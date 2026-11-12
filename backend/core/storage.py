"""Validation for files uploaded by the app to Firebase Storage.

The app uploads directly to Storage (rules restrict each user to their own
folder) and then tells Django the object path + download URL. Django only
accepts URLs that point at our bucket and at the caller's own folder, so a
client cannot attach someone else's (or a random internet) image.
"""
from urllib.parse import quote

from django.conf import settings
from rest_framework import serializers


def vendor_folder(vendor_id):
    return f'vendors/{vendor_id}/'


def user_folder(uid):
    return f'users/{uid}/'


def validate_storage_object(url, path, allowed_prefix):
    if not url and not path:
        return '', ''
    if not (url and path):
        raise serializers.ValidationError('Both image_url and image_path are required for an uploaded image.')
    if not path.startswith(allowed_prefix) or '..' in path:
        raise serializers.ValidationError('Image must be uploaded to your own Agiza folder.')
    bucket = settings.FIREBASE_STORAGE_BUCKET
    expected = f'https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{quote(path, safe="")}'
    if not url.startswith(expected):
        raise serializers.ValidationError('Image URL does not match the uploaded file.')
    return url, path
