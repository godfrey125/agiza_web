from django.contrib import admin

from .models import DeliveryPolicy, MenuCategory, MenuItem, Review, VendorCategory, VendorProfile, VendorStaff


class DeliveryPolicyInline(admin.StackedInline):
    model = DeliveryPolicy
    can_delete = False


class MenuItemInline(admin.TabularInline):
    model = MenuItem
    extra = 0
    fields = ('name', 'category', 'price', 'availability_status', 'is_archived')


@admin.register(VendorProfile)
class VendorProfileAdmin(admin.ModelAdmin):
    list_display = ('business_name', 'business_type', 'phone', 'is_approved', 'is_online', 'rating_avg')
    list_filter = ('is_approved', 'is_online', 'business_type', 'categories')
    search_fields = ('business_name', 'phone', 'owner__phone')
    inlines = [DeliveryPolicyInline, MenuItemInline]
    actions = ['approve']

    @admin.action(description='Approve selected vendors')
    def approve(self, request, queryset):
        queryset.update(is_approved=True)


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor', 'price', 'availability_status', 'is_archived')
    list_filter = ('availability_status', 'is_archived')
    search_fields = ('name', 'vendor__business_name')


admin.site.register(VendorCategory)
admin.site.register(VendorStaff)
admin.site.register(MenuCategory)
admin.site.register(Review)
