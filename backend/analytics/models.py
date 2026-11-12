from django.conf import settings
from django.db import models


class PageVisit(models.Model):
    DEVICE_CHOICES = (
        ('mobile', 'Mobile'),
        ('tablet', 'Tablet'),
        ('desktop', 'Desktop'),
        ('bot', 'Bot'),
        ('unknown', 'Unknown'),
    )

    visit_id = models.CharField(max_length=64, unique=True)
    visitor_id = models.CharField(max_length=64, db_index=True)
    session_id = models.CharField(max_length=64, db_index=True)
    path = models.CharField(max_length=255, db_index=True)
    full_path = models.CharField(max_length=1000, blank=True)
    referrer = models.CharField(max_length=1000, blank=True)
    referrer_host = models.CharField(max_length=255, blank=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='page_visits',
    )
    user_agent = models.CharField(max_length=1000, blank=True)
    device_type = models.CharField(max_length=20, choices=DEVICE_CHOICES, default='unknown')
    browser = models.CharField(max_length=60, blank=True)
    operating_system = models.CharField(max_length=60, blank=True)
    language = models.CharField(max_length=20, blank=True)
    is_bot = models.BooleanField(default=False, db_index=True)
    is_staff = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at', 'is_bot', 'is_staff']),
            models.Index(fields=['visitor_id', 'created_at']),
        ]

    def __str__(self):
        return f'{self.path} — {self.created_at:%Y-%m-%d %H:%M}'
