from rest_framework.exceptions import PermissionDenied

from .models import VendorProfile, VendorStaff


def vendor_for_user(user):
    """The vendor a user owns or works for, or None."""
    if not user.is_authenticated:
        return None
    vendor = VendorProfile.objects.filter(owner=user).first()
    if vendor:
        return vendor
    staff = VendorStaff.objects.select_related('vendor').filter(user=user, is_active=True).first()
    return staff.vendor if staff else None


def require_vendor(user):
    vendor = vendor_for_user(user)
    if vendor is None:
        raise PermissionDenied('This action is only for vendor accounts.')
    return vendor
