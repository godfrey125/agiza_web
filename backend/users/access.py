"""Account-state enforcement shared by website and app authentication.

The database is the source of truth. A blocked account cannot keep using an
old JWT: the authentication layer re-checks the account on every request. For
Firebase sessions we also attempt a Firebase refresh-token revocation (best
effort, only when service-account credentials are configured).
"""
import logging

from django.utils import timezone

log = logging.getLogger('agiza.access')


def account_access_error(user):
    """Return a human-readable reason when the account may not sign in."""
    if user is None:
        return 'Account not found.'
    user.refresh_suspension()

    if not user.is_active:
        return 'This account is disabled.'
    if user.login_disabled:
        return 'Sign-in has been disabled for this account.'
    if user.account_state == user.AccountState.TERMINATED:
        return 'This account has been permanently terminated.'
    if user.account_state == user.AccountState.TEMPORARILY_SUSPENDED:
        until = user.suspended_until
        if until and until > timezone.now():
            return (
                'This account is temporarily suspended until '
                f'{timezone.localtime(until).strftime("%d %b %Y, %H:%M")}.'
            )
        user.refresh_suspension()
    if user.account_state == user.AccountState.REJECTED:
        return 'This account application was rejected.'
    return None


def account_is_usable(user):
    return account_access_error(user) is None


def revoke_firebase_sessions(user):
    """Best-effort revocation of Firebase refresh tokens for app sessions."""
    if not user.firebase_uid:
        return False, 'No Firebase identity is linked to this account.'
    try:
        from firebase_admin import auth as fb_auth

        from core.firebase import get_app, has_credentials

        if not has_credentials():
            return False, 'Firebase credentials are not configured.'
        fb_auth.revoke_refresh_tokens(user.firebase_uid, app=get_app())
        return True, 'Firebase sessions revoked.'
    except Exception as exc:  # pragma: no cover - depends on external service
        log.warning('Firebase session revocation failed for user %s: %s', user.pk, exc)
        return False, 'Firebase session revocation could not be completed.'
