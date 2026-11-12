"""Account provisioning: one place that creates the Firebase user and the Django user."""
from django.contrib.auth import get_user_model
from django.db import transaction
from firebase_admin import auth as fb_auth

from core.firebase import require_credentials
from core.phone import normalize_tz_phone, phone_login_email

from .models import CustomerProfile

User = get_user_model()


@transaction.atomic
def create_account(*, password, role, phone=None, email=None, display_name=''):
    """Create (or link) the Firebase Auth user and the matching Agiza user.

    Phone accounts sign in with an internal email derived from the phone number,
    so the app can offer "phone + password" without SMS.
    """
    if not phone and not email:
        raise ValueError('A phone number or an email is required.')
    e164 = normalize_tz_phone(phone) if phone else None
    login_email = (email or phone_login_email(e164)).lower()

    app = require_credentials()
    try:
        fb_user = fb_auth.get_user_by_email(login_email, app=app)
        fb_auth.update_user(fb_user.uid, password=password, app=app)
    except fb_auth.UserNotFoundError:
        fb_user = fb_auth.create_user(
            email=login_email,
            password=password,
            display_name=display_name or None,
            app=app,
        )

    user, _ = User.objects.update_or_create(
        firebase_uid=fb_user.uid,
        defaults={
            'username': e164 or login_email,
            'email': email.lower() if email else '',
            'phone': e164,
            'role': role,
            'display_name': display_name,
        },
    )
    user.set_unusable_password()  # passwords live in Firebase only
    user.save()
    if role == User.Role.CUSTOMER:
        CustomerProfile.objects.get_or_create(user=user)
    elif role == User.Role.RIDER:
        from riders.models import RiderProfile
        RiderProfile.objects.get_or_create(user=user)
    from .claims import sync_claims
    sync_claims(user)
    return user
