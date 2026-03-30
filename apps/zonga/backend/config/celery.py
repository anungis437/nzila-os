"""Celery application entry-point for Zonga.

Workers:   celery -A config worker -l info
Beat:      celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("zonga")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Sanity-check task — prints the request context."""
    print(f"Request: {self.request!r}")
