from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Address, CustomerProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'username', 'display_name', 'phone', 'email', 'role', 'staff_role',
        'account_state', 'risk_level', 'is_active',
    )
    list_filter = ('role', 'staff_role', 'account_state', 'risk_level', 'is_active', 'is_staff')
    search_fields = ('username', 'phone', 'email', 'display_name', 'firebase_uid')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Agiza', {'fields': ('firebase_uid', 'phone', 'role', 'display_name', 'photo_url', 'preferred_language')}),
        ('Control centre', {'fields': (
            'staff_role', 'account_state', 'account_state_reason', 'account_state_updated_at',
            'account_state_updated_by', 'suspended_until', 'restriction_flags',
            'login_disabled', 'risk_level', 'risk_score', 'auth_epoch',
        )}),
    )


admin.site.register(CustomerProfile)
admin.site.register(Address)
