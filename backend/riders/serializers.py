from rest_framework import serializers

from .models import DeliveryJob, RiderProfile


class RiderProfileSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='user.name', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)

    class Meta:
        model = RiderProfile
        fields = ('id', 'name', 'phone', 'vehicle_type', 'license_plate', 'is_approved', 'is_online',
                  'rating_avg', 'total_deliveries')
        read_only_fields = ('id', 'is_approved', 'is_online', 'rating_avg', 'total_deliveries')


class DeliveryJobSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source='order.pk', read_only=True)
    order_code = serializers.CharField(source='order.code', read_only=True)
    order_status = serializers.CharField(source='order.status', read_only=True)
    rider_earning = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    distance_to_pickup_km = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    items_count = serializers.IntegerField(source='order.items.count', read_only=True)

    class Meta:
        model = DeliveryJob
        fields = ('id', 'order_id', 'order_code', 'order_status', 'status', 'pickup_name', 'pickup_address',
                  'pickup_latitude', 'pickup_longitude', 'dropoff_address', 'dropoff_landmark', 'dropoff_latitude',
                  'dropoff_longitude', 'distance_km', 'distance_to_pickup_km', 'delivery_fee', 'rider_tip',
                  'rider_earning', 'items_count', 'customer', 'assigned_at', 'picked_up_at', 'delivered_at',
                  'created_at')

    def get_distance_to_pickup_km(self, obj):
        return getattr(obj, 'distance_to_pickup_km', None)

    def get_customer(self, obj):
        # Contact details only for the rider holding the job.
        user = self.context['request'].user
        if obj.rider_id and obj.rider.user_id == user.id:
            return {'name': obj.order.customer.name, 'phone': obj.order.customer.phone}
        return None
