from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel

MONEY = dict(max_digits=12, decimal_places=2)


class VendorCategory(models.Model):
    """Business type shown to customers, e.g. Mama Lishe, Chipsi Mayai, Restaurant."""

    slug = models.SlugField(unique=True)
    name_en = models.CharField(max_length=80)
    name_sw = models.CharField(max_length=80)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name_en']
        verbose_name_plural = 'vendor categories'

    def __str__(self):
        return self.name_en


class VendorProfile(TimeStampedModel):
    class BusinessType(models.TextChoices):
        SIMPLE = 'SIMPLE', 'Simple vendor (mama lishe, street food)'
        RESTAURANT = 'RESTAURANT', 'Restaurant'

    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='vendor_profile')
    business_name = models.CharField(max_length=160)
    business_type = models.CharField(max_length=16, choices=BusinessType.choices, default=BusinessType.SIMPLE)
    categories = models.ManyToManyField(VendorCategory, blank=True, related_name='vendors')
    phone = models.CharField(max_length=16)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255)
    landmark = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    profile_image_url = models.URLField(max_length=1000, blank=True)
    cover_image_url = models.URLField(max_length=1000, blank=True)
    # {"mon": [["07:00", "21:00"]], "tue": [...], ...}; empty means "open whenever online".
    opening_hours = models.JSONField(default=dict, blank=True)
    is_online = models.BooleanField(default=False, help_text='Vendor is accepting orders right now.')
    is_approved = models.BooleanField(default=False, help_text='Approved by Agiza admin; only approved vendors are listed.')
    min_order_amount = models.DecimalField(
        **MONEY, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))],
        help_text='Smallest order the vendor accepts. 0 means no minimum.',
    )
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.00'))
    rating_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=['is_approved', 'is_online']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return self.business_name

    def is_open_now(self, at=None):
        if not self.is_online:
            return False
        if not self.opening_hours:
            return True
        now = timezone.localtime(at or timezone.now())
        day = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[now.weekday()]
        hhmm = now.strftime('%H:%M')
        return any(start <= hhmm < end for start, end in self.opening_hours.get(day, []))

    def is_member(self, user):
        """Owner or staff of this vendor."""
        return user.is_authenticated and (
            self.owner_id == user.id or self.staff.filter(user=user, is_active=True).exists()
        )


class VendorStaff(TimeStampedModel):
    """Restaurant employees who can manage orders (and optionally deliver)."""

    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='staff')
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='vendor_staff')
    can_deliver = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.user.name} @ {self.vendor}'


class DeliveryPolicy(TimeStampedModel):
    vendor = models.OneToOneField(VendorProfile, on_delete=models.CASCADE, related_name='delivery_policy')
    offers_dine_in = models.BooleanField(default=True)
    offers_pickup = models.BooleanField(default=True)
    offers_vendor_delivery = models.BooleanField(default=False, help_text='Vendor or their staff deliver.')
    offers_platform_rider = models.BooleanField(default=False, help_text='Independent Agiza riders may deliver.')
    free_delivery_radius_km = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))
    free_delivery_agreed = models.BooleanField(
        default=False,
        help_text='Vendor agrees to cover delivery cost inside the free radius. Free delivery is only advertised when true.',
    )
    max_delivery_distance_km = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('5'))
    base_fee = models.DecimalField(**MONEY, default=Decimal('1000'))
    per_km_fee = models.DecimalField(**MONEY, default=Decimal('500'))

    class Meta:
        verbose_name_plural = 'delivery policies'

    def __str__(self):
        return f'Delivery policy — {self.vendor}'

    @property
    def offers_delivery(self):
        return self.offers_vendor_delivery or self.offers_platform_rider

    @property
    def advertises_free_delivery(self):
        return self.free_delivery_agreed and self.free_delivery_radius_km > 0


class MenuCategory(models.Model):
    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='menu_categories')
    name = models.CharField(max_length=80)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        unique_together = ('vendor', 'name')
        verbose_name_plural = 'menu categories'

    def __str__(self):
        return f'{self.name} ({self.vendor})'


class MenuItem(TimeStampedModel):
    class Availability(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Available'
        SOLD_OUT = 'SOLD_OUT', 'Sold out (temporarily)'
        HIDDEN = 'HIDDEN', 'Hidden'

    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='menu_items')
    category = models.ForeignKey(MenuCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name='items')
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    keywords = models.CharField(max_length=255, blank=True, help_text='Extra search words, comma separated.')
    price = models.DecimalField(**MONEY, validators=[MinValueValidator(Decimal('0'))])
    image_url = models.URLField(max_length=1000, blank=True)
    image_path = models.CharField(max_length=500, blank=True, help_text='Firebase Storage object path.')
    availability_status = models.CharField(max_length=16, choices=Availability.choices, default=Availability.AVAILABLE)
    portions_available = models.PositiveIntegerField(null=True, blank=True, help_text='Empty = unlimited.')
    preparation_minutes = models.PositiveSmallIntegerField(default=15)
    is_archived = models.BooleanField(default=False, help_text='Deleted from the menu. Past orders keep their snapshot.')

    class Meta:
        ordering = ['category__sort_order', 'name']
        indexes = [models.Index(fields=['vendor', 'availability_status', 'is_archived'])]

    def __str__(self):
        return f'{self.name} — {self.vendor}'

    @property
    def is_orderable(self):
        return (
            not self.is_archived
            and self.availability_status == self.Availability.AVAILABLE
            and (self.portions_available is None or self.portions_available > 0)
        )


class Review(TimeStampedModel):
    order = models.OneToOneField('orders.Order', on_delete=models.CASCADE, related_name='review')
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)

    def __str__(self):
        return f'{self.rating}★ {self.vendor}'
