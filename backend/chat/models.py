"""Chat metadata. Message bodies live in Firestore (`conversations/{id}/messages`).

Django decides *who* may talk about an order and writes the participant list
to Firestore; security rules then only allow those Firebase UIDs to read/write.
"""
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class Conversation(TimeStampedModel):
    order = models.OneToOneField('orders.Order', on_delete=models.CASCADE, related_name='conversation')
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='conversations')
    firestore_synced_at = models.DateTimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)

    @property
    def firestore_path(self):
        return f'conversations/{self.pk}'

    def __str__(self):
        return f'Chat for {self.order.code}'
