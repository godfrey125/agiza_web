from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Address

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    vendor_id = serializers.SerializerMethodField()
    rider_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'name', 'display_name', 'email', 'phone', 'role', 'photo_url',
            'preferred_language', 'vendor_id', 'rider_id', 'date_joined',
        )
        read_only_fields = ('id', 'email', 'phone', 'role', 'date_joined')

    def get_vendor_id(self, obj):
        vendor = getattr(obj, 'vendor_profile', None) or getattr(getattr(obj, 'vendor_staff', None), 'vendor', None)
        return vendor.id if vendor else None

    def get_rider_id(self, obj):
        rider = getattr(obj, 'rider_profile', None)
        return rider.id if rider else None


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ('id', 'label', 'description', 'landmark', 'latitude', 'longitude', 'created_at')
        read_only_fields = ('id', 'created_at')
