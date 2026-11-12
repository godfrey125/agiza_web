"""Live rider location via Firebase Realtime Database.

Django writes who may see/write `tracking/{orderId}`; the rider app writes
`tracking/{orderId}/location` directly; rules enforce the access list.
"""
import logging

from django.db import transaction

from core.firebase import has_credentials, require_credentials

log = logging.getLogger('agiza.realtime')


def open_tracking(job):
    order = job.order
    viewers = {order.customer.firebase_uid, order.vendor.owner.firebase_uid}
    payload = {
        'riderUid': job.rider.user.firebase_uid,
        'viewers': {uid: True for uid in viewers if uid},
        'active': True,
    }
    transaction.on_commit(lambda: _write(f'tracking/{order.pk}', payload, update=True))


def close_tracking(order_id):
    transaction.on_commit(lambda: _write(f'tracking/{order_id}', {'active': False}, update=True))


def _write(path, payload, update=False):
    if not has_credentials():
        log.info('Skipping RTDB write %s (no credentials).', path)
        return
    from firebase_admin import db

    ref = db.reference(path, app=require_credentials())
    try:
        ref.update(payload) if update else ref.set(payload)
    except Exception as exc:  # network errors must never break the order flow
        log.warning('RTDB write %s failed: %s', path, exc)
