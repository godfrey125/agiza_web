from django.db import migrations


def backfill_staff_roles(apps, schema_editor):
    """Existing admins keep full access after granular roles are introduced."""
    User = apps.get_model('users', 'User')
    User.objects.filter(role='ADMIN', staff_role='NONE').update(
        staff_role='SUPER_ADMIN',
        is_staff=True,
    )


def reverse(apps, schema_editor):
    # Do not remove privileges automatically on rollback.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0002_user_account_state_user_account_state_reason_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_staff_roles, reverse),
    ]
