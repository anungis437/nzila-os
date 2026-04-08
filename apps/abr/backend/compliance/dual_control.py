"""
ABR Insights — Dual-Control Enforcement

Requires two distinct principals (requester ≠ approver) for sensitive
operations: case close, severity change, identity unmask.

NzilaOS Integration: Mirrors @nzila/os-core/abr/confidential-reporting
dual-control patterns for the Django/Python backend.
"""

import uuid
from datetime import datetime, timedelta, timezone

from backend.auth_core.models import Organizations
from django.conf import settings
from django.db import models


class DualControlAction(models.TextChoices):
    CASE_CLOSE = "case-close", "Close Case"
    SEVERITY_CHANGE = "severity-change", "Change Severity"
    IDENTITY_UNMASK = "identity-unmask", "Unmask Reporter Identity"


class DualControlStatus(models.TextChoices):
    PENDING = "pending", "Pending Approval"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    EXPIRED = "expired", "Expired"


class DualControlRequest(models.Model):
    """
    A request for a dual-control-protected operation.
    Must be approved by a different principal before execution.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organizations,
        on_delete=models.CASCADE,
        related_name="dual_control_requests",
    )
    action = models.CharField(
        max_length=32,
        choices=DualControlAction.choices,
    )
    case_id = models.UUIDField(
        help_text="ID of the case this request applies to",
    )
    requested_by = models.CharField(
        max_length=255,
        help_text="User ID of the requester",
    )
    justification = models.TextField(
        help_text="Why this action is needed",
    )
    status = models.CharField(
        max_length=16,
        choices=DualControlStatus.choices,
        default=DualControlStatus.PENDING,
    )
    approved_by = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="User ID of the approver (must differ from requester)",
    )
    approval_notes = models.TextField(null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(
        help_text="Request auto-expires if not resolved by this time",
    )

    class Meta:
        db_table = "dual_control_requests"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["case_id", "action"]),
        ]

    def save(self, *args, **kwargs):
        # Default expiry: 24 hours
        if not self.expires_at:
            self.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return (
            self.status == DualControlStatus.PENDING
            and datetime.now(timezone.utc) > self.expires_at
        )

    def approve(self, approver_id: str, notes: str = "") -> bool:
        """
        Approve this request. Returns False if validation fails.
        """
        if self.status != DualControlStatus.PENDING:
            return False

        if self.is_expired:
            self.status = DualControlStatus.EXPIRED
            self.save(update_fields=["status"])
            return False

        # Dual-control: approver ≠ requester
        if approver_id == self.requested_by:
            return False

        self.status = DualControlStatus.APPROVED
        self.approved_by = approver_id
        self.approval_notes = notes
        self.resolved_at = datetime.now(timezone.utc)
        self.save(
            update_fields=["status", "approved_by", "approval_notes", "resolved_at"]
        )
        return True

    def reject(self, rejector_id: str, notes: str = "") -> bool:
        """Reject this request."""
        if self.status != DualControlStatus.PENDING:
            return False

        self.status = DualControlStatus.REJECTED
        self.approved_by = rejector_id
        self.approval_notes = notes
        self.resolved_at = datetime.now(timezone.utc)
        self.save(
            update_fields=["status", "approved_by", "approval_notes", "resolved_at"]
        )
        return True

    def __str__(self):
        return f"DualControl({self.action}, case={self.case_id}, status={self.status})"
