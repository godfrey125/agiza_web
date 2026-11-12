from django.contrib import admin

from .models import (
    CancellationRecord, Cart, CustomFoodRequest, CustomRequestRecipient, Offer, Order, OrderItem, OrderStatusHistory,
)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = [f.name for f in OrderItem._meta.fields]
    can_delete = False


class HistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ('from_status', 'to_status', 'actor', 'actor_role', 'note', 'created_at')
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('code', 'order_type', 'fulfillment_method', 'status', 'vendor_name', 'customer', 'total', 'created_at')
    list_filter = ('order_type', 'fulfillment_method', 'status', 'payment_status')
    search_fields = ('code', 'vendor_name', 'customer__phone')
    inlines = [OrderItemInline, HistoryInline]
    readonly_fields = ('subtotal', 'delivery_fee', 'rider_tip', 'total', 'status')


@admin.register(CustomFoodRequest)
class CustomFoodRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'status', 'offers_deadline', 'created_at')
    list_filter = ('status',)


@admin.register(CancellationRecord)
class CancellationRecordAdmin(admin.ModelAdmin):
    list_display = ('kind', 'reason_code', 'actor_role', 'order', 'custom_request', 'created_at')
    list_filter = ('kind', 'reason_code')


admin.site.register(Offer)
admin.site.register(CustomRequestRecipient)
admin.site.register(Cart)
