"""Server-side role-based access control for the Agiza control center.

Frontend visibility is only a convenience. Every endpoint that changes state
declares a permission here and DRF enforces it against the signed-in user.
"""
from rest_framework.permissions import BasePermission

from users.models import User

ALL = '*'


def _permissions_for(role):
    """Permission matrix for each staff role."""
    matrix = {
        User.StaffRole.SUPER_ADMIN: {ALL},
        User.StaffRole.OPERATIONS_MANAGER: {
            'users.view', 'users.warn', 'users.suspend', 'users.restrict',
            'users.restore', 'users.request_verification', 'users.investigate',
            'orders.view', 'disputes.view', 'applications.view',
            'reports.view', 'risk.view',
        },
        User.StaffRole.VERIFICATION_OFFICER: {
            'users.view', 'users.request_verification', 'applications.view',
            'applications.decide', 'documents.view', 'reports.view',
        },
        User.StaffRole.FINANCE_OFFICER: {
            'users.view', 'finance.view', 'reports.view',
        },
        User.StaffRole.CUSTOMER_SUPPORT: {
            'users.view', 'users.warn', 'users.restore', 'users.investigate',
            'appeals.view', 'appeals.decide', 'disputes.view', 'reports.view',
        },
        User.StaffRole.TRUST_SAFETY_OFFICER: {
            'users.view', 'users.warn', 'users.suspend', 'users.restrict',
            'users.disable_login', 'users.revoke_sessions', 'users.investigate',
            'users.request_verification', 'users.restore', 'appeals.view',
            'appeals.decide', 'risk.view', 'risk.manage', 'audit.view',
            'reports.view',
        },
        User.StaffRole.CONTENT_MANAGER: {
            'content.view', 'content.edit', 'users.view', 'reports.view',
        },
    }
    return matrix.get(role, set())


def permissions_for_user(user):
    if not user or not user.is_authenticated:
        return set()
    if not user.is_active or user.login_disabled:
        return set()
    if user.account_state in (User.AccountState.TERMINATED, User.AccountState.TEMPORARILY_SUSPENDED):
        return set()
    if user.is_superuser:
        return {ALL}
    if user.role != User.Role.ADMIN and not user.is_staff:
        return set()
    return _permissions_for(user.staff_role)


def has_permission(user, permission):
    perms = permissions_for_user(user)
    return ALL in perms or permission in perms


def is_control_center_user(user):
    if not user or not user.is_authenticated:
        return False
    if not (user.is_staff or user.role == User.Role.ADMIN):
        return False
    return bool(permissions_for_user(user))


class HasAdminPermission(BasePermission):
    """Require one or more permissions declared on the view."""

    message = 'You do not have permission to perform this action.'

    def has_permission(self, request, view):
        required = getattr(view, 'required_permissions', ())
        if isinstance(required, str):
            required = (required,)
        if not required:
            return is_control_center_user(request.user)
        mode = getattr(view, 'permission_mode', 'all')
        perms = permissions_for_user(request.user)
        if ALL in perms:
            return True
        if mode == 'any':
            return any(permission in perms for permission in required)
        return all(permission in perms for permission in required)
