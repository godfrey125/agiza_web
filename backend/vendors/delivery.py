"""Delivery eligibility and fee calculation — the only place fees are computed."""
from dataclasses import asdict, dataclass
from decimal import Decimal

from core.geo import road_distance_km, round_up_tzs


class Fulfillment:
    DINE_IN = 'DINE_IN'
    VENDOR_DELIVERY = 'VENDOR_DELIVERY'
    PLATFORM_RIDER = 'PLATFORM_RIDER'
    CUSTOMER_PICKUP = 'CUSTOMER_PICKUP'

    DELIVERY_METHODS = (VENDOR_DELIVERY, PLATFORM_RIDER)
    CHOICES = [
        (DINE_IN, 'Dine in'),
        (VENDOR_DELIVERY, 'Vendor delivers'),
        (PLATFORM_RIDER, 'Agiza rider delivers'),
        (CUSTOMER_PICKUP, 'Customer picks up'),
    ]


@dataclass
class DeliveryQuote:
    eligible: bool
    method: str
    distance_km: Decimal | None
    fee: Decimal
    is_free: bool
    reason: str = ''

    def as_dict(self):
        d = asdict(self)
        d['distance_km'] = str(self.distance_km) if self.distance_km is not None else None
        d['fee'] = str(self.fee)
        return d


def _policy(vendor):
    from .models import DeliveryPolicy

    return getattr(vendor, 'delivery_policy', None) or DeliveryPolicy(vendor=vendor)


def quote(vendor, method, lat=None, lng=None):
    """Return whether `method` is possible for this vendor/location and its fee."""
    policy = _policy(vendor)
    zero = Decimal('0.00')

    if method == Fulfillment.DINE_IN:
        ok = policy.offers_dine_in
        return DeliveryQuote(ok, method, None, zero, False, '' if ok else 'DINE_IN_UNAVAILABLE')
    if method == Fulfillment.CUSTOMER_PICKUP:
        ok = policy.offers_pickup
        return DeliveryQuote(ok, method, None, zero, False, '' if ok else 'PICKUP_UNAVAILABLE')
    if method not in Fulfillment.DELIVERY_METHODS:
        return DeliveryQuote(False, method, None, zero, False, 'UNKNOWN_METHOD')

    offered = policy.offers_vendor_delivery if method == Fulfillment.VENDOR_DELIVERY else policy.offers_platform_rider
    if not offered:
        return DeliveryQuote(False, method, None, zero, False, 'DELIVERY_METHOD_UNAVAILABLE')
    if lat is None or lng is None:
        return DeliveryQuote(False, method, None, zero, False, 'LOCATION_REQUIRED')

    distance = Decimal(str(round(road_distance_km(vendor.latitude, vendor.longitude, lat, lng), 2)))
    if distance > policy.max_delivery_distance_km:
        return DeliveryQuote(False, method, distance, zero, False, 'OUTSIDE_SERVICE_AREA')
    if policy.advertises_free_delivery and distance <= policy.free_delivery_radius_km:
        return DeliveryQuote(True, method, distance, zero, True)
    fee = round_up_tzs(policy.base_fee + policy.per_km_fee * distance)
    return DeliveryQuote(True, method, distance, fee, False)


def best_delivery_quote(vendor, lat, lng):
    """Cheapest eligible delivery method, used by search to label results."""
    quotes = [quote(vendor, m, lat, lng) for m in Fulfillment.DELIVERY_METHODS]
    eligible = [q for q in quotes if q.eligible]
    return min(eligible, key=lambda q: q.fee) if eligible else quotes[0]
