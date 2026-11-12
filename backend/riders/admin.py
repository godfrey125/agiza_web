from django.contrib import admin

from .models import DeliveryJob, RiderProfile


@admin.register(RiderProfile)
class RiderProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle_type', 'is_approved', 'is_online', 'total_deliveries')
    list_filter = ('is_approved', 'is_online', 'vehicle_type')
    actions = ['approve']

    @admin.action(description='Approve selected riders')
    def approve(self, request, queryset):
        queryset.update(is_approved=True)


@admin.register(DeliveryJob)
class DeliveryJobAdmin(admin.ModelAdmin):
    list_display = ('order', 'status', 'rider', 'delivery_fee', 'created_at')
    list_filter = ('status',)
