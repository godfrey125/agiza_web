"""Small test-data builders (no external factory library)."""
from decimal import Decimal
from itertools import count

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from riders.models import RiderProfile
from vendors.models import DeliveryPolicy, MenuItem, VendorProfile

User = get_user_model()
_seq = count(1)

# Mlimani City, Dar es Salaam
DAR = (Decimal('-6.772500'), Decimal('39.219200'))


def user(role='CUSTOMER', **kw):
    n = next(_seq)
    return User.objects.create(
        username=f'u{n}', firebase_uid=f'uid{n}', phone=f'+2557{n:08d}', role=role,
        display_name=kw.pop('name', f'User {n}'), **kw)


def vendor(name='Mama Asha', *, lat=DAR[0], lng=DAR[1], policy=None, **kw):
    owner = user('VENDOR', name=name)
    v = VendorProfile.objects.create(
        owner=owner, business_name=name, phone=owner.phone, address='Mwenge', latitude=lat, longitude=lng,
        is_online=True, is_approved=True, **kw)
    DeliveryPolicy.objects.filter(vendor=v).update(**(policy or {}))
    v.refresh_from_db()
    return v


def item(v, name='Chapati', price='1000', **kw):
    return MenuItem.objects.create(vendor=v, name=name, price=Decimal(price), **kw)


def rider(online=True, lat=DAR[0], lng=DAR[1]):
    u = user('RIDER', name='Juma Rider')
    return RiderProfile.objects.create(user=u, is_online=online, is_approved=True, last_latitude=lat, last_longitude=lng)


def client_for(u):
    c = APIClient()
    c.force_authenticate(u)
    return c


def offset(lat, lng, km_north):
    """A point roughly `km_north` km north of (lat, lng)."""
    return (Decimal(str(round(float(lat) + km_north / 111.0, 6))), lng)
