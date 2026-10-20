"""Disable the scheduled cleanups that have no source authority to run.

``daily-cleanup-logs`` targets the audit hash chain, which no retention policy
authorizes touching. ``weekly-cleanup-sessions`` needs DELETE on django_session, which no
worker identity in the supported role design holds. Both were reporting FAILURE on every
run once cleanup_task started telling the truth, so they are removed from
CELERY_BEAT_SCHEDULE.

The supported beat scheduler is django_celery_beat's DatabaseScheduler. It upserts the
entries it finds in settings and never deletes the rows of entries that are gone, so an
existing deployment keeps dispatching them until the rows are disabled. This does that,
and records the change so a running beat reloads. It does not delete the rows, so the
operator's history is preserved, and it does not touch tasks with other names.
"""
from django.db import migrations
from django.utils import timezone

UNSUPPORTED_SCHEDULES = ("daily-cleanup-logs", "weekly-cleanup-sessions")
CLEANUP_TASK = "core.tasks.cleanup_task"


def disable_unsupported_cleanup_schedules(apps, schema_editor):
    alias = schema_editor.connection.alias
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTasks = apps.get_model("django_celery_beat", "PeriodicTasks")
    changed = (
        PeriodicTask.objects.using(alias)
        .filter(name__in=UNSUPPORTED_SCHEDULES, task=CLEANUP_TASK, enabled=True)
        .update(enabled=False)
    )
    if changed:
        PeriodicTasks.objects.using(alias).update_or_create(
            ident=1, defaults={"last_update": timezone.now()}
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_alter_auditlogs_action_and_more"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        # Re-enabling known-failing dispatch is not something a rollback should do.
        migrations.RunPython(disable_unsupported_cleanup_schedules, migrations.RunPython.noop),
    ]
