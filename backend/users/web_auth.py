"""Website phone-OTP authentication.

The Flutter app uses Firebase Auth. The public website uses the Django phone
OTP + SimpleJWT contract documented in the website README. These endpoints sit
alongside the Firebase-backed app API and do not change it.

OTP delivery is intentionally not faked. In DEBUG the code is returned as
`dev_otp`. Outside DEBUG, set `OTP_SMS_WEBHOOK_URL` to a trusted SMS relay that
accepts `{"phone": "+255...", "otp": "123456", "message": "..."}`. If no relay is
configured, the endpoint refuses the request instead of claiming an SMS was sent.
"""
import json
import logging
import re
import secrets
import string
from urllib import error as urlerror
from urllib import request as urlrequest

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework import generics, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .access import account_access_error

User = get_user_model()
log = logging.getLogger('agiza.auth')

OTP_TIMEOUT_SECONDS = 300
OTP_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


def normalize_phone(value):
    digits = re.sub(r'\D', '', value or '')
    if len(digits) == 12 and digits.startswith('255'):
        return f'+{digits}'
    if len(digits) == 10 and digits.startswith('0'):
        return f'+255{digits[1:]}'
    if len(digits) == 9 and digits[0] in '67':
        return f'+255{digits}'
    if 10 <= len(digits) <= 15:
        return f'+{digits}'
    raise serializers.ValidationError('Enter a valid phone number.')


def _deliver_otp(phone, otp):
    """Send the OTP through the configured relay. Return True on success."""
    url = getattr(settings, 'OTP_SMS_WEBHOOK_URL', '').strip()
    if not url:
        return False

    body = json.dumps(
        {
            'phone': phone,
            'otp': otp,
            'message': (
                f'Your Agiza verification code is {otp}. '
                f'It expires in {OTP_TIMEOUT_SECONDS // 60} minutes.'
            ),
        }
    ).encode('utf-8')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    token = getattr(settings, 'OTP_SMS_WEBHOOK_TOKEN', '').strip()
    if token:
        headers['Authorization'] = f'Bearer {token}'

    req = urlrequest.Request(url, data=body, headers=headers, method='POST')
    try:
        with urlrequest.urlopen(req, timeout=10) as response:
            return 200 <= response.status < 300
    except (urlerror.HTTPError, urlerror.URLError, TimeoutError, OSError):
        log.exception('OTP delivery failed for %s', phone)
        return False


class WebUserSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(source='date_joined', read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'phone',
            'role',
            'staff_role',
            'account_state',
            'account_state_reason',
            'suspended_until',
            'restriction_flags',
            'risk_level',
            'login_disabled',
            'is_active',
            'created_at',
        )
        read_only_fields = (
            'id', 'email', 'role', 'staff_role', 'account_state', 'account_state_reason',
            'suspended_until', 'restriction_flags', 'risk_level', 'login_disabled',
            'is_active', 'created_at', 'phone',
        )

    def get_role(self, obj):
        return (obj.role or '').lower()


class OTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)

    def validate_phone(self, value):
        return normalize_phone(value)


class OTPVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    otp = serializers.RegexField(r'^\d{6}$')

    def validate_phone(self, value):
        return normalize_phone(value)


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    # `auth_epoch` lets administrators revoke every existing website session.
    refresh['account_epoch'] = int(user.auth_epoch or 0)
    refresh.access_token['account_epoch'] = int(user.auth_epoch or 0)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


class WebTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh tokens must still belong to a usable account."""

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh'])
        except Exception:
            return super().validate(attrs)
        user_id = refresh.get(jwt_settings.USER_ID_CLAIM)
        user = User.objects.filter(**{jwt_settings.USER_ID_FIELD: user_id}).first()
        if user:
            if int(refresh.get('account_epoch', 0)) != int(user.auth_epoch or 0):
                raise AuthenticationFailed(
                    'This session has been revoked. Please sign in again.',
                    code='session_revoked',
                )
            reason = account_access_error(user)
            if reason:
                raise AuthenticationFailed(reason, code='account_blocked')
        return super().validate(attrs)


class WebTokenRefreshView(TokenRefreshView):
    serializer_class = WebTokenRefreshSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def request_otp(request):
    serializer = OTPRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = serializer.validated_data['phone']

    cooldown_key = f'web_otp_cooldown_{phone}'
    if cache.get(cooldown_key):
        return Response(
            {
                'detail': 'Please wait before requesting another code.',
                'retry_after': OTP_COOLDOWN_SECONDS,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    otp = ''.join(secrets.choice(string.digits) for _ in range(6))

    if not settings.DEBUG and not _deliver_otp(phone, otp):
        return Response(
            {'detail': 'OTP delivery is not configured. Please contact support.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if settings.DEBUG and getattr(settings, 'OTP_SMS_WEBHOOK_URL', '').strip():
        _deliver_otp(phone, otp)

    cache.set(f'web_otp_{phone}', otp, timeout=OTP_TIMEOUT_SECONDS)
    cache.set(cooldown_key, '1', timeout=OTP_COOLDOWN_SECONDS)
    cache.delete(f'web_otp_attempts_{phone}')

    payload = {'message': 'OTP sent. Check your phone.'}
    if settings.DEBUG:
        payload['dev_otp'] = otp
    return Response(payload, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    serializer = OTPVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = serializer.validated_data['phone']
    otp = serializer.validated_data['otp']

    otp_key = f'web_otp_{phone}'
    attempts_key = f'web_otp_attempts_{phone}'
    expected = cache.get(otp_key)
    if not expected:
        return Response(
            {'detail': 'Incorrect or expired OTP.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not constant_time_compare(str(expected), otp):
        attempts = cache.get(attempts_key, 0) + 1
        if attempts >= OTP_MAX_ATTEMPTS:
            cache.delete(otp_key)
            cache.delete(attempts_key)
            return Response(
                {'detail': 'Too many incorrect attempts. Request a new code.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        cache.set(attempts_key, attempts, timeout=OTP_TIMEOUT_SECONDS)
        return Response(
            {'detail': 'Incorrect or expired OTP.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cache.delete(otp_key)
    cache.delete(attempts_key)

    user, created = User.objects.get_or_create(
        phone=phone,
        defaults={'username': phone, 'role': User.Role.CUSTOMER},
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=['password'])
    user.refresh_suspension()
    blocked_reason = account_access_error(user)
    if blocked_reason:
        return Response(
            {'detail': blocked_reason, 'account_state': user.account_state},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response(
        {
            'tokens': _tokens_for(user),
            'user': WebUserSerializer(user).data,
            'is_new_user': created,
        },
        status=status.HTTP_200_OK,
    )


class WebMeView(generics.RetrieveUpdateAPIView):
    serializer_class = WebUserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class PasswordLoginSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=254)
    password = serializers.CharField(max_length=128, trim_whitespace=False)

    def validate_phone(self, value):
        value = (value or '').strip()
        # Staff may sign in with an email address instead of a phone number.
        if '@' in value:
            return value.lower()
        return normalize_phone(value)


PASSWORD_MAX_ATTEMPTS = 6
PASSWORD_LOCK_SECONDS = 600


@api_view(['POST'])
@permission_classes([AllowAny])
def password_login(request):
    """Phone + password sign-in, issuing the same JWT pair as the OTP flow.

    Used by the app when Firebase Auth is unavailable. Accounts created through
    the OTP flow have an unusable password and cannot use this endpoint.
    """
    serializer = PasswordLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = serializer.validated_data['phone']
    password = serializer.validated_data['password']

    attempts_key = f'web_password_attempts_{phone}'
    attempts = cache.get(attempts_key, 0)
    if attempts >= PASSWORD_MAX_ATTEMPTS:
        return Response(
            {'detail': 'Too many sign-in attempts. Try again in 10 minutes.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if '@' in phone:
        user = User.objects.filter(email__iexact=phone).first()
    else:
        user = User.objects.filter(phone=phone).first()
    if user is None or not user.has_usable_password() or not user.check_password(password):
        cache.set(attempts_key, attempts + 1, timeout=PASSWORD_LOCK_SECONDS)
        return Response(
            {'detail': 'Incorrect phone number or password.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cache.delete(attempts_key)
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
        {
            'tokens': _tokens_for(user),
            'user': WebUserSerializer(user).data,
        },
        status=status.HTTP_200_OK,
    )
