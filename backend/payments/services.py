"""Payments. Cash is fully supported; mobile money is integration-ready (provider adapters TODO)."""
from django.db import transaction

from core.exceptions import BusinessRuleError
from orders.models import Order, OrderStatus, PaymentMethod, PaymentStatus
from rest_framework.exceptions import PermissionDenied

from .models import Payment

PAYABLE_AFTER = {OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED,
                 OrderStatus.COMPLETED, OrderStatus.AWAITING_RIDER, OrderStatus.RIDER_ASSIGNED,
                 OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED}


class ProviderNotConfigured(BusinessRuleError):
    status_code = 501
    default_code = 'PAYMENT_PROVIDER_NOT_CONFIGURED'


def confirm_cash_payment(order_id, user):
    """Vendor (or the rider who collected it) confirms cash was received."""
    with transaction.atomic():
        order = Order.objects.select_for_update().select_related('vendor').get(pk=order_id)
        job = getattr(order, 'delivery_job', None)
        collector = order.vendor.is_member(user) or (job and job.rider_id and job.rider.user_id == user.id)
        if not collector:
            raise PermissionDenied('Only the vendor or delivering rider can confirm cash.')
        if order.payment_method != PaymentMethod.CASH:
            raise BusinessRuleError('This order is not a cash order.', 'NOT_CASH')
        if order.status not in PAYABLE_AFTER:
            raise BusinessRuleError('This order cannot be paid in its current state.', 'NOT_PAYABLE')
        if order.payment_status == PaymentStatus.PAID:
            return order.payments.first()
        payment = Payment.objects.create(order=order, payer=order.customer, method=PaymentMethod.CASH,
                                         amount=order.total, status=PaymentStatus.PAID, confirmed_by=user)
        order.payment_status = PaymentStatus.PAID
        order.save(update_fields=['payment_status', 'updated_at'])
    return payment


def initiate_mobile_money(order, user, phone):
    """Placeholder for M-Pesa / Mixx / Airtel / HaloPesa push payments.

    To integrate: create Payment(status=PENDING), call the provider API, store
    provider_reference, and confirm in a webhook view that verifies the signature.
    """
    raise ProviderNotConfigured('Mobile money payments are not connected yet. Choose cash for now.')
