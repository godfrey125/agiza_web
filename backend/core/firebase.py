"""Lazy Firebase Admin SDK initialisation.

Token verification only needs the project id. Everything privileged
(FCM, Firestore/RTDB writes, creating users) needs FIREBASE_CREDENTIALS.
"""
import logging
import threading

import firebase_admin
from django.conf import settings
from firebase_admin import credentials

log = logging.getLogger('agiza.firebase')
_lock = threading.Lock()


class FirebaseNotConfigured(RuntimeError):
    pass


def has_credentials():
    return bool(settings.FIREBASE_CREDENTIALS)


def get_app():
    with _lock:
        try:
            return firebase_admin.get_app()
        except ValueError:
            pass
        options = {
            'projectId': settings.FIREBASE_PROJECT_ID,
            'databaseURL': settings.FIREBASE_DATABASE_URL,
            'storageBucket': settings.FIREBASE_STORAGE_BUCKET,
        }
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS) if has_credentials() else None
        if cred is None:
            log.warning('FIREBASE_CREDENTIALS not set: only ID-token verification is available.')
        return firebase_admin.initialize_app(cred, options)


def require_credentials():
    if not has_credentials():
        raise FirebaseNotConfigured(
            'Set FIREBASE_CREDENTIALS to a service-account JSON to use this feature.'
        )
    return get_app()
