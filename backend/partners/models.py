import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel


class ApplicationType(models.TextChoices):
    VENDOR = 'vendor', 'Vendor'
    RIDER = 'rider', 'Rider'


class ApplicationStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    PENDING_REVIEW = 'PENDING_REVIEW', 'Pending review'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under review'
    ADDITIONAL_INFORMATION_REQUIRED = 'ADDITIONAL_INFORMATION_REQUIRED', 'Additional information required'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class ApplicationRequirement(models.Model):
    """A document or image the website asks an applicant to upload."""

    class Category(models.TextChoices):
        BUSINESS = 'business', 'Business'
        IDENTITY = 'identity', 'Identity'
        VEHICLE = 'vehicle', 'Vehicle'
        PROFILE = 'profile', 'Profile'
        OTHER = 'other', 'Other'

    application_type = models.CharField(max_length=10, choices=ApplicationType.choices)
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=160)
    label_sw = models.CharField(max_length=160, blank=True)
    description = models.TextField(blank=True)
    description_sw = models.TextField(blank=True)
    mandatory = models.BooleanField(default=True)
    allowed_types = models.JSONField(default=list, blank=True)
    max_size_mb = models.PositiveIntegerField(default=10)
    applies_to = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.OTHER)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['application_type', 'code'], name='unique_requirement_per_type'
            )
        ]

    def __str__(self):
        return f'{self.application_type}:{self.code}'


def application_upload_path(instance, filename):
    application = instance.application
    safe = ''.join(ch for ch in filename if ch.isalnum() or ch in '._-') or 'upload'
    return f'applications/{application.application_type}/{application.reference}/{safe}'


class PartnerApplication(TimeStampedModel):
    """A vendor or rider application submitted from the Agiza website."""

    reference = models.CharField(max_length=40, unique=True, editable=False)
    application_type = models.CharField(max_length=10, choices=ApplicationType.choices)
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='partner_applications',
    )
    applicant_name = models.CharField(max_length=200, blank=True)
    applicant_phone = models.CharField(max_length=32, blank=True)
    applicant_email = models.EmailField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=40, choices=ApplicationStatus.choices, default=ApplicationStatus.SUBMITTED
    )
    decision_reason = models.TextField(blank=True)
    requested_information = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_partner_applications',
    )
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['application_type', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.reference} ({self.application_type}, {self.status})'

    def save(self, *args, **kwargs):
        if not self.reference:
            prefix = 'AGZ-V' if self.application_type == ApplicationType.VENDOR else 'AGZ-R'
            for _ in range(10):
                candidate = f'{prefix}-{timezone.now():%y%m%d}-{secrets.token_hex(3).upper()}'
                if not PartnerApplication.objects.filter(reference=candidate).exists():
                    self.reference = candidate
                    break
            else:  # pragma: no cover - astronomically unlikely
                self.reference = f'{prefix}-{secrets.token_hex(8).upper()}'
        super().save(*args, **kwargs)


class ApplicationAttachment(models.Model):
    """A stored document or image belonging to an application."""

    class Kind(models.TextChoices):
        DOCUMENT = 'document', 'Document'
        IMAGE = 'image', 'Image'

    application = models.ForeignKey(
        PartnerApplication, on_delete=models.CASCADE, related_name='attachments'
    )
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=160, blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.DOCUMENT)
    file = models.FileField(upload_to=application_upload_path)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.application.reference}:{self.code}'
