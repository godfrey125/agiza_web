from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers

from .models import Conversation
from .services import sync_to_firestore


class ConversationSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.code', read_only=True)
    vendor_name = serializers.CharField(source='order.vendor_name', read_only=True)
    firestore_path = serializers.CharField(read_only=True)
    participants = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ('id', 'order', 'order_code', 'vendor_name', 'firestore_path', 'participants', 'is_closed',
                  'firestore_synced_at', 'created_at')

    def get_participants(self, obj):
        return [{'name': u.name, 'firebase_uid': u.firebase_uid} for u in obj.participants.all()]


class ConversationViewSet(viewsets.ReadOnlyModelViewSet):
    """Order chats I'm part of. Messages are read/written directly in Firestore at `firestore_path`."""

    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user).select_related('order').prefetch_related('participants')

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        conv = self.get_object()
        ok = sync_to_firestore(conv.pk)
        return Response({'synced': ok})
