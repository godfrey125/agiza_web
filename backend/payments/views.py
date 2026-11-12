from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order
from vendors.access import vendor_for_user

from . import services
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.code', read_only=True)

    class Meta:
        model = Payment
        fields = ('id', 'order', 'order_code', 'method', 'amount', 'status', 'provider_reference', 'created_at')


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer

    def get_queryset(self):
        vendor = vendor_for_user(self.request.user)
        q = Q(payer=self.request.user)
        if vendor:
            q |= Q(order__vendor=vendor)
        return Payment.objects.filter(q).select_related('order')


class ConfirmCashView(APIView):
    def post(self, request, order_id):
        payment = services.confirm_cash_payment(order_id, request.user)
        return Response(PaymentSerializer(payment).data)


class InitiateMobileMoneyView(APIView):
    def post(self, request, order_id):
        order = Order.objects.filter(pk=order_id, customer=request.user).first()
        if order is None:
            return Response({'error': {'code': 'not_found', 'message': 'Order not found.'}}, status=404)
        services.initiate_mobile_money(order, request.user, request.data.get('phone'))
