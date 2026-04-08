"""
ABR test migration — creates ONLY the 6 ABR tables using SQLite-compatible
field types (no ArrayField, no VectorField, no postgres-specific ops).

This migration is used EXCLUSIVELY in pytest (config.settings.test).
Production uses the real compliance/migrations/ folder.

We intentionally:
  - Skip EvidenceBundles, RiskScoreHistory etc. (referenced auth_core FKs,
    not needed in ABR unit/integration tests)
  - Omit choices= on CharFields (check constraints not needed for tests)
  - Include all 6 ABR tables: AbrReporterIdentity, AbrCase,
    AbrIdentityAccessLog, AbrSensitiveActionRequest,
    AbrSensitiveActionApproval, AbrCaseTeamMember
"""

import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        # ── 1. AbrReporterIdentity ────────────────────────────────────────────
        migrations.CreateModel(
            name="AbrReporterIdentity",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org_id", models.UUIDField(db_index=True)),
                ("vault_entry_id", models.UUIDField(unique=True)),
                ("key_id", models.CharField(default="default", max_length=64)),
                ("is_active", models.BooleanField(default=True)),
                ("created_by", models.CharField(max_length=255)),
            ],
            options={
                "db_table": "abr_reporter_identity",
                "verbose_name": "AbrReporterIdentity",
            },
        ),
        migrations.AddIndex(
            model_name="abrreporteridentity",
            index=models.Index(
                fields=["org_id", "vault_entry_id"],
                name="abr_ri_org_vault_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abrreporteridentity",
            index=models.Index(
                fields=["org_id", "is_active"],
                name="abr_ri_org_active_idx",
            ),
        ),
        # ── 2. AbrCase ────────────────────────────────────────────────────────
        migrations.CreateModel(
            name="AbrCase",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org_id", models.UUIDField(db_index=True)),
                (
                    "identity_id",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cases",
                        to="compliance.abrreporteridentity",
                    ),
                ),
                ("case_number", models.CharField(max_length=64, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("status", models.CharField(default="open", max_length=20)),
                ("severity", models.CharField(default="medium", max_length=10)),
                ("category", models.CharField(blank=True, default="", max_length=100)),
                ("description", models.TextField(blank=True, default="")),
                ("closed_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "abr_case",
                "verbose_name": "AbrCase",
            },
        ),
        migrations.AddIndex(
            model_name="abrcase",
            index=models.Index(
                fields=["org_id", "status"],
                name="abr_case_org_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abrcase",
            index=models.Index(
                fields=["org_id", "severity"],
                name="abr_case_org_severity_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abrcase",
            index=models.Index(
                fields=["org_id", "created_at"],
                name="abr_case_org_created_idx",
            ),
        ),
        # ── 3. AbrIdentityAccessLog ───────────────────────────────────────────
        migrations.CreateModel(
            name="AbrIdentityAccessLog",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org_id", models.UUIDField(db_index=True)),
                ("case_id", models.UUIDField(db_index=True)),
                ("identity_id", models.UUIDField()),
                ("accessed_by", models.CharField(max_length=255)),
                ("justification", models.TextField()),
                ("accessed_at", models.DateTimeField(auto_now_add=True)),
                ("access_type", models.CharField(default="view", max_length=50)),
            ],
            options={
                "db_table": "abr_identity_access_log",
                "verbose_name": "AbrIdentityAccessLog",
            },
        ),
        migrations.AddIndex(
            model_name="abridentityaccesslog",
            index=models.Index(
                fields=["org_id", "case_id"],
                name="abr_ial_org_case_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abridentityaccesslog",
            index=models.Index(
                fields=["org_id", "accessed_at"],
                name="abr_ial_org_at_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abridentityaccesslog",
            index=models.Index(
                fields=["accessed_by", "accessed_at"],
                name="abr_ial_by_at_idx",
            ),
        ),
        # ── 4. AbrSensitiveActionRequest ──────────────────────────────────────
        migrations.CreateModel(
            name="AbrSensitiveActionRequest",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org_id", models.UUIDField(db_index=True)),
                ("case_id", models.UUIDField(db_index=True)),
                ("action", models.CharField(max_length=32)),
                ("requested_by", models.CharField(max_length=255)),
                ("justification", models.TextField()),
                ("status", models.CharField(default="pending", max_length=16)),
                ("expires_at", models.DateTimeField()),
                ("executed_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "abr_sensitive_action_requests",
                "verbose_name": "AbrSensitiveActionRequest",
            },
        ),
        migrations.AddIndex(
            model_name="abrsensitiveactionrequest",
            index=models.Index(
                fields=["org_id", "case_id"],
                name="abr_sar_org_case_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abrsensitiveactionrequest",
            index=models.Index(
                fields=["org_id", "status"],
                name="abr_sar_org_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abrsensitiveactionrequest",
            index=models.Index(
                fields=["requested_by", "status"],
                name="abr_sar_by_status_idx",
            ),
        ),
        # ── 5. AbrSensitiveActionApproval ─────────────────────────────────────
        migrations.CreateModel(
            name="AbrSensitiveActionApproval",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org_id", models.UUIDField(db_index=True)),
                (
                    "request",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="approvals",
                        to="compliance.abrsensitiveactionrequest",
                    ),
                ),
                ("approver_id", models.CharField(max_length=255)),
                ("decision", models.CharField(max_length=10)),
                ("notes", models.TextField(blank=True, default="")),
                ("decided_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "abr_sensitive_action_approvals",
                "verbose_name": "AbrSensitiveActionApproval",
            },
        ),
        migrations.AddIndex(
            model_name="abrsensitiveactionapproval",
            index=models.Index(
                fields=["request", "decision"],
                name="abr_saa_req_dec_idx",
            ),
        ),
        # ── 6. AbrCaseTeamMember ──────────────────────────────────────────────
        migrations.CreateModel(
            name="AbrCaseTeamMember",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org_id", models.UUIDField(db_index=True)),
                (
                    "case",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="team_members",
                        to="compliance.abrcase",
                    ),
                ),
                ("user_id", models.CharField(max_length=255)),
                ("role", models.CharField(default="observer", max_length=30)),
                ("added_by", models.CharField(max_length=255)),
            ],
            options={
                "db_table": "abr_case_team_members",
                "verbose_name": "AbrCaseTeamMember",
                "unique_together": {("case", "user_id")},
            },
        ),
        migrations.AddIndex(
            model_name="abrcaseteammember",
            index=models.Index(
                fields=["org_id", "case"],
                name="abr_ctm_org_case_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="abrcaseteammember",
            index=models.Index(
                fields=["user_id", "org_id"],
                name="abr_ctm_user_org_idx",
            ),
        ),
    ]
