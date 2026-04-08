"""
ABR Insights — Need-To-Know Serializers

Strict DTO allowlists that enforce metadata minimization at the
serialization boundary. No identity fields EVER appear on public
case endpoints.

Design invariants:
  - AbrCaseMetaSerializer: only org-safe metadata fields
  - AbrCaseDetailSerializer: adds internal notes and evidence refs,
    still NO PII
  - AbrIdentitySerializer: compliance-only, requires elevated role +
    justification at the view layer
"""

from rest_framework import serializers

from .models import (
    AbrCase,
    AbrCaseTeamMember,
    AbrIdentityAccessLog,
    AbrReporterIdentity,
    AbrSensitiveActionApproval,
    AbrSensitiveActionRequest,
)

# Fields that MUST NEVER appear on any public endpoint response.
# Applied at serializer level as a final safety net.
_FORBIDDEN_FIELDS = frozenset(
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


class AbrCaseMetaSerializer(serializers.ModelSerializer):
    """
    Metadata-only case view — safe for any authenticated user.
    Exposes: id, case_number, title, status, severity, category,
             org_id, created_at, updated_at.

    NEVER includes identity_id, description, or internal notes.
    """

    class Meta:
        model = AbrCase
        # Explicit allowlist — anything not listed here is excluded.
        fields = [
            "id",
            "case_number",
            "title",
            "status",
            "severity",
            "category",
            "org_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Belt-and-suspenders: strip any forbidden keys that might slip through
        for key in _FORBIDDEN_FIELDS:
            data.pop(key, None)
        return data


class AbrCaseDetailSerializer(serializers.ModelSerializer):
    """
    Case-details view — for case team members or compliance override.
    Adds: description.  Still NEVER includes identity_id, vault_entry_id.
    """

    class Meta:
        model = AbrCase
        fields = [
            "id",
            "case_number",
            "title",
            "status",
            "severity",
            "category",
            "description",
            "org_id",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for key in _FORBIDDEN_FIELDS:
            data.pop(key, None)
        return data


class AbrCaseWriteSerializer(serializers.ModelSerializer):
    """Write serializer for creating / updating an AbrCase."""

    class Meta:
        model = AbrCase
        fields = [
            "case_number",
            "title",
            "status",
            "severity",
            "category",
            "description",
            "org_id",
        ]


class AbrCaseTeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbrCaseTeamMember
        fields = ["id", "case", "user_id", "role", "added_by", "org_id", "created_at"]
        read_only_fields = ["id", "created_at"]


class AbrIdentityAccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbrIdentityAccessLog
        fields = [
            "id",
            "org_id",
            "case_id",
            "identity_id",
            "accessed_by",
            "justification",
            "accessed_at",
            "access_type",
        ]
        read_only_fields = ["id", "accessed_at"]


class AbrSensitiveActionRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbrSensitiveActionRequest
        fields = [
            "id",
            "org_id",
            "case_id",
            "action",
            "requested_by",
            "justification",
            "status",
            "expires_at",
            "executed_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "executed_at", "created_at"]


class AbrSensitiveActionApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbrSensitiveActionApproval
        fields = [
            "id",
            "request",
            "approver_id",
            "decision",
            "notes",
            "decided_at",
        ]
        read_only_fields = ["id", "decided_at"]


class AbrReporterIdentitySerializer(serializers.ModelSerializer):
    """
    COMPLIANCE-ONLY serializer for reporter identity metadata.
    Does NOT expose vault_entry_id or any decrypted PII.
    PII decryption happens at the IdentityVaultEntry layer, not here.
    """

    class Meta:
        model = AbrReporterIdentity
        fields = [
            "id",
            "org_id",
            "key_id",
            "is_active",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
