"""
ABR Phase 2 — Schema Assertion Tests

These tests verify that the 6 ABR identity-vault tables are correctly
defined in the Django model registry. They run against the in-memory
SQLite test database (tables created from model state in MIGRATION_MODULES=None mode).

Tests inspect:
  - Model classes are importable and registered
  - All required fields exist with correct types
  - All required indexes are declared
  - Org-scope invariant: all ABR models carry org_id

Run with:
  pytest backend/compliance/tests/test_abr_schema.py -v
"""

import pytest
from django.apps import apps
from django.db import models as m

# ── helpers ───────────────────────────────────────────────────────────────────


def get_field(model_cls, name):
    """Return the field instance or raise AssertionError."""
    try:
        return model_cls._meta.get_field(name)
    except Exception:
        raise AssertionError(f"{model_cls.__name__} is missing field '{name}'")


def assert_uuid_field(model_cls, name):
    f = get_field(model_cls, name)
    assert isinstance(
        f, m.UUIDField
    ), f"{model_cls.__name__}.{name} should be UUIDField, got {type(f).__name__}"


def assert_char_field(model_cls, name, max_length=None):
    f = get_field(model_cls, name)
    assert isinstance(
        f, m.CharField
    ), f"{model_cls.__name__}.{name} should be CharField, got {type(f).__name__}"
    if max_length:
        assert (
            f.max_length >= max_length
        ), f"{model_cls.__name__}.{name}.max_length={f.max_length} < {max_length}"


def get_index_field_sets(model_cls):
    """Return frozensets of field names from all declared indexes."""
    return {frozenset(idx.fields) for idx in model_cls._meta.indexes}


# ── Model import ──────────────────────────────────────────────────────────────


def test_abr_models_are_registered():
    """All 6 ABR models must be loadable from the compliance app registry."""
    compliance = apps.get_app_config("compliance")
    model_names = {m.__name__ for m in compliance.get_models()}
    required = {
        "AbrReporterIdentity",
        "AbrCase",
        "AbrIdentityAccessLog",
        "AbrSensitiveActionRequest",
        "AbrSensitiveActionApproval",
        "AbrCaseTeamMember",
    }
    missing = required - model_names
    assert missing == set(), f"ABR models missing from compliance app: {missing}"


# ── AbrReporterIdentity ───────────────────────────────────────────────────────


def test_abr_reporter_identity_fields():
    from compliance.models import AbrReporterIdentity as M  # noqa

    assert M._meta.db_table == "abr_reporter_identity"
    assert_uuid_field(M, "id")
    assert_uuid_field(M, "org_id")
    assert_uuid_field(M, "vault_entry_id")
    assert_char_field(M, "key_id")
    assert_char_field(M, "created_by")
    get_field(M, "is_active")


def test_abr_reporter_identity_indexes():
    from compliance.models import AbrReporterIdentity as M  # noqa

    field_sets = get_index_field_sets(M)
    assert (
        frozenset(["org_id", "vault_entry_id"]) in field_sets
    ), "Missing index (org_id, vault_entry_id) on AbrReporterIdentity"
    assert (
        frozenset(["org_id", "is_active"]) in field_sets
    ), "Missing index (org_id, is_active) on AbrReporterIdentity"


# ── AbrCase ───────────────────────────────────────────────────────────────────


def test_abr_case_fields():
    from compliance.models import AbrCase as M  # noqa

    assert M._meta.db_table == "abr_case"
    assert_uuid_field(M, "org_id")
    assert_char_field(M, "case_number")
    assert_char_field(M, "title")
    assert_char_field(M, "status")
    assert_char_field(M, "severity")


def test_abr_case_no_pii_fields():
    """AbrCase must NOT expose reporter PII fields."""
    from compliance.models import AbrCase as M  # noqa

    field_names = {f.name for f in M._meta.get_fields()}
    forbidden = {"reporter_name", "reporter_email", "reporter_phone", "vault_entry_id"}
    exposed = forbidden & field_names
    assert (
        exposed == set()
    ), f"AbrCase must NOT contain PII fields, but found: {exposed}"


def test_abr_case_indexes():
    from compliance.models import AbrCase as M  # noqa

    field_sets = get_index_field_sets(M)
    assert frozenset(["org_id", "status"]) in field_sets
    assert frozenset(["org_id", "severity"]) in field_sets


# ── AbrIdentityAccessLog ──────────────────────────────────────────────────────


def test_abr_identity_access_log_fields():
    from compliance.models import AbrIdentityAccessLog as M  # noqa

    assert M._meta.db_table == "abr_identity_access_log"
    assert_uuid_field(M, "org_id")
    assert_uuid_field(M, "case_id")
    assert_uuid_field(M, "identity_id")
    assert_char_field(M, "accessed_by")
    get_field(M, "justification")
    get_field(M, "accessed_at")


def test_abr_identity_access_log_indexes():
    from compliance.models import AbrIdentityAccessLog as M  # noqa

    field_sets = get_index_field_sets(M)
    assert frozenset(["org_id", "case_id"]) in field_sets


# ── AbrSensitiveActionRequest ────────────────────────────────────────────────


def test_abr_sensitive_action_request_fields():
    from compliance.models import AbrSensitiveActionRequest as M  # noqa

    assert M._meta.db_table == "abr_sensitive_action_requests"
    assert_uuid_field(M, "org_id")
    assert_uuid_field(M, "case_id")
    assert_char_field(M, "action")
    assert_char_field(M, "requested_by")
    assert_char_field(M, "status")
    get_field(M, "expires_at")
    get_field(M, "justification")


def test_abr_sensitive_action_request_index_on_org_case():
    from compliance.models import AbrSensitiveActionRequest as M  # noqa

    field_sets = get_index_field_sets(M)
    assert frozenset(["org_id", "case_id"]) in field_sets


# ── AbrSensitiveActionApproval ────────────────────────────────────────────────


def test_abr_sensitive_action_approval_fields():
    from compliance.models import AbrSensitiveActionApproval as M  # noqa

    assert M._meta.db_table == "abr_sensitive_action_approvals"
    assert_char_field(M, "approver_id")
    assert_char_field(M, "decision")
    get_field(M, "request")


# ── AbrCaseTeamMember ─────────────────────────────────────────────────────────


def test_abr_case_team_member_fields():
    from compliance.models import AbrCaseTeamMember as M  # noqa

    assert M._meta.db_table == "abr_case_team_members"
    assert_uuid_field(M, "org_id")
    assert_char_field(M, "user_id")
    assert_char_field(M, "role")
    get_field(M, "case")


def test_abr_case_team_member_unique_case_user():
    from compliance.models import AbrCaseTeamMember as M  # noqa

    ut = {frozenset(pair) for pair in M._meta.unique_together}
    assert (
        frozenset(["case", "user_id"]) in ut
    ), "AbrCaseTeamMember must enforce unique_together (case, user_id)"


# ── Org-scope invariant ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "model_name",
    [
        "AbrReporterIdentity",
        "AbrCase",
        "AbrIdentityAccessLog",
        "AbrSensitiveActionRequest",
        "AbrCaseTeamMember",
    ],
)
def test_abr_model_has_org_id(model_name: str):
    """Every ABR model that is not a join table must carry org_id."""
    from compliance import models as cm  # noqa: PLC0415

    model_cls = getattr(cm, model_name)
    field_names = {f.name for f in model_cls._meta.get_fields()}
    assert (
        "org_id" in field_names
    ), f"{model_name} is missing org_id — org-scope invariant violated"
