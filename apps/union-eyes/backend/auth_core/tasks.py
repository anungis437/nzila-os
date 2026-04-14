"""Async audit logging tasks for auth_core.

Offloads audit log writes to Celery so request latency is unaffected.
"""

import logging

from config.celery import app

logger = logging.getLogger(__name__)


@app.task(
    name="auth_core.tasks.log_audit_event",
    ignore_result=True,
    acks_late=False,
    queue="notifications",
)
def log_audit_event(
    *,
    user_id: str,
    org_id: str,
    method: str,
    path: str,
    status_code: int,
    duration_ms: int,
    ip: str,
    user_agent: str = "",
):
    """Fire-and-forget audit log write.

    Currently writes to the structured logger (same output as the old
    synchronous middleware).  A future iteration can persist to the
    audit_events table without touching the middleware again.
    """
    logger.info(
        "AUTH_REQUEST user=%s org=%s method=%s path=%s "
        "status=%s duration_ms=%s ip=%s ua=%s",
        user_id,
        org_id,
        method,
        path,
        status_code,
        duration_ms,
        ip,
        user_agent,
    )
