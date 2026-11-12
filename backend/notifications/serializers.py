from rest_framework import serializers

from .models import DeviceToken, Notification


class DeviceTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=4096)
    platform = serializers.ChoiceField(choices=DeviceToken.Platform.choices)


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ('id', 'event', 'title', 'body', 'data', 'order', 'custom_request', 'is_read', 'created_at')

    def get_is_read(self, obj):
        return obj.read_at is not None
