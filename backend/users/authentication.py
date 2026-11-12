"""DRF authentication backed by Firebase ID tokens.

The app signs in with Firebase Auth and sends `Authorization: Bearer <ID token>`.
Accounts are created ahead of time (website / admin / `create_account` command);
an unknown Firebase user is rejected rather than silently created.
"""
import logging

from django.contrib.auth import get_user_model
from firebase_admin import auth as fb_auth
from rest_framework import authentication, exceptions
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from core.firebase import get_app

from .access import account_access_error

log = logging.getLogger('agiza.auth')
User = get_user_model()


def verify_id_token(token):
    """Separate function so tests can patch it."""
    return fb_auth.verify_id_token(token, app=get_app(), clock_skew_seconds=10)


class FirebaseAuthentication(authentication.BaseAuthentication):
    keyword = 'Bearer'

    def authenticate_header(self, request):
        return self.keyword

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode('utf-8', 'ignore')
        if not header.startswith(f'{self.keyword} '):
            return None
        token = header[len(self.keyword) + 1:].strip()
        if not token:
            raise exceptions.AuthenticationFailed('Empty token.')
        try:
            claims = verify_id_token(token)
        except (fb_auth.ExpiredIdTokenError, fb_auth.RevokedIdTokenError):
            raise exceptions.AuthenticationFailed('Session expired. Please sign in again.', code='token_expired')
        except (ValueError, fb_auth.InvalidIdTokenError) as exc:
            log.info('Rejected Firebase token: %s', exc)
            raise exceptions.AuthenticationFailed('Invalid sign-in token.', code='token_invalid')

        user = self._resolve_user(claims)
        reason = account_access_error(user)
        if reason:
            raise exceptions.AuthenticationFailed(reason, code='account_blocked')
        return user, claims

    @staticmethod
    def _resolve_user(claims):
        uid = claims['uid']
        user = User.objects.filter(firebase_uid=uid).first()
        if user:
            return user
        # Link an account created before its Firebase user existed (matched by verified email).
        email = (claims.get('email') or '').lower()
        if email:
            user = User.objects.filter(email__iexact=email, firebase_uid__isnull=True).first()
            if user:
                user.firebase_uid = uid
                user.save(update_fields=['firebase_uid'])
                return user
        raise exceptions.AuthenticationFailed(
            'No Agiza account is registered for this login. Register on the Agiza website first.',
            code='account_not_registered',
        )


class AgizaAuthentication(authentication.BaseAuthentication):
    """Accept website JWTs and Flutter app Firebase ID tokens on the same API."""

    keyword = 'Bearer'

    def authenticate_header(self, request):
        return self.keyword

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode('utf-8', 'ignore')
        if not header.startswith(f'{self.keyword} '):
            return None

        jwt_auth = JWTAuthentication()
        try:
            result = jwt_auth.authenticate(request)
            if result is not None:
                user, token = result
                if int(token.get('account_epoch', 0)) != int(user.auth_epoch or 0):
                    raise AuthenticationFailed(
                        'This session has been revoked. Please sign in again.',
                        code='session_revoked',
                    )
                reason = account_access_error(user)
                if reason:
                    raise AuthenticationFailed(reason, code='account_blocked')
                return result
        except AuthenticationFailed as exc:
            code = getattr(getattr(exc, 'detail', None), 'code', None)
            if code in ('session_revoked', 'account_blocked'):
                raise
        except (InvalidToken, TokenError):
            pass
        except Exception:  # pragma: no cover - defensive fallback
            pass

        return FirebaseAuthentication().authenticate(request)
