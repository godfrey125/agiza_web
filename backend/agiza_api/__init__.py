try:  # Celery is optional in local development.
    from .celery import app as celery_app  # noqa: F401
except ImportError:  # pragma: no cover
    celery_app = None
