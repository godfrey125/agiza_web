from django.contrib import admin

from .models import ApplicationAttachment, ApplicationRequirement, PartnerApplication


class AttachmentInline(admin.TabularInline):
    model = ApplicationAttachment
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(PartnerApplication)
class PartnerApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'reference',
        'application_type',
        'applicant_name',
        'status',
        'created_at',
        'decided_at',
    )
    list_filter = ('application_type', 'status')
    search_fields = ('reference', 'applicant_name', 'applicant_phone', 'applicant_email')
    readonly_fields = ('reference', 'created_at', 'updated_at')
    inlines = [AttachmentInline]


@admin.register(ApplicationRequirement)
class ApplicationRequirementAdmin(admin.ModelAdmin):
    list_display = ('application_type', 'code', 'label', 'category', 'mandatory', 'sort_order')
    list_filter = ('application_type', 'category', 'mandatory')
