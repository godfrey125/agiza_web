from decimal import Decimal, InvalidOperation

from django.db.models import Avg, Q
from rest_framework import generics, mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.geo import bounding_box, haversine_km

from . import delivery
from .access import require_vendor
from .models import DeliveryPolicy, MenuCategory, MenuItem, VendorCategory, VendorProfile
from .serializers import (
    DeliveryPolicySerializer, MenuCategorySerializer, MenuItemSerializer, OwnVendorSerializer,
    PublicMenuItemSerializer, ReviewSerializer, SearchResultSerializer, VendorCategorySerializer,
    VendorDetailSerializer, VendorSummarySerializer,
)

SEARCH_SCAN_LIMIT = 500


def _decimal_param(request, name, default=None):
    raw = request.query_params.get(name)
    if raw in (None, ''):
        return default
    try:
        return Decimal(raw)
    except InvalidOperation:
        raise serializers.ValidationError({name: 'Must be a number.'})


def _bool_param(request, name):
    return request.query_params.get(name, '').lower() in ('1', 'true', 'yes')


def _location(request):
    lat, lng = _decimal_param(request, 'lat'), _decimal_param(request, 'lng')
    if (lat is None) != (lng is None):
        raise serializers.ValidationError('Give both lat and lng.')
    return lat, lng


def approved_vendors():
    return (
        VendorProfile.objects.filter(is_approved=True, owner__is_active=True)
        .select_related('delivery_policy')
        .prefetch_related('categories')
    )


# ── Public discovery ─────────────────────────────────────────────────────────

class VendorCategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = VendorCategorySerializer
    queryset = VendorCategory.objects.all()
    pagination_class = None


class VendorViewSet(viewsets.ReadOnlyModelViewSet):
    """Approved vendors. `/vendors/{id}/menu/` is the vendor's live menu."""

    permission_classes = [permissions.AllowAny]
    lookup_value_regex = r'\d+'

    def get_queryset(self):
        qs = approved_vendors()
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(business_name__icontains=q) | Q(categories__name_en__icontains=q) | Q(categories__name_sw__icontains=q)).distinct()
        cat = self.request.query_params.get('category')
        if cat:
            qs = qs.filter(categories__slug=cat)
        return qs.order_by('-rating_avg', 'business_name')

    def get_serializer_class(self):
        return VendorDetailSerializer if self.action == 'retrieve' else VendorSummarySerializer

    @action(detail=True)
    def menu(self, request, pk=None):
        vendor = self.get_object()
        items = (
            vendor.menu_items.filter(is_archived=False)
            .exclude(availability_status=MenuItem.Availability.HIDDEN)
            .select_related('category')
        )
        return Response({
            'vendor': VendorDetailSerializer(vendor).data,
            'categories': MenuCategorySerializer(vendor.menu_categories.all(), many=True).data,
            'items': PublicMenuItemSerializer(items, many=True).data,
        })

    @action(detail=True)
    def reviews(self, request, pk=None):
        vendor = self.get_object()
        page = self.paginate_queryset(vendor.reviews.select_related('customer').order_by('-created_at'))
        return self.get_paginated_response(ReviewSerializer(page, many=True).data)

    @action(detail=True, url_path='delivery-quote')
    def delivery_quote(self, request, pk=None):
        """Preview fulfilment options + fees for a location. Order creation recomputes server-side."""
        vendor = self.get_object()
        lat, lng = _location(request)
        methods = [m for m, _ in delivery.Fulfillment.CHOICES]
        return Response({'options': [delivery.quote(vendor, m, lat, lng).as_dict() for m in methods]})


class MenuSearchView(generics.ListAPIView):
    """Search real menu items from approved vendors.

    Query: q, lat, lng, radius_km (nearby), category, vendor_category, min_price,
    max_price, free_delivery, available_now, min_rating, delivery (deliverable only),
    sort=distance|price|rating.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = SearchResultSerializer

    def get_queryset(self):
        p = self.request.query_params
        qs = (
            MenuItem.objects.filter(is_archived=False, vendor__is_approved=True, vendor__owner__is_active=True)
            .exclude(availability_status=MenuItem.Availability.HIDDEN)
            .select_related('vendor', 'vendor__delivery_policy', 'category')
            .prefetch_related('vendor__categories')
        )
        q = (p.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q) | Q(description__icontains=q) | Q(keywords__icontains=q)
                | Q(category__name__icontains=q) | Q(vendor__categories__name_en__icontains=q)
                | Q(vendor__categories__name_sw__icontains=q)
            ).distinct()
        if p.get('category'):
            qs = qs.filter(category__name__iexact=p['category'])
        if p.get('vendor_category'):
            qs = qs.filter(vendor__categories__slug=p['vendor_category'])
        if (v := _decimal_param(self.request, 'min_price')) is not None:
            qs = qs.filter(price__gte=v)
        if (v := _decimal_param(self.request, 'max_price')) is not None:
            qs = qs.filter(price__lte=v)
        if (v := _decimal_param(self.request, 'min_rating')) is not None:
            qs = qs.filter(vendor__rating_avg__gte=v)
        if _bool_param(self.request, 'available_now'):
            qs = qs.filter(availability_status=MenuItem.Availability.AVAILABLE, vendor__is_online=True)

        lat, lng = _location(self.request)
        radius = _decimal_param(self.request, 'radius_km')
        if lat is not None and radius is not None:
            min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, float(radius))
            qs = qs.filter(vendor__latitude__range=(min_lat, max_lat), vendor__longitude__range=(min_lng, max_lng))

        items = list(qs[:SEARCH_SCAN_LIMIT])
        want_free, want_delivery = _bool_param(self.request, 'free_delivery'), _bool_param(self.request, 'delivery')
        if (want_free or want_delivery) and lat is None:
            raise serializers.ValidationError('lat and lng are required for delivery filters.')
        result = []
        for item in items:
            v = item.vendor
            if _bool_param(self.request, 'available_now') and not v.is_open_now():
                continue
            if lat is not None:
                item.distance_km = haversine_km(v.latitude, v.longitude, lat, lng)
                if radius is not None and item.distance_km > float(radius):
                    continue
                item.delivery_quote = delivery.best_delivery_quote(v, lat, lng)
                if want_delivery and not item.delivery_quote.eligible:
                    continue
                if want_free and not item.delivery_quote.is_free:
                    continue
            result.append(item)

        sort = p.get('sort') or ('distance' if lat is not None else 'relevance')
        if sort == 'distance' and lat is not None:
            result.sort(key=lambda i: i.distance_km)
        elif sort == 'price':
            result.sort(key=lambda i: i.price)
        elif sort == 'rating':
            result.sort(key=lambda i: -i.vendor.rating_avg)
        elif q:
            ql = q.lower()
            result.sort(key=lambda i: (not i.name.lower().startswith(ql), ql not in i.name.lower(), i.price))
        return result


class MapVendorsView(generics.ListAPIView):
    """Approved vendors for the map and the Nearby Vendors list.

    Query: q, lat, lng, radius_km (or max_distance_km), category (comma
    separated slugs), open_now, delivery, pickup, dine_in, min_rating,
    sort=distance|rating|availability|eta. Returns distance, ETA, minimum
    order and fulfilment flags alongside the compact vendor fields.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = VendorSummarySerializer
    pagination_class = None

    def get_queryset(self):
        return approved_vendors().annotate(avg_prep=Avg('menu_items__preparation_minutes'))

    def list(self, request, *args, **kwargs):
        p = request.query_params
        lat, lng = _location(request)
        radius = float(_decimal_param(request, 'max_distance_km', _decimal_param(request, 'radius_km', Decimal('10'))))
        qs = self.get_queryset()

        q = (p.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(business_name__icontains=q)
                | Q(description__icontains=q)
                | Q(address__icontains=q)
                | Q(categories__name_en__icontains=q)
                | Q(categories__name_sw__icontains=q)
            ).distinct()

        slugs = [s.strip() for s in (p.get('category') or '').split(',') if s.strip()]
        if slugs:
            qs = qs.filter(categories__slug__in=slugs).distinct()

        if _bool_param(request, 'delivery'):
            qs = qs.filter(
                Q(delivery_policy__offers_vendor_delivery=True) | Q(delivery_policy__offers_platform_rider=True)
            )
        if _bool_param(request, 'pickup'):
            qs = qs.filter(delivery_policy__offers_pickup=True)
        if _bool_param(request, 'dine_in'):
            qs = qs.filter(delivery_policy__offers_dine_in=True)
        if (v := _decimal_param(request, 'min_rating')) is not None:
            qs = qs.filter(rating_avg__gte=v)

        if lat is not None:
            min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius)
            qs = qs.filter(latitude__range=(min_lat, max_lat), longitude__range=(min_lng, max_lng))

        want_open = _bool_param(request, 'open_now')
        data = []
        for v in qs[:300]:
            row = VendorSummarySerializer(v).data
            policy = getattr(v, 'delivery_policy', None)
            row['offers_delivery'] = bool(policy and policy.offers_delivery)
            row['offers_pickup'] = bool(policy and policy.offers_pickup)
            row['offers_dine_in'] = bool(policy and policy.offers_dine_in)
            row['advertises_free_delivery'] = bool(policy and policy.advertises_free_delivery)
            row['min_order_amount'] = str(v.min_order_amount or 0)
            if want_open and not row['is_open_now']:
                continue

            prep = float(getattr(v, 'avg_prep', None) or 15)
            if lat is not None:
                distance = haversine_km(v.latitude, v.longitude, lat, lng)
                if distance > radius:
                    continue
                row['distance_km'] = round(distance, 2)
                row['eta_minutes'] = int(round(prep + distance * 3 + 5))
            else:
                row['eta_minutes'] = int(round(prep + 10))
            data.append(row)

        sort = p.get('sort') or ('distance' if lat is not None else 'availability')
        if sort == 'distance' and lat is not None:
            data.sort(key=lambda r: r['distance_km'])
        elif sort == 'rating':
            data.sort(key=lambda r: (-float(r['rating_avg']), r.get('distance_km', 0)))
        elif sort == 'eta':
            data.sort(key=lambda r: r['eta_minutes'])
        else:  # availability, then nearest
            data.sort(key=lambda r: (not r['is_open_now'], r.get('distance_km', 0)))
        return Response(data)


# ── Vendor self-management ───────────────────────────────────────────────────

class MyVendorView(generics.RetrieveUpdateAPIView):
    serializer_class = OwnVendorSerializer

    def get_object(self):
        return require_vendor(self.request.user)


class MyDeliveryPolicyView(generics.RetrieveUpdateAPIView):
    serializer_class = DeliveryPolicySerializer

    def get_object(self):
        vendor = require_vendor(self.request.user)
        policy, _ = DeliveryPolicy.objects.get_or_create(vendor=vendor)
        return policy


class MyOnlineStatusView(APIView):
    def post(self, request):
        vendor = require_vendor(request.user)
        value = request.data.get('is_online')
        if not isinstance(value, bool):
            raise serializers.ValidationError({'is_online': 'true or false required.'})
        vendor.is_online = value
        vendor.save(update_fields=['is_online', 'updated_at'])
        return Response({'is_online': vendor.is_online})


class MyMenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return MenuCategory.objects.filter(vendor=require_vendor(self.request.user))

    def perform_create(self, serializer):
        serializer.save(vendor=require_vendor(self.request.user))


class MyMenuItemViewSet(viewsets.ModelViewSet):
    """The vendor's own menu. DELETE archives (past orders keep their snapshots)."""

    serializer_class = MenuItemSerializer

    def get_vendor(self):
        if not hasattr(self, '_vendor'):
            self._vendor = require_vendor(self.request.user)
        return self._vendor

    def get_queryset(self):
        return MenuItem.objects.filter(vendor=self.get_vendor(), is_archived=False).select_related('category')

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'vendor': self.get_vendor()}

    def perform_create(self, serializer):
        serializer.save(vendor=self.get_vendor())

    def perform_destroy(self, instance):
        instance.is_archived = True
        instance.save(update_fields=['is_archived', 'updated_at'])
