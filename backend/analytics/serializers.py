from rest_framework import serializers


class TrackVisitSerializer(serializers.Serializer):
    visit_id = serializers.CharField(max_length=64)
    visitor_id = serializers.CharField(max_length=64)
    session_id = serializers.CharField(max_length=64)
    path = serializers.CharField(max_length=255)
    full_path = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    referrer = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    language = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_path(self, value):
        if not value.startswith('/'):
            raise serializers.ValidationError('Path must start with /.')
        return value
