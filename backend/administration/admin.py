from django.contrib import admin

from .models import AccountAction, AccountAppeal, AdminAuditLog


@admin.register(AccountAction)
class AccountActionAdmin(admin.ModelAdmin):
    list_display = ('target', 'action', 'violation_category', 'actor', 'created_at')
    list_filter = ('action', 'violation_category')
    search_fields = ('target__display_name', 'target__phone', 'reason')
    readonly_fields = ('created_at', 'updated_at')

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AccountAppeal)
class AccountAppealAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'action', 'reviewed_by', 'created_at')
    list_filter = ('status',)
    search_fields = ('user__display_name', 'user__phone', 'message')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'actor_label', 'target_type', 'target_label', 'created_at')
    list_filter = ('action', 'target_type')
    search_fields = ('actor_label', 'target_label', 'action', 'reason')
    readonly_fields = (
        'actor', 'actor_label', 'action', 'target_type', 'target_id', 'target_label',
        'reason', 'previous_values', 'new_values', 'request_metadata', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
