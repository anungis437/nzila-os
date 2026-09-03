"""
Task Enqueue API — replaces direct BullMQ usage from the frontend.

Endpoints (mounted at /api/tasks/ in config/urls.py):

  POST   /api/tasks/enqueue/              Enqueue a background job
  GET    /api/tasks/queues/               Queue stats (replaces getAllQueueStats)
  GET    /api/tasks/queues/{name}/failed/ Failed task list  (replaces getFailedJobs)
  POST   /api/tasks/jobs/{task_id}/retry/ Retry a failed task (replaces retryJob)
  POST   /api/tasks/queues/{name}/pause/  Pause a queue
  POST   /api/tasks/queues/{name}/resume/ Resume a queue

Authentication: OIDC JWT (via auth_core.middleware.OIDCJWTMiddleware).
Admin-only routes (queue management) additionally require org_role == 'admin'.
"""

import logging
from typing import Any

from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Supported job types and their Celery task paths
# ---------------------------------------------------------------------------

JOB_TYPE_MAP: dict[str, str] = {
    # email queue
    "send-email":        "notifications.tasks.send_email_task",
    "email-digest":      "notifications.tasks.send_email_digest_task",
    # sms queue
    "send-sms":          "notifications.tasks.send_sms_task",
    # notifications queue
    "send-notification": "notifications.tasks.send_notification_task",
    # reports queue
    "generate-report":   "analytics.tasks.generate_report_task",
    # cleanup queue
    "cleanup":           "core.tasks.cleanup_task",
    # billing queue
    "run-billing":       "billing.tasks.run_billing_scheduler_task",
    "dues-reminders":    "billing.tasks.send_dues_reminders_task",
    "payment-retry":     "billing.tasks.retry_failed_payments_task",
}

QUEUE_NAMES = {"email", "sms", "notifications", "reports", "cleanup", "billing"}

ADMIN_ONLY_JOB_TYPES = {
    "cleanup", "run-billing", "dues-reminders", "payment-retry", "email-digest",
}


def _require_admin(request) -> bool:
    """Return True if the request user has admin role."""
    return getattr(request, "org_role", None) in ("org:admin", "admin")


def _get_celery_app():
    from config.celery import app
    return app


def _get_task_result(task_id: str):
    """Fetch a AsyncResult for a given task_id."""
    from celery.result import AsyncResult
    return AsyncResult(task_id, app=_get_celery_app())


# ---------------------------------------------------------------------------
# POST /api/tasks/enqueue/
# ---------------------------------------------------------------------------

class TaskEnqueueView(APIView):
    """
    Enqueue a background Celery task.

    Request body:
    {
        "job_type":  "send-email",       // required — see JOB_TYPE_MAP
        "kwargs":    { ... },            // keyword arguments forwarded to the task
        "options":   {                   // optional Celery apply_async options
            "countdown": 0,             // delay in seconds
            "priority":  5,
            "eta":       "ISO-8601"
        }
    }

    Response:
    {
        "task_id":   "uuid",
        "job_type":  "send-email",
        "status":    "queued"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        body = request.data

        job_type = body.get("job_type")
        if not job_type:
            return Response({"error": "job_type is required"}, status=status.HTTP_400_BAD_REQUEST)

        task_path = JOB_TYPE_MAP.get(job_type)
        if not task_path:
            return Response(
                {"error": "An error occurred"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Admin-only job types
        if job_type in ADMIN_ONLY_JOB_TYPES and not _require_admin(request):
            return Response(
                {"error": "Admin role required for this job type"},
                status=status.HTTP_403_FORBIDDEN,
            )

        job_kwargs: dict = body.get("kwargs", {})
        options: dict = body.get("options", {})

        # Strip unknown apply_async options for safety
        allowed_options = {"countdown", "eta", "priority", "expires", "queue"}
        safe_options = {k: v for k, v in options.items() if k in allowed_options}

        try:
            app = _get_celery_app()
            task = app.signature(task_path, kwargs=job_kwargs, **safe_options)
            async_result = task.apply_async()

            logger.info(
                "Enqueued task: type=%s task_id=%s user=%s",
                job_type, async_result.id,
                getattr(request, "user_id", "unknown"),
            )

            return Response(
                {
                    "task_id":  async_result.id,
                    "job_type": job_type,
                    "status":   "queued",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to enqueue task %s: %s", job_type, exc)
            return Response(
                {"error": "An error occurred"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------------
# GET /api/tasks/queues/
# ---------------------------------------------------------------------------

class QueueStatsView(APIView):
    """
    Return stats for all Celery queues.

    Requires admin role (mirrors /api/admin/jobs in the frontend).

    Response:
    {
        "queues": [
            {
                "name":      "email",
                "active":    2,
                "reserved":  0,
                "scheduled": 1,
                "workers":   1
            },
            ...
        ]
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if not _require_admin(request):
            return Response({"error": "Admin role required"}, status=status.HTTP_403_FORBIDDEN)

        try:
            app = _get_celery_app()
            inspect = app.control.inspect(timeout=2)

            active    = inspect.active()    or {}
            reserved  = inspect.reserved()  or {}
            scheduled = inspect.scheduled() or {}

            # Aggregate per queue
            queue_data: dict[str, dict] = {q: {"name": q, "active": 0, "reserved": 0, "scheduled": 0} for q in QUEUE_NAMES}

            for worker_tasks in active.values():
                for task in worker_tasks:
                    q = task.get("delivery_info", {}).get("routing_key", "")
                    if q in queue_data:
                        queue_data[q]["active"] += 1

            for worker_tasks in reserved.values():
                for task in worker_tasks:
                    q = task.get("delivery_info", {}).get("routing_key", "")
                    if q in queue_data:
                        queue_data[q]["reserved"] += 1

            for worker_tasks in scheduled.values():
                for task in worker_tasks:
                    q = task.get("delivery_info", {}).get("routing_key", "")
                    if q in queue_data:
                        queue_data[q]["scheduled"] += 1

            return Response({"queues": list(queue_data.values())})

        except Exception as exc:  # noqa: BLE001
            logger.error("Could not retrieve queue stats: %s", exc)
            return Response(
                {"queues": [{"name": q, "active": 0, "reserved": 0, "scheduled": 0} for q in QUEUE_NAMES],
                 "warning": "Could not reach Celery workers"},
                status=status.HTTP_200_OK,
            )


# ---------------------------------------------------------------------------
# GET /api/tasks/queues/{queue_name}/failed/
# ---------------------------------------------------------------------------

class FailedTasksView(APIView):
    """
    Return failed tasks for a given queue, using django-celery-results.

    Query params:
      limit (int, default 20)

    Response:
    {
        "queue": "email",
        "failed": [
            {
                "task_id": "...",
                "task_name": "...",
                "status": "FAILURE",
                "result": "...",
                "date_done": "...",
                "traceback": "..."
            }
        ]
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, queue_name: str, *args, **kwargs):
        if not _require_admin(request):
            return Response({"error": "Admin role required"}, status=status.HTTP_403_FORBIDDEN)

        if queue_name not in QUEUE_NAMES:
            return Response(
                {"error": "An error occurred"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        limit = min(int(request.query_params.get("limit", 20)), 100)

        try:
            from django_celery_results.models import TaskResult

            # Map queue name to the task names that run on it
            queue_task_prefixes = {
                "email":         ("notifications.tasks.send_email",),
                "sms":           ("notifications.tasks.send_sms",),
                "notifications": ("notifications.tasks.send_notification",),
                "reports":       ("analytics.tasks.",),
                "cleanup":       ("core.tasks.",),
                "billing":       ("billing.tasks.",),
            }
            prefixes = queue_task_prefixes.get(queue_name, ())

            qs = TaskResult.objects.filter(status="FAILURE")
            if prefixes:
                from django.db.models import Q

                q_filter = Q()
                for prefix in prefixes:
                    q_filter |= Q(task_name__startswith=prefix)
                qs = qs.filter(q_filter)

            qs = qs.order_by("-date_done")[:limit]

            failed = [
                {
                    "task_id":   r.task_id,
                    "task_name": r.task_name,
                    "status":    r.status,
                    "result":    str(r.result)[:500],
                    "date_done": r.date_done.isoformat() if r.date_done else None,
                    "traceback": (r.traceback or "")[:2000],
                }
                for r in qs
            ]

            return Response({"queue": queue_name, "failed": failed})

        except Exception as exc:  # noqa: BLE001
            logger.error("Could not retrieve failed tasks for queue %s: %s", queue_name, exc)
            return Response(
                {"queue": queue_name, "failed": [], "warning": str(exc)},
                status=status.HTTP_200_OK,
            )


# ---------------------------------------------------------------------------
# POST /api/tasks/jobs/{task_id}/retry/
# ---------------------------------------------------------------------------

class RetryTaskView(APIView):
    """
    Re-queue a previously failed task.

    Response:
    {
        "original_task_id": "...",
        "new_task_id": "...",
        "status": "queued"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, task_id: str, *args, **kwargs):
        if not _require_admin(request):
            return Response({"error": "Admin role required"}, status=status.HTTP_403_FORBIDDEN)

        try:
            from django_celery_results.models import TaskResult

            record = TaskResult.objects.filter(task_id=task_id).first()
            if not record:
                return Response({"error": "An error occurred"}, status=status.HTTP_404_NOT_FOUND)

            if record.status != "FAILURE":
                return Response(
                    {"error": "An error occurred"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Re-dispatch with the same task name and args (recovered from result record)
            import ast

            task_name = record.task_name
            try:
                kwargs_raw = ast.literal_eval(record.kwargs or "{}") if record.kwargs else {}
            except Exception:  # noqa: BLE001
                kwargs_raw = {}

            app = _get_celery_app()
            new_result = app.send_task(task_name, kwargs=kwargs_raw)

            logger.info(
                "Retried task %s → new task_id=%s user=%s",
                task_id, new_result.id,
                getattr(request, "user_id", "unknown"),
            )

            return Response({
                "original_task_id": task_id,
                "new_task_id":      new_result.id,
                "status":           "queued",
            }, status=status.HTTP_202_ACCEPTED)

        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to retry task %s: %s", task_id, exc)
            return Response({"error": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# GET /api/tasks/jobs/{task_id}/status/
# ---------------------------------------------------------------------------

class TaskStatusView(APIView):
    """
    Return the current status of a specific task.

    Response:
    {
        "task_id": "...",
        "status":  "SUCCESS" | "FAILURE" | "PENDING" | "STARTED" | "RETRY",
        "result":  "...",
        "date_done": "..."
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, task_id: str, *args, **kwargs):
        try:
            result = _get_task_result(task_id)
            return Response({
                "task_id":    task_id,
                "status":     result.status,
                "result":     str(result.result)[:500] if result.result else None,
                "date_done":  result.date_done.isoformat() if getattr(result, "date_done", None) else None,
            })
        except Exception as exc:  # noqa: BLE001
            return Response({"error": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# POST /api/tasks/queues/{queue_name}/pause/
# POST /api/tasks/queues/{queue_name}/resume/
# ---------------------------------------------------------------------------

class QueuePauseView(APIView):
    """Pause a Celery queue by broadcasting a rate_limit of 0 to workers."""

    permission_classes = [IsAuthenticated]

    def post(self, request, queue_name: str, *args, **kwargs):
        if not _require_admin(request):
            return Response({"error": "Admin role required"}, status=status.HTTP_403_FORBIDDEN)
        if queue_name not in QUEUE_NAMES:
            return Response({"error": "An error occurred"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            app = _get_celery_app()
            # Cancel consumer on the queue — workers stop picking up new tasks
            app.control.cancel_consumer(queue_name, reply=False)
            return Response({"queue": queue_name, "status": "paused"})
        except Exception as exc:  # noqa: BLE001
            return Response({"error": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class QueueResumeView(APIView):
    """Resume a previously paused Celery queue."""

    permission_classes = [IsAuthenticated]

    def post(self, request, queue_name: str, *args, **kwargs):
        if not _require_admin(request):
            return Response({"error": "Admin role required"}, status=status.HTTP_403_FORBIDDEN)
        if queue_name not in QUEUE_NAMES:
            return Response({"error": "An error occurred"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            app = _get_celery_app()
            app.control.add_consumer(queue_name, reply=False)
            return Response({"queue": queue_name, "status": "resumed"})
        except Exception as exc:  # noqa: BLE001
            return Response({"error": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
