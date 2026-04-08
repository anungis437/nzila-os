"""
Migration: ABR Phase 2 — Identity Vault, Dual-Control, Access Logs

Creates:
  abr_reporter_identity   — org-scoped vault entry reference
  abr_case                — non-PII case metadata, optional identity link
  abr_identity_access_log — immutable read audit trail
  abr_sensitive_action_requests   — dual-control request table
  abr_sensitive_action_approvals  — approval records (requester ≠ approver)
  abr_case_team_members   — membership gate for case-level access

All tables carry org_id (UUID) for multi-tenant partitioning.
Indexes on (org_id, case_id), (org_id, status), etc. mirror NzilaOS ABR schema.
"""

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("compliance", "0002_compliance_org_seal"),
    ]

    operations = [
        # ── AbrReporterIdentity ───────────────────────────────────────────
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
                (
                    "org_id",
                    models.UUIDField(
                        db_index=True,
                        help_text="Owning organization (UUID, no FK — enforced at app layer).",
                    ),
                ),
                (
                    "vault_entry_id",
                    models.UUIDField(
                        unique=True,
                        help_text="ID of the corresponding IdentityVaultEntry.",
                    ),
                ),
                (
                    "key_id",
                    models.CharField(
                        default="default", max_length=64, help_text="Encryption key ID."
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True, help_text="False once permanently redacted."
                    ),
                ),
                (
                    "created_by",
                    models.CharField(
                        max_length=255, help_text="User ID of the compliance officer."
                    ),
                ),
            ],
            options={
                "db_table": "abr_reporter_identity",
                "verbose_name": "AbrReporterIdentity",
            },
        ),
        migrations.AddIndex(
            model_name="abrreporteridentity",
            index=models.Index(
                fields=["org_id", "vault_entry_id"], name="abr_identity_org_vault_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="abrreporteridentity",
            index=models.Index(
                fields=["org_id", "is_active"], name="abr_identity_org_active_idx"
            ),
        ),
        # ── AbrCase ───────────────────────────────────────────────────────
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
                (
                    "org_id",
                    models.UUIDField(db_index=True, help_text="Owning organization."),
                ),
                (
                    "identity_id",
                    models.ForeignKey(
                        blank=True,
                        help_text="Linked identity (dual-control required to populate).",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cases",
                        to="compliance.abrreporteridentity",
                    ),
                ),
                (
                    "case_number",
                    models.CharField(
                        max_length=64,
                        unique=True,
                        help_text="Human-readable reference.",
                    ),
                ),
                (
                    "title",
                    models.CharField(
                        max_length=255, help_text="Non-identifying title."
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("under_review", "Under Review"),
                            ("escalated", "Escalated"),
                            ("closed", "Closed"),
                            ("archived", "Archived"),
                        ],
                        default="open",
                        max_length=20,
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("low", "Low"),
                            ("medium", "Medium"),
                            ("high", "High"),
                            ("critical", "Critical"),
                        ],
                        default="medium",
                        max_length=10,
                    ),
                ),
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
                fields=["org_id", "status"], name="abr_case_org_status_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="abrcase",
            index=models.Index(
                fields=["org_id", "severity"], name="abr_case_org_severity_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="abrcase",
            index=models.Index(
                fields=["org_id", "created_at"], name="abr_case_org_created_idx"
            ),
        ),
        # ── AbrIdentityAccessLog ──────────────────────────────────────────
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
                (
                    "justification",
                    models.TextField(help_text="Mandatory reason for access."),
                ),
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
                fields=["org_id", "case_id"], name="abr_log_org_case_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="abridentityaccesslog",
            index=models.Index(
                fields=["org_id", "accessed_at"], name="abr_log_org_ts_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="abridentityaccesslog",
            index=models.Index(
                fields=["accessed_by", "accessed_at"], name="abr_log_actor_ts_idx"
            ),
        ),
        # ── AbrSensitiveActionRequest ─────────────────────────────────────
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
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("case-close", "Close Case"),
                            ("severity-change", "Change Severity"),
                            ("identity-unmask", "Unmask Reporter Identity"),
                            ("evidence-export", "Export Case Evidence"),
                        ],
                        max_length=32,
                    ),
                ),
                ("requested_by", models.CharField(max_length=255)),
                ("justification", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending Approval"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                            ("expired", "Expired"),
                            ("executed", "Executed"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
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
                fields=["org_id", "case_id"], name="abr_req_org_case_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="abrsensitiveactionrequest",
            index=models.Index(
                fields=["org_id", "status"], name="abr_req_org_status_idx"
            ),
        ),
        # ── AbrSensitiveActionApproval ────────────────────────────────────
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
                (
                    "decision",
                    models.CharField(
                        choices=[("approved", "Approved"), ("rejected", "Rejected")],
                        max_length=10,
                    ),
                ),
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
                fields=["request", "decision"], name="abr_approval_req_dec_idx"
            ),
        ),
        # ── AbrCaseTeamMember ─────────────────────────────────────────────
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
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("investigator", "Investigator"),
                            ("reviewer", "Reviewer"),
                            ("observer", "Observer"),
                            ("compliance-officer", "Compliance Officer"),
                        ],
                        default="observer",
                        max_length=30,
                    ),
                ),
                ("added_by", models.CharField(max_length=255)),
            ],
            options={
                "db_table": "abr_case_team_members",
                "verbose_name": "AbrCaseTeamMember",
            },
        ),
        migrations.AlterUniqueTogether(
            name="abrcaseteammember",
            unique_together={("case", "user_id")},
        ),
        migrations.AddIndex(
            model_name="abrcaseteammember",
            index=models.Index(fields=["org_id", "case"], name="abr_team_org_case_idx"),
        ),
        migrations.AddIndex(
            model_name="abrcaseteammember",
            index=models.Index(
                fields=["user_id", "org_id"], name="abr_team_user_org_idx"
            ),
        ),
    ]
