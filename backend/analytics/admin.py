from django.contrib import admin

from .models import PageVisit


@admin.register(PageVisit)
class PageVisitAdmin(admin.ModelAdmin):
    list_display = (
        'path',
        'visitor_id',
        'user',
        'device_type',
        'browser',
        'is_bot',
        'is_staff',
        'created_at',
    )
    list_filter = ('device_type', 'browser', 'is_bot', 'is_staff', 'created_at')
    search_fields = (
        'path',
        'visitor_id',
        'session_id',
        'user__username',
        'referrer_host',
    )
    readonly_fields = (
        'visit_id',
        'visitor_id',
        'session_id',
        'path',
        'full_path',
        'referrer',
        'referrer_host',
        'user',
        'user_agent',
        'device_type',
        'browser',
        'operating_system',
        'language',
        'is_bot',
        'is_staff',
        'created_at',
    )
