from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class DeviceToken(TimeStampedModel):
    """An FCM registration token. A user may have several devices."""

    class Platform(models.TextChoices):
        ANDROID = 'android'
        IOS = 'ios'
        WEB = 'web'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='device_tokens')
    token = models.CharField(max_length=4096)
    token_hash = models.CharField(max_length=64, unique=True)
    platform = models.CharField(max_length=10, choices=Platform.choices)
    last_seen_at = models.DateTimeField(auto_now=True)
    failure_count = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f'{self.platform} token for {self.user}'


class Notification(TimeStampedModel):
    """In-app inbox entry; also the record that a push was (or wasn't) sent.

    `dedupe_key` is unique per user, so the same business event can never
    notify the same person twice — even if code paths retry.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    event = models.CharField(max_length=48, db_index=True)
    dedupe_key = models.CharField(max_length=160)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=500)
    data = models.JSONField(default=dict, blank=True)
    order = models.ForeignKey('orders.Order', null=True, blank=True, on_delete=models.CASCADE, related_name='notifications')
    custom_request = models.ForeignKey('orders.CustomFoodRequest', null=True, blank=True, on_delete=models.CASCADE, related_name='notifications')
    read_at = models.DateTimeField(null=True, blank=True)
    push_sent_count = models.PositiveSmallIntegerField(default=0)
    push_error = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'dedupe_key'], name='notification_once_per_event')]
