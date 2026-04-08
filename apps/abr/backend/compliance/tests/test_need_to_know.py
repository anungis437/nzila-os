"""
ABR Phase 2 — Need-To-Know + Metadata Minimization Tests

Covers:
  - Forbidden PII fields absent from case list/detail responses
  - Non-member cannot see case details
  - Team member can see case details
  - Compliance-officer override allows access without membership
  - Identity endpoint blocked without compliance-officer role
  - Identity endpoint blocked without justification header
  - Identity endpoint allowed + access log created with correct fields
  - AbrCaseMetaSerializer never exposes forbidden fields
  - AbrCaseDetailSerializer never exposes forbidden fields

These are unit/integration tests that run against the in-memory SQLite
test database (no postgres required).
"""

import uuid
from unittest.mock import patch

import pytest
from compliance.abr_serializers import AbrCaseDetailSerializer, AbrCaseMetaSerializer
from compliance.abr_views import (
    AbrCaseDetailView,
    AbrCaseListView,
    AbrIdentityDetailView,
    _can_see_case_details,
    _has_role,
)
from compliance.models import (
    AbrCase,
    AbrCaseTeamMember,
    AbrIdentityAccessLog,
    AbrReporterIdentity,
)
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

User = get_user_model()

# ── Fixtures (no-DB model builders) ──────────────────────────────────────────

ORG_ID = uuid.uuid4()
CASE_ID = uuid.uuid4()
USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())


def _make_case(**kwargs):
    """Build an unsaved AbrCase instance for serializer tests."""
    defaults = {
        "id": CASE_ID,
        "org_id": ORG_ID,
        "case_number": "ABR-2026-001",
        "title": "Test Case",
        "status": "open",
        "severity": "medium",
        "category": "workplace-harassment",
        "description": "Internal notes about the situation.",
        "identity_id": None,
    }
    defaults.update(kwargs)
    return AbrCase(**defaults)


# ── Serializer-level DTO tests (no DB) ───────────────────────────────────────

_ALWAYS_STRIP = {
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


class TestAbrCaseMetaSerializer(TestCase):
    """AbrCaseMetaSerializer must never expose PII fields."""

    def _serialize(self, **kwargs):
        case = _make_case(**kwargs)
        return AbrCaseMetaSerializer(case).data

    def test_forbidden_fields_absent_from_meta(self):
        data = self._serialize()
        for field in _ALWAYS_STRIP:
            self.assertNotIn(
                field, data, f"AbrCaseMetaSerializer exposed forbidden field: {field}"
            )

    def test_identity_id_absent_from_meta(self):
        data = self._serialize()
        self.assertNotIn(
            "identity_id", data, "AbrCaseMetaSerializer must NOT expose identity_id"
        )

    def test_meta_only_includes_safe_fields(self):
        data = self._serialize()
        allowed = {
            "id",
            "case_number",
            "title",
            "status",
            "severity",
            "category",
            "org_id",
            "created_at",
            "updated_at",
        }
        unexpected = set(data.keys()) - allowed
        self.assertEqual(
            unexpected,
            set(),
            f"AbrCaseMetaSerializer exposed extra fields: {unexpected}",
        )


class TestAbrCaseDetailSerializer(TestCase):
    """AbrCaseDetailSerializer must never expose PII fields."""

    def _serialize(self, **kwargs):
        case = _make_case(**kwargs)
        return AbrCaseDetailSerializer(case).data

    def test_forbidden_fields_absent_from_detail(self):
        data = self._serialize()
        for field in _ALWAYS_STRIP:
            self.assertNotIn(
                field, data, f"AbrCaseDetailSerializer exposed forbidden field: {field}"
            )

    def test_identity_id_absent_from_detail(self):
        data = self._serialize()
        self.assertNotIn(
            "identity_id", data, "AbrCaseDetailSerializer must NOT expose identity_id"
        )

    def test_description_present_in_detail(self):
        data = self._serialize()
        self.assertIn("description", data)


# ── Role helper tests (no DB) ─────────────────────────────────────────────────


class MockUser:
    is_authenticated = True
    is_active = True
    is_superuser = False
    pk = 1


class TestRoleHelpers(TestCase):
    def _make_request(self, roles=None, superuser=False):
        factory = RequestFactory()
        request = factory.get("/")
        user = MockUser()
        user.abr_roles = roles or []
        user.is_superuser = superuser
        request.user = user
        return request

    def test_has_role_returns_true_for_matching_role(self):
        req = self._make_request(roles=["compliance-officer"])
        self.assertTrue(_has_role(req, "compliance-officer"))

    def test_has_role_returns_false_for_mismatch(self):
        req = self._make_request(roles=["observer"])
        self.assertFalse(_has_role(req, "compliance-officer"))

    def test_superuser_gets_compliance_officer_implicitly(self):
        req = self._make_request(superuser=True)
        self.assertTrue(_has_role(req, "compliance-officer"))


# ── DB-backed access control tests ───────────────────────────────────────────


@pytest.mark.django_db
class TestAbrCaseDetailAccessControl:
    """
    Verifies that case details are only accessible to team members
    or compliance-officers, and never to unrelated users.
    """

    def setup_method(self):
        self.org_id = uuid.uuid4()
        self.case = AbrCase.objects.create(
            org_id=self.org_id,
            case_number=f"ABR-{uuid.uuid4().hex[:8]}",
            title="Access Control Test",
            status="open",
            severity="medium",
        )
        self.member_user_id = str(uuid.uuid4())
        self.non_member_user_id = str(uuid.uuid4())
        self.compliance_user_id = str(uuid.uuid4())

        AbrCaseTeamMember.objects.create(
            org_id=self.org_id,
            case=self.case,
            user_id=self.member_user_id,
            role="investigator",
            added_by="system",
        )

    def _make_request_with_user(self, user_id, roles=None):
        factory = RequestFactory()
        request = factory.get(f"/api/compliance/abr/cases/{self.case.pk}/")
        user = MockUser()
        user.pk = user_id
        user.abr_roles = roles or []
        request.user = user
        return request

    def test_team_member_can_see_case_details(self):
        request = self._make_request_with_user(self.member_user_id)
        assert _can_see_case_details(request, self.case) is True

    def test_non_member_cannot_see_case_details(self):
        request = self._make_request_with_user(self.non_member_user_id)
        assert _can_see_case_details(request, self.case) is False

    def test_compliance_officer_override_allows_access(self):
        request = self._make_request_with_user(
            self.compliance_user_id, roles=["compliance-officer"]
        )
        assert _can_see_case_details(request, self.case) is True


# ── DB-backed identity endpoint tests ────────────────────────────────────────


@pytest.mark.django_db
class TestAbrIdentityEndpoint:
    """
    Identity endpoint must:
      - Reject non-compliance-officer roles (403)
      - Reject missing justification (400)
      - Create AbrIdentityAccessLog on successful access
    """

    def setup_method(self):
        self.org_id = uuid.uuid4()
        self.identity = AbrReporterIdentity.objects.create(
            org_id=self.org_id,
            vault_entry_id=uuid.uuid4(),
            key_id="default",
            is_active=True,
            created_by="compliance-officer-001",
        )
        self.case = AbrCase.objects.create(
            org_id=self.org_id,
            case_number=f"ABR-{uuid.uuid4().hex[:8]}",
            title="Identity Test Case",
            status="open",
            severity="high",
            identity_id=self.identity,
        )
        self.client = APIClient()

    def _make_auth_request(self, roles=None, justification=None):
        factory = RequestFactory()
        headers = {}
        if justification is not None:
            headers["HTTP_X_JUSTIFICATION"] = justification
        request = factory.get(
            f"/api/compliance/abr/cases/{self.case.pk}/identity/",
            **headers,
        )
        user = MockUser()
        user.pk = str(uuid.uuid4())
        user.abr_roles = roles or []
        request.user = user
        return request

    def test_non_compliance_officer_is_rejected(self):
        view = AbrIdentityDetailView.as_view()
        request = self._make_auth_request(roles=["investigator"], justification="test")
        response = view(request, case_id=str(self.case.pk))
        assert response.status_code == 403

    def test_missing_justification_is_rejected(self):
        view = AbrIdentityDetailView.as_view()
        request = self._make_auth_request(roles=["compliance-officer"])
        response = view(request, case_id=str(self.case.pk))
        assert response.status_code == 400

    def test_valid_access_creates_access_log(self):
        view = AbrIdentityDetailView.as_view()
        user_id = str(uuid.uuid4())
        request = self._make_auth_request(
            roles=["compliance-officer"],
            justification="Annual audit review",
        )
        request.user.pk = user_id

        initial_count = AbrIdentityAccessLog.objects.count()
        response = view(request, case_id=str(self.case.pk))

        assert response.status_code == 200
        assert AbrIdentityAccessLog.objects.count() == initial_count + 1

        log = AbrIdentityAccessLog.objects.filter(case_id=self.case.pk).latest(
            "accessed_at"
        )
        assert log.justification == "Annual audit review"
        assert log.access_type == "view"

    def test_identity_response_excludes_vault_entry_id(self):
        view = AbrIdentityDetailView.as_view()
        request = self._make_auth_request(
            roles=["compliance-officer"],
            justification="Audit review",
        )
        response = view(request, case_id=str(self.case.pk))
        assert "vault_entry_id" not in response.data
