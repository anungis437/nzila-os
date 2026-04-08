"""
ABR Insights — Identity Vault Django Model

Stores encrypted reporter identity data separate from case records.
The identity vault lives in a dedicated table to enforce need-to-know access
at the database layer. All identity payloads are AES-256-GCM encrypted
before storage.

NzilaOS Integration: Mirrors @nzila/os-core/abr/confidential-reporting
patterns for the Django/Python backend.
"""

import json
import os
import uuid
from datetime import datetime, timezone

from backend.auth_core.models import Organizations
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.db import models


class IdentityVaultEntry(models.Model):
    """
    Encrypted identity record. Not joined to cases directly — the link
    is stored only in the case record and requires dual-control to resolve.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organizations,
        on_delete=models.CASCADE,
        related_name="identity_vault_entries",
        help_text="Org that owns this identity record",
    )
    encrypted_payload = models.BinaryField(
        help_text="AES-256-GCM encrypted identity JSON",
    )
    iv = models.BinaryField(
        max_length=12,
        help_text="GCM initialization vector",
    )
    auth_tag = models.BinaryField(
        max_length=16,
        help_text="GCM authentication tag",
    )
    key_id = models.CharField(
        max_length=64,
        help_text="ID of the encryption key used (for rotation support)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(
        max_length=255,
        help_text="User ID who triggered vault entry creation",
    )

    class Meta:
        db_table = "identity_vault"
        ordering = ["-created_at"]
        # No FK to cases — access is via case.vault_entry_id only
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["key_id"]),
        ]

    @classmethod
    def encrypt_and_store(
        cls,
        organization: Organizations,
        identity_data: dict,
        created_by: str,
        key_id: str | None = None,
    ) -> "IdentityVaultEntry":
        """
        Encrypt identity data and create a vault entry.

        Args:
            organization: Owning Org
            identity_data: Dict with reporter PII fields
            created_by: Actor who created the entry
            key_id: Optional key ID. Defaults to 'default'.
        """
        raw_key = os.environ.get("IDENTITY_VAULT_KEY")
        if not raw_key:
            raise ValueError("IDENTITY_VAULT_KEY environment variable is required")

        key = bytes.fromhex(raw_key)
        if len(key) != 32:
            raise ValueError("IDENTITY_VAULT_KEY must be 32 bytes (64 hex chars)")

        aesgcm = AESGCM(key)
        iv = os.urandom(12)
        plaintext = json.dumps(identity_data).encode("utf-8")
        ciphertext_with_tag = aesgcm.encrypt(iv, plaintext, None)

        # GCM appends 16-byte tag
        ciphertext = ciphertext_with_tag[:-16]
        auth_tag = ciphertext_with_tag[-16:]

        return cls.objects.create(
            organization=organization,
            encrypted_payload=ciphertext,
            iv=iv,
            auth_tag=auth_tag,
            key_id=key_id or "default",
            created_by=created_by,
        )

    def decrypt(self) -> dict:
        """
        Decrypt identity data. Requires IDENTITY_VAULT_KEY env var.
        Raises on tampered data (GCM auth failure).
        """
        raw_key = os.environ.get("IDENTITY_VAULT_KEY")
        if not raw_key:
            raise ValueError("IDENTITY_VAULT_KEY environment variable is required")

        key = bytes.fromhex(raw_key)
        aesgcm = AESGCM(key)

        ciphertext_with_tag = bytes(self.encrypted_payload) + bytes(self.auth_tag)
        plaintext = aesgcm.decrypt(bytes(self.iv), ciphertext_with_tag, None)
        return json.loads(plaintext.decode("utf-8"))

    def __str__(self):
        return f"VaultEntry({self.id}, org={self.organization_id}, key={self.key_id})"


class IdentityAccessLog(models.Model):
    """
    Audit log for identity vault access attempts.
    Every decrypt (successful or failed) is recorded.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vault_entry = models.ForeignKey(
        IdentityVaultEntry,
        on_delete=models.CASCADE,
        related_name="access_logs",
    )
    accessed_by = models.CharField(max_length=255)
    access_granted = models.BooleanField()
    dual_control_request_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="ID of the dual-control request that authorized this access",
    )
    reason = models.TextField()
    accessed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "identity_access_log"
        ordering = ["-accessed_at"]
        indexes = [
            models.Index(fields=["vault_entry", "accessed_at"]),
            models.Index(fields=["accessed_by", "accessed_at"]),
        ]

    def __str__(self):
        status = "GRANTED" if self.access_granted else "DENIED"
        return (
            f"AccessLog({status}, vault={self.vault_entry_id}, by={self.accessed_by})"
        )
