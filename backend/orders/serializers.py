from rest_framework import serializers

from vendors.delivery import Fulfillment

from . import state
from .models import (
    CancellationRecord, Cart, CartItem, CustomFoodRequest, Offer, Order, OrderItem,
    OrderStatusHistory, PaymentMethod,
)


class LineInputSerializer(serializers.Serializer):
    menu_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=50, default=1)
    instructions = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')


class _ItemsOrCartMixin(serializers.Serializer):
    vendor_id = serializers.IntegerField()
    items = LineInputSerializer(many=True, required=False)
    cart_id = serializers.IntegerField(required=False)
    instructions = serializers.CharField(max_length=2000, allow_blank=True, required=False, default='')
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices, default=PaymentMethod.CASH)

    def validate(self, attrs):
        if attrs.get('cart_id'):
            cart = Cart.objects.filter(pk=attrs['cart_id'], customer=self.context['request'].user,
                                       vendor_id=attrs['vendor_id']).prefetch_related('items').first()
            if cart is None:
                raise serializers.ValidationError({'cart_id': 'Cart not found for this vendor.'})
            attrs['items'] = [{'menu_item_id': i.menu_item_id, 'quantity': i.quantity, 'instructions': i.instructions}
                              for i in cart.items.all()]
        if not attrs.get('items'):
            raise serializers.ValidationError({'items': 'Choose at least one food item.'})
        return attrs


class DineInCreateSerializer(_ItemsOrCartMixin):
    pass


class DeliveryRequestSerializer(_ItemsOrCartMixin):
    fulfillment_method = serializers.ChoiceField(choices=[
        Fulfillment.VENDOR_DELIVERY, Fulfillment.PLATFORM_RIDER, Fulfillment.CUSTOMER_PICKUP])
    address_id = serializers.IntegerField(required=False)
    delivery_address = serializers.CharField(max_length=255, allow_blank=True, required=False, default='')
    delivery_landmark = serializers.CharField(max_length=255, allow_blank=True, required=False, default='')
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    rider_tip = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('address_id'):
            from users.models import Address
            addr = Address.objects.filter(pk=attrs['address_id'], user=self.context['request'].user).first()
            if addr is None:
                raise serializers.ValidationError({'address_id': 'Address not found.'})
            attrs.update(delivery_address=addr.description, delivery_landmark=addr.landmark,
                         latitude=addr.latitude, longitude=addr.longitude)
        if attrs['fulfillment_method'] in Fulfillment.DELIVERY_METHODS and (
                attrs.get('latitude') is None or attrs.get('longitude') is None):
            raise serializers.ValidationError({'latitude': 'Choose the delivery location on the map.'})
        return attrs


class ReasonSerializer(serializers.Serializer):
    reason_code = serializers.CharField(max_length=32)
    explanation = serializers.CharField(max_length=2000, allow_blank=True, required=False, default='')


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=32)
    note = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ('id', 'menu_item_ref', 'name', 'description', 'image_url', 'unit_price', 'quantity',
                  'discount', 'line_total', 'instructions')


class StatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ('from_status', 'to_status', 'actor_role', 'note', 'created_at')


class CancellationSerializer(serializers.ModelSerializer):
    reason_label = serializers.SerializerMethodField()

    class Meta:
        model = CancellationRecord
        fields = ('id', 'kind', 'reason_code', 'reason_label', 'explanation', 'actor_role', 'order',
                  'custom_request', 'status_at_cancellation', 'created_at')

    def get_reason_label(self, obj):
        from .reasons import label
        user = self.context.get('request').user if self.context.get('request') else None
        return label(obj.reason_code, getattr(user, 'preferred_language', 'en'))


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    next_actions = serializers.SerializerMethodField()
    seconds_left_to_respond = serializers.SerializerMethodField()
    rider = serializers.SerializerMethodField()
    conversation_id = serializers.SerializerMethodField()
    cancellation = serializers.SerializerMethodField()
    history = StatusHistorySerializer(source='status_history', many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            'id', 'code', 'order_type', 'fulfillment_method', 'status', 'status_label', 'my_role', 'next_actions',
            'customer_name', 'customer_phone', 'vendor', 'vendor_name', 'vendor_phone', 'vendor_address',
            'vendor_latitude', 'vendor_longitude', 'delivery_address', 'delivery_landmark', 'delivery_latitude',
            'delivery_longitude', 'delivery_distance_km', 'customer_instructions', 'items', 'subtotal',
            'discount_total', 'delivery_fee', 'is_free_delivery', 'rider_tip', 'total', 'payment_method',
            'payment_status', 'vendor_response_deadline', 'seconds_left_to_respond', 'estimated_ready_minutes',
            'accepted_at', 'ready_at', 'finished_at', 'rider', 'conversation_id', 'cancellation', 'history',
            'custom_request', 'created_at', 'updated_at',
        )

    def _role(self, obj):
        from .services import role_for
        request = self.context.get('request')
        return role_for(obj, request.user) if request else None

    def get_my_role(self, obj):
        return self._role(obj)

    def get_customer_phone(self, obj):
        # Vendors/riders only get the phone once the order is accepted.
        if self._role(obj) in (state.V, state.R) and obj.accepted_at:
            return obj.customer.phone
        return None

    def get_next_actions(self, obj):
        role = self._role(obj)
        return state.next_actions(obj, role) if role else []

    def get_seconds_left_to_respond(self, obj):
        from django.utils import timezone
        if obj.status != 'PENDING_VENDOR_CONFIRMATION' or not obj.vendor_response_deadline:
            return None
        return max(0, int((obj.vendor_response_deadline - timezone.now()).total_seconds()))

    def get_rider(self, obj):
        job = getattr(obj, 'delivery_job', None)
        if not job or not job.rider_id:
            return {'job_status': job.status} if job else None
        return {'job_id': job.pk, 'job_status': job.status, 'name': job.rider.user.name,
                'phone': job.rider.user.phone, 'vehicle_type': job.rider.vehicle_type,
                'firebase_uid': job.rider.user.firebase_uid}

    def get_conversation_id(self, obj):
        conv = getattr(obj, 'conversation', None)
        return conv.pk if conv else None

    def get_cancellation(self, obj):
        rec = obj.cancellations.first()
        return CancellationSerializer(rec, context=self.context).data if rec else None


class OrderListSerializer(OrderSerializer):
    class Meta(OrderSerializer.Meta):
        fields = tuple(f for f in OrderSerializer.Meta.fields if f not in ('history',))


class CartItemSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='menu_item.name', read_only=True)
    unit_price = serializers.DecimalField(source='menu_item.price', max_digits=12, decimal_places=2, read_only=True)
    image_url = serializers.CharField(source='menu_item.image_url', read_only=True)
    is_orderable = serializers.BooleanField(source='menu_item.is_orderable', read_only=True)

    class Meta:
        model = CartItem
        fields = ('id', 'menu_item', 'name', 'unit_price', 'image_url', 'is_orderable', 'quantity', 'instructions')
        read_only_fields = ('id',)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ('id', 'vendor', 'vendor_name', 'items', 'subtotal', 'updated_at')

    def get_subtotal(self, obj):
        from core.geo import money_str
        return money_str(sum((i.menu_item.price * i.quantity for i in obj.items.all()), 0))


class OfferSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    vendor_rating = serializers.DecimalField(source='vendor.rating_avg', max_digits=3, decimal_places=2, read_only=True)
    vendor_image_url = serializers.CharField(source='vendor.profile_image_url', read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Offer
        fields = ('id', 'request', 'vendor', 'vendor_name', 'vendor_rating', 'vendor_image_url', 'food_description',
                  'price', 'delivery_fee', 'total', 'preparation_minutes', 'fulfillment_method', 'delivery_terms',
                  'status', 'created_at')
        read_only_fields = ('id', 'vendor', 'delivery_fee', 'status', 'created_at')


class OfferCreateSerializer(serializers.Serializer):
    request_id = serializers.IntegerField()
    food_description = serializers.CharField(max_length=4000)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)
    preparation_minutes = serializers.IntegerField(min_value=1, max_value=24 * 60)
    fulfillment_method = serializers.ChoiceField(choices=[
        Fulfillment.VENDOR_DELIVERY, Fulfillment.PLATFORM_RIDER, Fulfillment.CUSTOMER_PICKUP])
    delivery_terms = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')


class ImageRefSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=1000)
    path = serializers.CharField(max_length=500)


class CustomRequestCreateSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=4000)
    quantity_description = serializers.CharField(max_length=255, allow_blank=True, required=False, default='')
    people_count = serializers.IntegerField(min_value=1, max_value=5000, required=False, allow_null=True)
    images = ImageRefSerializer(many=True, required=False, default=list)
    desired_time = serializers.DateTimeField(required=False, allow_null=True)
    budget_hint = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    address_id = serializers.IntegerField(required=False)
    delivery_address = serializers.CharField(max_length=255, allow_blank=True, required=False, default='')
    delivery_landmark = serializers.CharField(max_length=255, allow_blank=True, required=False, default='')
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)

    def validate(self, attrs):
        from core.storage import user_folder, validate_storage_object
        user = self.context['request'].user
        if len(attrs['images']) > 5:
            raise serializers.ValidationError({'images': 'Up to 5 images.'})
        for img in attrs['images']:
            validate_storage_object(img['url'], img['path'], user_folder(user.firebase_uid or user.pk))
        if attrs.get('address_id'):
            from users.models import Address
            addr = Address.objects.filter(pk=attrs.pop('address_id'), user=user).first()
            if addr is None:
                raise serializers.ValidationError({'address_id': 'Address not found.'})
            attrs.update(delivery_address=addr.description, delivery_landmark=addr.landmark,
                         latitude=addr.latitude, longitude=addr.longitude)
        if attrs.get('latitude') is None or attrs.get('longitude') is None or not attrs.get('delivery_address'):
            raise serializers.ValidationError({'latitude': 'Choose the delivery location.'})
        return attrs


class CustomRequestSerializer(serializers.ModelSerializer):
    offers = serializers.SerializerMethodField()
    order_id = serializers.SerializerMethodField()
    seconds_left_for_offers = serializers.SerializerMethodField()
    recipients_count = serializers.IntegerField(source='recipients.count', read_only=True)
    cancellation = serializers.SerializerMethodField()
    my_offer = serializers.SerializerMethodField()

    class Meta:
        model = CustomFoodRequest
        fields = ('id', 'description', 'quantity_description', 'people_count', 'images', 'desired_time',
                  'budget_hint', 'delivery_address', 'delivery_landmark', 'delivery_latitude', 'delivery_longitude',
                  'status', 'offers_deadline', 'selection_deadline', 'seconds_left_for_offers', 'recipients_count',
                  'offers', 'my_offer', 'order_id', 'cancellation', 'created_at')

    def _user(self):
        return self.context['request'].user

    def get_offers(self, obj):
        if obj.customer_id != self._user().id:
            return None  # vendors never see competitors' offers
        return OfferSerializer(obj.offers.select_related('vendor'), many=True).data

    def get_my_offer(self, obj):
        from vendors.access import vendor_for_user
        vendor = vendor_for_user(self._user())
        if not vendor:
            return None
        offer = obj.offers.filter(vendor=vendor).first()
        return OfferSerializer(offer).data if offer else None

    def get_order_id(self, obj):
        order = getattr(obj, 'order', None)
        if order is None:
            return None
        if obj.customer_id == self._user().id or order.vendor.is_member(self._user()):
            return order.pk
        return None

    def get_seconds_left_for_offers(self, obj):
        from django.utils import timezone
        if obj.status not in ('OPEN', 'OFFERS_RECEIVED'):
            return None
        return max(0, int((obj.offers_deadline - timezone.now()).total_seconds()))

    def get_cancellation(self, obj):
        rec = obj.cancellations.first()
        return CancellationSerializer(rec, context=self.context).data if rec else None
