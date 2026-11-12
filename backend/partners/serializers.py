from rest_framework import serializers

from .models import ApplicationAttachment, ApplicationRequirement, PartnerApplication


class RequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationRequirement
        fields = [
            'id',
            'code',
            'application_type',
            'label',
            'label_sw',
            'description',
            'description_sw',
            'mandatory',
            'allowed_types',
            'max_size_mb',
            'applies_to',
            'category',
            'sort_order',
        ]


class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationAttachment
        fields = ['id', 'code', 'label', 'kind', 'url', 'created_at']

    def get_url(self, obj):
        request = self.context.get('request')
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url


class PartnerApplicationSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    submitted_at = serializers.DateTimeField(source='created_at', read_only=True)
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = PartnerApplication
        fields = [
            'id',
            'reference',
            'application_type',
            'status',
            'submitted_at',
            'updated_at',
            'reviewer_name',
            'decision_reason',
            'requested_information',
            'attachments',
        ]

    def get_reviewer_name(self, obj):
        if not obj.reviewer:
            return None
        return obj.reviewer.name or obj.reviewer.display_name or obj.reviewer.username


class AdminApplicationSerializer(PartnerApplicationSerializer):
    class Meta(PartnerApplicationSerializer.Meta):
        fields = PartnerApplicationSerializer.Meta.fields + [
            'applicant',
            'applicant_name',
            'applicant_phone',
            'applicant_email',
            'payload',
            'internal_notes',
            'decided_at',
        ]
