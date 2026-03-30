# Make Celery app available as `from config import celery_app` and ensure
# it is loaded when Django starts so @shared_task decorators work.
from .celery import app as celery_app  # noqa: F401

__all__ = ("celery_app",)
