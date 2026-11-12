"""Ordering engine models.

Three separate transaction types share the Order table but never share a
state machine (see `orders/state.py`):

* DINE_IN          — customer eats at the vendor.
* MENU_DELIVERY    — customer picks items from a vendor menu; delivery, vendor
                     delivery or pickup. Starts in PENDING_VENDOR_CONFIRMATION
                     and must be answered by the vendor within 60 seconds.
* CUSTOM_DELIVERY  — created only when a customer accepts an Offer on a
                     CustomFoodRequest; starts ACCEPTED with the agreed terms.

Every order stores full snapshots (OrderItem + vendor/address fields) so
history never depends on the current menu.
"""
import secrets
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import TimeStampedModel
from vendors.delivery import Fulfillment

MONEY = dict(max_digits=12, decimal_places=2)
ZERO = Decimal('0.00')


def _order_code():
    return 'AGZ-' + secrets.token_hex(3).upper()


class OrderType(models.TextChoices):
    DINE_IN = 'DINE_IN', 'Dine-in order'
    MENU_DELIVERY = 'MENU_DELIVERY', 'Menu delivery request'
    CUSTOM_DELIVERY = 'CUSTOM_DELIVERY', 'Custom food order'


class OrderStatus(models.TextChoices):
    PENDING_VENDOR_CONFIRMATION = 'PENDING_VENDOR_CONFIRMATION', 'Waiting for vendor'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    PREPARING = 'PREPARING', 'Preparing'
    READY = 'READY', 'Ready'
    # dine-in only
    SERVED = 'SERVED', 'Served'
    COMPLETED = 'COMPLETED', 'Completed'
    # delivery only
    AWAITING_RIDER = 'AWAITING_RIDER', 'Waiting for rider'
    RIDER_ASSIGNED = 'RIDER_ASSIGNED', 'Rider assigned'
    PICKED_UP = 'PICKED_UP', 'Picked up'
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', 'Out for delivery'
    DELIVERED = 'DELIVERED', 'Delivered'
    # terminal failures
    REJECTED = 'REJECTED', 'Rejected by vendor'
    EXPIRED = 'EXPIRED', 'Expired (no vendor response)'
    CANCELLED = 'CANCELLED', 'Cancelled'


TERMINAL_STATUSES = frozenset({
    OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.REJECTED,
    OrderStatus.EXPIRED, OrderStatus.CANCELLED,
})


class PaymentStatus(models.TextChoices):
    UNPAID = 'UNPAID', 'Unpaid'
    PENDING = 'PENDING', 'Payment pending'
    PAID = 'PAID', 'Paid'
    FAILED = 'FAILED', 'Payment failed'
    REFUNDED = 'REFUNDED', 'Refunded'


class PaymentMethod(models.TextChoices):
    CASH = 'CASH', 'Cash (pay at vendor / on delivery)'
    MPESA = 'MPESA', 'M-Pesa'
    TIGOPESA = 'TIGOPESA', 'Mixx by Yas (Tigo Pesa)'
    AIRTEL_MONEY = 'AIRTEL_MONEY', 'Airtel Money'
    HALOPESA = 'HALOPESA', 'HaloPesa'
    CARD = 'CARD', 'Card'


# ── Cart ─────────────────────────────────────────────────────────────────────

class Cart(TimeStampedModel):
    """One open cart per customer per vendor — food always belongs to a vendor."""

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='carts')
    vendor = models.ForeignKey('vendors.VendorProfile', on_delete=models.CASCADE, related_name='+')

    class Meta:
        unique_together = ('customer', 'vendor')


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey('vendors.MenuItem', on_delete=models.CASCADE, related_name='+')
    quantity = models.PositiveIntegerField(default=1)
    instructions = models.CharField(max_length=500, blank=True)

    class Meta:
        unique_together = ('cart', 'menu_item')


# ── Custom food requests ─────────────────────────────────────────────────────

class CustomRequestStatus(models.TextChoices):
    OPEN = 'OPEN', 'Waiting for offers'
    OFFERS_RECEIVED = 'OFFERS_RECEIVED', 'Offers received'
    ACCEPTED = 'ACCEPTED', 'Offer accepted'
    EXPIRED = 'EXPIRED', 'Expired'
    CANCELLED = 'CANCELLED', 'Cancelled'


class CustomFoodRequest(TimeStampedModel):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='custom_requests')
    description = models.TextField()
    quantity_description = models.CharField(max_length=255, blank=True, help_text='e.g. "trays 3", "sahani 10"')
    people_count = models.PositiveIntegerField(null=True, blank=True)
    # [{"url": "...", "path": "users/<uid>/custom-requests/..."}]
    images = models.JSONField(default=list, blank=True)
    desired_time = models.DateTimeField(null=True, blank=True)
    budget_hint = models.DecimalField(**MONEY, null=True, blank=True)
    delivery_address = models.CharField(max_length=255)
    delivery_landmark = models.CharField(max_length=255, blank=True)
    delivery_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    delivery_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    status = models.CharField(max_length=20, choices=CustomRequestStatus.choices, default=CustomRequestStatus.OPEN, db_index=True)
    radius_km = models.DecimalField(max_digits=5, decimal_places=2)
    broadcast_at = models.DateTimeField()
    offers_deadline = models.DateTimeField(db_index=True)
    selection_deadline = models.DateTimeField(db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Custom request #{self.pk} ({self.status})'


class CustomRequestRecipient(models.Model):
    """A vendor that was offered this custom request (spec: FoodRequestRecipient)."""

    request = models.ForeignKey(CustomFoodRequest, on_delete=models.CASCADE, related_name='recipients')
    vendor = models.ForeignKey('vendors.VendorProfile', on_delete=models.CASCADE, related_name='custom_request_invites')
    distance_km = models.DecimalField(max_digits=6, decimal_places=2)
    notified_at = models.DateTimeField()
    declined_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('request', 'vendor')


class OfferStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    REJECTED = 'REJECTED', 'Not selected'
    WITHDRAWN = 'WITHDRAWN', 'Withdrawn'
    EXPIRED = 'EXPIRED', 'Expired'


class Offer(TimeStampedModel):
    request = models.ForeignKey(CustomFoodRequest, on_delete=models.CASCADE, related_name='offers')
    vendor = models.ForeignKey('vendors.VendorProfile', on_delete=models.CASCADE, related_name='offers')
    food_description = models.TextField()
    price = models.DecimalField(**MONEY)
    preparation_minutes = models.PositiveIntegerField()
    fulfillment_method = models.CharField(max_length=20, choices=[c for c in Fulfillment.CHOICES if c[0] != Fulfillment.DINE_IN])
    delivery_fee = models.DecimalField(**MONEY, default=ZERO)
    delivery_terms = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=12, choices=OfferStatus.choices, default=OfferStatus.PENDING, db_index=True)

    class Meta:
        ordering = ['price', 'created_at']
        constraints = [models.UniqueConstraint(fields=['request', 'vendor'], name='one_offer_per_vendor_per_request')]

    @property
    def total(self):
        return self.price + self.delivery_fee


# ── Orders ───────────────────────────────────────────────────────────────────

class Order(TimeStampedModel):
    code = models.CharField(max_length=12, unique=True, default=_order_code, editable=False)
    order_type = models.CharField(max_length=20, choices=OrderType.choices, db_index=True)
    fulfillment_method = models.CharField(max_length=20, choices=Fulfillment.CHOICES)
    status = models.CharField(max_length=32, choices=OrderStatus.choices, db_index=True)

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    vendor = models.ForeignKey('vendors.VendorProfile', on_delete=models.PROTECT, related_name='orders')
    custom_request = models.OneToOneField(CustomFoodRequest, null=True, blank=True, on_delete=models.PROTECT, related_name='order')
    accepted_offer = models.OneToOneField(Offer, null=True, blank=True, on_delete=models.PROTECT, related_name='order')

    # Vendor snapshot (also the pickup / dine-in location)
    vendor_name = models.CharField(max_length=160)
    vendor_phone = models.CharField(max_length=16, blank=True)
    vendor_address = models.CharField(max_length=255)
    vendor_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    vendor_longitude = models.DecimalField(max_digits=9, decimal_places=6)

    # Delivery snapshot (empty for dine-in / pickup)
    delivery_address = models.CharField(max_length=255, blank=True)
    delivery_landmark = models.CharField(max_length=255, blank=True)
    delivery_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    delivery_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    delivery_distance_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    customer_instructions = models.TextField(blank=True)

    # Money — all computed by the backend
    subtotal = models.DecimalField(**MONEY)
    discount_total = models.DecimalField(**MONEY, default=ZERO)
    delivery_fee = models.DecimalField(**MONEY, default=ZERO)
    is_free_delivery = models.BooleanField(default=False)
    rider_tip = models.DecimalField(**MONEY, default=ZERO)
    total = models.DecimalField(**MONEY)

    payment_method = models.CharField(max_length=16, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)

    # Timeline
    vendor_notified_at = models.DateTimeField(null=True, blank=True)
    vendor_response_deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True, help_text='Completed / delivered / cancelled / rejected / expired.')
    estimated_ready_minutes = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['status', 'vendor_response_deadline']),
        ]
        constraints = [
            models.CheckConstraint(
                name='dine_in_has_dine_in_fulfillment',
                condition=~Q(order_type='DINE_IN') | Q(fulfillment_method='DINE_IN'),
            ),
            models.CheckConstraint(
                name='non_dine_in_has_no_dine_in_fulfillment',
                condition=Q(order_type='DINE_IN') | ~Q(fulfillment_method='DINE_IN'),
            ),
            models.CheckConstraint(name='order_total_non_negative', condition=Q(total__gte=0)),
        ]

    def __str__(self):
        return f'{self.code} {self.order_type} {self.status}'

    @property
    def is_terminal(self):
        return self.status in TERMINAL_STATUSES


class OrderItem(models.Model):
    """Immutable snapshot of what the customer bought, at the agreed price."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey('vendors.MenuItem', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    menu_item_ref = models.PositiveBigIntegerField(null=True, blank=True, help_text='Original menu item id (kept if the item is deleted).')
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    image_url = models.URLField(max_length=1000, blank=True)
    image_path = models.CharField(max_length=500, blank=True)
    unit_price = models.DecimalField(**MONEY)
    quantity = models.PositiveIntegerField()
    discount = models.DecimalField(**MONEY, default=ZERO)
    line_total = models.DecimalField(**MONEY)
    instructions = models.CharField(max_length=500, blank=True)

    def __str__(self):
        return f'{self.quantity} × {self.name}'


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=32, blank=True)
    to_status = models.CharField(max_length=32)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    actor_role = models.CharField(max_length=16)
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        verbose_name_plural = 'order status history'


# ── Cancellations ────────────────────────────────────────────────────────────

class CancellationKind(models.TextChoices):
    CUSTOMER_CANCELLATION = 'CUSTOMER_CANCELLATION', 'Customer cancellation'
    VENDOR_REJECTION = 'VENDOR_REJECTION', 'Vendor rejection'
    VENDOR_CANCELLATION = 'VENDOR_CANCELLATION', 'Vendor cancellation'
    RIDER_RELEASE = 'RIDER_RELEASE', 'Rider released the job'
    AUTOMATIC_EXPIRY = 'AUTOMATIC_EXPIRY', 'Automatic expiry'
    ADMIN_CANCELLATION = 'ADMIN_CANCELLATION', 'Administrative cancellation'


class CancellationRecord(models.Model):
    kind = models.CharField(max_length=24, choices=CancellationKind.choices, db_index=True)
    reason_code = models.CharField(max_length=32, db_index=True)
    explanation = models.TextField(blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    actor_role = models.CharField(max_length=16)
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.CASCADE, related_name='cancellations')
    custom_request = models.ForeignKey(CustomFoodRequest, null=True, blank=True, on_delete=models.CASCADE, related_name='cancellations')
    status_at_cancellation = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                name='cancellation_targets_something',
                condition=Q(order__isnull=False) | Q(custom_request__isnull=False),
            ),
        ]
