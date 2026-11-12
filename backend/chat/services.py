import logging

from django.db import transaction
from django.utils import timezone

from core.firebase import has_credentials, require_credentials

from .models import Conversation

log = logging.getLogger('agiza.chat')


def _participants_for(order):
    users = {order.customer, order.vendor.owner}
    users.update(s.user for s in order.vendor.staff.filter(is_active=True).select_related('user'))
    job = getattr(order, 'delivery_job', None)
    if job and job.rider_id:
        users.add(job.rider.user)
    return users


def ensure_conversation(order):
    """Create/refresh the order chat and push its participant list to Firestore after commit."""
    conv, _ = Conversation.objects.get_or_create(order=order)
    conv.participants.set(_participants_for(order))
    transaction.on_commit(lambda: sync_to_firestore(conv.pk))
    return conv


def sync_to_firestore(conversation_id):
    if not has_credentials():
        log.info('Skipping Firestore sync for conversation %s (no credentials).', conversation_id)
        return False
    from firebase_admin import firestore

    conv = Conversation.objects.select_related('order', 'order__vendor').get(pk=conversation_id)
    uids = [u.firebase_uid for u in conv.participants.all() if u.firebase_uid]
    roles = {}
    for u in conv.participants.all():
        if not u.firebase_uid:
            continue
        roles[u.firebase_uid] = 'customer' if u.pk == conv.order.customer_id else (
            'rider' if getattr(u, 'rider_profile', None) else 'vendor')
    db = firestore.client(app=require_credentials())
    db.document(conv.firestore_path).set({
        'orderId': conv.order_id,
        'orderCode': conv.order.code,
        'vendorName': conv.order.vendor_name,
        'participantUids': uids,
        'participantRoles': roles,
        'closed': conv.is_closed,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    }, merge=True)
    Conversation.objects.filter(pk=conv.pk).update(firestore_synced_at=timezone.now())
    return True
