"""Delivery jobs for PLATFORM_RIDER orders."""
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from core.exceptions import BusinessRuleError
from core.geo import haversine_km, road_distance_km
from notifications.services import notify
from orders import state
from orders.models import OrderStatus

from . import realtime
from .models import DeliveryJob, RiderProfile

ACTIVE_JOB_STATUSES = (DeliveryJob.Status.ASSIGNED, DeliveryJob.Status.PICKED_UP)
MAX_ACTIVE_JOBS = 1


def _ctx(job, **extra):
    order = job.order
    return {
        'code': order.code, 'vendor': order.vendor_name, 'pickup': job.pickup_name,
        'dropoff': job.dropoff_landmark or job.dropoff_address, 'earning': f'{job.rider_earning:,.0f}', **extra,
    }


def open_job(order):
    """Create the job when the vendor accepts; notify nearby online riders."""
    job, created = DeliveryJob.objects.get_or_create(order=order, defaults=dict(
        pickup_name=order.vendor_name, pickup_address=order.vendor_address,
        pickup_latitude=order.vendor_latitude, pickup_longitude=order.vendor_longitude,
        dropoff_address=order.delivery_address, dropoff_landmark=order.delivery_landmark,
        dropoff_latitude=order.delivery_latitude, dropoff_longitude=order.delivery_longitude,
        distance_km=order.delivery_distance_km, delivery_fee=order.delivery_fee, rider_tip=order.rider_tip,
    ))
    if created:
        for rider in nearby_online_riders(order.vendor_latitude, order.vendor_longitude):
            notify(rider.user, 'RIDER_NEW_JOB', dedupe_key=f'job:{job.pk}:new', ctx=_ctx(job), order=order,
                   data={'job_id': job.pk})
    return job


def nearby_online_riders(lat, lng):
    radius = settings.AGIZA['RIDER_JOB_RADIUS_KM']
    riders = RiderProfile.objects.filter(is_online=True, is_approved=True, user__is_active=True).select_related('user')
    out = []
    for r in riders:
        if r.last_latitude is None or haversine_km(r.last_latitude, r.last_longitude, lat, lng) <= radius:
            out.append(r)
    return out


def available_jobs_for(rider):
    jobs = DeliveryJob.objects.filter(status=DeliveryJob.Status.OPEN).select_related('order')
    radius = settings.AGIZA['RIDER_JOB_RADIUS_KM']
    out = []
    for job in jobs:
        if rider.last_latitude is not None:
            job.distance_to_pickup_km = round(
                road_distance_km(rider.last_latitude, rider.last_longitude, job.pickup_latitude, job.pickup_longitude), 2)
            if job.distance_to_pickup_km > radius * settings.AGIZA['ROAD_DISTANCE_FACTOR']:
                continue
        else:
            job.distance_to_pickup_km = None
        out.append(job)
    return sorted(out, key=lambda j: (j.distance_to_pickup_km is None, j.distance_to_pickup_km or 0))


def _lock_job(job_id):
    return DeliveryJob.objects.select_for_update().select_related('order', 'order__customer', 'order__vendor').get(pk=job_id)


def accept_job(rider, job_id):
    from orders.services import _apply, _ctx as order_ctx, _notify_vendor, lock_order

    with transaction.atomic():
        RiderProfile.objects.select_for_update().get(pk=rider.pk)  # serialise this rider's accepts
        if not rider.is_online or not rider.is_approved:
            raise BusinessRuleError('Go online to accept jobs.', 'RIDER_OFFLINE')
        if DeliveryJob.objects.filter(rider=rider, status__in=ACTIVE_JOB_STATUSES).count() >= MAX_ACTIVE_JOBS:
            raise BusinessRuleError('Finish your current delivery first.', 'RIDER_BUSY')
        job = _lock_job(job_id)
        if job.status != DeliveryJob.Status.OPEN:
            raise BusinessRuleError('Another rider already took this job.', 'JOB_TAKEN')
        order = lock_order(job.order_id)
        job.rider, job.status, job.assigned_at = rider, DeliveryJob.Status.ASSIGNED, timezone.now()
        job.save()
        if order.status in (OrderStatus.AWAITING_RIDER,):
            _apply(order, OrderStatus.RIDER_ASSIGNED, rider.user, state.SYS, f'Rider {rider.user.name} accepted')
        from chat.services import ensure_conversation
        ensure_conversation(order)
        realtime.open_tracking(job)
        ctx = order_ctx(order, rider=rider.user.name)
        notify(order.customer, 'ORDER_RIDER_ASSIGNED', dedupe_key=f'order:{order.pk}:rider:{rider.pk}', ctx=ctx, order=order)
        _notify_vendor(order, 'VENDOR_RIDER_ASSIGNED', f'rider:{rider.pk}', rider=rider.user.name)
        notify(rider.user, 'RIDER_JOB_ASSIGNED', dedupe_key=f'job:{job.pk}:assigned:{rider.pk}', ctx=_ctx(job), order=order)
    return job


def release_job(rider, job_id, reason_code, explanation=''):
    """Rider gives the job back before pickup; it reopens for other riders."""
    from orders.models import CancellationKind
    from orders.services import _apply, _record_cancellation, _validate_reason, lock_order

    _validate_reason(state.R, reason_code, explanation)
    with transaction.atomic():
        job = _lock_job(job_id)
        if job.rider_id != rider.pk:
            raise PermissionDenied('Not your job.')
        if job.status != DeliveryJob.Status.ASSIGNED:
            raise BusinessRuleError('You can only release a job before pickup.', 'JOB_NOT_RELEASABLE')
        order = lock_order(job.order_id)
        _record_cancellation(order, CancellationKind.RIDER_RELEASE, reason_code, explanation, rider.user, state.R, order.status)
        job.rider, job.status, job.assigned_at = None, DeliveryJob.Status.OPEN, None
        job.save()
        if order.status == OrderStatus.RIDER_ASSIGNED:
            _apply(order, OrderStatus.AWAITING_RIDER, rider.user, state.SYS, f'Rider released: {reason_code}')
        realtime.close_tracking(order.pk)
        for r in nearby_online_riders(order.vendor_latitude, order.vendor_longitude):
            if r.pk != rider.pk:
                notify(r.user, 'RIDER_NEW_JOB', dedupe_key=f'job:{job.pk}:reopen:{timezone.now():%H%M%S}',
                       ctx=_ctx(job), order=order, data={'job_id': job.pk})
    return job


def rider_progress(order, user, to_status):
    """PICKED_UP / OUT_FOR_DELIVERY / DELIVERED by the assigned rider (order already locked)."""
    from orders.services import _after_progress, _apply

    job = DeliveryJob.objects.select_for_update().get(order=order)
    if job.rider is None or job.rider.user_id != user.id:
        raise PermissionDenied('Not your delivery.')
    _apply(order, to_status, user, state.R)
    now = timezone.now()
    if to_status == OrderStatus.PICKED_UP:
        job.status, job.picked_up_at = DeliveryJob.Status.PICKED_UP, now
    elif to_status == OrderStatus.DELIVERED:
        job.status, job.delivered_at = DeliveryJob.Status.DELIVERED, now
        RiderProfile.objects.filter(pk=job.rider_id).update(total_deliveries=F('total_deliveries') + 1)
    job.save()
    _after_progress(order, user, state.R)
    return order


def on_customer_confirmed_delivery(order):
    # Re-read under lock: the order's cached job may be stale if the rider just confirmed.
    job = DeliveryJob.objects.select_for_update().filter(order=order).first()
    if job and job.status != DeliveryJob.Status.DELIVERED and job.rider_id:
        job.status, job.delivered_at = DeliveryJob.Status.DELIVERED, timezone.now()
        job.save()
        RiderProfile.objects.filter(pk=job.rider_id).update(total_deliveries=F('total_deliveries') + 1)
