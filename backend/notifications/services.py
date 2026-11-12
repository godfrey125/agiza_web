"""Notification dispatch.

`notify()` is called from inside business transactions. It writes the inbox
row immediately (so it rolls back with the transaction) and sends the FCM push
only after commit — a push is never sent for something that didn't happen.
"""
import hashlib
import logging

from django.db import IntegrityError, transaction

from core.firebase import has_credentials, require_credentials

from . import messages
from .models import DeviceToken, Notification

log = logging.getLogger('agiza.notifications')


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def register_device(user, token, platform):
    obj, _ = DeviceToken.objects.update_or_create(
        token_hash=token_hash(token),
        defaults={'user': user, 'token': token, 'platform': platform, 'failure_count': 0},
    )
    return obj


def notify(user, event, *, dedupe_key, ctx=None, order=None, custom_request=None, data=None):
    """Record + push a notification once per (user, dedupe_key)."""
    if user is None:
        return None
    channel, title, body = messages.render(event, user.preferred_language, ctx or {})
    payload = {'event': event, 'channel': channel, **{k: str(v) for k, v in (data or {}).items()}}
    if order is not None:
        payload.setdefault('order_id', str(order.pk))
    if custom_request is not None:
        payload.setdefault('custom_request_id', str(custom_request.pk))
    try:
        with transaction.atomic():
            note = Notification.objects.create(
                user=user, event=event, dedupe_key=dedupe_key[:160], title=title, body=body,
                data=payload, order=order, custom_request=custom_request,
            )
    except IntegrityError:
        log.info('Duplicate notification suppressed: user=%s key=%s', user.pk, dedupe_key)
        return None
    transaction.on_commit(lambda: send_push(note.pk))
    return note


def send_push(notification_id):
    note = Notification.objects.select_related('user').get(pk=notification_id)
    tokens = list(DeviceToken.objects.filter(user=note.user))
    if not tokens:
        return
    if not has_credentials():
        Notification.objects.filter(pk=note.pk).update(push_error='FIREBASE_CREDENTIALS not configured')
        return

    from firebase_admin import exceptions as fb_exceptions
    from firebase_admin import messaging

    app = require_credentials()
    channel = note.data.get('channel', messages.UPDATES)
    message = messaging.MulticastMessage(
        tokens=[t.token for t in tokens],
        notification=messaging.Notification(title=note.title, body=note.body),
        data={**note.data, 'notification_id': str(note.pk)},
        android=messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(channel_id=channel, tag=note.dedupe_key[:64]),
        ),
        apns=messaging.APNSConfig(payload=messaging.APNSPayload(aps=messaging.Aps(sound='default', thread_id=channel))),
    )
    try:
        response = messaging.send_each_for_multicast(message, app=app)
    except fb_exceptions.FirebaseError as exc:
        log.warning('FCM send failed for notification %s: %s', note.pk, exc)
        Notification.objects.filter(pk=note.pk).update(push_error=str(exc)[:255])
        return

    dead = []
    for token, result in zip(tokens, response.responses):
        if result.success:
            continue
        exc = result.exception
        if isinstance(exc, (messaging.UnregisteredError, messaging.SenderIdMismatchError)) or (
            isinstance(exc, fb_exceptions.InvalidArgumentError)
        ):
            dead.append(token.pk)
        else:
            DeviceToken.objects.filter(pk=token.pk).update(failure_count=token.failure_count + 1)
    if dead:
        DeviceToken.objects.filter(pk__in=dead).delete()
        log.info('Removed %d invalid FCM tokens for user %s', len(dead), note.user_id)
    Notification.objects.filter(pk=note.pk).update(push_sent_count=response.success_count)
