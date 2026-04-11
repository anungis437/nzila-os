"""Celery application entry-point for UnionEyes.

Workers are started with:
    celery -A config worker -l info
Beat scheduler:
    celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("union_eyes")

# Read CELERY_* settings from Django's settings module.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks.py in every INSTALLED_APP.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Sanity-check task — prints the request context."""
    print(f"Request: {self.request!r}")
