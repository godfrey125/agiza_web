from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import TimeStampedModel

MONEY = dict(max_digits=12, decimal_places=2)


class RiderProfile(TimeStampedModel):
    class Vehicle(models.TextChoices):
        BODA = 'BODA', 'Bodaboda (motorcycle)'
        BAJAJI = 'BAJAJI', 'Bajaji'
        BICYCLE = 'BICYCLE', 'Bicycle'
        CAR = 'CAR', 'Car'
        FOOT = 'FOOT', 'On foot'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='rider_profile')
    vehicle_type = models.CharField(max_length=10, choices=Vehicle.choices, default=Vehicle.BODA)
    license_plate = models.CharField(max_length=20, blank=True)
    is_approved = models.BooleanField(default=False)
    is_online = models.BooleanField(default=False)
    # Coarse last-known position for job matching (live tracking goes through Firebase RTDB).
    last_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.00'))
    total_deliveries = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'Rider {self.user.name}'


class DeliveryJob(TimeStampedModel):
    """Created only for PLATFORM_RIDER orders. At most one rider holds it."""

    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Looking for a rider'
        ASSIGNED = 'ASSIGNED', 'Rider assigned'
        PICKED_UP = 'PICKED_UP', 'Picked up'
        DELIVERED = 'DELIVERED', 'Delivered'
        CANCELLED = 'CANCELLED', 'Cancelled'

    order = models.OneToOneField('orders.Order', on_delete=models.CASCADE, related_name='delivery_job')
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN, db_index=True)
    rider = models.ForeignKey(RiderProfile, null=True, blank=True, on_delete=models.PROTECT, related_name='jobs')
    pickup_name = models.CharField(max_length=160)
    pickup_address = models.CharField(max_length=255)
    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_address = models.CharField(max_length=255)
    dropoff_landmark = models.CharField(max_length=255, blank=True)
    dropoff_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    dropoff_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    distance_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    delivery_fee = models.DecimalField(**MONEY)
    rider_tip = models.DecimalField(**MONEY, default=Decimal('0.00'))
    assigned_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                name='assigned_job_has_rider',
                condition=Q(status__in=['OPEN', 'CANCELLED']) | Q(rider__isnull=False),
            ),
        ]

    @property
    def rider_earning(self):
        return self.delivery_fee + self.rider_tip
