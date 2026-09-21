"""
Integration Control Plane — Database models.

Provides:
  - IntegrationRegistry: per-org integration endpoint management
  - IntegrationIdempotencyKey: replay / duplicate protection
"""

import uuid

from django.db import models
from django.utils import timezone


class IntegrationRegistry(models.Model):
    """
    Tracks external integrations per organization.

    Each row represents a configured integration endpoint (e.g. Stripe webhook,
    CRM push, government API) along with its health status and retry policy.
    """

    INTEGRATION_TYPES = [
        ("webhook_inbound", "Webhook — Inbound"),
        ("webhook_outbound", "Webhook — Outbound"),
        ("api_push", "API — Push"),
        ("api_pull", "API — Pull"),
        ("email", "Email Provider"),
        ("sms", "SMS Provider"),
        ("crm", "CRM System"),
        ("payment", "Payment Processor"),
        ("government", "Government System"),
        ("document_storage", "Document Storage"),
        ("messaging", "Messaging Platform"),
        ("custom", "Custom"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("paused", "Paused"),
        ("degraded", "Degraded"),
        ("failed", "Failed"),
        ("disabled", "Disabled"),
    ]

    RETRY_POLICIES = [
        ("exponential_backoff", "Exponential Backoff"),
        ("linear", "Linear"),
        ("fixed", "Fixed Interval"),
        ("none", "No Retry"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org_id = models.UUIDField(db_index=True, help_text="Organization ID")
    integration_type = models.CharField(max_length=32, choices=INTEGRATION_TYPES)
    name = models.CharField(max_length=255, help_text="Human-readable label")
    endpoint_url = models.URLField(
        max_length=2048, blank=True, default="", help_text="Remote endpoint URL"
    )
    secret = models.TextField(
        blank=True,
        default="",
        help_text="HMAC secret or API key (encrypted at rest via app-layer)",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    retry_policy = models.CharField(
        max_length=32, choices=RETRY_POLICIES, default="exponential_backoff"
    )
    max_retries = models.PositiveSmallIntegerField(default=5)
    failure_count = models.PositiveIntegerField(default=0)
    consecutive_failures = models.PositiveIntegerField(default=0)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_failure_at = models.DateTimeField(null=True, blank=True)
    last_failure_reason = models.TextField(blank=True, default="")
    metadata = models.JSONField(
        default=dict, blank=True, help_text="Provider-specific config"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "integration_registry"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["org_id", "integration_type"], name="idx_intreg_org_type"
            ),
            models.Index(fields=["org_id", "status"], name="idx_intreg_org_status"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["org_id", "integration_type", "endpoint_url"],
                name="uq_intreg_org_type_url",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.integration_type}) — {self.status}"

    # ----- domain helpers -----

    def record_success(self) -> None:
        self.last_success_at = timezone.now()
        self.consecutive_failures = 0
        if self.status == "degraded":
            self.status = "active"
        self.save(
            update_fields=[
                "last_success_at",
                "consecutive_failures",
                "status",
                "updated_at",
            ]
        )

    def record_failure(self, reason: str = "") -> None:
        self.failure_count += 1
        self.consecutive_failures += 1
        self.last_failure_at = timezone.now()
        self.last_failure_reason = reason
        if self.consecutive_failures >= self.max_retries:
            self.status = "failed"
        elif self.consecutive_failures >= 3:
            self.status = "degraded"
        self.save(
            update_fields=[
                "failure_count",
                "consecutive_failures",
                "last_failure_at",
                "last_failure_reason",
                "status",
                "updated_at",
            ]
        )


class IntegrationIdempotencyKey(models.Model):
    """
    Idempotency protection for integration requests.

    Each inbound or outbound integration request is hashed; duplicate hashes
    within the TTL window are rejected.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_hash = models.CharField(
        max_length=64, db_index=True, help_text="SHA-256 of canonical request body"
    )
    integration = models.ForeignKey(
        IntegrationRegistry,
        on_delete=models.CASCADE,
        related_name="idempotency_keys",
        null=True,
        blank=True,
    )
    org_id = models.UUIDField(db_index=True)
    response_status = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="HTTP status of the original response"
    )
    response_body = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text="Discard after this instant (default: created_at + 24 h)"
    )

    class Meta:
        db_table = "integration_idempotency_keys"
        indexes = [
            models.Index(
                fields=["request_hash", "org_id"], name="idx_idempkey_hash_org"
            ),
            models.Index(fields=["expires_at"], name="idx_idempkey_expires"),
        ]
        constraints = [
            # Deterministic DB invariant. TTL/expiry is enforced as a data
            # lifecycle (reservation reclaim), not a time-relative partial index
            # (Postgres cannot reference now() in an index predicate).
            models.UniqueConstraint(
                fields=["request_hash", "org_id"],
                name="uq_idempkey_hash_org",
            ),
        ]

    def __str__(self) -> str:
        return f"IdempotencyKey({self.request_hash[:12]}…)"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
