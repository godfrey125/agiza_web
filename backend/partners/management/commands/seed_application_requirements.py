from django.core.management.base import BaseCommand

from partners.models import ApplicationRequirement, ApplicationType

PDF_OR_IMAGE = ['application/pdf', 'image/jpeg', 'image/png']

VENDOR = [
    {
        'code': 'business_licence',
        'label': 'Business licence',
        'label_sw': 'Leseni ya biashara',
        'description': 'A current licence for the food business.',
        'description_sw': 'Leseni ya sasa ya biashara ya chakula.',
        'category': 'business',
        'mandatory': True,
        'sort_order': 10,
    },
    {
        'code': 'national_id',
        'label': 'National ID',
        'label_sw': 'Kitambulisho cha taifa',
        'description': 'The owner or authorised representative identity document.',
        'description_sw': 'Kitambulisho cha mmiliki au mwakilishi aliyeidhinishwa.',
        'category': 'identity',
        'mandatory': True,
        'sort_order': 20,
    },
    {
        'code': 'tin_certificate',
        'label': 'TIN certificate',
        'label_sw': 'Cheti cha TIN',
        'description': 'Tax identification certificate for the business.',
        'description_sw': 'Cheti cha namba ya mlipakodi kwa biashara.',
        'category': 'business',
        'mandatory': False,
        'sort_order': 30,
    },
    {
        'code': 'food_handling_certificate',
        'label': 'Food handling certificate',
        'label_sw': 'Cheti cha usimamizi wa chakula',
        'description': 'Health or food handling certificate, where required.',
        'description_sw': 'Cheti cha afya au usimamizi wa chakula, inapohitajika.',
        'category': 'business',
        'mandatory': False,
        'sort_order': 40,
    },
]

RIDER = [
    {
        'code': 'national_id',
        'label': 'National ID',
        'label_sw': 'Kitambulisho cha taifa',
        'description': 'Your national identity document.',
        'description_sw': 'Kitambulisho chako cha taifa.',
        'category': 'identity',
        'mandatory': True,
        'sort_order': 10,
    },
    {
        'code': 'driving_licence',
        'label': 'Driving licence',
        'label_sw': 'Leseni ya udereva',
        'description': 'A valid driving licence for the vehicle class.',
        'description_sw': 'Leseni halali ya udereva kwa aina ya gari.',
        'category': 'identity',
        'mandatory': True,
        'sort_order': 20,
    },
    {
        'code': 'police_clearance',
        'label': 'Police clearance',
        'label_sw': 'Cheti cha polisi',
        'description': 'Recent police clearance certificate.',
        'description_sw': 'Cheti cha hivi karibuni cha polisi.',
        'category': 'identity',
        'mandatory': False,
        'sort_order': 30,
    },
    {
        'code': 'vehicle_registration',
        'label': 'Vehicle registration',
        'label_sw': 'Usajili wa gari',
        'description': 'Vehicle registration card or certificate.',
        'description_sw': 'Kadi au cheti cha usajili wa gari.',
        'category': 'vehicle',
        'mandatory': True,
        'sort_order': 40,
    },
    {
        'code': 'vehicle_insurance',
        'label': 'Vehicle insurance',
        'label_sw': 'Bima ya gari',
        'description': 'Current insurance cover for the vehicle.',
        'description_sw': 'Bima ya sasa ya gari.',
        'category': 'vehicle',
        'mandatory': True,
        'sort_order': 50,
    },
]


class Command(BaseCommand):
    help = 'Create or update the vendor and rider application requirements.'

    def handle(self, *args, **options):
        created = updated = 0
        for application_type, rows in (
            (ApplicationType.VENDOR, VENDOR),
            (ApplicationType.RIDER, RIDER),
        ):
            for row in rows:
                defaults = {
                    'label': row['label'],
                    'label_sw': row.get('label_sw', ''),
                    'description': row.get('description', ''),
                    'description_sw': row.get('description_sw', ''),
                    'mandatory': row.get('mandatory', True),
                    'allowed_types': PDF_OR_IMAGE,
                    'max_size_mb': 10,
                    'applies_to': [],
                    'category': row.get('category', 'other'),
                    'sort_order': row.get('sort_order', 0),
                }
                _, was_created = ApplicationRequirement.objects.update_or_create(
                    application_type=application_type,
                    code=row['code'],
                    defaults=defaults,
                )
                created += int(was_created)
                updated += int(not was_created)
        self.stdout.write(
            self.style.SUCCESS(
                f'Application requirements ready: {created} created, {updated} updated.'
            )
        )
