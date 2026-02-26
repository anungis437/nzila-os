"""
Celery tasks for the analytics app.

Migrated from BullMQ workers:
  - frontend/lib/workers/report-worker.ts → generate_report_task

Queue routing:
  reports queue → generate_report_task

Report types supported (mirrors BullMQ ReportJobData):
  - claims       → Claims report (CSV / PDF / Excel)
  - members      → Member roster report
  - grievances   → Grievance summary report
  - usage        → Platform usage report
  - gdpr-export  → GDPR personal data export (JSON / CSV / XML)
"""

import csv
import io
import json
import logging
import os
import uuid
from datetime import date, timedelta
from typing import Optional

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

REPORTS_DIR = os.environ.get("REPORTS_DIR", "/tmp/reports")


# ---------------------------------------------------------------------------
# Task: generate_report_task
# BullMQ equivalent: reportsQueue / report-worker.ts → Worker handler
# Options: max_retries=2, fixed retry delay=10s
# ---------------------------------------------------------------------------


@shared_task(
    bind=True,
    name="analytics.tasks.generate_report_task",
    queue="reports",
    max_retries=2,
    default_retry_delay=10,
    acks_late=True,
    time_limit=600,  # 10-minute hard limit for large reports
    soft_time_limit=540,
)
def generate_report_task(
    self,
    *,
    report_type: str,
    org_id: str,
    user_id: str,
    parameters: Optional[dict] = None,
    notify_user: bool = True,
):
    """
    Generate a report and store it to the reports directory.

    After generation, optionally notifies the requesting user via
    the send_email_task (mirrors ReportReadyEmail in the TS worker).

    Args:
        report_type:  One of 'claims', 'members', 'grievances', 'usage', 'gdpr-export'.
        org_id:       Organization UUID.
        user_id:      Requesting Clerk user ID.
        parameters:   Report-specific parameters (date range, format, etc.).
        notify_user:  Whether to email the user on completion.
    """
    parameters = parameters or {}
    os.makedirs(REPORTS_DIR, exist_ok=True)

    logger.info(
        "Starting report generation: type=%s org=%s user=%s",
        report_type,
        org_id,
        user_id,
    )

    try:
        result_path, content_type = _dispatch_report(
            report_type=report_type,
            org_id=org_id,
            user_id=user_id,
            parameters=parameters,
        )

        logger.info("Report generated: %s", result_path)

        # Notify user via email
        if notify_user:
            _notify_report_ready(
                user_id=user_id,
                report_type=report_type,
                result_path=result_path,
            )

        return {
            "success": True,
            "report_type": report_type,
            "path": result_path,
            "content_type": content_type,
        }

    except Exception as exc:  # noqa: BLE001
        logger.error("Report generation failed: type=%s error=%s", report_type, exc)
        raise self.retry(
            exc=exc,
            countdown=10,
        )


# ---------------------------------------------------------------------------
# Report dispatch
# ---------------------------------------------------------------------------


def _dispatch_report(
    report_type: str,
    org_id: str,
    user_id: str,
    parameters: dict,
) -> tuple[str, str]:
    """Route to the appropriate generator; return (file_path, content_type)."""
    dispatch = {
        "claims": _generate_claims_report,
        "members": _generate_members_report,
        "grievances": _generate_grievances_report,
        "usage": _generate_usage_report,
        "gdpr-export": _generate_gdpr_export,
    }

    generator = dispatch.get(report_type)
    if not generator:
        raise ValueError(f"Unknown report type: {report_type}")

    return generator(org_id=org_id, user_id=user_id, parameters=parameters)


# ---------------------------------------------------------------------------
# Individual report generators
# ---------------------------------------------------------------------------


def _write_csv(rows: list[dict], filename: str) -> str:
    """Write rows to a CSV file in REPORTS_DIR and return the path."""
    path = os.path.join(REPORTS_DIR, filename)
    if not rows:
        with open(path, "w", newline="", encoding="utf-8") as f:
            f.write("")
        return path

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    return path


def _write_json(data: dict, filename: str) -> str:
    """Write data to a JSON file in REPORTS_DIR and return the path."""
    path = os.path.join(REPORTS_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    return path


def _generate_claims_report(org_id: str, user_id: str, parameters: dict):
    """Generate a CSV report of claims for this org."""
    from grievances.models import Claims

    date_from = parameters.get("date_from")
    date_to = parameters.get("date_to")

    qs = Claims.objects.filter(organization_id=None)  # FK not on Claims yet
    # When FK available: .filter(organization__id=org_id)

    rows = [
        {
            "claim_id": str(c.claim_id),
            "claim_number": c.claim_number or "",
            "created_at": c.created_at.isoformat(),
        }
        for c in qs[:5000]
    ]

    filename = f"claims_{org_id}_{uuid.uuid4().hex[:8]}.csv"
    path = _write_csv(rows, filename)
    return path, "text/csv"


def _generate_members_report(org_id: str, user_id: str, parameters: dict):
    """Generate a CSV report of union members for this org."""
    from unions.models import (
        Unions,
    )  # placeholder — swap for Members model when available

    rows = []  # Member queryset goes here when models are fully populated
    filename = f"members_{org_id}_{uuid.uuid4().hex[:8]}.csv"
    path = _write_csv(rows, filename)
    return path, "text/csv"


def _generate_grievances_report(org_id: str, user_id: str, parameters: dict):
    """Generate a CSV report of grievances for this org."""
    from grievances.models import Claims

    rows = [
        {
            "id": str(c.id),
            "claim_number": c.claim_number or "",
            "created_at": c.created_at.isoformat(),
        }
        for c in Claims.objects.all()[:5000]
    ]
    filename = f"grievances_{org_id}_{uuid.uuid4().hex[:8]}.csv"
    path = _write_csv(rows, filename)
    return path, "text/csv"


def _generate_usage_report(org_id: str, user_id: str, parameters: dict):
    """Generate a JSON usage report."""
    report = {
        "org_id": org_id,
        "generated_at": timezone.now().isoformat(),
        "period": {
            "from": (date.today() - timedelta(days=30)).isoformat(),
            "to": date.today().isoformat(),
        },
        "metrics": {},
    }
    filename = f"usage_{org_id}_{uuid.uuid4().hex[:8]}.json"
    path = _write_json(report, filename)
    return path, "application/json"


def _generate_gdpr_export(org_id: str, user_id: str, parameters: dict):
    """
    Generate a GDPR personal-data export for a specific user.

    Mirrors report-worker.ts → generateGdprExport() in format support.
    """
    fmt = parameters.get("format", "json")

    # Gather data (extend with all models that hold personal data)
    data: dict = {
        "user_id": user_id,
        "exported_at": timezone.now().isoformat(),
        "data": {},
    }

    filename_base = f"gdpr_{user_id}_{uuid.uuid4().hex[:8]}"

    if fmt == "json":
        path = _write_json(data, f"{filename_base}.json")
        return path, "application/json"

    if fmt == "csv":
        rows = _flatten_for_export(data)
        path = _write_csv(rows, f"{filename_base}.csv")
        return path, "text/csv"

    if fmt == "xml":
        rows = _flatten_for_export(data)
        xml = _to_xml(rows)
        path = os.path.join(REPORTS_DIR, f"{filename_base}.xml")
        with open(path, "w", encoding="utf-8") as f:
            f.write(xml)
        return path, "application/xml"

    raise ValueError(f"Unsupported GDPR export format: {fmt}")


def _flatten_for_export(data, prefix="") -> list[dict]:
    """Recursively flatten a dict/list into path→value rows (mirrors report-worker.ts)."""
    if data is None:
        return [{"path": prefix, "value": ""}]
    if isinstance(data, list):
        result = []
        for i, item in enumerate(data):
            result.extend(_flatten_for_export(item, f"{prefix}[{i}]"))
        return result
    if isinstance(data, dict):
        result = []
        for key, value in data.items():
            child_prefix = f"{prefix}.{key}" if prefix else key
            result.extend(_flatten_for_export(value, child_prefix))
        return result
    return [{"path": prefix, "value": str(data)}]


def _escape_xml(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _to_xml(entries: list[dict]) -> str:
    items = "".join(
        f"<entry><path>{_escape_xml(e['path'])}</path>"
        f"<value>{_escape_xml(e['value'])}</value></entry>"
        for e in entries
    )
    return f'<?xml version="1.0" encoding="UTF-8"?><export>{items}</export>'


# ---------------------------------------------------------------------------
# Post-generation notification
# ---------------------------------------------------------------------------


def _notify_report_ready(user_id: str, report_type: str, result_path: str) -> None:
    """Queue an email notification to the user that their report is ready."""
    try:
        from notifications.tasks import send_email_task

        send_email_task.apply_async(
            kwargs={
                "to": _get_user_email(user_id),
                "subject": f"Your {report_type.title()} report is ready",
                "template": "report-ready",
                "data": {
                    "reportType": report_type.title(),
                    "reportUrl": f"/api/reports/download?path={os.path.basename(result_path)}",
                    "expiresAt": (date.today() + timedelta(days=7)).isoformat(),
                },
                "user_id": user_id,
            },
            queue="email",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not send report-ready email to %s: %s", user_id, exc)


def _get_user_email(user_id: str) -> str:
    """
    Resolve a Clerk user's primary email address.
    Returns an empty string if Clerk is not configured (build-safe).
    """
    try:
        from clerk_backend_api import Clerk  # type: ignore[import]

        client = Clerk(bearer_auth=os.environ.get("CLERK_SECRET_KEY", ""))
        user = client.users.get(user_id=user_id)
        primary_id = user.primary_email_address_id
        for addr in user.email_addresses or []:
            if addr.id == primary_id:
                return addr.email_address
    except Exception:  # noqa: BLE001
        pass
    return ""
