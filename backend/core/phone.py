"""Tanzanian phone-number helpers shared by auth and account creation."""
import re

from django.conf import settings


class InvalidPhone(ValueError):
    pass


def normalize_tz_phone(raw):
    """Return the number in E.164 form, e.g. '0635672667' → '+255635672667'."""
    digits = re.sub(r'\D', '', raw or '')
    if digits.startswith('255') and len(digits) == 12:
        local = digits[3:]
    elif digits.startswith('0') and len(digits) == 10:
        local = digits[1:]
    elif len(digits) == 9:
        local = digits
    else:
        raise InvalidPhone(f'Not a valid Tanzanian phone number: {raw!r}')
    if local[0] not in '67':
        raise InvalidPhone(f'Not a valid Tanzanian mobile number: {raw!r}')
    return f'+255{local}'


def phone_login_email(phone):
    """The internal email used for phone + password sign-in in Firebase Auth.

    Must stay identical to `phoneLoginEmail()` in the Flutter app.
    """
    e164 = normalize_tz_phone(phone)
    return f'{e164[1:]}@{settings.PHONE_LOGIN_EMAIL_DOMAIN}'
