from rest_framework import serializers

from core.storage import validate_storage_object, vendor_folder

from .models import DeliveryPolicy, MenuCategory, MenuItem, Review, VendorCategory, VendorProfile


class VendorCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = VendorCategory
        fields = ('id', 'slug', 'name_en', 'name_sw')


class DeliveryPolicySerializer(serializers.ModelSerializer):
    advertises_free_delivery = serializers.BooleanField(read_only=True)

    class Meta:
        model = DeliveryPolicy
        fields = (
            'offers_dine_in', 'offers_pickup', 'offers_vendor_delivery', 'offers_platform_rider',
            'free_delivery_radius_km', 'free_delivery_agreed', 'advertises_free_delivery',
            'max_delivery_distance_km', 'base_fee', 'per_km_fee',
        )


class MenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuCategory
        fields = ('id', 'name', 'sort_order')


class MenuItemSerializer(serializers.ModelSerializer):
    """Vendor-side menu item (read/write)."""

    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    is_orderable = serializers.BooleanField(read_only=True)

    class Meta:
        model = MenuItem
        fields = (
            'id', 'vendor', 'category', 'category_name', 'name', 'description', 'keywords', 'price',
            'image_url', 'image_path', 'availability_status', 'portions_available',
            'preparation_minutes', 'is_orderable', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'vendor', 'created_at', 'updated_at')

    def validate_category(self, category):
        vendor = self.context['vendor']
        if category and category.vendor_id != vendor.id:
            raise serializers.ValidationError('Category belongs to another vendor.')
        return category

    def validate(self, attrs):
        vendor = self.context['vendor']
        if 'image_url' in attrs or 'image_path' in attrs:
            url = attrs.get('image_url', getattr(self.instance, 'image_url', ''))
            path = attrs.get('image_path', getattr(self.instance, 'image_path', ''))
            attrs['image_url'], attrs['image_path'] = validate_storage_object(url, path, vendor_folder(vendor.id))
        return attrs


class VendorSummarySerializer(serializers.ModelSerializer):
    """Compact vendor info embedded in search results and orders."""

    categories = VendorCategorySerializer(many=True, read_only=True)
    is_open_now = serializers.SerializerMethodField()

    class Meta:
        model = VendorProfile
        fields = (
            'id', 'business_name', 'business_type', 'categories', 'address', 'landmark',
            'latitude', 'longitude', 'profile_image_url', 'rating_avg', 'rating_count', 'is_open_now',
            'min_order_amount',
        )

    def get_is_open_now(self, obj):
        return obj.is_open_now()


class VendorDetailSerializer(VendorSummarySerializer):
    delivery_policy = DeliveryPolicySerializer(read_only=True)

    class Meta(VendorSummarySerializer.Meta):
        fields = VendorSummarySerializer.Meta.fields + (
            'phone', 'description', 'cover_image_url', 'opening_hours', 'is_online', 'delivery_policy',
        )


class OwnVendorSerializer(VendorDetailSerializer):
    """The vendor's own profile — editable."""

    category_ids = serializers.PrimaryKeyRelatedField(
        source='categories', many=True, queryset=VendorCategory.objects.all(), write_only=True, required=False
    )
    profile_image_path = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta(VendorDetailSerializer.Meta):
        fields = VendorDetailSerializer.Meta.fields + ('category_ids', 'profile_image_path', 'is_approved')
        read_only_fields = ('rating_avg', 'rating_count', 'is_approved')

    def validate(self, attrs):
        path = attrs.pop('profile_image_path', None)
        if 'profile_image_url' in attrs or path is not None:
            url = attrs.get('profile_image_url', '')
            attrs['profile_image_url'], _ = validate_storage_object(url, path or '', vendor_folder(self.instance.id))
        hours = attrs.get('opening_hours')
        if hours:
            valid_days = {'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'}
            for day, ranges in hours.items():
                if day not in valid_days or not all(
                    isinstance(r, (list, tuple)) and len(r) == 2 and r[0] < r[1] for r in ranges
                ):
                    raise serializers.ValidationError({'opening_hours': f'Invalid hours for {day!r}. Use [["08:00","21:00"]].'})
        return attrs


class PublicMenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    is_orderable = serializers.BooleanField(read_only=True)

    class Meta:
        model = MenuItem
        fields = (
            'id', 'category', 'category_name', 'name', 'description', 'price', 'image_url',
            'availability_status', 'is_orderable', 'preparation_minutes',
        )


class SearchResultSerializer(PublicMenuItemSerializer):
    vendor = VendorSummarySerializer(read_only=True)
    distance_km = serializers.SerializerMethodField()
    delivery = serializers.SerializerMethodField()

    class Meta(PublicMenuItemSerializer.Meta):
        fields = PublicMenuItemSerializer.Meta.fields + ('vendor', 'distance_km', 'delivery')

    def get_distance_km(self, obj):
        d = getattr(obj, 'distance_km', None)
        return round(d, 2) if d is not None else None

    def get_delivery(self, obj):
        q = getattr(obj, 'delivery_quote', None)
        return q.as_dict() if q else None


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'order', 'vendor', 'customer_name', 'rating', 'comment', 'created_at')
        read_only_fields = ('id', 'vendor', 'customer_name', 'created_at')
