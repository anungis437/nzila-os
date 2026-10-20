"""
Celery tasks for the core app.

Migrated from BullMQ workers:
  - frontend/lib/workers/cleanup-worker.ts → cleanup_task

Queue routing:
  cleanup queue → cleanup_task

Cleanup targets (mirrors BullMQ CleanupJobData):
  logs        → Archive audit logs older than N days (immutable audit trail)
  sessions    → Delete expired / inactive DB sessions
  temp-files  → Delete temp files on disk older than N days
  exports     → Delete generated report files on disk older than N days
"""

import logging
import os
import tempfile
from datetime import timedelta
from pathlib import Path
from typing import Optional

from celery import shared_task
from django.db import DatabaseError, OperationalError
from django.utils import timezone

logger = logging.getLogger(__name__)

REPORTS_DIR = os.environ.get("REPORTS_DIR", "/tmp/reports")
TEMP_DIR = os.environ.get("TEMP_DIR", "/tmp/ue_temp")

INSUFFICIENT_PRIVILEGE = "42501"


class CleanupError(Exception):
    """A cleanup failure that retrying cannot fix. The task ends FAILURE without a retry."""


class CleanupTargetUnsupported(CleanupError):
    """The target is unknown or has no source authority to run."""


class CleanupPermissionDenied(CleanupError):
    """The database identity running the task is not allowed to perform the cleanup."""


class CleanupIncomplete(Exception):
    """Part of the cleanup was rejected. Retryable: everything already removed stays removed."""


def _sqlstate(exc: BaseException) -> Optional[str]:
    cause = exc.__cause__ or exc
    return getattr(cause, "pgcode", None)

# ---------------------------------------------------------------------------
# Task: cleanup_task
# BullMQ equivalent: cleanupQueue / cleanup-worker.ts → processCleanupJob()
# Options: concurrency=1 (sequential) — enforced at worker level via autoscale=1,1
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name="core.tasks.cleanup_task",
    queue="cleanup",
    max_retries=1,
    default_retry_delay=60,
    acks_late=True,
)
def cleanup_task(
    self,
    *,
    target: str,
    older_than_days: int = 30,
):
    """
    Run a maintenance cleanup operation.

    Args:
        target:         One of 'logs', 'sessions', 'temp-files', 'exports'.
        older_than_days: Age threshold for deletion/archival.
    """
    task_id = getattr(self.request, "id", None)
    logger.info(
        "Running cleanup task: id=%s target=%s older_than_days=%d", task_id, target, older_than_days
    )

    dispatch = {
        "logs":       _cleanup_logs,
        "sessions":   _cleanup_sessions,
        "temp-files": _cleanup_temp_files,
        "exports":    _cleanup_exports,
    }
    try:
        handler = dispatch.get(target)
        if not handler:
            raise CleanupTargetUnsupported(f"Unknown cleanup target: {target}")

        result = handler(older_than_days=older_than_days)
        logger.info("Cleanup complete: id=%s target=%s result=%s", task_id, target, result)
        return {"success": True, "target": target, **result}

    except CleanupError as exc:
        logger.error("Cleanup task failed permanently: id=%s target=%s error=%s", task_id, target, exc)
        raise
    except DatabaseError as exc:
        if _sqlstate(exc) == INSUFFICIENT_PRIVILEGE:
            logger.error(
                "Cleanup task denied by the database: id=%s target=%s error=%s", task_id, target, exc
            )
            raise CleanupPermissionDenied(
                f"The database identity running this task may not clean {target}: {exc}"
            ) from exc
        if isinstance(exc, OperationalError):
            logger.warning("Cleanup task hit a transient database error: id=%s target=%s", task_id, target)
            raise self.retry(exc=exc, countdown=60)
        logger.error("Cleanup task database error: id=%s target=%s error=%s", task_id, target, exc)
        raise
    except (CleanupIncomplete, OSError) as exc:
        logger.warning("Cleanup task incomplete: id=%s target=%s error=%s", task_id, target, exc)
        raise self.retry(exc=exc, countdown=60)


# ---------------------------------------------------------------------------
# Cleanup handlers
# ---------------------------------------------------------------------------

def _cleanup_logs(older_than_days: int, **_) -> dict:
    """
    Not supported. There is no source authority to run this.

    ``audit_logs`` is a tamper-evident SHA-256 hash chain (see core.models.AuditLogs).
    Archiving or deleting its rows is a retention decision that no policy in this
    repository makes, and the ``archived`` column the old code updated does not exist.
    Report that as a failure instead of a success that did nothing.
    """
    raise CleanupTargetUnsupported(
        "audit_logs is a tamper-evident hash chain and no retention policy authorizes "
        "archiving or deleting it, so the 'logs' cleanup target is not supported."
    )

def _cleanup_sessions(older_than_days: int = 90, **_) -> dict:
    """
    Delete expired and long-inactive DB sessions.

    Mirrors cleanup-worker.ts → cleanupSessions().
    """
    from django.contrib.sessions.models import Session
    from django.db.models import Q

    now = timezone.now()
    inactive_cutoff = now - timedelta(days=older_than_days)

    # A database error here (for example a denied privilege) must reach the task, which
    # decides between retry and permanent failure. It is not a reason to report success.
    result = Session.objects.filter(
        Q(expire_date__lt=now) | Q(expire_date__lt=inactive_cutoff)
    ).delete()
    deleted = result[0]

    logger.info("Deleted %d sessions", deleted)
    return {"deleted": deleted}


def _cleanup_temp_files(older_than_days: int, **_) -> dict:
    """
    Delete temporary files older than N days from TEMP_DIR.

    Mirrors cleanup-worker.ts → cleanupTempFiles().
    """
    deleted = 0
    cutoff = timezone.now().timestamp() - (older_than_days * 86400)
    temp_path = Path(TEMP_DIR)

    if not temp_path.exists():
        return {"deleted": 0}

    failed = []
    for filepath in temp_path.iterdir():
        try:
            if filepath.is_file() and filepath.stat().st_mtime < cutoff:
                filepath.unlink()
                deleted += 1
        except OSError as exc:
            logger.warning("Could not delete temp file %s: %s", filepath, exc)
            failed.append(filepath.name)

    logger.info("Deleted %d temp files older than %d days", deleted, older_than_days)
    if failed:
        raise CleanupIncomplete(
            f"{len(failed)} temp file(s) could not be deleted after {deleted} were: {sorted(failed)[:5]}"
        )
    return {"deleted": deleted}


def _cleanup_exports(older_than_days: int, **_) -> dict:
    """
    Delete generated report files older than N days from REPORTS_DIR.

    Mirrors cleanup-worker.ts → cleanupExports().
    """
    deleted = 0
    cutoff = timezone.now().timestamp() - (older_than_days * 86400)
    reports_path = Path(REPORTS_DIR)

    if not reports_path.exists():
        return {"deleted": 0}

    failed = []
    for filepath in reports_path.iterdir():
        try:
            if filepath.is_file() and filepath.stat().st_mtime < cutoff:
                filepath.unlink()
                deleted += 1
        except OSError as exc:
            logger.warning("Could not delete export file %s: %s", filepath, exc)
            failed.append(filepath.name)

    logger.info("Deleted %d export files older than %d days", deleted, older_than_days)
    if failed:
        raise CleanupIncomplete(
            f"{len(failed)} export file(s) could not be deleted after {deleted} were: {sorted(failed)[:5]}"
        )
    return {"deleted": deleted}
