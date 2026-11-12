"""Celery tasks (production). Beat runs `expire_due` every 5 seconds."""
from celery import shared_task

from . import services


@shared_task(name='orders.tasks.expire_due', ignore_result=True)
def expire_due():
    return services.expire_due()
