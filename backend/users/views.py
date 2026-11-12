from rest_framework import generics, viewsets

from .models import Address
from .serializers import AddressSerializer, UserSerializer


class MeView(generics.RetrieveUpdateAPIView):
    """The signed-in user. The app calls this right after Firebase sign-in to learn the role."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
