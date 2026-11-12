"""The 12 business scenarios from the Agiza spec, exercised through the REST API."""
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from notifications.models import Notification
from orders.models import CancellationRecord, Order, OrderStatusHistory
from orders.services import expire_due
from riders.models import DeliveryJob

from . import factories as f

API = '/api/v1'


def ids(user):
    return list(Notification.objects.filter(user=user).values_list('event', flat=True))


class Base(TestCase):
    def setUp(self):
        self.customer = f.user(name='Godfrey')
        self.cust = f.client_for(self.customer)

    def vendor_client(self, v):
        return f.client_for(v.owner)

    def assertOk(self, res, code=200):
        self.assertEqual(res.status_code, code, res.content)
        return res.json()


class Test01DineIn(Base):
    def test_full_dine_in_flow(self):
        v = f.vendor('Mlimani Restaurant')
        pilau = f.item(v, 'Pilau', '5000')
        res = self.assertOk(self.cust.post(f'{API}/dine-in-orders/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': pilau.pk, 'quantity': 2}]}, format='json'), 201)
        self.assertEqual(res['status'], 'PENDING_VENDOR_CONFIRMATION')
        self.assertEqual(res['total'], '10000.00')
        self.assertEqual(res['delivery_fee'], '0.00')
        self.assertIn('VENDOR_NEW_DINE_IN', ids(v.owner))
        oid = res['id']

        vc = self.vendor_client(v)
        self.assertEqual(self.assertOk(vc.post(f'{API}/orders/{oid}/accept/'))['status'], 'ACCEPTED')
        self.assertEqual(self.assertOk(self.cust.get(f'{API}/orders/{oid}/'))['status'], 'ACCEPTED')
        self.assertIn('ORDER_ACCEPTED', ids(self.customer))
        for s in ('PREPARING', 'READY', 'SERVED', 'COMPLETED'):
            self.assertEqual(self.assertOk(vc.post(f'{API}/orders/{oid}/status/', {'status': s}))['status'], s)
        self.assertFalse(DeliveryJob.objects.exists())
        self.assertEqual(
            list(OrderStatusHistory.objects.filter(order_id=oid).values_list('to_status', flat=True)),
            ['PENDING_VENDOR_CONFIRMATION', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'])

    def test_cannot_skip_served(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        vc = self.vendor_client(v)
        vc.post(f'{API}/orders/{oid}/accept/')
        res = vc.post(f'{API}/orders/{oid}/status/', {'status': 'COMPLETED'})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['error']['code'], 'INVALID_TRANSITION')


class Test02VendorDelivery(Base):
    def test_vendor_delivers_personally(self):
        v = f.vendor('Mama Asha', policy={'offers_vendor_delivery': True})
        chapati = f.item(v, 'Chapati', '1000')
        lat, lng = f.offset(*f.DAR, 1)
        res = self.assertOk(self.cust.post(f'{API}/delivery-requests/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': chapati.pk, 'quantity': 3}],
            'fulfillment_method': 'VENDOR_DELIVERY', 'delivery_address': 'Sinza Mori', 'latitude': str(lat),
            'longitude': str(lng)}, format='json'), 201)
        oid = res['id']
        self.assertIn('VENDOR_NEW_DELIVERY', ids(v.owner))
        vc = self.vendor_client(v)
        vc.post(f'{API}/orders/{oid}/accept/')
        for s in ('PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'):
            self.assertEqual(self.assertOk(vc.post(f'{API}/orders/{oid}/status/', {'status': s}))['status'], s)
        self.assertFalse(DeliveryJob.objects.exists())
        item = Order.objects.get(pk=oid).items.get()
        self.assertEqual((item.name, item.quantity, item.unit_price), ('Chapati', 3, Decimal('1000.00')))


class Test03FreeDelivery(Base):
    def test_inside_free_radius_fee_is_zero(self):
        v = f.vendor(policy={'offers_vendor_delivery': True, 'free_delivery_radius_km': 2, 'free_delivery_agreed': True})
        it = f.item(v, price='3000')
        lat, lng = f.offset(*f.DAR, 1)  # ~1.3 km road distance
        res = self.assertOk(self.cust.post(f'{API}/delivery-requests/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'VENDOR_DELIVERY',
            'delivery_address': 'Near', 'latitude': str(lat), 'longitude': str(lng)}, format='json'), 201)
        self.assertEqual(res['delivery_fee'], '0.00')
        self.assertTrue(res['is_free_delivery'])
        self.assertEqual(res['total'], '3000.00')
        self.assertEqual(Order.objects.get(pk=res['id']).vendor, v)

    def test_free_radius_not_advertised_without_agreement(self):
        v = f.vendor(policy={'offers_vendor_delivery': True, 'free_delivery_radius_km': 2, 'free_delivery_agreed': False})
        it = f.item(v)
        lat, lng = f.offset(*f.DAR, 1)
        res = self.cust.post(f'{API}/delivery-requests/quote/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'VENDOR_DELIVERY',
            'latitude': str(lat), 'longitude': str(lng)}, format='json').json()
        self.assertFalse(res['delivery']['is_free'])
        self.assertNotEqual(res['delivery']['fee'], '0.00')


class Test04LongDistance(Base):
    def test_fee_shown_then_rider_assigned(self):
        v = f.vendor(policy={'offers_platform_rider': True, 'free_delivery_radius_km': 2, 'free_delivery_agreed': True,
                             'max_delivery_distance_km': 10, 'base_fee': 1000, 'per_km_fee': 500})
        it = f.item(v, price='4000')
        lat, lng = f.offset(*f.DAR, 3)  # ~3.9 km road → 1000 + 500×3.9 = 2950 → 3000
        body = {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'PLATFORM_RIDER',
                'delivery_address': 'Far away', 'latitude': str(lat), 'longitude': str(lng), 'rider_tip': '500'}
        quote = self.assertOk(self.cust.post(f'{API}/delivery-requests/quote/', body, format='json'))
        self.assertEqual(quote['delivery']['fee'], '3000.00')
        self.assertEqual(quote['total'], '7500.00')  # food 4000 + fee 3000 + tip 500, kept separate
        order = self.assertOk(self.cust.post(f'{API}/delivery-requests/', body, format='json'), 201)
        self.assertEqual((order['subtotal'], order['delivery_fee'], order['rider_tip'], order['total']),
                         ('4000.00', '3000.00', '500.00', '7500.00'))
        oid = order['id']

        rider = f.rider()
        vc = self.vendor_client(v)
        vc.post(f'{API}/orders/{oid}/accept/')
        job = DeliveryJob.objects.get(order_id=oid)
        self.assertEqual(job.status, 'OPEN')
        self.assertIn('RIDER_NEW_JOB', ids(rider.user))

        rc = f.client_for(rider.user)
        self.assertEqual(len(rc.get(f'{API}/deliveries/available/').json()), 1)
        self.assertOk(rc.post(f'{API}/deliveries/{job.pk}/accept/'))
        vc.post(f'{API}/orders/{oid}/status/', {'status': 'PREPARING'})
        self.assertEqual(self.assertOk(vc.post(f'{API}/orders/{oid}/status/', {'status': 'READY'}))['status'], 'RIDER_ASSIGNED')
        for action, expected in (('pickup', 'PICKED_UP'), ('start', 'OUT_FOR_DELIVERY'), ('deliver', 'DELIVERED')):
            self.assertEqual(self.assertOk(rc.post(f'{API}/deliveries/{job.pk}/{action}/'))['order_status'], expected)
        rider.refresh_from_db()
        self.assertEqual(rider.total_deliveries, 1)
        self.assertEqual(rc.get(f'{API}/riders/me/earnings/').json()['total_earnings'], '3500.00')

    def test_second_rider_cannot_take_same_job(self):
        v = f.vendor(policy={'offers_platform_rider': True})
        it = f.item(v)
        lat, lng = f.offset(*f.DAR, 1)
        oid = self.cust.post(f'{API}/delivery-requests/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'PLATFORM_RIDER',
            'delivery_address': 'x', 'latitude': str(lat), 'longitude': str(lng)}, format='json').json()['id']
        self.vendor_client(v).post(f'{API}/orders/{oid}/accept/')
        job = DeliveryJob.objects.get(order_id=oid)
        r1, r2 = f.rider(), f.rider()
        self.assertOk(f.client_for(r1.user).post(f'{API}/deliveries/{job.pk}/accept/'))
        res = f.client_for(r2.user).post(f'{API}/deliveries/{job.pk}/accept/')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['error']['code'], 'JOB_TAKEN')

    def test_outside_service_area_rejected(self):
        v = f.vendor(policy={'offers_vendor_delivery': True, 'max_delivery_distance_km': 3})
        it = f.item(v)
        lat, lng = f.offset(*f.DAR, 10)
        res = self.cust.post(f'{API}/delivery-requests/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'VENDOR_DELIVERY',
            'delivery_address': 'x', 'latitude': str(lat), 'longitude': str(lng)}, format='json')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['error']['code'], 'OUTSIDE_SERVICE_AREA')


class Test05Pickup(Base):
    def test_pickup_flow(self):
        v = f.vendor()
        it = f.item(v)
        res = self.assertOk(self.cust.post(f'{API}/delivery-requests/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'CUSTOMER_PICKUP'},
            format='json'), 201)
        self.assertEqual(res['delivery_fee'], '0.00')
        self.assertEqual(res['delivery_address'], '')
        oid = res['id']
        vc = self.vendor_client(v)
        vc.post(f'{API}/orders/{oid}/accept/')
        vc.post(f'{API}/orders/{oid}/status/', {'status': 'PREPARING'})
        vc.post(f'{API}/orders/{oid}/status/', {'status': 'READY'})
        self.assertEqual(self.assertOk(self.cust.post(f'{API}/orders/{oid}/status/', {'status': 'COMPLETED'}))['status'], 'COMPLETED')
        self.assertFalse(DeliveryJob.objects.exists())


class Test06OutOfStock(Base):
    def test_reject_with_chakula_kimeisha(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        res = self.assertOk(self.vendor_client(v).post(f'{API}/orders/{oid}/reject/', {'reason_code': 'CHAKULA_KIMEISHA'}))
        self.assertEqual(res['status'], 'REJECTED')
        self.assertEqual(res['cancellation']['reason_code'], 'CHAKULA_KIMEISHA')
        rec = CancellationRecord.objects.get(order_id=oid)
        self.assertEqual((rec.kind, rec.actor, rec.actor_role), ('VENDOR_REJECTION', v.owner, 'vendor'))
        note = Notification.objects.get(user=self.customer, event='ORDER_REJECTED')
        self.assertIn('Chakula kimeisha', note.body)  # customer's language defaults to Kiswahili
        self.assertEqual(note.data['reason_code'], 'CHAKULA_KIMEISHA')

    def test_reject_requires_reason_and_other_needs_explanation(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        vc = self.vendor_client(v)
        self.assertEqual(vc.post(f'{API}/orders/{oid}/reject/', {}).status_code, 400)
        self.assertEqual(vc.post(f'{API}/orders/{oid}/reject/', {'reason_code': 'OTHER'}).status_code, 400)
        self.assertEqual(vc.post(f'{API}/orders/{oid}/reject/', {'reason_code': 'OTHER', 'explanation': 'Gas imeisha'}).status_code, 200)


class Test07Expiry(Base):
    def test_backend_expires_after_60s_and_blocks_accept(self):
        v = f.vendor(policy={'offers_vendor_delivery': True})
        it = f.item(v)
        lat, lng = f.offset(*f.DAR, 1)
        oid = self.cust.post(f'{API}/delivery-requests/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'VENDOR_DELIVERY',
            'delivery_address': 'x', 'latitude': str(lat), 'longitude': str(lng)}, format='json').json()['id']
        order = Order.objects.get(pk=oid)
        self.assertAlmostEqual((order.vendor_response_deadline - order.vendor_notified_at).total_seconds(), 60, delta=1)

        self.assertEqual(expire_due(), 0)  # not yet due
        later = timezone.now() + timedelta(seconds=61)
        self.assertEqual(expire_due(now=later), 1)
        order.refresh_from_db()
        self.assertEqual(order.status, 'EXPIRED')
        rec = CancellationRecord.objects.get(order=order)
        self.assertEqual((rec.kind, rec.reason_code, rec.actor_role), ('AUTOMATIC_EXPIRY', 'NO_VENDOR_RESPONSE', 'system'))
        self.assertIn('ORDER_EXPIRED', ids(self.customer))
        self.assertIn('VENDOR_REQUEST_EXPIRED', ids(v.owner))
        res = self.vendor_client(v).post(f'{API}/orders/{oid}/accept/')
        self.assertEqual(res.status_code, 409)

    def test_late_accept_expires_even_without_worker(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        Order.objects.filter(pk=oid).update(vendor_response_deadline=timezone.now() - timedelta(seconds=1))
        res = self.vendor_client(v).post(f'{API}/orders/{oid}/accept/')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['error']['code'], 'REQUEST_EXPIRED')
        self.assertEqual(Order.objects.get(pk=oid).status, 'EXPIRED')  # expiry was committed, not rolled back


class Test08CustomerCancel(Base):
    def test_cancel_pending_with_reason(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        self.assertEqual(self.cust.post(f'{API}/orders/{oid}/cancel/', {}).status_code, 400)
        res = self.assertOk(self.cust.post(f'{API}/orders/{oid}/cancel/', {'reason_code': 'CHANGED_MIND'}))
        self.assertEqual(res['status'], 'CANCELLED')
        self.assertEqual(CancellationRecord.objects.get(order_id=oid).kind, 'CUSTOMER_CANCELLATION')
        self.assertIn('VENDOR_CUSTOMER_CANCELLED', ids(v.owner))

    def test_cannot_cancel_after_preparing(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        vc = self.vendor_client(v)
        vc.post(f'{API}/orders/{oid}/accept/')
        vc.post(f'{API}/orders/{oid}/status/', {'status': 'PREPARING'})
        res = self.cust.post(f'{API}/orders/{oid}/cancel/', {'reason_code': 'CHANGED_MIND'})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['error']['code'], 'CANCELLATION_NOT_ALLOWED')


class Test09CustomRequest(Base):
    def test_offers_and_acceptance(self):
        v1 = f.vendor('Mama Asha', policy={'offers_vendor_delivery': True})
        v2 = f.vendor('Mama Rehema', policy={'offers_vendor_delivery': True})
        far = f.vendor('Far Away', lat=f.DAR[0] + Decimal('0.5'), policy={'offers_vendor_delivery': True})
        lat, lng = f.offset(*f.DAR, 1)
        req = self.assertOk(self.cust.post(f'{API}/custom-requests/', {
            'description': 'Pilau na nyama kwa watu 10, birthday', 'people_count': 10,
            'delivery_address': 'Sinza', 'latitude': str(lat), 'longitude': str(lng)}, format='json'), 201)
        self.assertEqual(req['recipients_count'], 2)
        self.assertIn('VENDOR_NEW_CUSTOM', ids(v1.owner))
        self.assertNotIn('VENDOR_NEW_CUSTOM', ids(far.owner))

        o1 = self.assertOk(f.client_for(v1.owner).post(f'{API}/offers/', {
            'request_id': req['id'], 'food_description': 'Pilau sahani 10 + kachumbari', 'price': '60000',
            'preparation_minutes': 90, 'fulfillment_method': 'VENDOR_DELIVERY'}), 201)
        self.assertOk(f.client_for(v2.owner).post(f'{API}/offers/', {
            'request_id': req['id'], 'food_description': 'Pilau 10', 'price': '55000',
            'preparation_minutes': 120, 'fulfillment_method': 'VENDOR_DELIVERY'}), 201)
        self.assertEqual(len(self.cust.get(f'{API}/custom-requests/{req["id"]}/').json()['offers']), 2)
        # vendors can't see each other's offers
        self.assertIsNone(f.client_for(v2.owner).get(f'{API}/custom-requests/{req["id"]}/').json()['offers'])

        order = self.assertOk(self.cust.post(f'{API}/offers/{o1["id"]}/accept/'), 201)
        self.assertEqual(order['order_type'], 'CUSTOM_DELIVERY')
        self.assertEqual(order['status'], 'ACCEPTED')
        self.assertEqual(order['subtotal'], '60000.00')
        self.assertEqual(order['items'][0]['description'], 'Pilau sahani 10 + kachumbari')
        self.assertEqual(Order.objects.filter(custom_request_id=req['id']).count(), 1)
        self.assertIn('VENDOR_OFFER_ACCEPTED', ids(v1.owner))
        self.assertIn('VENDOR_OFFER_NOT_SELECTED', ids(v2.owner))
        self.assertEqual(self.cust.post(f'{API}/offers/{o1["id"]}/accept/').status_code, 409)


class Test10CustomExpiry(Base):
    def test_no_offers_expires(self):
        f.vendor(policy={'offers_vendor_delivery': True})
        lat, lng = f.offset(*f.DAR, 1)
        req = self.cust.post(f'{API}/custom-requests/', {
            'description': 'Biriani', 'delivery_address': 'x', 'latitude': str(lat), 'longitude': str(lng)},
            format='json').json()
        self.assertEqual(expire_due(now=timezone.now() + timedelta(seconds=301)), 1)
        data = self.cust.get(f'{API}/custom-requests/{req["id"]}/').json()
        self.assertEqual(data['status'], 'EXPIRED')
        self.assertEqual(data['cancellation']['reason_code'], 'NO_OFFERS')
        self.assertIn('CUSTOM_REQUEST_EXPIRED', ids(self.customer))


class Test11HistoricalPrices(Base):
    def test_snapshot_survives_menu_changes(self):
        v = f.vendor()
        it = f.item(v, 'Chapati', '1000', image_url='https://example.invalid/old.jpg')
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk, 'quantity': 2}]},
                             format='json').json()['id']
        vc = self.vendor_client(v)
        vc.post(f'{API}/orders/{oid}/accept/')
        for s in ('PREPARING', 'READY', 'SERVED', 'COMPLETED'):
            vc.post(f'{API}/orders/{oid}/status/', {'status': s})
        self.assertOk(vc.patch(f'{API}/vendors/me/menu-items/{it.pk}/', {'name': 'Chapati Special', 'price': '2500'}))
        self.assertEqual(vc.delete(f'{API}/vendors/me/menu-items/{it.pk}/').status_code, 204)
        line = self.cust.get(f'{API}/orders/{oid}/').json()['items'][0]
        self.assertEqual((line['name'], line['unit_price'], line['line_total'], line['image_url']),
                         ('Chapati', '1000.00', '2000.00', 'https://example.invalid/old.jpg'))


class Test12Security(Base):
    def test_customer_cannot_see_others_orders(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        other = f.client_for(f.user())
        self.assertEqual(other.get(f'{API}/orders/{oid}/').status_code, 404)
        self.assertEqual(other.post(f'{API}/orders/{oid}/cancel/', {'reason_code': 'CHANGED_MIND'}).status_code, 404)

    def test_vendor_cannot_edit_other_vendor_menu(self):
        v1, v2 = f.vendor('A'), f.vendor('B')
        it = f.item(v1)
        c2 = self.vendor_client(v2)
        self.assertEqual(c2.patch(f'{API}/vendors/me/menu-items/{it.pk}/', {'price': '1'}).status_code, 404)
        self.assertEqual(c2.post(f'{API}/orders/1/accept/').status_code, 404)

    def test_vendor_cannot_accept_other_vendors_order(self):
        v1, v2 = f.vendor('A'), f.vendor('B')
        it = f.item(v1)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v1.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        self.assertEqual(self.vendor_client(v2).post(f'{API}/orders/{oid}/accept/').status_code, 404)

    def test_rider_cannot_touch_unassigned_jobs(self):
        v = f.vendor(policy={'offers_platform_rider': True})
        it = f.item(v)
        lat, lng = f.offset(*f.DAR, 1)
        oid = self.cust.post(f'{API}/delivery-requests/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}], 'fulfillment_method': 'PLATFORM_RIDER',
            'delivery_address': 'x', 'latitude': str(lat), 'longitude': str(lng)}, format='json').json()['id']
        self.vendor_client(v).post(f'{API}/orders/{oid}/accept/')
        job = DeliveryJob.objects.get(order_id=oid)
        holder, intruder = f.rider(), f.rider()
        f.client_for(holder.user).post(f'{API}/deliveries/{job.pk}/accept/')
        ic = f.client_for(intruder.user)
        self.assertEqual(ic.get(f'{API}/orders/{oid}/').status_code, 404)
        self.assertEqual(ic.post(f'{API}/deliveries/{job.pk}/pickup/').status_code, 404)
        avail = ic.get(f'{API}/deliveries/available/').json()
        self.assertEqual(avail, [])

    def test_client_cannot_set_price_or_status(self):
        v = f.vendor()
        it = f.item(v, price='1000')
        res = self.assertOk(self.cust.post(f'{API}/dine-in-orders/', {
            'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk, 'quantity': 1}], 'total': '1', 'subtotal': '1',
            'status': 'COMPLETED'}, format='json'), 201)
        self.assertEqual((res['total'], res['status']), ('1000.00', 'PENDING_VENDOR_CONFIRMATION'))
        res = self.cust.post(f'{API}/orders/{res["id"]}/status/', {'status': 'ACCEPTED'})
        self.assertEqual(res.status_code, 409)

    def test_customer_cannot_bypass_expiry(self):
        v = f.vendor()
        it = f.item(v)
        oid = self.cust.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]},
                             format='json').json()['id']
        res = self.cust.post(f'{API}/orders/{oid}/accept/')
        self.assertIn(res.status_code, (403, 404))

    def test_storage_url_must_be_own_folder(self):
        v = f.vendor()
        vc = self.vendor_client(v)
        res = vc.post(f'{API}/vendors/me/menu-items/', {
            'name': 'Mandazi', 'price': '300', 'image_url': 'https://random.example/x.jpg',
            'image_path': f'vendors/{v.pk + 1}/x.jpg'})
        self.assertEqual(res.status_code, 400)

    def test_unauthenticated_is_rejected(self):
        self.assertEqual(APIClient().get(f'{API}/orders/').status_code, 401)


class TestFirebaseAuth(TestCase):
    def test_valid_token_resolves_registered_user(self):
        u = f.user()
        with mock.patch('users.authentication.verify_id_token', return_value={'uid': u.firebase_uid}):
            res = APIClient().get(f'{API}/auth/me/', HTTP_AUTHORIZATION='Bearer token')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['role'], 'CUSTOMER')

    def test_unregistered_firebase_user_rejected(self):
        with mock.patch('users.authentication.verify_id_token', return_value={'uid': 'nobody'}):
            res = APIClient().get(f'{API}/auth/me/', HTTP_AUTHORIZATION='Bearer token')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['error']['code'], 'account_not_registered')

    def test_invalid_token_rejected(self):
        with mock.patch('users.authentication.verify_id_token', side_effect=ValueError('bad')):
            res = APIClient().get(f'{API}/auth/me/', HTTP_AUTHORIZATION='Bearer junk')
        self.assertEqual(res.status_code, 401)


class TestDiscovery(TestCase):
    def test_search_returns_vendor_owned_items_with_distance(self):
        asha = f.vendor('Mama Asha', policy={'offers_vendor_delivery': True, 'free_delivery_radius_km': 3,
                                             'free_delivery_agreed': True})
        rehema = f.vendor('Mama Rehema', lat=f.DAR[0] + Decimal('0.02'))
        hidden = f.vendor('Not approved')
        hidden.is_approved = False
        hidden.save()
        f.item(asha, 'Chapati', '1000')
        f.item(rehema, 'Chapati', '1500')
        f.item(hidden, 'Chapati', '500')
        f.item(asha, 'Wali', '2000')
        res = APIClient().get(f'{API}/menu/search/', {'q': 'chapati', 'lat': str(f.DAR[0]), 'lng': str(f.DAR[1])}).json()
        names = [(r['name'], r['vendor']['business_name'], r['price']) for r in res['results']]
        self.assertEqual(names, [('Chapati', 'Mama Asha', '1000.00'), ('Chapati', 'Mama Rehema', '1500.00')])
        self.assertTrue(res['results'][0]['delivery']['is_free'])
        free = APIClient().get(f'{API}/menu/search/', {'q': 'chapati', 'lat': str(f.DAR[0]), 'lng': str(f.DAR[1]),
                                                       'free_delivery': 'true'}).json()
        self.assertEqual(free['count'], 1)

    def test_map_lists_approved_vendors(self):
        f.vendor('A')
        res = APIClient().get(f'{API}/map/vendors/', {'lat': str(f.DAR[0]), 'lng': str(f.DAR[1])}).json()
        self.assertEqual([r['business_name'] for r in res], ['A'])

    def test_closed_vendor_cannot_receive_orders(self):
        v = f.vendor()
        v.is_online = False
        v.save()
        it = f.item(v)
        c = f.client_for(f.user())
        res = c.post(f'{API}/dine-in-orders/', {'vendor_id': v.pk, 'items': [{'menu_item_id': it.pk}]}, format='json')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['error']['code'], 'VENDOR_CLOSED')


class TestNotificationDedupe(TestCase):
    def test_same_event_notifies_once(self):
        from notifications.services import notify
        u = f.user()
        notify(u, 'ORDER_READY', dedupe_key='k1', ctx={'vendor': 'A', 'code': 'X'})
        notify(u, 'ORDER_READY', dedupe_key='k1', ctx={'vendor': 'A', 'code': 'X'})
        self.assertEqual(Notification.objects.filter(user=u).count(), 1)
