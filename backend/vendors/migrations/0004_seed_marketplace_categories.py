from django.db import migrations

# Marketplace-wide groups used by the Nearby Vendors filters. Food covers the
# existing prepared-food categories; grocery and fruits are new store types.
CATEGORIES = [
    ('grocery', 'Grocery', 'Mboga na vyakula vya nyumbani'),
    ('fruits', 'Fruits', 'Matunda'),
]


def seed(apps, schema_editor):
    VendorCategory = apps.get_model('vendors', 'VendorCategory')
    for i, (slug, en, sw) in enumerate(CATEGORIES, start=10):
        VendorCategory.objects.update_or_create(slug=slug, defaults={'name_en': en, 'name_sw': sw, 'sort_order': i})


class Migration(migrations.Migration):
    dependencies = [('vendors', '0003_vendorprofile_min_order_amount')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
