"""Selectable reason codes for rejections, cancellations and expiry (EN + SW)."""

VENDOR_REASONS = {
    'CHAKULA_KIMEISHA': ('Food is out of stock', 'Chakula kimeisha'),
    'ITEM_UNAVAILABLE': ('Selected food is unavailable', 'Chakula ulichochagua hakipatikani'),
    'BUSINESS_CLOSED': ('Business is closed', 'Biashara imefungwa'),
    'TOO_MANY_ORDERS': ('Too many current orders', 'Oda nyingi kwa sasa'),
    'DELIVERY_UNAVAILABLE': ('Delivery cannot be arranged', 'Usafirishaji haupatikani'),
    'UNABLE_TO_FULFILL': ('Unable to fulfill the order', 'Hatuwezi kukamilisha oda'),
    'OTHER': ('Other reason', 'Sababu nyingine'),
}

CUSTOMER_REASONS = {
    'ORDERED_BY_MISTAKE': ('Ordered by mistake', 'Niliagiza kwa makosa'),
    'CHANGED_MIND': ('Changed my mind', 'Nimebadilisha mawazo'),
    'TAKING_TOO_LONG': ('Delivery taking too long', 'Inachukua muda mrefu sana'),
    'FOUND_ANOTHER_VENDOR': ('Found another vendor', 'Nimepata muuzaji mwingine'),
    'OTHER': ('Other reason', 'Sababu nyingine'),
}

RIDER_REASONS = {
    'VEHICLE_PROBLEM': ('Vehicle problem', 'Tatizo la chombo cha usafiri'),
    'TOO_FAR': ('Pickup is too far', 'Mahali pa kuchukua ni mbali sana'),
    'PERSONAL_EMERGENCY': ('Personal emergency', 'Dharura binafsi'),
    'OTHER': ('Other reason', 'Sababu nyingine'),
}

ADMIN_REASONS = {
    'FRAUD_SUSPECTED': ('Suspected fraud', 'Udanganyifu unashukiwa'),
    'SUPPORT_REQUEST': ('Cancelled by Agiza support', 'Imesitishwa na huduma kwa wateja'),
    'OTHER': ('Other reason', 'Sababu nyingine'),
}

SYSTEM_REASONS = {
    'NO_VENDOR_RESPONSE': ('Vendor did not respond in time', 'Muuzaji hakujibu kwa wakati'),
    'NO_OFFERS': ('No vendor sent an offer in time', 'Hakuna muuzaji aliyetuma ofa kwa wakati'),
    'OFFER_NOT_SELECTED': ('No offer was selected in time', 'Hakuna ofa iliyochaguliwa kwa wakati'),
}

REASONS_BY_ROLE = {
    'vendor': VENDOR_REASONS,
    'customer': CUSTOMER_REASONS,
    'rider': RIDER_REASONS,
    'admin': ADMIN_REASONS,
    'system': SYSTEM_REASONS,
}


def label(code, lang='en'):
    for table in REASONS_BY_ROLE.values():
        if code in table:
            return table[code][1 if lang == 'sw' else 0]
    return code


def catalogue():
    return {
        role: [{'code': c, 'label_en': en, 'label_sw': sw, 'requires_explanation': c == 'OTHER'}
               for c, (en, sw) in table.items()]
        for role, table in REASONS_BY_ROLE.items() if role != 'system'
    }
