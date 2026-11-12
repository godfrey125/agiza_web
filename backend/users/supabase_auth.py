"""Supabase identity bridge.

Google/email sign-in happens in Supabase (free tier). The website and app send
the resulting Supabase access token here; we verify it against the project's
public JWKS, map it to an Agiza account, and issue the normal Django JWT pair.
That keeps every existing API endpoint and role rule unchanged.
"""
import json
import logging
import ssl
import time
import uuid
from urllib.request import urlopen

import certifi
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .access import account_access_error
from .web_auth import WebUserSerializer, _tokens_for, normalize_phone

User = get_user_model()
log = logging.getLogger('agiza.auth')

_jwks_cache = {'fetched': 0.0, 'keys': None}
JWKS_TTL_SECONDS = 300


def _supabase_jwks(force=False):
    """Fetch the project's public signing keys, with a short in-process cache.

    The standard `PyJWKClient` uses urllib's default SSL context, which on
    python.org macOS builds cannot find the system CA bundle. Using certifi
    keeps verification working locally and in production.
    """
    now = time.time()
    if not force and _jwks_cache['keys'] is not None and now - _jwks_cache['fetched'] < JWKS_TTL_SECONDS:
        return _jwks_cache['keys']

    url = f'{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json'
    context = ssl.create_default_context(cafile=certifi.where())
    with urlopen(url, timeout=10, context=context) as response:
        data = json.load(response)
    keys = jwt.PyJWKSet.from_dict(data)
    _jwks_cache.update(fetched=now, keys=keys)
    return keys


def _signing_key(token, force=False):
    header = jwt.get_unverified_header(token)
    kid = header.get('kid')
    keys = _supabase_jwks(force=force)
    for key in keys.keys:
        if not kid or key.key_id == kid:
            return key.key
    if not force:
        return _signing_key(token, force=True)
    raise ValueError('No matching Supabase signing key.')


def verify_supabase_token(token):
    """Return the verified claims for a Supabase access token.

    Supabase projects created after 2025 sign access tokens with ES256 and
    publish the public key at `/auth/v1/.well-known/jwks.json`. Older projects
    may still use HS256; those are verified with the shared JWT secret when it
    is configured.
    """
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise ValueError('Malformed Supabase token.') from exc

    algorithm = (header.get('alg') or '').upper()
    if algorithm == 'HS256':
        secret = getattr(settings, 'SUPABASE_JWT_SECRET', '')
        if not secret:
            raise ValueError('Supabase HS256 tokens are not configured.')
        key = secret
    else:
        try:
            key = _signing_key(token)
        except Exception as exc:
            log.warning('Supabase JWKS lookup failed: %s', exc)
            raise ValueError('Unable to verify the Supabase token.') from exc

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[algorithm or 'ES256'],
            audience=settings.SUPABASE_JWT_AUDIENCE,
            issuer=f'{settings.SUPABASE_URL}/auth/v1',
            options={'verify_iat': False},
        )
    except jwt.InvalidTokenError as exc:
        raise ValueError('Invalid or expired Supabase token.') from exc


def _unique_username(email, sub):
    base = (email or f'supabase_{str(sub)[:12]}').strip()[:150]
    candidate = base
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        suffix += 1
        candidate = f'{base[:140]}_{suffix}'
    return candidate


def _phone_or_none(value):
    if not value:
        return None
    try:
        phone = normalize_phone(value)
    except Exception:
        return None
    if User.objects.filter(phone=phone).exists():
        return None
    return phone


def _is_platform_admin(email):
    return bool(email) and email.strip().lower() == (settings.PLATFORM_ADMIN_EMAIL or '').strip().lower()


class SupabaseExchangeSerializer(serializers.Serializer):
    access_token = serializers.CharField(trim_whitespace=False)


@api_view(['POST'])
@permission_classes([AllowAny])
def supabase_exchange(request):
    """Exchange a Supabase access token for an Agiza JWT pair."""
    serializer = SupabaseExchangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token = serializer.validated_data['access_token']

    try:
        claims = verify_supabase_token(token)
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

    sub_raw = claims.get('sub')
    try:
        sub = uuid.UUID(str(sub_raw))
    except (TypeError, ValueError):
        return Response(
            {'detail': 'Supabase token has no valid subject.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    email = (claims.get('email') or '').strip().lower()
    phone_claim = claims.get('phone') or ''
    metadata = claims.get('user_metadata') or {}

    user = User.objects.filter(supabase_uid=sub).first()
    if user is None and email:
        user = User.objects.filter(email__iexact=email).order_by('id').first()
    if user is None and phone_claim:
        try:
            normalized = normalize_phone(phone_claim)
        except Exception:
            normalized = ''
        if normalized:
            user = User.objects.filter(phone=normalized).first()

    if user is None:
        if not settings.SUPABASE_AUTO_PROVISION:
            return Response(
                {'detail': 'No Agiza account is linked to this sign-in.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        display_name = (
            metadata.get('full_name')
            or metadata.get('name')
            or metadata.get('user_name')
            or ''
        )
        is_admin = _is_platform_admin(email)
        user = User(
            username=_unique_username(email, sub),
            email=email,
            phone=_phone_or_none(phone_claim),
            display_name=display_name[:120],
            photo_url=(metadata.get('avatar_url') or metadata.get('picture') or '')[:500],
            supabase_uid=sub,
            role=User.Role.ADMIN if is_admin else User.Role.CUSTOMER,
            staff_role=User.StaffRole.SUPER_ADMIN if is_admin else User.StaffRole.NONE,
            is_staff=is_admin,
        )
        user.set_unusable_password()
        user.save()

    updates = []
    if user.supabase_uid != sub:
        user.supabase_uid = sub
        updates.append('supabase_uid')
    if _is_platform_admin(email) and (user.role != User.Role.ADMIN or not user.is_staff):
        user.role = User.Role.ADMIN
        user.is_staff = True
        if user.staff_role == User.StaffRole.NONE:
            user.staff_role = User.StaffRole.SUPER_ADMIN
        updates += ['role', 'is_staff', 'staff_role']
    if not user.display_name and metadata.get('full_name'):
        user.display_name = str(metadata['full_name'])[:120]
        updates.append('display_name')
    if not user.photo_url and (metadata.get('avatar_url') or metadata.get('picture')):
        user.photo_url = str(metadata.get('avatar_url') or metadata.get('picture'))[:500]
        updates.append('photo_url')
    if updates:
        user.save(update_fields=updates)

    user.refresh_suspension()
    blocked_reason = account_access_error(user)
    if blocked_reason:
        return Response(
            {'detail': blocked_reason, 'account_state': user.account_state},
            status=status.HTTP_403_FORBIDDEN,
        )

    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])
    return Response(
        {'tokens': _tokens_for(user), 'user': WebUserSerializer(user).data},
        status=status.HTTP_200_OK,
    )
