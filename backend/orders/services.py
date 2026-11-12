"""Ordering engine — every order/request state change goes through here.

Rules enforced here (never trust the client):
* prices come from the menu / the accepted offer, fees from vendors.delivery
* transitions are validated against orders.state for the actor's role
* rows are locked (select_for_update) so accept vs. expiry vs. cancel can't race
* notifications are written in the same transaction and pushed after commit
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from core.exceptions import BusinessRuleError
from core.geo import haversine_km
from notifications.services import notify
from vendors import delivery
from vendors.delivery import Fulfillment
from vendors.models import MenuItem, VendorProfile

from . import reasons, state
from .models import (
    TERMINAL_STATUSES, CancellationKind, CancellationRecord, Cart, CustomFoodRequest,
    CustomRequestRecipient, CustomRequestStatus, Offer, OfferStatus, Order, OrderItem,
    OrderStatus, OrderStatusHistory, OrderType, PaymentMethod,
)

log = logging.getLogger('agiza.orders')
ZERO = Decimal('0.00')
MAX_QTY_PER_LINE = 50
MAX_TIP = Decimal('100000')


def _cfg(key):
    return settings.AGIZA[key]


# ── Helpers ──────────────────────────────────────────────────────────────────

def vendor_users(vendor):
    users = [vendor.owner]
    users += [s.user for s in vendor.staff.filter(is_active=True).select_related('user')]
    return users


def role_for(order, user):
    """The role `user` plays on this order, or None."""
    if not user.is_authenticated:
        return None
    if order.customer_id == user.id:
        return state.C
    if order.vendor.is_member(user):
        return state.V
    job = getattr(order, 'delivery_job', None)
    if job is not None and job.rider_id and job.rider.user_id == user.id:
        return state.R
    if user.is_staff:
        return state.A
    return None


def lock_order(order_id):
    return Order.objects.select_for_update().select_related('vendor', 'customer').get(pk=order_id)


def _items_summary(order, limit=3):
    lines = [f'{i.quantity}× {i.name}' for i in order.items.all()[:limit]]
    extra = order.items.count() - limit
    return ', '.join(lines) + (f' +{extra}' if extra > 0 else '')


def _ctx(order, **extra):
    return {'vendor': order.vendor_name, 'code': order.code, 'total': f'{order.total:,.0f}', **extra}


def _notify_vendor(order, event, key_suffix, **ctx):
    for u in vendor_users(order.vendor):
        notify(u, event, dedupe_key=f'order:{order.pk}:{key_suffix}', ctx=_ctx(order, **ctx), order=order)


def _validate_reason(role, code, explanation):
    table = reasons.REASONS_BY_ROLE[role]
    if code not in table:
        raise serializers.ValidationError({'reason_code': f'Choose one of: {", ".join(table)}'})
    if code == 'OTHER' and not (explanation or '').strip():
        raise serializers.ValidationError({'explanation': 'Please explain the reason.'})


# ── Line items & snapshots ───────────────────────────────────────────────────

def build_lines(vendor, items):
    """Validate requested items against the vendor's live menu and price them server-side.

    `items`: [{"menu_item_id": int, "quantity": int, "instructions": str}]
    """
    if not items:
        raise serializers.ValidationError({'items': 'Choose at least one food item.'})
    merged = {}
    for raw in items:
        try:
            mid, qty = int(raw['menu_item_id']), int(raw.get('quantity', 1))
        except (KeyError, TypeError, ValueError):
            raise serializers.ValidationError({'items': 'Each item needs menu_item_id and quantity.'})
        if not 1 <= qty <= MAX_QTY_PER_LINE:
            raise serializers.ValidationError({'items': f'Quantity must be between 1 and {MAX_QTY_PER_LINE}.'})
        entry = merged.setdefault(mid, {'quantity': 0, 'instructions': ''})
        entry['quantity'] += qty
        if raw.get('instructions'):
            entry['instructions'] = str(raw['instructions'])[:500]

    menu = {m.pk: m for m in MenuItem.objects.filter(pk__in=merged, vendor=vendor, is_archived=False)}
    missing = set(merged) - set(menu)
    if missing:
        raise serializers.ValidationError({'items': 'Some items are not on this vendor\'s menu.'})
    lines, subtotal = [], ZERO
    for mid, entry in merged.items():
        m = menu[mid]
        if not m.is_orderable:
            raise BusinessRuleError(f'"{m.name}" is not available right now.', 'ITEM_UNAVAILABLE')
        if m.portions_available is not None and m.portions_available < entry['quantity']:
            raise BusinessRuleError(f'Only {m.portions_available} portions of "{m.name}" left.', 'NOT_ENOUGH_PORTIONS')
        line_total = (m.price * entry['quantity']).quantize(Decimal('0.01'))
        subtotal += line_total
        lines.append(dict(
            menu_item=m, menu_item_ref=m.pk, name=m.name, description=m.description,
            image_url=m.image_url, image_path=m.image_path, unit_price=m.price,
            quantity=entry['quantity'], line_total=line_total, instructions=entry['instructions'],
        ))
    return lines, subtotal


def _vendor_snapshot(vendor):
    return dict(
        vendor=vendor, vendor_name=vendor.business_name, vendor_phone=vendor.phone,
        vendor_address=vendor.address, vendor_latitude=vendor.latitude, vendor_longitude=vendor.longitude,
    )


def _require_open_vendor(vendor_id):
    vendor = VendorProfile.objects.select_related('delivery_policy', 'owner').filter(pk=vendor_id, is_approved=True).first()
    if vendor is None:
        raise serializers.ValidationError({'vendor_id': 'Vendor not found.'})
    if not vendor.is_open_now():
        raise BusinessRuleError(f'{vendor.business_name} is closed right now.', 'VENDOR_CLOSED')
    return vendor


def _history(order, from_status, to_status, actor, role, note=''):
    OrderStatusHistory.objects.create(
        order=order, from_status=from_status or '', to_status=to_status,
        actor=actor if getattr(actor, 'pk', None) else None, actor_role=role, note=note[:500],
    )


def _start_vendor_clock(order):
    now = timezone.now()
    order.vendor_notified_at = now
    order.vendor_response_deadline = now + timedelta(seconds=_cfg('VENDOR_RESPONSE_SECONDS'))


# ── Creation: dine-in & menu delivery ────────────────────────────────────────

def _payment_method(value):
    value = value or PaymentMethod.CASH
    if value not in PaymentMethod.values:
        raise serializers.ValidationError({'payment_method': 'Unknown payment method.'})
    return value


@transaction.atomic
def create_dine_in_order(customer, *, vendor_id, items, instructions='', payment_method=None):
    vendor = _require_open_vendor(vendor_id)
    q = delivery.quote(vendor, Fulfillment.DINE_IN)
    if not q.eligible:
        raise BusinessRuleError(f'{vendor.business_name} does not take dine-in orders.', q.reason)
    lines, subtotal = build_lines(vendor, items)
    order = Order(
        order_type=OrderType.DINE_IN, fulfillment_method=Fulfillment.DINE_IN,
        status=OrderStatus.PENDING_VENDOR_CONFIRMATION, customer=customer, **_vendor_snapshot(vendor),
        customer_instructions=(instructions or '')[:2000], subtotal=subtotal, total=subtotal,
        payment_method=_payment_method(payment_method),
    )
    _start_vendor_clock(order)
    order.save()
    OrderItem.objects.bulk_create([OrderItem(order=order, **line) for line in lines])
    _history(order, '', order.status, customer, state.C, 'Dine-in order placed')

    ctx = _ctx(order, items=_items_summary(order), seconds=_cfg('VENDOR_RESPONSE_SECONDS'))
    for u in vendor_users(vendor):
        notify(u, 'VENDOR_NEW_DINE_IN', dedupe_key=f'order:{order.pk}:new', ctx=ctx, order=order)
    notify(customer, 'DINE_IN_SUBMITTED', dedupe_key=f'order:{order.pk}:submitted', ctx=ctx, order=order)
    return order


def price_delivery_request(customer, *, vendor_id, items, fulfillment_method, latitude=None, longitude=None,
                           rider_tip=ZERO, require_open=True):
    """Compute (without saving) everything a delivery request would cost."""
    if fulfillment_method not in (Fulfillment.VENDOR_DELIVERY, Fulfillment.PLATFORM_RIDER, Fulfillment.CUSTOMER_PICKUP):
        raise serializers.ValidationError({'fulfillment_method': 'Choose VENDOR_DELIVERY, PLATFORM_RIDER or CUSTOMER_PICKUP.'})
    vendor = _require_open_vendor(vendor_id) if require_open else VendorProfile.objects.get(pk=vendor_id)
    lines, subtotal = build_lines(vendor, items)
    q = delivery.quote(vendor, fulfillment_method, latitude, longitude)
    if not q.eligible:
        raise BusinessRuleError(_quote_message(vendor, q.reason), q.reason)
    tip = Decimal(rider_tip or 0)
    if tip < 0 or tip > MAX_TIP:
        raise serializers.ValidationError({'rider_tip': 'Invalid tip.'})
    if tip and fulfillment_method != Fulfillment.PLATFORM_RIDER:
        raise serializers.ValidationError({'rider_tip': 'Tips are only for Agiza rider deliveries.'})
    total = subtotal + q.fee + tip
    return vendor, lines, subtotal, q, tip, total


def _quote_message(vendor, reason):
    return {
        'OUTSIDE_SERVICE_AREA': f'{vendor.business_name} does not deliver to this location.',
        'DELIVERY_METHOD_UNAVAILABLE': f'{vendor.business_name} does not offer this delivery option.',
        'PICKUP_UNAVAILABLE': f'{vendor.business_name} does not offer pickup.',
        'LOCATION_REQUIRED': 'Choose a delivery location first.',
    }.get(reason, 'This option is not available.')


@transaction.atomic
def create_delivery_request(customer, *, vendor_id, items, fulfillment_method, delivery_address='',
                            delivery_landmark='', latitude=None, longitude=None, rider_tip=ZERO,
                            instructions='', payment_method=None):
    vendor, lines, subtotal, q, tip, total = price_delivery_request(
        customer, vendor_id=vendor_id, items=items, fulfillment_method=fulfillment_method,
        latitude=latitude, longitude=longitude, rider_tip=rider_tip,
    )
    is_delivery = fulfillment_method in Fulfillment.DELIVERY_METHODS
    if is_delivery and not (delivery_address or '').strip():
        raise serializers.ValidationError({'delivery_address': 'Describe the delivery location.'})
    order = Order(
        order_type=OrderType.MENU_DELIVERY, fulfillment_method=fulfillment_method,
        status=OrderStatus.PENDING_VENDOR_CONFIRMATION, customer=customer, **_vendor_snapshot(vendor),
        delivery_address=delivery_address[:255] if is_delivery else '',
        delivery_landmark=(delivery_landmark or '')[:255] if is_delivery else '',
        delivery_latitude=latitude if is_delivery else None,
        delivery_longitude=longitude if is_delivery else None,
        delivery_distance_km=q.distance_km, customer_instructions=(instructions or '')[:2000],
        subtotal=subtotal, delivery_fee=q.fee, is_free_delivery=q.is_free, rider_tip=tip, total=total,
        payment_method=_payment_method(payment_method),
    )
    _start_vendor_clock(order)
    order.save()
    OrderItem.objects.bulk_create([OrderItem(order=order, **line) for line in lines])
    _history(order, '', order.status, customer, state.C, f'Request placed ({fulfillment_method})')
    ctx = _ctx(order, items=_items_summary(order), seconds=_cfg('VENDOR_RESPONSE_SECONDS'))
    for u in vendor_users(vendor):
        notify(u, 'VENDOR_NEW_DELIVERY', dedupe_key=f'order:{order.pk}:new', ctx=ctx, order=order)
    return order


def clear_cart(customer, vendor_id):
    Cart.objects.filter(customer=customer, vendor_id=vendor_id).delete()


# ── Transitions ──────────────────────────────────────────────────────────────

_CUSTOMER_EVENTS = {
    OrderStatus.PREPARING: 'ORDER_PREPARING',
    OrderStatus.READY: 'ORDER_READY',
    OrderStatus.OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
    OrderStatus.DELIVERED: 'ORDER_DELIVERED',
    OrderStatus.COMPLETED: 'ORDER_COMPLETED',
}


def _apply(order, to_status, actor, role, note=''):
    """Validate and apply one transition on a *locked* order."""
    if role not in state.allowed_roles(order, to_status):
        raise BusinessRuleError(
            f'Cannot change order from {order.status} to {to_status}.', 'INVALID_TRANSITION')
    from_status = order.status
    order.status = to_status
    now = timezone.now()
    if to_status == OrderStatus.ACCEPTED:
        order.accepted_at = now
    elif to_status == OrderStatus.READY:
        order.ready_at = now
    if to_status in TERMINAL_STATUSES:
        order.finished_at = now
    order.save()
    _history(order, from_status, to_status, actor, role, note)
    return from_status


def transition(order_id, to_status, user, note=''):
    """Generic status change requested by a user (vendor/rider/customer buttons)."""
    if to_status in (OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED, OrderStatus.EXPIRED):
        raise BusinessRuleError('Use the accept, reject or cancel action for this change.', 'USE_DEDICATED_ACTION')
    with transaction.atomic():
        order = lock_order(order_id)
        role = role_for(order, user)
        if role is None:
            raise PermissionDenied('Not your order.')
        if role == state.R and to_status in (OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED):
            from riders import services as rider_services
            return rider_services.rider_progress(order, user, to_status)
        _apply(order, to_status, user, role, note)
        _after_progress(order, user, role)
    return order


def _after_progress(order, actor, role):
    """Side effects of non-terminal and completion transitions (order is locked)."""
    s = order.status
    if s == OrderStatus.READY and order.fulfillment_method == Fulfillment.PLATFORM_RIDER:
        job = getattr(order, 'delivery_job', None)
        nxt = OrderStatus.RIDER_ASSIGNED if job and job.rider_id else OrderStatus.AWAITING_RIDER
        _apply(order, nxt, None, state.SYS, 'Food ready')
        if job and job.rider_id:
            notify(job.rider.user, 'RIDER_FOOD_READY', dedupe_key=f'order:{order.pk}:rider_ready',
                   ctx=_ctx(order, pickup=order.vendor_address), order=order)
        notify(order.customer, 'ORDER_READY', dedupe_key=f'order:{order.pk}:status:READY', ctx=_ctx(order), order=order)
        return
    if s == OrderStatus.SERVED:
        return
    event = _CUSTOMER_EVENTS.get(s)
    if event and role != state.C:
        notify(order.customer, event, dedupe_key=f'order:{order.pk}:status:{s}', ctx=_ctx(order), order=order)
    if role in (state.C, state.R):
        _notify_vendor(order, 'VENDOR_ORDER_UPDATE', f'vendor_status:{s}', status=order.get_status_display())
    if s in (OrderStatus.DELIVERED, OrderStatus.COMPLETED):
        from riders import realtime
        from riders.services import on_customer_confirmed_delivery
        if order.fulfillment_method == Fulfillment.PLATFORM_RIDER:
            on_customer_confirmed_delivery(order)  # no-op if the rider already confirmed
        realtime.close_tracking(order.pk)


# ── Vendor accept / reject ───────────────────────────────────────────────────

def vendor_accept(order_id, user, estimated_ready_minutes=None):
    expired = False
    with transaction.atomic():
        order = lock_order(order_id)
        if not order.vendor.is_member(user):
            raise PermissionDenied('Not your order.')
        if order.status == OrderStatus.PENDING_VENDOR_CONFIRMATION and timezone.now() >= order.vendor_response_deadline:
            _expire_order(order)  # deadline passed: expiry wins, commit it
            expired = True
        else:
            _apply(order, OrderStatus.ACCEPTED, user, state.V)
            _reserve_portions(order)
            if estimated_ready_minutes:
                order.estimated_ready_minutes = max(1, min(int(estimated_ready_minutes), 600))
                order.save(update_fields=['estimated_ready_minutes', 'updated_at'])
            _after_accept(order)
    if expired:
        raise BusinessRuleError('This request has expired and can no longer be accepted.', 'REQUEST_EXPIRED')
    return order


def _reserve_portions(order):
    for item in order.items.select_related('menu_item'):
        if item.menu_item_id is None:
            continue
        m = MenuItem.objects.select_for_update().get(pk=item.menu_item_id)
        if m.portions_available is None:
            continue
        if m.portions_available < item.quantity:
            raise BusinessRuleError(f'Not enough "{m.name}" left to accept. Reject with CHAKULA_KIMEISHA.', 'NOT_ENOUGH_PORTIONS')
        MenuItem.objects.filter(pk=m.pk).update(portions_available=F('portions_available') - item.quantity)


def _release_portions(order):
    for item in order.items.all():
        if item.menu_item_id:
            MenuItem.objects.filter(pk=item.menu_item_id, portions_available__isnull=False).update(
                portions_available=F('portions_available') + item.quantity)


def _after_accept(order):
    from chat.services import ensure_conversation
    ensure_conversation(order)
    if order.fulfillment_method == Fulfillment.PLATFORM_RIDER:
        from riders.services import open_job
        open_job(order)
    event = 'VENDOR_OFFER_ACCEPTED' if order.order_type == OrderType.CUSTOM_DELIVERY else None
    if event:
        _notify_vendor(order, event, 'offer_accepted')
    else:
        notify(order.customer, 'ORDER_ACCEPTED', dedupe_key=f'order:{order.pk}:accepted', ctx=_ctx(order), order=order)


def vendor_reject(order_id, user, reason_code, explanation=''):
    _validate_reason(state.V, reason_code, explanation)
    expired = False
    with transaction.atomic():
        order = lock_order(order_id)
        if not order.vendor.is_member(user):
            raise PermissionDenied('Not your order.')
        if order.status == OrderStatus.PENDING_VENDOR_CONFIRMATION and timezone.now() >= order.vendor_response_deadline:
            _expire_order(order)
            expired = True
        else:
            from_status = _apply(order, OrderStatus.REJECTED, user, state.V, reason_code)
            _record_cancellation(order, CancellationKind.VENDOR_REJECTION, reason_code, explanation, user, state.V, from_status)
            notify(order.customer, 'ORDER_REJECTED', dedupe_key=f'order:{order.pk}:rejected', order=order,
                   ctx=_ctx(order, reason=_reason_text(order.customer, reason_code, explanation)),
                   data={'reason_code': reason_code})
    if expired:
        raise BusinessRuleError('This request already expired.', 'REQUEST_EXPIRED')
    return order


def _reason_text(user, code, explanation):
    text = reasons.label(code, user.preferred_language)
    return f'{text} — {explanation}' if explanation else text


def _record_cancellation(order, kind, code, explanation, actor, role, from_status):
    return CancellationRecord.objects.create(
        kind=kind, reason_code=code, explanation=(explanation or '')[:2000],
        actor=actor if getattr(actor, 'pk', None) else None, actor_role=role,
        order=order, status_at_cancellation=from_status,
    )


# ── Cancellation ─────────────────────────────────────────────────────────────

def cancel_order(order_id, user, reason_code, explanation=''):
    with transaction.atomic():
        order = lock_order(order_id)
        role = role_for(order, user)
        if role not in (state.C, state.V, state.A):
            raise PermissionDenied('You cannot cancel this order.')
        _validate_reason(role, reason_code, explanation)
        if role not in state.allowed_roles(order, OrderStatus.CANCELLED):
            raise BusinessRuleError(_cancel_denied_message(order, role), 'CANCELLATION_NOT_ALLOWED')
        from_status = _apply(order, OrderStatus.CANCELLED, user, role, reason_code)
        kind = {state.C: CancellationKind.CUSTOMER_CANCELLATION, state.V: CancellationKind.VENDOR_CANCELLATION,
                state.A: CancellationKind.ADMIN_CANCELLATION}[role]
        _record_cancellation(order, kind, reason_code, explanation, user, role, from_status)
        if from_status != OrderStatus.PENDING_VENDOR_CONFIRMATION:
            _release_portions(order)
        _cancel_job(order, reason_code, explanation)

        if role == state.C:
            _notify_vendor(order, 'VENDOR_CUSTOMER_CANCELLED', 'customer_cancelled',
                           reason=_reason_text(order.vendor.owner, reason_code, explanation))
            notify(order.customer, 'ORDER_CANCELLED_CONFIRMED', dedupe_key=f'order:{order.pk}:cancel_confirmed',
                   ctx=_ctx(order), order=order)
        else:
            event = 'ORDER_CANCELLED_BY_VENDOR' if role == state.V else 'ORDER_CANCELLED_BY_ADMIN'
            notify(order.customer, event, dedupe_key=f'order:{order.pk}:cancelled', order=order,
                   ctx=_ctx(order, reason=_reason_text(order.customer, reason_code, explanation)),
                   data={'reason_code': reason_code})
            if role == state.A:
                _notify_vendor(order, 'VENDOR_ORDER_UPDATE', 'admin_cancelled', status=order.get_status_display())
    return order


def _cancel_denied_message(order, role):
    if role == state.C and order.status in (OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.AWAITING_RIDER,
                                            OrderStatus.RIDER_ASSIGNED):
        return 'The vendor has started preparing your food, so it can no longer be cancelled in the app. Contact the vendor.'
    return f'This order cannot be cancelled while {order.get_status_display().lower()}.'


def _cancel_job(order, reason_code, explanation):
    job = getattr(order, 'delivery_job', None)
    if job is None or job.status in (job.Status.DELIVERED, job.Status.CANCELLED):
        return
    rider_user = job.rider.user if job.rider_id else None
    job.status = job.Status.CANCELLED
    job.save(update_fields=['status', 'updated_at'])
    from riders import realtime
    realtime.close_tracking(order.pk)
    if rider_user:
        notify(rider_user, 'RIDER_JOB_CANCELLED', dedupe_key=f'order:{order.pk}:job_cancelled', order=order,
               ctx=_ctx(order, reason=_reason_text(rider_user, reason_code, explanation)))


# ── Expiry (called by the background worker and by accept/reject) ────────────

def _expire_order(order):
    from_status = _apply(order, OrderStatus.EXPIRED, None, state.SYS, 'NO_VENDOR_RESPONSE')
    _record_cancellation(order, CancellationKind.AUTOMATIC_EXPIRY, 'NO_VENDOR_RESPONSE', '', None, state.SYS, from_status)
    notify(order.customer, 'ORDER_EXPIRED', dedupe_key=f'order:{order.pk}:expired', ctx=_ctx(order), order=order,
           data={'reason_code': 'NO_VENDOR_RESPONSE'})
    _notify_vendor(order, 'VENDOR_REQUEST_EXPIRED', 'expired')


def expire_due(now=None):
    """Expire every overdue order/custom request. Safe to run concurrently."""
    now = now or timezone.now()
    count = 0
    due = Order.objects.filter(
        status=OrderStatus.PENDING_VENDOR_CONFIRMATION, vendor_response_deadline__lte=now,
    ).values_list('pk', flat=True)[:500]
    for pk in list(due):
        with transaction.atomic():
            order = lock_order(pk)
            if order.status == OrderStatus.PENDING_VENDOR_CONFIRMATION and order.vendor_response_deadline <= now:
                _expire_order(order)
                count += 1
    count += expire_custom_requests(now)
    return count


# ── Custom food requests & offers ────────────────────────────────────────────

def eligible_vendors_for(lat, lng, radius_km):
    from core.geo import bounding_box
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_km)
    candidates = VendorProfile.objects.filter(
        is_approved=True, is_online=True, owner__is_active=True,
        latitude__range=(min_lat, max_lat), longitude__range=(min_lng, max_lng),
    ).select_related('delivery_policy', 'owner')
    out = []
    for v in candidates:
        if not v.is_open_now():
            continue
        d = haversine_km(v.latitude, v.longitude, lat, lng)
        if d > radius_km:
            continue
        policy = getattr(v, 'delivery_policy', None)
        if policy is None or not (policy.offers_delivery or policy.offers_pickup):
            continue
        out.append((v, d))
    return sorted(out, key=lambda t: t[1])


@transaction.atomic
def create_custom_request(customer, *, description, delivery_address, latitude, longitude, delivery_landmark='',
                          quantity_description='', people_count=None, images=None, desired_time=None, budget_hint=None):
    radius = _cfg('CUSTOM_REQUEST_RADIUS_KM')
    vendors = eligible_vendors_for(latitude, longitude, radius)
    if not vendors:
        raise BusinessRuleError('No vendors are open near this location right now. Try again later.', 'NO_VENDORS_NEARBY')
    now = timezone.now()
    offers_deadline = now + timedelta(seconds=_cfg('CUSTOM_OFFER_WINDOW_SECONDS'))
    req = CustomFoodRequest.objects.create(
        customer=customer, description=description[:4000], quantity_description=quantity_description[:255],
        people_count=people_count, images=images or [], desired_time=desired_time, budget_hint=budget_hint,
        delivery_address=delivery_address[:255], delivery_landmark=(delivery_landmark or '')[:255],
        delivery_latitude=latitude, delivery_longitude=longitude, radius_km=Decimal(str(radius)),
        broadcast_at=now, offers_deadline=offers_deadline,
        selection_deadline=offers_deadline + timedelta(seconds=_cfg('CUSTOM_SELECTION_WINDOW_SECONDS')),
    )
    CustomRequestRecipient.objects.bulk_create([
        CustomRequestRecipient(request=req, vendor=v, distance_km=Decimal(str(round(d, 2))), notified_at=now)
        for v, d in vendors
    ])
    short = (description[:90] + '…') if len(description) > 90 else description
    for v, _ in vendors:
        for u in vendor_users(v):
            notify(u, 'VENDOR_NEW_CUSTOM', dedupe_key=f'custom:{req.pk}:new', ctx={'description': short},
                   custom_request=req)
    notify(customer, 'CUSTOM_REQUEST_SENT', dedupe_key=f'custom:{req.pk}:sent', ctx={'count': len(vendors)},
           custom_request=req)
    return req


def lock_custom_request(pk):
    return CustomFoodRequest.objects.select_for_update().select_related('customer').get(pk=pk)


def submit_offer(vendor, request_id, *, food_description, price, preparation_minutes, fulfillment_method,
                 delivery_terms=''):
    price = Decimal(price)
    if price <= 0:
        raise serializers.ValidationError({'price': 'Price must be more than 0.'})
    with transaction.atomic():
        req = lock_custom_request(request_id)
        if not req.recipients.filter(vendor=vendor).exists():
            raise PermissionDenied('This request was not sent to you.')
        now = timezone.now()
        if req.status not in (CustomRequestStatus.OPEN, CustomRequestStatus.OFFERS_RECEIVED) or now >= req.offers_deadline:
            raise BusinessRuleError('This request is no longer accepting offers.', 'OFFER_WINDOW_CLOSED')
        q = delivery.quote(vendor, fulfillment_method, req.delivery_latitude, req.delivery_longitude)
        if not q.eligible:
            raise BusinessRuleError(_quote_message(vendor, q.reason), q.reason)
        if Offer.objects.filter(request=req, vendor=vendor).exists():
            raise BusinessRuleError('You already sent an offer for this request.', 'OFFER_EXISTS')
        offer = Offer.objects.create(
            request=req, vendor=vendor, food_description=food_description[:4000], price=price,
            preparation_minutes=max(1, int(preparation_minutes)), fulfillment_method=fulfillment_method,
            delivery_fee=q.fee, delivery_terms=(delivery_terms or '')[:500],
        )
        if req.status == CustomRequestStatus.OPEN:
            req.status = CustomRequestStatus.OFFERS_RECEIVED
            req.save(update_fields=['status', 'updated_at'])
        notify(req.customer, 'CUSTOM_OFFER_RECEIVED', dedupe_key=f'custom:{req.pk}:offer:{offer.pk}',
               ctx={'vendor': vendor.business_name, 'price': f'{offer.total:,.0f}'}, custom_request=req)
    return offer


def withdraw_offer(vendor, offer_id):
    with transaction.atomic():
        offer = Offer.objects.select_for_update().get(pk=offer_id, vendor=vendor)
        if offer.status != OfferStatus.PENDING:
            raise BusinessRuleError('Only pending offers can be withdrawn.', 'OFFER_NOT_PENDING')
        offer.status = OfferStatus.WITHDRAWN
        offer.save(update_fields=['status', 'updated_at'])
        req = lock_custom_request(offer.request_id)
        if req.status == CustomRequestStatus.OFFERS_RECEIVED and not req.offers.filter(status=OfferStatus.PENDING).exists():
            req.status = CustomRequestStatus.OPEN
            req.save(update_fields=['status', 'updated_at'])
    return offer


def accept_offer(customer, offer_id):
    with transaction.atomic():
        offer = Offer.objects.select_related('vendor', 'vendor__owner').get(pk=offer_id)
        req = lock_custom_request(offer.request_id)
        offer = Offer.objects.select_for_update().select_related('vendor', 'vendor__owner').get(pk=offer_id)
        if req.customer_id != customer.id:
            raise PermissionDenied('Not your request.')
        now = timezone.now()
        if req.status not in (CustomRequestStatus.OPEN, CustomRequestStatus.OFFERS_RECEIVED) or now >= req.selection_deadline:
            raise BusinessRuleError('This request is closed.', 'REQUEST_CLOSED')
        if offer.status != OfferStatus.PENDING:
            raise BusinessRuleError('This offer is no longer available.', 'OFFER_NOT_PENDING')

        vendor = offer.vendor
        is_delivery = offer.fulfillment_method in Fulfillment.DELIVERY_METHODS
        distance = Decimal(str(round(haversine_km(vendor.latitude, vendor.longitude, req.delivery_latitude, req.delivery_longitude), 2)))
        order = Order.objects.create(
            order_type=OrderType.CUSTOM_DELIVERY, fulfillment_method=offer.fulfillment_method,
            status=OrderStatus.ACCEPTED, customer=customer, custom_request=req, accepted_offer=offer,
            **_vendor_snapshot(vendor),
            delivery_address=req.delivery_address if is_delivery else '',
            delivery_landmark=req.delivery_landmark if is_delivery else '',
            delivery_latitude=req.delivery_latitude if is_delivery else None,
            delivery_longitude=req.delivery_longitude if is_delivery else None,
            delivery_distance_km=distance if is_delivery else None,
            customer_instructions=req.description, subtotal=offer.price, delivery_fee=offer.delivery_fee,
            is_free_delivery=is_delivery and offer.delivery_fee == 0, total=offer.total,
            estimated_ready_minutes=offer.preparation_minutes, accepted_at=now,
        )
        OrderItem.objects.create(
            order=order, name='Custom order', description=offer.food_description,
            image_url=(req.images[0]['url'] if req.images else ''), image_path=(req.images[0]['path'] if req.images else ''),
            unit_price=offer.price, quantity=1, line_total=offer.price,
            instructions=f'Customer request: {req.description}'[:500],
        )
        _history(order, '', OrderStatus.ACCEPTED, customer, state.C, f'Offer #{offer.pk} accepted')

        offer.status = OfferStatus.ACCEPTED
        offer.save(update_fields=['status', 'updated_at'])
        losers = list(req.offers.filter(status=OfferStatus.PENDING).exclude(pk=offer.pk).select_related('vendor'))
        req.offers.filter(pk__in=[o.pk for o in losers]).update(status=OfferStatus.REJECTED, updated_at=now)
        req.status = CustomRequestStatus.ACCEPTED
        req.closed_at = now
        req.save(update_fields=['status', 'closed_at', 'updated_at'])
        for o in losers:
            for u in vendor_users(o.vendor):
                notify(u, 'VENDOR_OFFER_NOT_SELECTED', dedupe_key=f'custom:{req.pk}:not_selected', custom_request=req)
        _after_accept(order)
    return order


def cancel_custom_request(customer, request_id, reason_code, explanation=''):
    _validate_reason(state.C, reason_code, explanation)
    with transaction.atomic():
        req = lock_custom_request(request_id)
        if req.customer_id != customer.id:
            raise PermissionDenied('Not your request.')
        if req.status not in (CustomRequestStatus.OPEN, CustomRequestStatus.OFFERS_RECEIVED):
            raise BusinessRuleError('This request can no longer be cancelled here. Cancel the order instead.', 'REQUEST_CLOSED')
        prev = req.status
        req.status = CustomRequestStatus.CANCELLED
        req.closed_at = timezone.now()
        req.save(update_fields=['status', 'closed_at', 'updated_at'])
        req.offers.filter(status=OfferStatus.PENDING).update(status=OfferStatus.REJECTED)
        CancellationRecord.objects.create(
            kind=CancellationKind.CUSTOMER_CANCELLATION, reason_code=reason_code, explanation=explanation[:2000],
            actor=customer, actor_role=state.C, custom_request=req, status_at_cancellation=prev,
        )
    return req


def expire_custom_requests(now=None):
    now = now or timezone.now()
    count = 0
    candidates = CustomFoodRequest.objects.filter(
        status__in=[CustomRequestStatus.OPEN, CustomRequestStatus.OFFERS_RECEIVED], offers_deadline__lte=now,
    ).values_list('pk', flat=True)[:500]
    for pk in list(candidates):
        with transaction.atomic():
            req = lock_custom_request(pk)
            if req.status not in (CustomRequestStatus.OPEN, CustomRequestStatus.OFFERS_RECEIVED):
                continue
            has_offers = req.offers.filter(status=OfferStatus.PENDING).exists()
            if has_offers and now < req.selection_deadline:
                continue  # offers are waiting for the customer's choice
            code = 'OFFER_NOT_SELECTED' if has_offers else 'NO_OFFERS'
            prev = req.status
            req.status = CustomRequestStatus.EXPIRED
            req.closed_at = now
            req.save(update_fields=['status', 'closed_at', 'updated_at'])
            req.offers.filter(status=OfferStatus.PENDING).update(status=OfferStatus.EXPIRED)
            CancellationRecord.objects.create(
                kind=CancellationKind.AUTOMATIC_EXPIRY, reason_code=code, actor_role=state.SYS,
                custom_request=req, status_at_cancellation=prev,
            )
            notify(req.customer, 'CUSTOM_REQUEST_EXPIRED', dedupe_key=f'custom:{req.pk}:expired',
                   ctx={'reason': reasons.label(code, req.customer.preferred_language)}, custom_request=req,
                   data={'reason_code': code})
            count += 1
    return count
