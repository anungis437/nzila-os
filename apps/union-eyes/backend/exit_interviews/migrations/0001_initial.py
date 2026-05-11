# Generated for exit_interviews app — pre-KT baseline (mirrors Drizzle 0042 + 0043).
#
# This migration captures the table shape that already exists in the database
# from the Drizzle migrations frozen under apps/union-eyes/db/migrations/.
# Apply with `python manage.py migrate exit_interviews 0001 --fake` so Django
# learns the state without re-running DDL.
#
# The KT (Knowledge Transfer) handover lifecycle deltas land in 0002.

import uuid

from django.db import migrations, models


PRE_KT_STATUS_CHOICES = [
    ("draft", "Draft"),
    ("submitted", "Submitted"),
    ("reviewed", "Reviewed"),
    ("published", "Published"),
    ("archived", "Archived"),
]

ROLE_CHOICES = [
    ("member", "Member"),
    ("steward", "Steward"),
    ("chief_steward", "Chief Steward"),
    ("officer", "Officer"),
    ("admin", "Admin"),
]

RETIREMENT_REASON_CHOICES = [
    ("retirement", "Retirement"),
    ("career_change", "Career Change"),
    ("health", "Health"),
    ("relocation", "Relocation"),
    ("other", "Other"),
]

SENSITIVITY_CHOICES = [
    ("public_internal", "Public Internal"),
    ("restricted", "Restricted"),
    ("privileged", "Privileged"),
    ("legal_sensitive", "Legal Sensitive"),
    ("executive_confidential", "Executive Confidential"),
]

INDEXING_STATUS_CHOICES = [
    ("pending", "Pending"),
    ("indexing", "Indexing"),
    ("indexed", "Indexed"),
    ("failed", "Failed"),
    ("skipped", "Skipped"),
]

PRE_KT_EVENT_TYPE_CHOICES = [
    ("created", "Created"),
    ("updated", "Updated"),
    ("submitted", "Submitted"),
    ("reviewed", "Reviewed"),
    ("published", "Published"),
    ("archived", "Archived"),
    ("viewed", "Viewed"),
    ("searched", "Searched"),
    ("indexed", "Indexed"),
    ("summarized", "Summarized"),
    ("governance_updated", "Governance Updated"),
]


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ExitInterview",
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
                ("organization_id", models.UUIDField()),
                (
                    "status",
                    models.CharField(
                        choices=PRE_KT_STATUS_CHOICES, default="draft", max_length=32
                    ),
                ),
                ("retiring_employee_name", models.TextField()),
                ("role_in_union", models.CharField(choices=ROLE_CHOICES, max_length=32)),
                ("years_of_service", models.IntegerField(default=0)),
                (
                    "retirement_reason",
                    models.CharField(
                        blank=True,
                        choices=RETIREMENT_REASON_CHOICES,
                        default="retirement",
                        max_length=32,
                        null=True,
                    ),
                ),
                ("title", models.TextField()),
                ("summary", models.TextField(blank=True, null=True)),
                ("key_lessons", models.TextField()),
                ("best_practices", models.TextField(blank=True, null=True)),
                ("bargaining_advice", models.TextField(blank=True, null=True)),
                ("mediation_advice", models.TextField(blank=True, null=True)),
                ("incoming_officer_advice", models.TextField(blank=True, null=True)),
                ("topics", models.JSONField(blank=True, null=True)),
                ("key_cases", models.JSONField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, null=True)),
                ("contains_pii", models.BooleanField(default=False)),
                (
                    "sensitivity_level",
                    models.CharField(
                        choices=SENSITIVITY_CHOICES,
                        default="public_internal",
                        max_length=32,
                    ),
                ),
                ("consent_granted", models.BooleanField(default=False)),
                ("consent_granted_at", models.DateTimeField(blank=True, null=True)),
                ("consent_granted_by", models.TextField(blank=True, null=True)),
                ("expertise_tags", models.JSONField(blank=True, null=True)),
                ("continuity_risk_score", models.IntegerField(blank=True, null=True)),
                ("continuity_risk_flags", models.JSONField(blank=True, null=True)),
                (
                    "indexing_status",
                    models.CharField(
                        choices=INDEXING_STATUS_CHOICES,
                        default="pending",
                        max_length=32,
                    ),
                ),
                ("indexed_at", models.DateTimeField(blank=True, null=True)),
                ("ai_summary", models.TextField(blank=True, null=True)),
                ("ai_summary_generated_at", models.DateTimeField(blank=True, null=True)),
                ("knowledge_base_id", models.UUIDField(blank=True, null=True)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("reviewed_by", models.TextField(blank=True, null=True)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                ("created_by", models.TextField()),
                ("updated_by", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Exit Interview",
                "db_table": "exit_interviews",
                "indexes": [
                    models.Index(
                        fields=["organization_id", "status"],
                        name="idx_exit_interviews_org_status",
                    ),
                    models.Index(
                        fields=["organization_id", "created_at"],
                        name="idx_ei_org_created",
                    ),
                    models.Index(
                        fields=["published_at"], name="idx_exit_interviews_published"
                    ),
                    models.Index(
                        fields=["knowledge_base_id"],
                        name="idx_ei_knowledge_base",
                    ),
                    models.Index(
                        fields=["sensitivity_level"],
                        name="idx_ei_sensitivity",
                    ),
                    models.Index(
                        fields=["indexing_status"],
                        name="idx_ei_indexing_status",
                    ),
                    models.Index(
                        fields=["continuity_risk_score"],
                        name="idx_exit_interviews_risk_score",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ExitInterviewDocument",
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
                ("interview_id", models.UUIDField()),
                ("organization_id", models.UUIDField()),
                ("title", models.TextField()),
                ("file_url", models.TextField()),
                ("mime_type", models.TextField()),
                ("size_bytes", models.IntegerField(blank=True, null=True)),
                ("transcript_text", models.TextField(blank=True, null=True)),
                ("created_by", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Exit Interview Document",
                "db_table": "exit_interview_documents",
                "indexes": [
                    models.Index(
                        fields=["interview_id"],
                        name="idx_ei_docs_interview",
                    ),
                    models.Index(
                        fields=["organization_id"],
                        name="idx_ei_docs_org",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ExitInterviewEvent",
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
                ("interview_id", models.UUIDField()),
                ("organization_id", models.UUIDField()),
                (
                    "event_type",
                    models.CharField(
                        choices=PRE_KT_EVENT_TYPE_CHOICES, max_length=32
                    ),
                ),
                ("notes", models.TextField(blank=True, null=True)),
                ("payload", models.JSONField(blank=True, null=True)),
                ("actor_user_id", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Exit Interview Event",
                "db_table": "exit_interview_events",
                "indexes": [
                    models.Index(
                        fields=["interview_id"],
                        name="idx_ei_events_interview",
                    ),
                    models.Index(
                        fields=["organization_id"],
                        name="idx_exit_interview_events_org",
                    ),
                    models.Index(
                        fields=["event_type"], name="idx_exit_interview_events_type"
                    ),
                    models.Index(
                        fields=["created_at"], name="idx_ei_events_created"
                    ),
                ],
            },
        ),
    ]
