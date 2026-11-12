"""Distance helpers. Uses haversine × a road factor until a routing API is added."""
import math
from decimal import ROUND_CEILING, Decimal

from django.conf import settings

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1, lng1, lat2, lng2):
    lat1, lng1, lat2, lng2 = map(lambda v: math.radians(float(v)), (lat1, lng1, lat2, lng2))
    dlat, dlng = lat2 - lat1, lng2 - lng1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def road_distance_km(lat1, lng1, lat2, lng2):
    """Estimated travel distance (km) between two points."""
    return haversine_km(lat1, lng1, lat2, lng2) * settings.AGIZA['ROAD_DISTANCE_FACTOR']


def bounding_box(lat, lng, radius_km):
    """(min_lat, max_lat, min_lng, max_lng) for a cheap DB pre-filter."""
    lat, lng = float(lat), float(lng)
    dlat = radius_km / 111.0
    dlng = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.01))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def round_up_tzs(amount):
    """Round a fee up to the configured TZS step (default 100)."""
    step = Decimal(settings.AGIZA['FEE_ROUNDING_TZS'])
    amount = Decimal(amount)
    if amount <= 0:
        return Decimal('0.00')
    return ((amount / step).to_integral_value(rounding=ROUND_CEILING) * step).quantize(Decimal('0.01'))


def money_str(value):
    """Decimal → '1234.00' regardless of database backend."""
    return str(Decimal(value or 0).quantize(Decimal('0.01')))
