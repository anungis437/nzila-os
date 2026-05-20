"""
Structured Logging — JSON-formatted logger with contextual fields.

Every log entry includes:
  timestamp, service, request_id, org_id, user_id, event, latency, status

Usage::

    from observability.logging import get_logger
    logger = get_logger("my_module")
    logger.info("something happened", extra={"case_id": "abc-123"})
"""

from __future__ import annotations

import json
import logging

# ---------------------------------------------------------------------------
# Thread-local request context
# ---------------------------------------------------------------------------
import threading
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

_context = threading.local()


def set_request_context(
    *,
    request_id: str = "",
    org_id: str = "",
    user_id: str = "",
    service: str = "union-eyes",
    governance_correlation_id: str = "",
    governance_trace_id: str = "",
) -> None:
    """Set contextual fields that appear in every log line.

    Governance correlation IDs are sourced from the upstream TS frontend
    (`X-Governance-Correlation` / `X-Governance-Trace`). They span a request
    chain across services so a single governance unit of work can be reliably
    traced end-to-end.
    """
    _context.request_id = request_id
    _context.org_id = org_id
    _context.user_id = user_id
    _context.service = service
    _context.governance_correlation_id = governance_correlation_id
    _context.governance_trace_id = governance_trace_id


def clear_request_context() -> None:
    for attr in (
        "request_id",
        "org_id",
        "user_id",
        "service",
        "governance_correlation_id",
        "governance_trace_id",
    ):
        try:
            delattr(_context, attr)
        except AttributeError:
            pass


def get_request_context() -> Dict[str, str]:
    return {
        "request_id": getattr(_context, "request_id", ""),
        "org_id": getattr(_context, "org_id", ""),
        "user_id": getattr(_context, "user_id", ""),
        "service": getattr(_context, "service", "union-eyes"),
        "governance_correlation_id": getattr(
            _context, "governance_correlation_id", ""
        ),
        "governance_trace_id": getattr(_context, "governance_trace_id", ""),
    }


# ---------------------------------------------------------------------------
# JSON formatter
# ---------------------------------------------------------------------------

# PII field names to redact automatically.
_PII_FIELDS = frozenset(
    {
        "password",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "ssn",
        "sin",
        "credit_card",
        "card_number",
        "cvv",
        "email",
        "phone",
        "address",
        "date_of_birth",
    }
)


def _redact(data: Dict[str, Any]) -> Dict[str, Any]:
    """Redact PII fields from a dict (shallow)."""
    return {
        k: "***REDACTED***" if k.lower() in _PII_FIELDS else v for k, v in data.items()
    }


class StructuredJsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        ctx = get_request_context()
        entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": ctx.get("service", "union-eyes"),
            "request_id": ctx.get("request_id", ""),
            "org_id": ctx.get("org_id", ""),
            "user_id": ctx.get("user_id", ""),
            "logger": record.name,
            "event": record.getMessage(),
        }

        # Governance correlation — only present when upstream sent them, so we
        # avoid polluting every log line with empty strings.
        gcid = ctx.get("governance_correlation_id", "")
        gtid = ctx.get("governance_trace_id", "")
        if gcid:
            entry["governance_correlation_id"] = gcid
        if gtid:
            entry["governance_trace_id"] = gtid

        # Merge extra fields (exclude internal logging attrs).
        extras = {
            k: v
            for k, v in record.__dict__.items()
            if k not in logging.LogRecord("", 0, "", 0, None, None, None).__dict__
            and k not in ("message", "msg", "args")
        }
        if extras:
            entry["extra"] = _redact(extras)

        # Latency (if set by middleware).
        if hasattr(record, "latency"):
            entry["latency_ms"] = record.latency

        # Status code (if set by middleware).
        if hasattr(record, "status"):
            entry["status"] = record.status

        # Exception info.
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(entry, default=str)


# ---------------------------------------------------------------------------
# Convenience factory
# ---------------------------------------------------------------------------


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Return a logger pre-configured with the structured JSON formatter."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredJsonFormatter())
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger
