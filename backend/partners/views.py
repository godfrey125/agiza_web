import json

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from rest_framework.views import APIView

from .models import (
    ApplicationAttachment,
    ApplicationRequirement,
    ApplicationStatus,
    ApplicationType,
    PartnerApplication,
)
from .permissions import IsPlatformAdmin
from .serializers import (
    AdminApplicationSerializer,
    PartnerApplicationSerializer,
    RequirementSerializer,
)

IMAGE_TYPES = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp'}
DOCUMENT_TYPES = IMAGE_TYPES | {'application/pdf'}

FIXED_IMAGES = {
    'profile_image': 'Profile image',
    'logo': 'Business logo',
    'premises_photo_1': 'Premises photo 1',
    'premises_photo_2': 'Premises photo 2',
    'premises_photo_3': 'Premises photo 3',
    'food_photo_1': 'Food photo 1',
    'food_photo_2': 'Food photo 2',
    'food_photo_3': 'Food photo 3',
    'vehicle_photo': 'Vehicle photo',
    'vehicle_photo_1': 'Vehicle photo 1',
    'vehicle_photo_2': 'Vehicle photo 2',
}

ACTIVE_STATUSES = (
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.PENDING_REVIEW,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
)

DECISION_STATUS = {
    'approve': ApplicationStatus.APPROVED,
    'reject': ApplicationStatus.REJECTED,
    'request_info': ApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    'suspend': ApplicationStatus.SUSPENDED,
}


def _application_type(value):
    if value not in ApplicationType.values:
        raise NotFound('Unknown application type.')
    return value


def _validate_file(upload, requirement=None):
    max_mb = requirement.max_size_mb if requirement else 10
    if upload.size > max_mb * 1024 * 1024:
        raise ValidationError({upload.name: f'File is larger than {max_mb} MB.'})
    content_type = (getattr(upload, 'content_type', '') or '').lower()
    if not content_type:
        return
    allowed = (
        [value.lower() for value in requirement.allowed_types]
        if requirement and requirement.allowed_types
        else sorted(DOCUMENT_TYPES)
    )
    if content_type not in allowed:
        raise ValidationError({upload.name: f'Unsupported file type: {content_type}.'})


class RequirementListView(ListAPIView):
    """`GET /api/partner/application-requirements/?application_type=vendor`."""

    permission_classes = [AllowAny]
    serializer_class = RequirementSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = ApplicationRequirement.objects.all()
        app_type = self.request.query_params.get('application_type')
        if app_type:
            queryset = queryset.filter(application_type=app_type)
        return queryset


class ApplicationSubmitView(APIView):
    """`POST /api/partner/vendor-applications/` (multipart)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, application_type):
        application_type = _application_type(application_type)
        payload = request.data.get('payload')
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError as exc:
                raise ValidationError({'payload': 'payload must be valid JSON.'}) from exc
        if not isinstance(payload, dict):
            payload = {}

        existing = (
            PartnerApplication.objects.filter(
                applicant=request.user,
                application_type=application_type,
                status__in=ACTIVE_STATUSES,
            )
            .order_by('-created_at')
            .first()
        )
        if existing:
            data = PartnerApplicationSerializer(existing, context={'request': request}).data
            data['detail'] = 'An application is already under review.'
            return Response(data, status=status.HTTP_200_OK)

        requirements = {
            requirement.code: requirement
            for requirement in ApplicationRequirement.objects.filter(application_type=application_type)
        }

        missing = [
            requirement.code
            for requirement in requirements.values()
            if requirement.mandatory and f'document_{requirement.code}' not in request.FILES
        ]
        if missing:
            raise ValidationError(
                {'documents': f'Missing required documents: {", ".join(sorted(missing))}.'}
            )

        applicant_name = (
            payload.get('fullName')
            or payload.get('businessName')
            or getattr(request.user, 'name', '')
            or request.user.display_name
            or request.user.username
        )
        application = PartnerApplication.objects.create(
            application_type=application_type,
            applicant=request.user,
            applicant_name=str(applicant_name)[:200],
            applicant_phone=str(
                payload.get('phone') or payload.get('businessPhone') or request.user.phone or ''
            )[:32],
            applicant_email=str(payload.get('email') or request.user.email or '')[:254],
            payload=payload,
            status=ApplicationStatus.SUBMITTED,
        )

        for field_name, upload in request.FILES.items():
            if field_name.startswith('document_'):
                code = field_name[len('document_'):]
                requirement = requirements.get(code)
                if not requirement:
                    raise ValidationError({field_name: 'Unknown document code.'})
                _validate_file(upload, requirement)
                ApplicationAttachment.objects.create(
                    application=application,
                    code=code,
                    label=requirement.label,
                    kind=ApplicationAttachment.Kind.DOCUMENT,
                    file=upload,
                )
            elif field_name in FIXED_IMAGES:
                _validate_file(upload)
                ApplicationAttachment.objects.create(
                    application=application,
                    code=field_name,
                    label=FIXED_IMAGES[field_name],
                    kind=ApplicationAttachment.Kind.IMAGE,
                    file=upload,
                )

        return Response(
            {
                'id': application.id,
                'reference': application.reference,
                'submitted_at': application.created_at,
                'status': application.status,
            },
            status=status.HTTP_201_CREATED,
        )


class MyApplicationView(APIView):
    """`GET /api/partner/vendor-applications/me/`."""

    permission_classes = [IsAuthenticated]

    def get(self, request, application_type):
        application_type = _application_type(application_type)
        application = (
            PartnerApplication.objects.filter(
                applicant=request.user, application_type=application_type
            )
            .prefetch_related('attachments')
            .order_by('-created_at')
            .first()
        )
        if not application:
            raise NotFound('No application has been submitted yet.')
        return Response(
            PartnerApplicationSerializer(application, context={'request': request}).data
        )


class AdminApplicationListView(ListAPIView):
    """`GET /api/partner/admin/applications/?type=vendor&status=UNDER_REVIEW`."""

    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminApplicationSerializer

    def get_queryset(self):
        queryset = PartnerApplication.objects.select_related('applicant', 'reviewer').prefetch_related(
            'attachments'
        )
        app_type = self.request.query_params.get('type')
        app_status = self.request.query_params.get('status')
        if app_type and app_type != 'all':
            queryset = queryset.filter(application_type=app_type)
        if app_status and app_status != 'all':
            queryset = queryset.filter(status=app_status)
        return queryset


class AdminApplicationDecisionView(APIView):
    """`POST /api/partner/admin/applications/<id>/decision/`."""

    permission_classes = [IsPlatformAdmin]

    def post(self, request, pk):
        application = get_object_or_404(PartnerApplication, pk=pk)
        decision = str(request.data.get('decision') or '').strip()
        reason = str(request.data.get('reason') or '').strip()
        if decision not in DECISION_STATUS:
            raise ValidationError(
                {'decision': 'decision must be approve, reject, request_info or suspend.'}
            )
        if decision != 'approve' and not reason:
            raise ValidationError({'reason': 'A reason is required for this decision.'})
        if application.status in (ApplicationStatus.APPROVED, ApplicationStatus.REJECTED):
            raise ValidationError({'detail': 'This application has already been decided.'})

        application.status = DECISION_STATUS[decision]
        application.reviewer = request.user
        application.decided_at = timezone.now()
        if decision == 'request_info':
            application.requested_information = reason
        else:
            application.decision_reason = reason
        application.save(
            update_fields=[
                'status',
                'reviewer',
                'decided_at',
                'decision_reason',
                'requested_information',
                'updated_at',
            ]
        )

        if decision == 'approve' and application.applicant:
            new_role = (
                'VENDOR' if application.application_type == ApplicationType.VENDOR else 'RIDER'
            )
            applicant = application.applicant
            if applicant.role == 'CUSTOMER':
                applicant.role = new_role
                applicant.save(update_fields=['role'])

        return Response(
            AdminApplicationSerializer(application, context={'request': request}).data
        )
