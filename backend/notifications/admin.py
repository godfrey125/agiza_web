from django.contrib import admin

from .models import DeviceToken, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'event', 'title', 'push_sent_count', 'push_error', 'created_at')
    list_filter = ('event',)
    search_fields = ('user__phone', 'dedupe_key')


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'platform', 'last_seen_at', 'failure_count')
    exclude = ('token',)
