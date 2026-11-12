"""Notification texts (English + Kiswahili) and Android channel per event.

Placeholders are filled with str.format(**ctx). Keep them short — they show on lock screens.
"""

URGENT = 'agiza_incoming'   # high-importance channel: vendor/rider must react quickly
UPDATES = 'agiza_updates'   # normal order updates

EVENTS = {
    # customer
    'DINE_IN_SUBMITTED': (UPDATES, ('Order sent to {vendor}', 'Waiting for {vendor} to confirm your dine-in order.'),
                          ('Oda imetumwa kwa {vendor}', 'Tunasubiri {vendor} athibitishe oda yako.')),
    'ORDER_ACCEPTED': (UPDATES, ('{vendor} accepted your order', 'Order {code} is confirmed.'),
                       ('{vendor} amekubali oda yako', 'Oda {code} imethibitishwa.')),
    'ORDER_REJECTED': (UPDATES, ('{vendor} could not take your order', 'Reason: {reason}. Try another vendor.'),
                       ('{vendor} hawezi kupokea oda yako', 'Sababu: {reason}. Jaribu muuzaji mwingine.')),
    'ORDER_EXPIRED': (UPDATES, ('No response from {vendor}', 'Your request expired. You can try another vendor.'),
                      ('{vendor} hakujibu', 'Ombi lako limeisha muda. Jaribu muuzaji mwingine.')),
    'ORDER_CANCELLED_BY_VENDOR': (UPDATES, ('{vendor} cancelled order {code}', 'Reason: {reason}.'),
                                  ('{vendor} amesitisha oda {code}', 'Sababu: {reason}.')),
    'ORDER_CANCELLED_BY_ADMIN': (UPDATES, ('Order {code} was cancelled', 'Agiza support cancelled this order. Reason: {reason}.'),
                                 ('Oda {code} imesitishwa', 'Huduma kwa wateja wamesitisha oda hii. Sababu: {reason}.')),
    'ORDER_CANCELLED_CONFIRMED': (UPDATES, ('Order {code} cancelled', 'Your cancellation was recorded.'),
                                  ('Oda {code} imesitishwa', 'Usitishaji wako umerekodiwa.')),
    'ORDER_PREPARING': (UPDATES, ('{vendor} is preparing your food', 'Order {code}.'),
                        ('{vendor} anaandaa chakula chako', 'Oda {code}.')),
    'ORDER_READY': (UPDATES, ('Your food is ready', '{vendor} has your order {code} ready.'),
                    ('Chakula chako kiko tayari', '{vendor} ameandaa oda {code}.')),
    'ORDER_RIDER_ASSIGNED': (UPDATES, ('Rider assigned', '{rider} will deliver order {code}.'),
                             ('Msafirishaji amepatikana', '{rider} atakuletea oda {code}.')),
    'ORDER_OUT_FOR_DELIVERY': (UPDATES, ('Your food is on the way', 'Order {code} is out for delivery.'),
                               ('Chakula chako kiko njiani', 'Oda {code} inaletwa.')),
    'ORDER_DELIVERED': (UPDATES, ('Order delivered', 'Enjoy your meal! Order {code}.'),
                        ('Oda imefika', 'Karibu chakula! Oda {code}.')),
    'ORDER_COMPLETED': (UPDATES, ('Order completed', 'Thank you for using Agiza. Order {code}.'),
                        ('Oda imekamilika', 'Asante kwa kutumia Agiza. Oda {code}.')),
    'CUSTOM_REQUEST_SENT': (UPDATES, ('Custom request sent', 'Sent to {count} nearby vendors. Offers will appear here.'),
                            ('Ombi maalum limetumwa', 'Limetumwa kwa wauzaji {count} wa karibu. Ofa zitaonekana hapa.')),
    'CUSTOM_OFFER_RECEIVED': (UPDATES, ('New offer from {vendor}', 'TZS {price} — tap to compare offers.'),
                              ('Ofa mpya kutoka {vendor}', 'TZS {price} — gusa kulinganisha ofa.')),
    'CUSTOM_REQUEST_EXPIRED': (UPDATES, ('Custom request expired', '{reason}. You can send a new request.'),
                               ('Ombi maalum limeisha muda', '{reason}. Unaweza kutuma ombi jipya.')),
    # vendor
    'VENDOR_NEW_DINE_IN': (URGENT, ('New dine-in order', '{items} — TZS {total}. Accept within {seconds}s.'),
                           ('Oda mpya ya kula hapa', '{items} — TZS {total}. Kubali ndani ya sekunde {seconds}.')),
    'VENDOR_NEW_DELIVERY': (URGENT, ('New delivery request', '{items} — TZS {total}. Accept within {seconds}s.'),
                            ('Ombi jipya la kuletewa', '{items} — TZS {total}. Kubali ndani ya sekunde {seconds}.')),
    'VENDOR_NEW_CUSTOM': (URGENT, ('New custom food request', '{description}'),
                          ('Ombi jipya la chakula maalum', '{description}')),
    'VENDOR_REQUEST_EXPIRED': (UPDATES, ('Request expired', 'Order {code} expired because it was not answered in time.'),
                               ('Ombi limeisha muda', 'Oda {code} imeisha muda kwa sababu haikujibiwa kwa wakati.')),
    'VENDOR_CUSTOMER_CANCELLED': (UPDATES, ('Customer cancelled order {code}', 'Reason: {reason}.'),
                                  ('Mteja amesitisha oda {code}', 'Sababu: {reason}.')),
    'VENDOR_OFFER_ACCEPTED': (URGENT, ('Your offer was accepted!', 'Order {code} — TZS {total}. Start preparing.'),
                              ('Ofa yako imekubaliwa!', 'Oda {code} — TZS {total}. Anza kuandaa.')),
    'VENDOR_OFFER_NOT_SELECTED': (UPDATES, ('Offer not selected', 'The customer chose another offer.'),
                                  ('Ofa haikuchaguliwa', 'Mteja amechagua ofa nyingine.')),
    'VENDOR_RIDER_ASSIGNED': (UPDATES, ('Rider assigned', '{rider} will collect order {code}.'),
                              ('Msafirishaji amepatikana', '{rider} atachukua oda {code}.')),
    'VENDOR_ORDER_UPDATE': (UPDATES, ('Order {code} update', 'Status: {status}.'),
                            ('Taarifa ya oda {code}', 'Hali: {status}.')),
    # rider
    'RIDER_NEW_JOB': (URGENT, ('New delivery job', 'Pickup: {pickup}. Earn TZS {earning}.'),
                      ('Kazi mpya ya kusafirisha', 'Chukua: {pickup}. Pata TZS {earning}.')),
    'RIDER_JOB_ASSIGNED': (UPDATES, ('Job assigned to you', 'Pick up at {pickup}, deliver to {dropoff}.'),
                           ('Umepewa kazi', 'Chukua {pickup}, peleka {dropoff}.')),
    'RIDER_FOOD_READY': (URGENT, ('Food is ready for pickup', 'Go to {pickup} for order {code}.'),
                         ('Chakula kiko tayari kuchukuliwa', 'Nenda {pickup} kwa oda {code}.')),
    'RIDER_JOB_CANCELLED': (UPDATES, ('Delivery job cancelled', 'Order {code} was cancelled. Reason: {reason}.'),
                            ('Kazi imesitishwa', 'Oda {code} imesitishwa. Sababu: {reason}.')),
    # account governance
    'ACCOUNT_WARNING': (UPDATES, ('Important warning about your Agiza account', 'Reason: {reason}. Please review the platform rules.'),
                        ('Onyo muhimu kuhusu akaunti yako ya Agiza', 'Sababu: {reason}. Tafadhali soma kanuni za jukwaa.')),
    'ACCOUNT_SUSPENDED': (UPDATES, ('Your Agiza account is temporarily suspended', 'You cannot sign in until {until}. Reason: {reason}.'),
                         ('Akaunti yako ya Agiza imesitishwa kwa muda', 'Hutaweza kuingia hadi {until}. Sababu: {reason}.')),
    'ACCOUNT_TERMINATED': (UPDATES, ('Your Agiza account has been terminated', 'Reason: {reason}. You may appeal this decision through support.'),
                         ('Akaunti yako ya Agiza imefutwa', 'Sababu: {reason}. Unaweza kukata rufaa kupitia huduma kwa wateja.')),
    'ACCOUNT_RESTRICTED': (UPDATES, ('Some Agiza features are restricted', 'Restricted: {features}. Reason: {reason}.'),
                          ('Baadhi ya huduma za Agiza zimezuiwa', 'Zilizozuiwa: {features}. Sababu: {reason}.')),
    'ACCOUNT_RESTORED': (UPDATES, ('Your Agiza account has been restored', 'You can use Agiza normally again.'),
                        ('Akaunti yako ya Agiza imerejeshwa', 'Unaweza kutumia Agiza kawaida tena.')),
    'ACCOUNT_VERIFICATION_REQUIRED': (UPDATES, ('Additional verification is required', 'Please submit the requested documents. Reason: {reason}.'),
                                      ('Uthibitisho wa ziada unahitajika', 'Tafadhali wasilisha nyaraka zilizoombwa. Sababu: {reason}.')),
    'ACCOUNT_INVESTIGATION': (UPDATES, ('Your Agiza account is under review', 'Some features may be limited while we investigate. Reason: {reason}.'),
                              ('Akaunti yako ya Agiza inachunguzwa', 'Baadhi ya huduma zinaweza kuwa na kikomo wakati tunachunguza. Sababu: {reason}.')),
    'ACCOUNT_LOGIN_DISABLED': (UPDATES, ('Sign-in disabled for your Agiza account', 'Reason: {reason}. Contact support if you believe this is a mistake.'),
                               ('Kuingia kumezuiwa kwa akaunti yako ya Agiza', 'Sababu: {reason}. Wasiliana na huduma kwa wateja ikiwa unaona hii si sahihi.')),
    'ACCOUNT_APPEAL_RECEIVED': (UPDATES, ('Your appeal was received', 'Our team will review your appeal and contact you.'),
                               ('Rufaa yako imepokelewa', 'Timu yetu itakagua rufaa yako na kuwasiliana nawe.')),
    'ACCOUNT_APPEAL_DECIDED': (UPDATES, ('Your appeal has been reviewed', 'Outcome: {outcome}. {reason}'),
                               ('Rufaa yako imekaguliwa', 'Matokeo: {outcome}. {reason}')),
    'ACCOUNT_ROLE_UPDATED': (UPDATES, ('Your Agiza access level changed', 'New role: {role}.'),
                             ('Kiwango chako cha ufikiaji Agiza kimebadilika', 'Jukumu jipya: {role}.')),
}


def render(event, lang, ctx):
    channel, en, sw = EVENTS[event]
    title, body = sw if lang == 'sw' else en
    safe = _SafeDict(ctx)
    return channel, title.format_map(safe)[:160], body.format_map(safe)[:500]


class _SafeDict(dict):
    def __missing__(self, key):
        return ''
