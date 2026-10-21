"""Outcome contract for core.tasks.cleanup_task.

A task result must describe what actually happened. A rejected required side effect is a
failure, not a success that deleted nothing. These tests run the task body eagerly with the
database and filesystem faked at the boundary; the real Redis and worker path is exercised
separately.
"""
import os
import tempfile
import time
from pathlib import Path
from unittest import mock

from django.db import OperationalError, ProgrammingError
from django.test import SimpleTestCase

from core import tasks


class _InsufficientPrivilege(Exception):
    """Carries pgcode like an error raised by libpq. A hand-built psycopg2 exception does not."""

    pgcode = "42501"


def _denied() -> ProgrammingError:
    error = ProgrammingError("permission denied for table django_session")
    error.__cause__ = _InsufficientPrivilege("permission denied for table django_session")
    return error


def _run(**kwargs):
    return tasks.cleanup_task.apply(kwargs=kwargs, throw=False)


class CleanupTaskOutcomeTests(SimpleTestCase):
    def test_unknown_target_fails_without_retry(self):
        result = _run(target="bogus")
        self.assertEqual(result.state, "FAILURE")
        self.assertIsInstance(result.result, tasks.CleanupTargetUnsupported)

    def test_logs_target_is_refused_and_touches_no_database(self):
        with mock.patch("django.db.backends.utils.CursorWrapper.execute") as execute:
            result = _run(target="logs", older_than_days=30)
        self.assertEqual(result.state, "FAILURE")
        self.assertIsInstance(result.result, tasks.CleanupTargetUnsupported)
        self.assertIn("hash chain", str(result.result))
        execute.assert_not_called()

    def test_denied_privilege_is_a_permanent_failure_not_a_success(self):
        with mock.patch("django.contrib.sessions.models.Session.objects") as manager:
            manager.filter.return_value.delete.side_effect = _denied()
            with mock.patch.object(tasks.cleanup_task, "retry") as retry:
                result = _run(target="sessions", older_than_days=90)
        self.assertEqual(result.state, "FAILURE")
        self.assertIsInstance(result.result, tasks.CleanupPermissionDenied)
        retry.assert_not_called()

    def test_transient_database_error_is_retried(self):
        with mock.patch("django.contrib.sessions.models.Session.objects") as manager:
            manager.filter.return_value.delete.side_effect = OperationalError("server closed the connection")
            with mock.patch.object(tasks.cleanup_task, "retry", side_effect=RuntimeError("retry requested")) as retry:
                result = _run(target="sessions", older_than_days=90)
        retry.assert_called_once()
        self.assertEqual(result.state, "FAILURE")

    def test_other_database_errors_fail_without_retry(self):
        with mock.patch("django.contrib.sessions.models.Session.objects") as manager:
            manager.filter.return_value.delete.side_effect = ProgrammingError('relation "django_session" does not exist')
            with mock.patch.object(tasks.cleanup_task, "retry") as retry:
                result = _run(target="sessions", older_than_days=90)
        self.assertEqual(result.state, "FAILURE")
        retry.assert_not_called()

    def test_session_cleanup_reports_the_real_count(self):
        with mock.patch("django.contrib.sessions.models.Session.objects") as manager:
            manager.filter.return_value.delete.return_value = (3, {"sessions.Session": 3})
            result = _run(target="sessions", older_than_days=90)
        self.assertEqual(result.state, "SUCCESS")
        self.assertEqual(result.result["deleted"], 3)

    def test_file_cleanup_removes_only_old_files(self):
        with tempfile.TemporaryDirectory() as directory:
            old, fresh = Path(directory, "old.tmp"), Path(directory, "fresh.tmp")
            old.write_text("x")
            fresh.write_text("y")
            os.utime(old, (time.time() - 10 * 86400, time.time() - 10 * 86400))
            with mock.patch.object(tasks, "TEMP_DIR", directory):
                result = _run(target="temp-files", older_than_days=1)
            self.assertEqual(result.state, "SUCCESS")
            self.assertEqual(result.result["deleted"], 1)
            self.assertFalse(old.exists())
            self.assertTrue(fresh.exists())

    def test_a_rejected_file_deletion_is_not_reported_as_success(self):
        with tempfile.TemporaryDirectory() as directory:
            old = Path(directory, "old.tmp")
            old.write_text("x")
            os.utime(old, (time.time() - 10 * 86400, time.time() - 10 * 86400))
            with mock.patch.object(tasks, "TEMP_DIR", directory), mock.patch.object(
                Path, "unlink", side_effect=PermissionError("denied")
            ), mock.patch.object(tasks.cleanup_task, "retry", side_effect=RuntimeError("retry requested")) as retry:
                result = _run(target="temp-files", older_than_days=1)
            retry.assert_called_once()
            self.assertEqual(result.state, "FAILURE")
            self.assertTrue(old.exists())

    def test_a_second_delivery_of_the_same_cleanup_is_harmless(self):
        with tempfile.TemporaryDirectory() as directory:
            old = Path(directory, "old.tmp")
            old.write_text("x")
            os.utime(old, (time.time() - 10 * 86400, time.time() - 10 * 86400))
            with mock.patch.object(tasks, "TEMP_DIR", directory):
                first = _run(target="temp-files", older_than_days=1)
                second = _run(target="temp-files", older_than_days=1)
            self.assertEqual((first.state, first.result["deleted"]), ("SUCCESS", 1))
            self.assertEqual((second.state, second.result["deleted"]), ("SUCCESS", 0))
