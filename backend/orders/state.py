"""Order state machines — the single source of truth for allowed transitions.

Each table maps   from_status → {to_status: {roles allowed to make it}}.
Roles: customer, vendor (owner/staff), rider (assigned rider), system, admin.
Cancellation/rejection/expiry go through dedicated service functions which
also consult these tables, so a reason is always recorded.
"""
from vendors.delivery import Fulfillment

from .models import OrderStatus as S
from .models import OrderType

C, V, R, SYS, A = 'customer', 'vendor', 'rider', 'system', 'admin'

_CONFIRMATION = {
    S.PENDING_VENDOR_CONFIRMATION: {
        S.ACCEPTED: {V},
        S.REJECTED: {V},
        S.EXPIRED: {SYS},
        S.CANCELLED: {C, A},
    },
}

DINE_IN = {
    **_CONFIRMATION,
    S.ACCEPTED: {S.PREPARING: {V}, S.CANCELLED: {C, V, A}},
    S.PREPARING: {S.READY: {V}, S.CANCELLED: {V, A}},
    S.READY: {S.SERVED: {V}, S.CANCELLED: {V, A}},
    S.SERVED: {S.COMPLETED: {V}},
}

_DELIVERY_PREP = {
    **_CONFIRMATION,
    S.ACCEPTED: {S.PREPARING: {V}, S.CANCELLED: {C, V, A}},
    S.PREPARING: {S.READY: {V}, S.CANCELLED: {V, A}},
}

VENDOR_DELIVERY = {
    **_DELIVERY_PREP,
    S.READY: {S.OUT_FOR_DELIVERY: {V}, S.CANCELLED: {V, A}},
    S.OUT_FOR_DELIVERY: {S.DELIVERED: {V, C}},
}

PLATFORM_RIDER = {
    **_DELIVERY_PREP,
    # READY is immediately followed by a system move depending on whether a rider holds the job.
    S.READY: {S.AWAITING_RIDER: {SYS}, S.RIDER_ASSIGNED: {SYS}, S.CANCELLED: {V, A}},
    S.AWAITING_RIDER: {S.RIDER_ASSIGNED: {SYS}, S.CANCELLED: {V, A}},
    S.RIDER_ASSIGNED: {S.PICKED_UP: {R}, S.AWAITING_RIDER: {SYS}, S.CANCELLED: {V, A}},
    S.PICKED_UP: {S.OUT_FOR_DELIVERY: {R}},
    S.OUT_FOR_DELIVERY: {S.DELIVERED: {R, C}},
}

CUSTOMER_PICKUP = {
    **_DELIVERY_PREP,
    S.READY: {S.COMPLETED: {V, C}, S.CANCELLED: {V, A}},
}

_DELIVERY_TABLES = {
    Fulfillment.VENDOR_DELIVERY: VENDOR_DELIVERY,
    Fulfillment.PLATFORM_RIDER: PLATFORM_RIDER,
    Fulfillment.CUSTOMER_PICKUP: CUSTOMER_PICKUP,
}


def table_for(order):
    if order.order_type == OrderType.DINE_IN:
        return DINE_IN
    return _DELIVERY_TABLES[order.fulfillment_method]


def allowed_roles(order, to_status):
    return table_for(order).get(order.status, {}).get(to_status, set())


def next_actions(order, role):
    """Statuses `role` may move this order to now (used by the app to show buttons)."""
    return [to for to, roles in table_for(order).get(order.status, {}).items() if role in roles]
