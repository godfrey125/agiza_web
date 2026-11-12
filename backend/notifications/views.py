from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DeviceToken, Notification
from .serializers import DeviceTokenSerializer, NotificationSerializer
from .services import register_device, token_hash


class DeviceTokenView(APIView):
    """POST to register this device's FCM token; DELETE (same body) on sign-out."""

    def post(self, request):
        s = DeviceTokenSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        register_device(request.user, s.validated_data['token'], s.validated_data['platform'])
        return Response({'registered': True}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        token = request.data.get('token', '')
        DeviceToken.objects.filter(user=request.user, token_hash=token_hash(token)).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get('unread') in ('1', 'true'):
            qs = qs.filter(read_at__isnull=True)
        return qs

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        self.get_queryset().filter(pk=pk, read_at__isnull=True).update(read_at=timezone.now())
        return Response({'read': True})

    @action(detail=False, methods=['post'], url_path='read-all')
    def read_all(self, request):
        n = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({'marked': n})

    @action(detail=False, url_path='unread-count')
    def unread_count(self, request):
        return Response({'unread': Notification.objects.filter(user=request.user, read_at__isnull=True).count()})
