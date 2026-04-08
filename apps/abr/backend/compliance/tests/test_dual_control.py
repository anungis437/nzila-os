"""
ABR Phase 2 — Dual-Control Enforcement Tests

Proves every sensitive route enforces the dual-control invariant:
  - Requester CANNOT approve their own request (self-approve rejected)
  - Execution WITHOUT approval is rejected (NotApprovedError)
  - Execution AFTER approval by a distinct actor succeeds
  - Expired request cannot be approved (RequestExpiredError)
  - Rejected request cannot be executed (NotApprovedError)
  - Already-executed request raises AlreadyExecutedError

These are contract-style tests for the service layer.
No HTTP layer required — tests call service functions directly.

Run with:
  pytest backend/compliance/tests/test_dual_control.py -v
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from compliance.models import AbrSensitiveActionRequest
from compliance.services import (
    AlreadyExecutedError,
    DualControlError,
    NotApprovedError,
    RequestExpiredError,
    SelfApprovalError,
    approve_sensitive_action,
    execute_sensitive_action,
    request_sensitive_action,
)

ORG_ID = uuid.uuid4()
CASE_ID = uuid.uuid4()
USER_A = "user-aaa-requester"
USER_B = "user-bbb-approver"
USER_C = "user-ccc-executor"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _create_request(**kwargs):
    defaults = {
        "org_id": ORG_ID,
        "case_id": CASE_ID,
        "action": "case-close",
        "requested_by": USER_A,
        "justification": "Compliance review complete",
    }
    defaults.update(kwargs)
    return request_sensitive_action(**defaults)


# ── request_sensitive_action ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestRequestSensitiveAction:

    def test_creates_pending_request(self):
        req = _create_request()
        assert req.status == "pending"
        assert req.action == "case-close"
        assert req.requested_by == USER_A
        assert req.expires_at is not None

    def test_empty_justification_raises_value_error(self):
        with pytest.raises(ValueError, match="justification"):
            _create_request(justification="")

    def test_whitespace_justification_raises_value_error(self):
        with pytest.raises(ValueError, match="justification"):
            _create_request(justification="   ")

    def test_expires_at_is_24h_by_default(self):
        before = datetime.now(timezone.utc)
        req = _create_request()
        after = datetime.now(timezone.utc)
        delta = req.expires_at - before
        assert (
            timedelta(hours=23, minutes=59) <= delta <= timedelta(hours=24, seconds=5)
        )


# ── approve_sensitive_action ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestApproveSensitiveAction:

    def test_approval_by_different_actor_succeeds(self):
        req = _create_request()
        approval = approve_sensitive_action(req.pk, USER_B)
        assert approval.decision == "approved"
        assert approval.approver_id == USER_B

        req.refresh_from_db()
        assert req.status == "approved"

    def test_self_approve_is_rejected(self):
        """The requester cannot approve their own request."""
        req = _create_request(requested_by=USER_A)
        with pytest.raises(SelfApprovalError):
            approve_sensitive_action(req.pk, USER_A)

    def test_self_approve_does_not_change_status(self):
        req = _create_request(requested_by=USER_A)
        try:
            approve_sensitive_action(req.pk, USER_A)
        except SelfApprovalError:
            pass
        req.refresh_from_db()
        assert req.status == "pending", "Self-approval attempt must not alter status"

    def test_rejection_is_recorded(self):
        req = _create_request()
        approval = approve_sensitive_action(
            req.pk, USER_B, decision="rejected", notes="Not justified"
        )
        assert approval.decision == "rejected"

        req.refresh_from_db()
        assert req.status == "rejected"

    def test_non_pending_request_cannot_be_approved(self):
        req = _create_request()
        approve_sensitive_action(req.pk, USER_B)  # moves to approved
        with pytest.raises(DualControlError, match="status='approved'"):
            approve_sensitive_action(req.pk, USER_C)  # try again — already approved

    def test_expired_request_raises_request_expired_error(self):
        req = _create_request()
        # Force expiry by back-dating expires_at
        req.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        req.save(update_fields=["expires_at"])

        with pytest.raises(RequestExpiredError):
            approve_sensitive_action(req.pk, USER_B)

        req.refresh_from_db()
        assert req.status == "expired"

    def test_invalid_decision_raises_value_error(self):
        req = _create_request()
        with pytest.raises(ValueError, match="decision"):
            approve_sensitive_action(req.pk, USER_B, decision="maybe")


# ── execute_sensitive_action ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestExecuteSensitiveAction:

    def test_execute_after_approval_succeeds(self):
        """Full happy path: request → approve (distinct actor) → execute."""
        req = _create_request()
        approve_sensitive_action(req.pk, USER_B)
        executed_req = execute_sensitive_action(req.pk, USER_C)

        assert executed_req.status == "executed"
        assert executed_req.executed_at is not None

    def test_execute_without_approval_raises_not_approved_error(self):
        """Execute without prior approval must be rejected."""
        req = _create_request()
        with pytest.raises(NotApprovedError):
            execute_sensitive_action(req.pk, USER_B)

    def test_execute_after_rejection_raises_not_approved_error(self):
        req = _create_request()
        approve_sensitive_action(req.pk, USER_B, decision="rejected")
        with pytest.raises(NotApprovedError):
            execute_sensitive_action(req.pk, USER_C)

    def test_execute_already_executed_raises_already_executed_error(self):
        """Double-execution must be rejected."""
        req = _create_request()
        approve_sensitive_action(req.pk, USER_B)
        execute_sensitive_action(req.pk, USER_C)

        with pytest.raises(AlreadyExecutedError):
            execute_sensitive_action(req.pk, USER_C)

    def test_execute_pending_request_raises_not_approved_error(self):
        req = _create_request()
        with pytest.raises(NotApprovedError, match="'pending'"):
            execute_sensitive_action(req.pk, USER_B)

    def test_executed_at_is_set_after_execute(self):
        before = datetime.now(timezone.utc)
        req = _create_request()
        approve_sensitive_action(req.pk, USER_B)
        execute_sensitive_action(req.pk, USER_C)

        req.refresh_from_db()
        assert req.executed_at is not None
        assert req.executed_at >= before


# ── Invariant table ───────────────────────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.parametrize(
    "scenario,approver,executor,expected_exception",
    [
        # self-approve, then try to execute → self-approve blocked first
        ("self-approve", USER_A, USER_B, SelfApprovalError),
        # no approval, try to execute → NotApprovedError
        ("no-approval", None, USER_B, NotApprovedError),
    ],
)
def test_dual_control_invariants(scenario, approver, executor, expected_exception):
    req = _create_request()
    if approver is not None:
        try:
            approve_sensitive_action(req.pk, approver)
        except (SelfApprovalError, DualControlError):
            if scenario == "self-approve":
                # Re-raise to confirm the correct exception was thrown
                with pytest.raises(SelfApprovalError):
                    approve_sensitive_action(req.pk, approver)
                return
    if scenario == "no-approval":
        with pytest.raises(expected_exception):
            execute_sensitive_action(req.pk, executor)
