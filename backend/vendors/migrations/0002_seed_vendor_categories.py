from django.db import migrations

CATEGORIES = [
    ('mama-lishe', 'Mama Lishe', 'Mama Lishe'),
    ('mama-chapati', 'Mama Chapati', 'Mama Chapati'),
    ('chipsi-mayai', 'Chipsi Mayai', 'Chipsi Mayai'),
    ('street-food', 'Street food', 'Vyakula vya mtaani'),
    ('nyama-choma', 'Nyama Choma', 'Nyama Choma'),
    ('restaurant', 'Restaurant', 'Mgahawa'),
    ('fast-food', 'Fast food', 'Vyakula vya haraka'),
    ('seafood', 'Seafood', 'Vyakula vya baharini'),
    ('drinks', 'Drinks & juice', 'Vinywaji na juisi'),
    ('bakery', 'Bakery & snacks', 'Mikate na vitafunio'),
]


def seed(apps, schema_editor):
    VendorCategory = apps.get_model('vendors', 'VendorCategory')
    for i, (slug, en, sw) in enumerate(CATEGORIES):
        VendorCategory.objects.update_or_create(slug=slug, defaults={'name_en': en, 'name_sw': sw, 'sort_order': i})


class Migration(migrations.Migration):
    dependencies = [('vendors', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
