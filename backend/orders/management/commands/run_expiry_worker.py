"""Expire overdue requests without Celery/Redis (local development, small deployments).

    python manage.py run_expiry_worker            # loop forever, every 2 seconds
    python manage.py run_expiry_worker --once     # single pass (e.g. from cron)
"""
import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from orders.services import expire_due

log = logging.getLogger('agiza.worker')


class Command(BaseCommand):
    help = 'Expire vendor-unanswered requests (60s) and custom requests past their windows.'

    def add_arguments(self, parser):
        parser.add_argument('--interval', type=float, default=2.0)
        parser.add_argument('--once', action='store_true')

    def handle(self, *args, **opts):
        self.stdout.write(f'Expiry worker started (interval {opts["interval"]}s).')
        while True:
            close_old_connections()
            try:
                n = expire_due()
                if n:
                    self.stdout.write(f'Expired {n} request(s).')
            except Exception:  # keep the worker alive; log and retry next tick
                log.exception('Expiry pass failed')
            if opts['once']:
                return
            time.sleep(opts['interval'])
