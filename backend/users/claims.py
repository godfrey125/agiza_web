"""Firebase custom claims mirrored from Django (role, vendor_id).

Storage/Firestore rules use them, e.g. only `vendor_id == 12` may write `vendors/12/**`.
Django stays the authority; claims are refreshed whenever role/vendor membership changes.
The app must force-refresh its ID token after a change (`getIdToken(true)`).
"""
import logging

from django.db import transaction

from core.firebase import has_credentials, require_credentials

log = logging.getLogger('agiza.claims')


def claims_for(user):
    from vendors.access import vendor_for_user
    vendor = vendor_for_user(user)
    claims = {'role': user.role}
    if vendor:
        claims['vendor_id'] = str(vendor.pk)
    return claims


def sync_claims(user):
    if not user.firebase_uid:
        return
    def _push():
        if not has_credentials():
            log.info('Skipping custom claims for user %s (no credentials).', user.pk)
            return
        from firebase_admin import auth
        try:
            auth.set_custom_user_claims(user.firebase_uid, claims_for(user), app=require_credentials())
        except Exception as exc:
            log.warning('Could not set claims for %s: %s', user.pk, exc)
    transaction.on_commit(_push)
