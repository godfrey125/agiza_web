from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class ViolationCategory(models.TextChoices):
    FRAUD = 'FRAUD', 'Fraud or financial abuse'
    FAKE_DOCUMENTS = 'FAKE_DOCUMENTS', 'Fake or altered documents'
    ILLEGAL_ACTIVITY = 'ILLEGAL_ACTIVITY', 'Illegal activity'
    FOOD_SAFETY = 'FOOD_SAFETY', 'Food safety or hygiene'
    ABUSIVE_BEHAVIOUR = 'ABUSIVE_BEHAVIOUR', 'Abusive behaviour'
    PAYMENT_ABUSE = 'PAYMENT_ABUSE', 'Payment or refund abuse'
    ACCOUNT_SECURITY = 'ACCOUNT_SECURITY', 'Account security'
    TERMS_VIOLATION = 'TERMS_VIOLATION', 'Terms of service violation'
    SPAM = 'SPAM', 'Spam or misleading content'
    OTHER = 'OTHER', 'Other'


class ActionType(models.TextChoices):
    WARNING = 'WARNING', 'Issue warning'
    SUSPEND = 'SUSPEND', 'Temporary suspension'
    TERMINATE = 'TERMINATE', 'Permanent termination'
    RESTRICT = 'RESTRICT', 'Restrict selected features'
    DISABLE_LOGIN = 'DISABLE_LOGIN', 'Disable sign-in'
    ENABLE_LOGIN = 'ENABLE_LOGIN', 'Enable sign-in'
    REVOKE_SESSIONS = 'REVOKE_SESSIONS', 'Revoke active sessions'
    RESTORE = 'RESTORE', 'Restore account'
    REQUEST_VERIFICATION = 'REQUEST_VERIFICATION', 'Request additional verification'
    INVESTIGATE = 'INVESTIGATE', 'Open investigation'
    NOTE = 'NOTE', 'Internal note only'


class AccountAction(TimeStampedModel):
    """A permanent, human-readable governance record for one account."""

    target = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='account_actions'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    action = models.CharField(max_length=24, choices=ActionType.choices, db_index=True)
    violation_category = models.CharField(max_length=24, choices=ViolationCategory.choices, db_index=True)
    reason = models.TextField()
    evidence = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    duration_days = models.PositiveSmallIntegerField(null=True, blank=True)
    effective_until = models.DateTimeField(null=True, blank=True)
    previous_state = models.CharField(max_length=24, blank=True)
    new_state = models.CharField(max_length=24, blank=True)
    restriction_flags = models.JSONField(default=list, blank=True)
    request_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['target', '-created_at']),
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['violation_category', '-created_at']),
        ]

    def __str__(self):
        return f'{self.get_action_display()} — {self.target_id}'


class AppealStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under review'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class AccountAppeal(TimeStampedModel):
    """A user-initiated request to review a governance decision."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='account_appeals'
    )
    action = models.ForeignKey(
        AccountAction, null=True, blank=True, on_delete=models.SET_NULL, related_name='appeals'
    )
    message = models.TextField()
    status = models.CharField(
        max_length=16, choices=AppealStatus.choices, default=AppealStatus.PENDING, db_index=True
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    decision_reason = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Appeal by {self.user_id} ({self.status})'


class AdminAuditLog(models.Model):
    """Append-only record of sensitive administrative operations."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    actor_label = models.CharField(max_length=160, blank=True)
    action = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=48, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    target_label = models.CharField(max_length=255, blank=True)
    reason = models.TextField(blank=True)
    previous_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    request_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['target_type', 'target_id']),
        ]

    def __str__(self):
        return f'{self.action} by {self.actor_label or "system"}'

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError('Audit records are immutable.')
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('Audit records cannot be deleted.')
