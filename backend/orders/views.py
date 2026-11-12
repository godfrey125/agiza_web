from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from core.geo import money_str
from vendors.access import require_vendor, vendor_for_user
from vendors.models import MenuItem, Review
from vendors.serializers import ReviewSerializer

from . import reasons, services
from .models import (
    TERMINAL_STATUSES, CancellationRecord, Cart, CartItem, CustomFoodRequest, Offer, Order, OrderStatus,
)
from .serializers import (
    CancellationSerializer, CartItemSerializer, CartSerializer, CustomRequestCreateSerializer,
    CustomRequestSerializer, DeliveryRequestSerializer, DineInCreateSerializer, OfferCreateSerializer,
    OfferSerializer, OrderListSerializer, OrderSerializer, ReasonSerializer, StatusChangeSerializer,
)


def _order_qs():
    return Order.objects.select_related(
        'vendor', 'vendor__owner', 'customer', 'delivery_job', 'delivery_job__rider__user', 'conversation',
    ).prefetch_related('items', 'cancellations', 'status_history')


def _respond(order, request, code=status.HTTP_200_OK):
    order = _order_qs().get(pk=order.pk)
    return Response(OrderSerializer(order, context={'request': request}).data, status=code)


# ── Carts ────────────────────────────────────────────────────────────────────

class CartViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = CartSerializer
    pagination_class = None

    def get_queryset(self):
        return Cart.objects.filter(customer=self.request.user).select_related('vendor').prefetch_related('items__menu_item')

    @action(detail=False, methods=['post'], url_path='items')
    def add_item(self, request):
        menu_item = MenuItem.objects.filter(pk=request.data.get('menu_item_id'), is_archived=False,
                                            vendor__is_approved=True).first()
        if menu_item is None:
            return Response({'error': {'code': 'not_found', 'message': 'Food item not found.'}}, status=404)
        qty = max(1, min(int(request.data.get('quantity', 1)), 50))
        cart, _ = Cart.objects.get_or_create(customer=request.user, vendor=menu_item.vendor)
        item, created = CartItem.objects.get_or_create(cart=cart, menu_item=menu_item, defaults={'quantity': qty})
        if not created:
            item.quantity = min(item.quantity + qty, 50)
        if 'instructions' in request.data:
            item.instructions = str(request.data['instructions'])[:500]
        item.save()
        cart.save(update_fields=['updated_at'])
        return Response(CartSerializer(self.get_queryset().get(pk=cart.pk)).data, status=201)

    @action(detail=False, methods=['patch', 'delete'], url_path=r'items/(?P<item_id>\d+)')
    def change_item(self, request, item_id=None):
        item = CartItem.objects.filter(pk=item_id, cart__customer=request.user).select_related('cart').first()
        if item is None:
            return Response({'error': {'code': 'not_found', 'message': 'Cart item not found.'}}, status=404)
        cart = item.cart
        if request.method == 'DELETE' or int(request.data.get('quantity', 1)) <= 0:
            item.delete()
        else:
            s = CartItemSerializer(item, data=request.data, partial=True)
            s.is_valid(raise_exception=True)
            s.save()
        if not cart.items.exists():
            cart.delete()
            return Response(status=204)
        return Response(CartSerializer(self.get_queryset().get(pk=cart.pk)).data)


# ── Creating orders ──────────────────────────────────────────────────────────

class DineInOrderView(APIView):
    """POST: place a dine-in order (customer eats at the vendor)."""

    def post(self, request):
        s = DineInCreateSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        d = s.validated_data
        order = services.create_dine_in_order(
            request.user, vendor_id=d['vendor_id'], items=d['items'], instructions=d['instructions'],
            payment_method=d['payment_method'])
        if d.get('cart_id'):
            services.clear_cart(request.user, d['vendor_id'])
        return _respond(order, request, status.HTTP_201_CREATED)


class DeliveryRequestView(APIView):
    """POST: request delivery / pickup of menu items. Vendor must answer within 60s."""

    def post(self, request):
        s = DeliveryRequestSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        d = s.validated_data
        order = services.create_delivery_request(
            request.user, vendor_id=d['vendor_id'], items=d['items'], fulfillment_method=d['fulfillment_method'],
            delivery_address=d['delivery_address'], delivery_landmark=d['delivery_landmark'],
            latitude=d.get('latitude'), longitude=d.get('longitude'), rider_tip=d['rider_tip'],
            instructions=d['instructions'], payment_method=d['payment_method'])
        if d.get('cart_id'):
            services.clear_cart(request.user, d['vendor_id'])
        return _respond(order, request, status.HTTP_201_CREATED)


class DeliveryQuoteView(APIView):
    """POST: same body as a delivery request; returns the price breakdown without creating anything."""

    def post(self, request):
        s = DeliveryRequestSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        d = s.validated_data
        vendor, lines, subtotal, q, tip, total = services.price_delivery_request(
            request.user, vendor_id=d['vendor_id'], items=d['items'], fulfillment_method=d['fulfillment_method'],
            latitude=d.get('latitude'), longitude=d.get('longitude'), rider_tip=d['rider_tip'])
        return Response({
            'vendor_id': vendor.pk, 'vendor_name': vendor.business_name,
            'items': [{'menu_item_id': l['menu_item_ref'], 'name': l['name'], 'unit_price': str(l['unit_price']),
                       'quantity': l['quantity'], 'line_total': str(l['line_total'])} for l in lines],
            'subtotal': str(subtotal), 'delivery': q.as_dict(), 'rider_tip': str(tip), 'total': str(total),
        })


# ── Orders ───────────────────────────────────────────────────────────────────

class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Orders visible to the caller (as customer, vendor or assigned rider).

    Filters: ?type=DINE_IN|MENU_DELIVERY|CUSTOM_DELIVERY  ?status=A,B  ?active=true|false
             ?as=customer|vendor|rider
    """

    def get_serializer_class(self):
        return OrderListSerializer if self.action == 'list' else OrderSerializer

    def get_queryset(self):
        user = self.request.user
        vendor = vendor_for_user(user)
        scope = self.request.query_params.get('as')
        q = Q()
        if scope in (None, 'customer'):
            q |= Q(customer=user)
        if scope in (None, 'vendor') and vendor:
            q |= Q(vendor=vendor)
        if scope in (None, 'rider'):
            q |= Q(delivery_job__rider__user=user)
        qs = _order_qs().filter(q) if q else Order.objects.none()
        p = self.request.query_params
        if p.get('type'):
            qs = qs.filter(order_type__in=p['type'].split(','))
        if p.get('status'):
            qs = qs.filter(status__in=p['status'].split(','))
        if p.get('active') in ('true', '1'):
            qs = qs.exclude(status__in=TERMINAL_STATUSES)
        elif p.get('active') in ('false', '0'):
            qs = qs.filter(status__in=TERMINAL_STATUSES)
        return qs.distinct()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        order = services.vendor_accept(self.get_object().pk, request.user, request.data.get('estimated_ready_minutes'))
        return _respond(order, request)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        s = ReasonSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = services.vendor_reject(self.get_object().pk, request.user, **s.validated_data)
        return _respond(order, request)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        s = ReasonSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = services.cancel_order(self.get_object().pk, request.user, **s.validated_data)
        return _respond(order, request)

    @action(detail=True, methods=['post'])
    def status(self, request, pk=None):
        s = StatusChangeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = services.transition(self.get_object().pk, s.validated_data['status'], request.user, s.validated_data['note'])
        return _respond(order, request)

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        order = self.get_object()
        if order.customer_id != request.user.id:
            raise PermissionDenied('Only the customer can review this order.')
        if order.status not in (OrderStatus.COMPLETED, OrderStatus.DELIVERED):
            return Response({'error': {'code': 'not_finished', 'message': 'You can review after the order is finished.'}}, status=409)
        if hasattr(order, 'review'):
            return Response({'error': {'code': 'already_reviewed', 'message': 'You already reviewed this order.'}}, status=409)
        s = ReviewSerializer(data={**request.data, 'order': order.pk})
        s.is_valid(raise_exception=True)
        s.save(customer=request.user, vendor=order.vendor)
        agg = Review.objects.filter(vendor=order.vendor).aggregate(n=Count('id'), total=Sum('rating'))
        order.vendor.rating_count = agg['n']
        order.vendor.rating_avg = round(agg['total'] / agg['n'], 2)
        order.vendor.save(update_fields=['rating_count', 'rating_avg', 'updated_at'])
        return Response(s.data, status=201)


class VendorSalesSummaryView(APIView):
    def get(self, request):
        vendor = require_vendor(request.user)
        now = timezone.localtime()
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        done = Q(status__in=[OrderStatus.COMPLETED, OrderStatus.DELIVERED])

        def window(since):
            qs = Order.objects.filter(vendor=vendor, created_at__gte=since)
            agg = qs.filter(done).aggregate(n=Count('id'), food=Sum('subtotal'))
            return {
                'orders_completed': agg['n'], 'food_sales': money_str(agg['food']),
                'orders_rejected': qs.filter(status=OrderStatus.REJECTED).count(),
                'orders_expired': qs.filter(status=OrderStatus.EXPIRED).count(),
                'orders_cancelled': qs.filter(status=OrderStatus.CANCELLED).count(),
            }
        return Response({'today': window(start_today), 'last_7_days': window(start_today - timedelta(days=6)),
                         'last_30_days': window(start_today - timedelta(days=29))})


# ── Custom requests & offers ─────────────────────────────────────────────────

class CustomRequestViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    """Customers see their own requests; vendors see requests sent to them."""

    serializer_class = CustomRequestSerializer

    def get_queryset(self):
        user = self.request.user
        vendor = vendor_for_user(user)
        q = Q(customer=user)
        if vendor:
            q |= Q(recipients__vendor=vendor)
        qs = CustomFoodRequest.objects.filter(q).distinct().prefetch_related('offers__vendor', 'cancellations')
        if self.request.query_params.get('as') == 'vendor' and vendor:
            qs = qs.filter(recipients__vendor=vendor)
        if self.request.query_params.get('open') in ('1', 'true'):
            qs = qs.filter(status__in=['OPEN', 'OFFERS_RECEIVED'], offers_deadline__gt=timezone.now())
        return qs

    def create(self, request, *args, **kwargs):
        s = CustomRequestCreateSerializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        req = services.create_custom_request(request.user, **s.validated_data)
        return Response(CustomRequestSerializer(req, context={'request': request}).data, status=201)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        s = ReasonSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        req = services.cancel_custom_request(request.user, self.get_object().pk, **s.validated_data)
        return Response(CustomRequestSerializer(req, context={'request': request}).data)


class OfferViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = OfferSerializer

    def get_queryset(self):
        user = self.request.user
        vendor = vendor_for_user(user)
        q = Q(request__customer=user)
        if vendor:
            q |= Q(vendor=vendor)
        return Offer.objects.filter(q).select_related('vendor')

    def create(self, request, *args, **kwargs):
        vendor = require_vendor(request.user)
        s = OfferCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        offer = services.submit_offer(vendor, d.pop('request_id'), **d)
        return Response(OfferSerializer(offer).data, status=201)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        offer = services.withdraw_offer(require_vendor(request.user), self.get_object().pk)
        return Response(OfferSerializer(offer).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        order = services.accept_offer(request.user, self.get_object().pk)
        return _respond(order, request, status.HTTP_201_CREATED)


# ── Cancellations ────────────────────────────────────────────────────────────

class CancellationReasonsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(reasons.catalogue())


class CancellationListView(generics.ListAPIView):
    """Cancellation/rejection/expiry records on orders and requests the caller is part of."""

    serializer_class = CancellationSerializer

    def get_queryset(self):
        user = self.request.user
        vendor = vendor_for_user(user)
        q = Q(order__customer=user) | Q(custom_request__customer=user)
        if vendor:
            q |= Q(order__vendor=vendor)
        return CancellationRecord.objects.filter(q).distinct()
