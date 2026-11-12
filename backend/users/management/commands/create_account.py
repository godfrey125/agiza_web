"""Create an Agiza account (Firebase Auth user + Django user).

Stand-in for the website registration flow:

    python manage.py create_account --phone 0712345678 --role CUSTOMER --name "Asha"
    python manage.py create_account --email shop@example.com --role VENDOR

The password is prompted for (or read from AGIZA_NEW_ACCOUNT_PASSWORD) so it
never lands in shell history.
"""
import getpass
import os

from django.core.management.base import BaseCommand, CommandError

from core.firebase import FirebaseNotConfigured
from core.phone import InvalidPhone
from users.models import User
from users.services import create_account


class Command(BaseCommand):
    help = 'Create an Agiza account that can sign in to the app with phone/email + password.'

    def add_arguments(self, parser):
        parser.add_argument('--phone')
        parser.add_argument('--email')
        parser.add_argument('--role', default=User.Role.CUSTOMER, choices=User.Role.values)
        parser.add_argument('--name', default='')

    def handle(self, *args, **opts):
        if not opts['phone'] and not opts['email']:
            raise CommandError('Give --phone or --email.')
        password = os.environ.get('AGIZA_NEW_ACCOUNT_PASSWORD') or getpass.getpass('Password: ')
        if len(password) < 6:
            raise CommandError('Password must be at least 6 characters (Firebase minimum).')
        try:
            user = create_account(
                password=password, role=opts['role'], phone=opts['phone'],
                email=opts['email'], display_name=opts['name'],
            )
        except (InvalidPhone, FirebaseNotConfigured, ValueError) as exc:
            raise CommandError(str(exc))
        self.stdout.write(self.style.SUCCESS(
            f'Created {user.role} account id={user.id} uid={user.firebase_uid} login={user.phone or user.email}'
        ))
