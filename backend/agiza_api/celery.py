"""Celery app for production background work (request expiry, notifications).

Run with:
    celery -A agiza_api worker -B -l info
Locally you can instead run `python manage.py run_expiry_worker`.
"""
import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'agiza_api.settings')

app = Celery('agiza')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
