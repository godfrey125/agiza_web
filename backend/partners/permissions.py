from django.conf import settings
from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """Staff account whose email matches PLATFORM_ADMIN_EMAIL.

    The product has a single platform administrator; when the setting is blank,
    any staff account is accepted (useful for local development).
    """

    message = 'Only the Agiza platform administrator can access this resource.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if not (user.is_staff or user.is_superuser or user.role == 'ADMIN'):
            return False
        allowed = (getattr(settings, 'PLATFORM_ADMIN_EMAIL', '') or '').strip().lower()
        if not allowed:
            return True
        return (user.email or '').strip().lower() == allowed
