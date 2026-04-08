"""
ABR Insights — Metadata Minimization

Strips PII and sensitive fields from case data before external
exposure (API responses, exports, partner views). Only the minimum
fields required for the use case are retained.

NzilaOS Integration: Mirrors the @nzila/os-core evidence redaction
pattern — redact then re-seal.
"""

from __future__ import annotations

import copy
from typing import Any

# Fields that MUST be stripped from all external API responses
_ALWAYS_STRIP = frozenset(
    {
        "reporter_name",
        "reporter_email",
        "reporter_phone",
        "reporter_employee_id",
        "vault_entry_id",
        "ip_address",
        "user_agent",
        "session_id",
        "clerk_user_id",
        "additional_identifiers",
    }
)

# Fields visible only to case-details access level
_DETAILS_ONLY = frozenset(
    {
        "description",
        "internal_notes",
        "evidence_ids",
        "action_taken",
        "remediation_plan",
    }
)

# Fields visible at metadata-only level
_METADATA_FIELDS = frozenset(
    {
        "id",
        "case_number",
        "title",
        "status",
        "severity",
        "category",
        "organization_id",
        "created_at",
        "updated_at",
    }
)


def minimize_for_metadata(case_data: dict[str, Any]) -> dict[str, Any]:
    """
    Strip a case dict down to metadata-only fields.
    Used for listing endpoints and partner views.
    """
    return {k: v for k, v in case_data.items() if k in _METADATA_FIELDS}


def minimize_for_details(case_data: dict[str, Any]) -> dict[str, Any]:
    """
    Strip PII but keep case details. Used for case-details access level.
    """
    result = copy.deepcopy(case_data)
    for field in _ALWAYS_STRIP:
        result.pop(field, None)
    return result


def minimize_for_export(
    case_data: dict[str, Any],
    *,
    include_identity: bool = False,
) -> dict[str, Any]:
    """
    Prepare a case for evidence export.

    If include_identity is False (default), all PII fields are stripped.
    If True, identity fields are included — caller MUST have passed
    dual-control validation before calling this.
    """
    result = copy.deepcopy(case_data)

    if not include_identity:
        for field in _ALWAYS_STRIP:
            result.pop(field, None)

    # Always strip internal session/auth fields even with identity
    for field in ("session_id", "user_agent", "ip_address"):
        result.pop(field, None)

    return result


def strip_pii_from_list(
    cases: list[dict[str, Any]],
    access_level: str = "metadata-only",
) -> list[dict[str, Any]]:
    """
    Batch-minimize a list of case dicts.
    """
    if access_level == "metadata-only":
        return [minimize_for_metadata(c) for c in cases]
    elif access_level == "case-details":
        return [minimize_for_details(c) for c in cases]
    else:
        # Default to most restrictive
        return [minimize_for_metadata(c) for c in cases]
