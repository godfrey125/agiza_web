from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from orders.models import Order, OrderItem, OrderStatus, OrderStatusHistory
from payments.models import Payment
from riders.models import DeliveryJob, RiderProfile
from users.models import User
from vendors.models import MenuItem, Review, VendorProfile

from .models import (
    AccountAction,
    AccountAppeal,
    AdminAuditLog,
    AppealStatus,
    ActionType,
    ViolationCategory,
)


class AccountActionSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.name', read_only=True, default='System')
    action_label = serializers.CharField(source='get_action_display', read_only=True)
    category_label = serializers.CharField(source='get_violation_category_display', read_only=True)

    class Meta:
        model = AccountAction
        fields = (
            'id', 'target', 'actor', 'actor_name', 'action', 'action_label',
            'violation_category', 'category_label', 'reason', 'evidence',
            'internal_notes', 'duration_days', 'effective_until', 'previous_state',
            'new_state', 'restriction_flags', 'created_at',
        )
        read_only_fields = fields


class AdminUserListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    order_count = serializers.IntegerField(read_only=True, default=0)
    lifetime_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=0
    )
    violation_count = serializers.IntegerField(read_only=True, default=0)
    last_action_at = serializers.DateTimeField(read_only=True, allow_null=True, default=None)
    business_name = serializers.SerializerMethodField()
    vehicle_type = serializers.SerializerMethodField()
    is_suspended = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            'id', 'name', 'display_name', 'username', 'phone', 'email', 'role',
            'staff_role', 'account_state', 'account_state_reason', 'suspended_until',
            'restriction_flags', 'login_disabled', 'risk_level', 'risk_score',
            'is_active', 'is_staff', 'is_superuser', 'photo_url', 'date_joined',
            'last_login', 'order_count', 'lifetime_value', 'violation_count',
            'last_action_at', 'business_name', 'vehicle_type', 'is_suspended',
        )
        read_only_fields = fields

    def get_business_name(self, obj):
        vendor = getattr(obj, 'vendor_profile', None)
        return vendor.business_name if vendor else ''

    def get_vehicle_type(self, obj):
        rider = getattr(obj, 'rider_profile', None)
        return rider.get_vehicle_type_display() if rider else ''


class AdminUserDetailSerializer(AdminUserListSerializer):
    recent_actions = serializers.SerializerMethodField()
    appeals = serializers.SerializerMethodField()
    notification_count = serializers.SerializerMethodField()

    class Meta(AdminUserListSerializer.Meta):
        fields = AdminUserListSerializer.Meta.fields + (
            'recent_actions', 'appeals', 'notification_count',
        )
        read_only_fields = fields

    def get_recent_actions(self, obj):
        records = obj.account_actions.select_related('actor').order_by('-created_at')[:25]
        return AccountActionSerializer(records, many=True).data

    def get_appeals(self, obj):
        return [
            {
                'id': appeal.pk,
                'status': appeal.status,
                'message': appeal.message,
                'decision_reason': appeal.decision_reason,
                'created_at': appeal.created_at,
                'reviewed_at': appeal.reviewed_at,
            }
            for appeal in obj.account_appeals.order_by('-created_at')[:10]
        ]

    def get_notification_count(self, obj):
        return obj.notifications.count()


class ApplyActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ActionType.choices)
    reason = serializers.CharField(allow_blank=True, max_length=4000)
    violation_category = serializers.ChoiceField(
        choices=ViolationCategory.choices, default=ViolationCategory.OTHER
    )
    evidence = serializers.CharField(allow_blank=True, max_length=8000, required=False)
    internal_notes = serializers.CharField(allow_blank=True, max_length=8000, required=False)
    duration_days = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=365)
    features = serializers.ListField(
        child=serializers.CharField(max_length=48), required=False, allow_empty=True
    )
    confirm = serializers.CharField(allow_blank=True, max_length=32, required=False)


class StaffRoleUpdateSerializer(serializers.Serializer):
    staff_role = serializers.ChoiceField(choices=User.StaffRole.choices)
    reason = serializers.CharField(min_length=5, max_length=2000)


class StaffUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    action_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = (
            'id', 'name', 'phone', 'email', 'role', 'staff_role', 'account_state',
            'is_active', 'is_staff', 'is_superuser', 'last_login', 'date_joined',
            'action_count',
        )
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.name', read_only=True, default='System')

    class Meta:
        model = AdminAuditLog
        fields = (
            'id', 'actor', 'actor_name', 'actor_label', 'action', 'target_type',
            'target_id', 'target_label', 'reason', 'previous_values',
            'new_values', 'request_metadata', 'created_at',
        )
        read_only_fields = fields


class AccountAppealSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.name', read_only=True, default='')
    action_label = serializers.CharField(source='action.get_action_display', read_only=True, default='')

    class Meta:
        model = AccountAppeal
        fields = (
            'id', 'user', 'user_name', 'action', 'action_label', 'message', 'status',
            'reviewed_by', 'reviewed_by_name', 'decision_reason', 'reviewed_at',
            'created_at',
        )
        read_only_fields = (
            'id', 'user', 'user_name', 'action', 'action_label', 'status',
            'reviewed_by', 'reviewed_by_name', 'decision_reason', 'reviewed_at',
            'created_at',
        )


class CreateAppealSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=20, max_length=4000)
    action_id = serializers.IntegerField(required=False, allow_null=True)


class PublicAppealSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    message = serializers.CharField(min_length=20, max_length=4000)


class DecideAppealSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            AppealStatus.UNDER_REVIEW,
            AppealStatus.APPROVED,
            AppealStatus.REJECTED,
        ]
    )
    decision_reason = serializers.CharField(min_length=5, max_length=4000)


class DashboardSummarySerializer(serializers.Serializer):
    """Documentation-only shape; the view builds the dict from live queries."""

    generated_at = serializers.DateTimeField()
    users = serializers.DictField()
    recent_actions = AccountActionSerializer(many=True)
    recent_audit = AuditLogSerializer(many=True)


def account_state_label(value):
    labels = dict(User.AccountState.choices)
    return labels.get(value, value)


def now_iso():
    return timezone.now().isoformat()


# ---------------------------------------------------------------------------
# Platform operations (orders, deliveries, vendors, food, payments)
# ---------------------------------------------------------------------------


class AdminOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            'id', 'menu_item_ref', 'name', 'description', 'image_url', 'unit_price',
            'quantity', 'discount', 'line_total', 'instructions',
        )
        read_only_fields = fields


class AdminOrderHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ('from_status', 'to_status', 'actor_role', 'note', 'created_at')
        read_only_fields = fields


class AdminDeliverySerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.code', read_only=True)
    rider_name = serializers.SerializerMethodField()
    rider_phone = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    rider_earning = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = DeliveryJob
        fields = (
            'id', 'order', 'order_code', 'status', 'status_label', 'rider', 'rider_name',
            'rider_phone', 'pickup_name', 'pickup_address', 'dropoff_address',
            'dropoff_landmark', 'distance_km', 'delivery_fee', 'rider_tip', 'rider_earning',
            'assigned_at', 'picked_up_at', 'delivered_at', 'created_at',
        )
        read_only_fields = fields

    def get_rider_name(self, obj):
        return obj.rider.user.name if obj.rider_id else ''

    def get_rider_phone(self, obj):
        return obj.rider.user.phone if obj.rider_id else ''


class AdminOrderListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    rider_name = serializers.SerializerMethodField()
    rider_phone = serializers.SerializerMethodField()
    item_count = serializers.IntegerField(read_only=True, default=0)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    order_type_label = serializers.CharField(source='get_order_type_display', read_only=True)
    payment_status_label = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )

    class Meta:
        model = Order
        fields = (
            'id', 'code', 'order_type', 'order_type_label', 'fulfillment_method',
            'status', 'status_label', 'customer', 'customer_name', 'customer_phone',
            'vendor', 'vendor_name', 'rider_name', 'rider_phone', 'item_count',
            'subtotal', 'discount_total', 'delivery_fee', 'rider_tip', 'total',
            'payment_method', 'payment_status', 'payment_status_label', 'created_at',
            'accepted_at', 'ready_at', 'finished_at',
        )
        read_only_fields = fields

    def get_rider_name(self, obj):
        job = getattr(obj, 'delivery_job', None)
        return job.rider.user.name if job and job.rider_id else ''

    def get_rider_phone(self, obj):
        job = getattr(obj, 'delivery_job', None)
        return job.rider.user.phone if job and job.rider_id else ''


class AdminOrderDetailSerializer(AdminOrderListSerializer):
    items = AdminOrderItemSerializer(many=True, read_only=True)
    history = AdminOrderHistorySerializer(source='status_history', many=True, read_only=True)
    delivery = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    vendor_phone = serializers.CharField(source='vendor.phone', read_only=True)
    vendor_address = serializers.CharField(source='vendor.address', read_only=True)

    class Meta(AdminOrderListSerializer.Meta):
        fields = AdminOrderListSerializer.Meta.fields + (
            'items', 'history', 'delivery', 'customer_email', 'vendor_phone',
            'vendor_address', 'delivery_address', 'delivery_landmark', 'customer_instructions',
            'is_free_delivery', 'estimated_ready_minutes', 'updated_at',
        )
        read_only_fields = fields

    def get_delivery(self, obj):
        job = getattr(obj, 'delivery_job', None)
        return AdminDeliverySerializer(job).data if job else None


class AdminRiderSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='user.name', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    account_state = serializers.CharField(source='user.account_state', read_only=True)
    vehicle_label = serializers.CharField(source='get_vehicle_type_display', read_only=True)
    active_jobs = serializers.IntegerField(read_only=True, default=0)
    completed_jobs = serializers.IntegerField(read_only=True, default=0)
    earnings = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=Decimal('0.00')
    )

    class Meta:
        model = RiderProfile
        fields = (
            'id', 'name', 'phone', 'email', 'account_state', 'vehicle_type', 'vehicle_label',
            'license_plate', 'is_approved', 'is_online', 'rating_avg', 'total_deliveries',
            'active_jobs', 'completed_jobs', 'earnings', 'last_latitude', 'last_longitude',
            'last_location_at', 'created_at',
        )
        read_only_fields = fields


class AdminVendorSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.name', read_only=True)
    owner_phone = serializers.CharField(source='owner.phone', read_only=True)
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    business_type_label = serializers.CharField(
        source='get_business_type_display', read_only=True
    )
    order_count = serializers.IntegerField(read_only=True, default=0)
    revenue = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=Decimal('0.00')
    )
    menu_item_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = VendorProfile
        fields = (
            'id', 'business_name', 'business_type', 'business_type_label', 'owner', 'owner_name',
            'owner_phone', 'owner_email', 'phone', 'address', 'landmark', 'is_approved',
            'is_online', 'rating_avg', 'rating_count', 'min_order_amount', 'order_count',
            'revenue', 'menu_item_count', 'profile_image_url', 'created_at',
        )
        read_only_fields = fields


class AdminMenuItemSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    category_name = serializers.SerializerMethodField()
    availability_label = serializers.CharField(
        source='get_availability_status_display', read_only=True
    )
    order_count = serializers.IntegerField(read_only=True, default=0)
    quantity_sold = serializers.IntegerField(read_only=True, default=0)
    revenue = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, default=Decimal('0.00')
    )

    class Meta:
        model = MenuItem
        fields = (
            'id', 'name', 'description', 'vendor', 'vendor_name', 'category', 'category_name',
            'price', 'image_url', 'availability_status', 'availability_label',
            'portions_available', 'preparation_minutes', 'is_archived', 'order_count',
            'quantity_sold', 'revenue', 'created_at', 'updated_at',
        )
        read_only_fields = fields

    def get_category_name(self, obj):
        return obj.category.name if obj.category_id else ''


class AdminReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    order_code = serializers.CharField(source='order.code', read_only=True)

    class Meta:
        model = Review
        fields = (
            'id', 'order', 'order_code', 'vendor', 'vendor_name', 'customer',
            'customer_name', 'rating', 'comment', 'created_at',
        )
        read_only_fields = fields


class AdminPaymentSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.code', read_only=True)
    payer_name = serializers.CharField(source='payer.name', read_only=True)
    payer_phone = serializers.CharField(source='payer.phone', read_only=True)
    method_label = serializers.CharField(source='get_method_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Payment
        fields = (
            'id', 'order', 'order_code', 'payer', 'payer_name', 'payer_phone', 'method',
            'method_label', 'amount', 'status', 'status_label', 'provider_reference',
            'confirmed_by', 'created_at', 'updated_at',
        )
        read_only_fields = fields


class PlatformOverviewSerializer(serializers.Serializer):
    """Documentation-only shape; the view builds the dict from live queries."""

    generated_at = serializers.DateTimeField()
    range_days = serializers.IntegerField()
    orders = serializers.DictField()
    riders = serializers.DictField()
    vendors = serializers.DictField()
    users = serializers.DictField()
    food = serializers.DictField()
    payments = serializers.DictField()
    daily = serializers.ListField()
    status_breakdown = serializers.ListField()
    recent_orders = AdminOrderListSerializer(many=True)
    top_vendors = serializers.ListField()
    top_items = serializers.ListField()
    top_riders = serializers.ListField()


ORDER_STATUS_LABELS = dict(OrderStatus.choices)
