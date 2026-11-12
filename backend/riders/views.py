from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from core.geo import money_str
from orders.models import OrderStatus
from orders.serializers import ReasonSerializer
from orders.services import transition

from . import services
from .models import DeliveryJob, RiderProfile
from .serializers import DeliveryJobSerializer, RiderProfileSerializer


def require_rider(user):
    rider = RiderProfile.objects.filter(user=user).select_related('user').first()
    if rider is None:
        raise PermissionDenied('This action is only for rider accounts.')
    return rider


class MyRiderView(generics.RetrieveUpdateAPIView):
    serializer_class = RiderProfileSerializer

    def get_object(self):
        return require_rider(self.request.user)


class RiderOnlineView(APIView):
    def post(self, request):
        rider = require_rider(request.user)
        value = request.data.get('is_online')
        if not isinstance(value, bool):
            raise serializers.ValidationError({'is_online': 'true or false required.'})
        if value and not rider.is_approved:
            return Response({'error': {'code': 'RIDER_NOT_APPROVED', 'message': 'Your rider account is waiting for approval.'}}, status=409)
        rider.is_online = value
        rider.save(update_fields=['is_online', 'updated_at'])
        return Response({'is_online': rider.is_online})


class RiderLocationView(APIView):
    """Coarse location for job matching (call about once a minute while online)."""

    def post(self, request):
        rider = require_rider(request.user)
        try:
            lat, lng = Decimal(str(request.data['latitude'])), Decimal(str(request.data['longitude']))
        except (KeyError, ArithmeticError, ValueError):
            raise serializers.ValidationError('latitude and longitude are required.')
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise serializers.ValidationError('Coordinates out of range.')
        rider.last_latitude, rider.last_longitude = round(lat, 6), round(lng, 6)
        rider.last_location_at = timezone.now()
        rider.save(update_fields=['last_latitude', 'last_longitude', 'last_location_at', 'updated_at'])
        return Response({'ok': True})


class RiderEarningsView(APIView):
    def get(self, request):
        rider = require_rider(request.user)
        done = DeliveryJob.objects.filter(rider=rider, status=DeliveryJob.Status.DELIVERED)
        today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)

        def total(qs):
            agg = qs.aggregate(fee=Sum('delivery_fee'), tip=Sum('rider_tip'))
            return money_str((agg['fee'] or 0) + (agg['tip'] or 0))
        return Response({
            'total_deliveries': done.count(), 'total_earnings': total(done),
            'today_deliveries': done.filter(delivered_at__gte=today).count(),
            'today_earnings': total(done.filter(delivered_at__gte=today)),
        })


class DeliveryJobViewSet(viewsets.ReadOnlyModelViewSet):
    """`/deliveries/` = my jobs; `/deliveries/available/` = open jobs near me."""

    serializer_class = DeliveryJobSerializer

    def get_rider(self):
        if not hasattr(self, '_rider'):
            self._rider = require_rider(self.request.user)
        return self._rider

    def get_queryset(self):
        qs = DeliveryJob.objects.filter(rider=self.get_rider()).select_related('order', 'order__customer', 'rider__user')
        if self.request.query_params.get('status'):
            qs = qs.filter(status__in=self.request.query_params['status'].split(','))
        return qs

    @action(detail=False)
    def available(self, request):
        rider = self.get_rider()
        if not rider.is_online:
            return Response([])
        jobs = services.available_jobs_for(rider)
        return Response(DeliveryJobSerializer(jobs, many=True, context={'request': request}).data)

    def _open_job(self, pk):
        job = DeliveryJob.objects.filter(pk=pk).first()
        if job is None:
            raise PermissionDenied('Job not found.')
        return job

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        job = services.accept_job(self.get_rider(), self._open_job(pk).pk)
        return Response(DeliveryJobSerializer(job, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        s = ReasonSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        job = services.release_job(self.get_rider(), pk, **s.validated_data)
        return Response(DeliveryJobSerializer(job, context={'request': request}).data)

    def _progress(self, request, pk, to_status):
        job = self.get_object()
        transition(job.order_id, to_status, request.user)
        job.refresh_from_db()
        return Response(DeliveryJobSerializer(job, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def pickup(self, request, pk=None):
        return self._progress(request, pk, OrderStatus.PICKED_UP)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        return self._progress(request, pk, OrderStatus.OUT_FOR_DELIVERY)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        return self._progress(request, pk, OrderStatus.DELIVERED)
