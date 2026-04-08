"""
Migration: Add hash chain fields to AuditLogs.

Adds content_hash, previous_hash and missing operational fields
(action, resource_type, resource_id, user_id, ip_address,
 correlation_id, details) to the audit_logs table.

These fields implement the NzilaOS tamper-evident audit invariant:
  SHA-256( action | resource_type | resource_id | user_id |
           correlation_id | details | previous_hash )
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auth_core", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditlogs",
            name="action",
            field=models.CharField(
                blank=True,
                max_length=100,
                null=True,
                help_text="Verb: create, update, delete, initiate, cancel, …",
            ),
        ),
        migrations.AddField(
            model_name="auditlogs",
            name="resource_type",
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                help_text="Django model class name of the affected object",
            ),
        ),
        migrations.AddField(
            model_name="auditlogs",
            name="resource_id",
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                help_text="PK of the affected object as string",
            ),
        ),
        migrations.AddField(
            model_name="auditlogs",
            name="user_id",
            field=models.UUIDField(
                blank=True, null=True, help_text="Actor who performed the action"
            ),
        ),
        migrations.AddField(
            model_name="auditlogs",
            name="ip_address",
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="auditlogs",
            name="correlation_id",
            field=models.UUIDField(
                blank=True,
                null=True,
                help_text="Ties this event to a request or workflow",
            ),
        ),
        migrations.AddField(
            model_name="auditlogs",
            name="details",
            field=models.JSONField(
                blank=True,
                default=dict,
                null=True,
                help_text="Arbitrary context payload",
            ),
        ),
        # ── Hash chain fields ──────────────────────────────────────────────
        migrations.AddField(
            model_name="auditlogs",
            name="content_hash",
            field=models.CharField(
                blank=True,
                max_length=64,
                null=True,
                help_text=(
                    "SHA-256 of (action|resource_type|resource_id|user_id|"
                    "correlation_id|details|previous_hash)"
                ),
            ),
        ),
        migrations.AddField(
            model_name="auditlogs",
            name="previous_hash",
            field=models.CharField(
                blank=True,
                max_length=64,
                null=True,
                help_text=(
                    "content_hash of the immediately preceding AuditLogs "
                    "record for this org. NULL for first record."
                ),
            ),
        ),
        # ── Indexes ───────────────────────────────────────────────────────
        migrations.AddIndex(
            model_name="auditlogs",
            index=models.Index(
                fields=["organization_id", "created_at"],
                name="idx_audit_logs_org_created",
            ),
        ),
        migrations.AddIndex(
            model_name="auditlogs",
            index=models.Index(
                fields=["correlation_id"],
                name="idx_audit_logs_correlation",
            ),
        ),
    ]
