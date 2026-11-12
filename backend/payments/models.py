from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from orders.models import PaymentMethod, PaymentStatus

MONEY = dict(max_digits=12, decimal_places=2)


class Payment(TimeStampedModel):
    """One payment attempt for an order. Order.payment_status mirrors the latest outcome."""

    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, related_name='payments')
    payer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payments')
    method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    amount = models.DecimalField(**MONEY)
    status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    provider_reference = models.CharField(max_length=128, blank=True, db_index=True)
    payer_phone = models.CharField(max_length=16, blank=True)
    raw_callback = models.JSONField(default=dict, blank=True)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['-created_at']
