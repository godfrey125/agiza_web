from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel


class User(AbstractUser):
    """An Agiza account. Identity is owned by Firebase Auth (`firebase_uid`)."""

    class Role(models.TextChoices):
        CUSTOMER = 'CUSTOMER', 'Customer'
        VENDOR = 'VENDOR', 'Vendor'
        RIDER = 'RIDER', 'Rider'
        ADMIN = 'ADMIN', 'Admin'

    class Language(models.TextChoices):
        SWAHILI = 'sw', 'Kiswahili'
        ENGLISH = 'en', 'English'

    class AccountState(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        WARNING = 'WARNING', 'Warning issued'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under review'
        TEMPORARILY_SUSPENDED = 'TEMPORARILY_SUSPENDED', 'Temporarily suspended'
        RESTRICTED = 'RESTRICTED', 'Restricted'
        TERMINATED = 'TERMINATED', 'Terminated'
        PENDING_VERIFICATION = 'PENDING_VERIFICATION', 'Pending verification'
        REJECTED = 'REJECTED', 'Rejected'

    class StaffRole(models.TextChoices):
        NONE = 'NONE', 'No staff role'
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super admin'
        OPERATIONS_MANAGER = 'OPERATIONS_MANAGER', 'Operations manager'
        VERIFICATION_OFFICER = 'VERIFICATION_OFFICER', 'Verification officer'
        FINANCE_OFFICER = 'FINANCE_OFFICER', 'Finance officer'
        CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT', 'Customer support'
        TRUST_SAFETY_OFFICER = 'TRUST_SAFETY_OFFICER', 'Trust and safety officer'
        CONTENT_MANAGER = 'CONTENT_MANAGER', 'Content manager'

    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    firebase_uid = models.CharField(max_length=128, unique=True, null=True, blank=True)
    supabase_uid = models.UUIDField(
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='Supabase auth.users id for Google/email sign-in.',
    )
    phone = models.CharField(max_length=16, unique=True, null=True, blank=True, help_text='E.164, e.g. +255712345678')
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
    staff_role = models.CharField(
        max_length=32,
        choices=StaffRole.choices,
        default=StaffRole.NONE,
        db_index=True,
        help_text='Granular admin role. Only used for staff accounts.',
    )
    display_name = models.CharField(max_length=120, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    preferred_language = models.CharField(max_length=2, choices=Language.choices, default=Language.SWAHILI)

    # Account governance. Records are never deleted; states are changed with an audit trail.
    account_state = models.CharField(
        max_length=24, choices=AccountState.choices, default=AccountState.ACTIVE, db_index=True
    )
    account_state_reason = models.TextField(blank=True)
    account_state_updated_at = models.DateTimeField(null=True, blank=True)
    account_state_updated_by = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    suspended_until = models.DateTimeField(null=True, blank=True, db_index=True)
    restriction_flags = models.JSONField(default=list, blank=True)
    login_disabled = models.BooleanField(default=False)
    risk_level = models.CharField(
        max_length=10, choices=RiskLevel.choices, default=RiskLevel.LOW, db_index=True
    )
    risk_score = models.PositiveSmallIntegerField(default=0)
    auth_epoch = models.PositiveIntegerField(
        default=0,
        help_text='Increment to invalidate every previously issued website JWT.',
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name} ({self.role})'

    @property
    def name(self):
        return self.display_name or self.get_full_name() or self.phone or self.email or self.username

    @property
    def is_suspended(self):
        return (
            self.account_state == self.AccountState.TEMPORARILY_SUSPENDED
            and self.suspended_until is not None
            and self.suspended_until > timezone.now()
        )

    @property
    def is_terminated(self):
        return self.account_state == self.AccountState.TERMINATED

    def refresh_suspension(self, save=True):
        """Lift an expired temporary suspension back to active."""
        if (
            self.account_state == self.AccountState.TEMPORARILY_SUSPENDED
            and self.suspended_until is not None
            and self.suspended_until <= timezone.now()
        ):
            self.account_state = self.AccountState.ACTIVE
            self.account_state_reason = ''
            self.suspended_until = None
            self.restriction_flags = []
            self.account_state_updated_at = timezone.now()
            if save:
                self.save(
                    update_fields=[
                        'account_state',
                        'account_state_reason',
                        'suspended_until',
                        'restriction_flags',
                        'account_state_updated_at',
                        'updated_at',
                    ]
                )
        return self


class CustomerProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer_profile')
    default_address = models.ForeignKey(
        'users.Address', null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )

    def __str__(self):
        return f'Customer {self.user.name}'


class Address(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=60, help_text='e.g. Home, Kazini')
    description = models.CharField(max_length=255)
    landmark = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.label}: {self.description}'
