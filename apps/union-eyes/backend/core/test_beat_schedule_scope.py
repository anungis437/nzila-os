"""The beat schedule must not dispatch work that has no authority to succeed."""
import importlib
from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase

from core import tasks

SUPPORTED_SCHEDULED_CLEANUP_TARGETS = {"exports"}


class BeatScheduleScopeTests(SimpleTestCase):
    def test_every_scheduled_cleanup_targets_a_supported_target(self):
        scheduled = [
            (name, entry["kwargs"]["target"])
            for name, entry in settings.CELERY_BEAT_SCHEDULE.items()
            if entry["task"] == "core.tasks.cleanup_task"
        ]
        self.assertTrue(scheduled, "the exports cleanup is expected to stay scheduled")
        for name, target in scheduled:
            self.assertIn(target, SUPPORTED_SCHEDULED_CLEANUP_TARGETS, name)

    def test_audit_chain_and_session_cleanups_are_not_scheduled(self):
        names = set(settings.CELERY_BEAT_SCHEDULE)
        self.assertNotIn("daily-cleanup-logs", names)
        self.assertNotIn("weekly-cleanup-sessions", names)

    def test_every_scheduled_task_is_registered(self):
        registered = set(tasks.cleanup_task.app.tasks)
        for name, entry in settings.CELERY_BEAT_SCHEDULE.items():
            if entry["task"].startswith("core."):
                self.assertIn(entry["task"], registered, name)


class DisableUnsupportedSchedulesMigrationTests(SimpleTestCase):
    def _migration(self):
        return importlib.import_module("core.migrations.0005_disable_unsupported_cleanup_schedules")

    def _apps(self, changed):
        periodic_task, periodic_tasks = mock.MagicMock(), mock.MagicMock()
        periodic_task.objects.using.return_value.filter.return_value.update.return_value = changed
        apps = mock.MagicMock()
        apps.get_model.side_effect = lambda app, model: {
            "PeriodicTask": periodic_task,
            "PeriodicTasks": periodic_tasks,
        }[model]
        return apps, periodic_task, periodic_tasks

    def test_disables_only_the_two_named_cleanup_rows_and_signals_beat(self):
        module = self._migration()
        apps, periodic_task, periodic_tasks = self._apps(changed=2)
        editor = mock.MagicMock()
        editor.connection.alias = "default"
        module.disable_unsupported_cleanup_schedules(apps, editor)
        periodic_task.objects.using.return_value.filter.assert_called_once_with(
            name__in=("daily-cleanup-logs", "weekly-cleanup-sessions"),
            task="core.tasks.cleanup_task",
            enabled=True,
        )
        periodic_task.objects.using.return_value.filter.return_value.update.assert_called_once_with(enabled=False)
        periodic_tasks.objects.using.return_value.update_or_create.assert_called_once()

    def test_does_not_signal_beat_when_nothing_changed(self):
        module = self._migration()
        apps, _, periodic_tasks = self._apps(changed=0)
        editor = mock.MagicMock()
        editor.connection.alias = "default"
        module.disable_unsupported_cleanup_schedules(apps, editor)
        periodic_tasks.objects.using.return_value.update_or_create.assert_not_called()
