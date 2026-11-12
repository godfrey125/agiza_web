from django.db.models.signals import post_save
from django.dispatch import receiver

from users.claims import sync_claims

from .models import DeliveryPolicy, VendorProfile, VendorStaff


@receiver(post_save, sender=VendorProfile)
def vendor_saved(sender, instance, created, **kwargs):
    if created:
        DeliveryPolicy.objects.get_or_create(vendor=instance)
        sync_claims(instance.owner)


@receiver(post_save, sender=VendorStaff)
def staff_saved(sender, instance, **kwargs):
    sync_claims(instance.user)
