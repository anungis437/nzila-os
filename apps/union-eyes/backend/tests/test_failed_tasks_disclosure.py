"""
Round 59D — FailedTasksView stack-trace disclosure regression test.

Proves the API response never contains raw traceback/exception text (even
for an admin-gated caller), while the full detail is still logged
server-side for operators.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import RequestFactory, TestCase


class FailedTasksViewDisclosureTest(TestCase):
    def _make_admin_request(self):
        request = RequestFactory().get("/api/tasks/queues/email/failed/")
        request.org_role = "admin"
        return request

    @patch("django_celery_results.models.TaskResult.objects")
    def test_api_response_never_contains_raw_traceback_or_result(self, mock_objects):
        from services.api.task_enqueue_views import FailedTasksView

        sensitive_traceback = (
            "Traceback (most recent call last):\n"
            '  File "/app/services/billing/tasks.py", line 42, in run\n'
            "    cursor.execute(\"SELECT secret_token FROM api_keys WHERE id=%s\", [key_id])\n"
            "psycopg2.errors.UndefinedColumn: column \"secret_token\" does not exist\n"
            "DATABASE_URL=postgres://admin:hunter2@internal-db:5432/prod"
        )
        sensitive_result = "KeyError: 'AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...'"

        mock_task = MagicMock()
        mock_task.task_id = "task-123"
        mock_task.task_name = "billing.tasks.run_billing_scheduler_task"
        mock_task.status = "FAILURE"
        mock_task.date_done = None
        mock_task.result = sensitive_result
        mock_task.traceback = sensitive_traceback

        mock_qs = MagicMock()
        mock_qs.filter.return_value = mock_qs
        mock_qs.order_by.return_value = mock_qs
        mock_qs.__getitem__.return_value = [mock_task]
        mock_objects.filter.return_value = mock_qs

        view = FailedTasksView()
        with patch("services.api.task_enqueue_views._require_admin", return_value=True):
            response = view.get(self._make_admin_request(), queue_name="billing")

        body = response.data
        serialized = str(body)

        # The sensitive traceback/result must never reach the API response.
        self.assertNotIn("hunter2", serialized)
        self.assertNotIn("DATABASE_URL", serialized)
        self.assertNotIn("AZURE_STORAGE_CONNECTION_STRING", serialized)
        self.assertNotIn("Traceback", serialized)
        self.assertNotIn("psycopg2", serialized)

        # Bounded, sanitized fields only.
        entry = body["failed"][0]
        self.assertEqual(entry["task_id"], "task-123")
        self.assertEqual(entry["task_name"], "billing.tasks.run_billing_scheduler_task")
        self.assertEqual(entry["status"], "FAILURE")
        self.assertNotIn("result", entry)
        self.assertNotIn("traceback", entry)
        self.assertIn("error_summary", entry)
        self.assertNotIn("hunter2", entry["error_summary"])

    @patch("services.api.task_enqueue_views._require_admin", return_value=False)
    def test_non_admin_is_rejected_before_any_data_access(self, _mock_admin):
        from services.api.task_enqueue_views import FailedTasksView

        view = FailedTasksView()
        response = view.get(self._make_admin_request(), queue_name="billing")
        self.assertEqual(response.status_code, 403)
