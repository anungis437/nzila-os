# KT (Knowledge Transfer) handover lifecycle deltas for exit_interviews.
#
# This migration adds:
#   * 'handover_complete' to exit_interview_status enum
#   * 9 new event types to exit_interview_event_type enum
#   * exit_interview_session_type and exit_interview_complexity_tier enums
#   * 8 KT columns on exit_interviews
#   * exit_interview_sessions table
#   * 6 supporting indexes
#
# Uses SeparateDatabaseAndState so PG ENUM types are preserved and Django's
# state matches the canonical Drizzle schema (apps/union-eyes/db/schema/
# domains/infrastructure/exit-interviews.ts).

import uuid

from django.db import migrations, models


PRE_KT_STATUS_CHOICES = [
    ("draft", "Draft"),
    ("submitted", "Submitted"),
    ("reviewed", "Reviewed"),
    ("published", "Published"),
    ("archived", "Archived"),
]

POST_KT_STATUS_CHOICES = [
    ("draft", "Draft"),
    ("submitted", "Submitted"),
    ("reviewed", "Reviewed"),
    ("published", "Published"),
    ("handover_complete", "Handover Complete"),
    ("archived", "Archived"),
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

POST_KT_EVENT_TYPE_CHOICES = PRE_KT_EVENT_TYPE_CHOICES + [
    ("session_scheduled", "Session Scheduled"),
    ("session_completed", "Session Completed"),
    ("successor_assigned", "Successor Assigned"),
    ("successor_accepted", "Successor Accepted"),
    ("followup_scheduled", "Followup Scheduled"),
    ("followup_completed", "Followup Completed"),
    ("followup_overdue", "Followup Overdue"),
    ("manager_signed_off", "Manager Signed Off"),
    ("rotation_triggered", "Rotation Triggered"),
]

COMPLEXITY_TIER_CHOICES = [
    ("high", "High"),
    ("medium", "Medium"),
    ("low", "Low"),
]

SESSION_TYPE_CHOICES = [
    ("walkthrough", "Walkthrough"),
    ("shadow", "Shadow"),
    ("qa", "Q&A"),
    ("recording_review", "Recording Review"),
]


# ---------------------------------------------------------------------------
# Raw SQL — actual DDL applied to Postgres
# ---------------------------------------------------------------------------

EXTEND_ENUMS_SQL = """
-- No-op: status/event_type columns are varchar(32) with Django choices,
-- not PG ENUM types. Choice expansion is captured in state_operations.
SELECT 1;
"""

CREATE_NEW_ENUMS_SQL = """
-- No-op: new columns use varchar with Django choices instead of PG ENUMs.
SELECT 1;
"""

ADD_KT_COLUMNS_SQL = """
ALTER TABLE exit_interviews
    ADD COLUMN IF NOT EXISTS successor_user_id text,
    ADD COLUMN IF NOT EXISTS successor_accepted_at timestamptz,
    ADD COLUMN IF NOT EXISTS complexity_tier varchar(16) NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS followup_due_at timestamptz,
    ADD COLUMN IF NOT EXISTS followup_completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS followup_notes text,
    ADD COLUMN IF NOT EXISTS manager_signed_off_at timestamptz,
    ADD COLUMN IF NOT EXISTS manager_signed_off_by text;
"""

DROP_KT_COLUMNS_SQL = """
ALTER TABLE exit_interviews
    DROP COLUMN IF EXISTS successor_user_id,
    DROP COLUMN IF EXISTS successor_accepted_at,
    DROP COLUMN IF EXISTS complexity_tier,
    DROP COLUMN IF EXISTS followup_due_at,
    DROP COLUMN IF EXISTS followup_completed_at,
    DROP COLUMN IF EXISTS followup_notes,
    DROP COLUMN IF EXISTS manager_signed_off_at,
    DROP COLUMN IF EXISTS manager_signed_off_by;
"""

CREATE_SESSIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS exit_interview_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    session_type varchar(32) NOT NULL,
    scheduled_at timestamptz NOT NULL,
    duration_minutes integer NOT NULL DEFAULT 30,
    facilitator_user_id text NOT NULL,
    successor_user_id text,
    recording_url text,
    notes text,
    completed_at timestamptz,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ei_sess_interview
    ON exit_interview_sessions (interview_id);
CREATE INDEX IF NOT EXISTS idx_ei_sess_org
    ON exit_interview_sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_ei_sess_scheduled
    ON exit_interview_sessions (scheduled_at);
"""

DROP_SESSIONS_TABLE_SQL = """
DROP TABLE IF EXISTS exit_interview_sessions;
"""

CREATE_KT_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_exit_interviews_successor
    ON exit_interviews (successor_user_id);
CREATE INDEX IF NOT EXISTS idx_ei_followup_due
    ON exit_interviews (followup_due_at);
CREATE INDEX IF NOT EXISTS idx_exit_interviews_complexity
    ON exit_interviews (complexity_tier);
"""

DROP_KT_INDEXES_SQL = """
DROP INDEX IF EXISTS idx_exit_interviews_successor;
DROP INDEX IF EXISTS idx_ei_followup_due;
DROP INDEX IF EXISTS idx_exit_interviews_complexity;
"""


class Migration(migrations.Migration):

    # ALTER TYPE ... ADD VALUE cannot run in a transaction block (Postgres < 12
    # and some 12+ scenarios), so disable the per-migration transaction.
    atomic = False

    dependencies = [
        ("exit_interviews", "0001_initial"),
    ]

    operations = [
        # ------------------------------------------------------------------
        # 1. Extend existing enums (must run outside a transaction)
        # ------------------------------------------------------------------
        migrations.RunSQL(
            sql=EXTEND_ENUMS_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
        # ------------------------------------------------------------------
        # 2. Create new enums + columns + sessions table + indexes,
        #    paired with state operations so Django's view of the schema
        #    stays consistent with the actual database.
        # ------------------------------------------------------------------
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=CREATE_NEW_ENUMS_SQL,
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    sql=ADD_KT_COLUMNS_SQL,
                    reverse_sql=DROP_KT_COLUMNS_SQL,
                ),
                migrations.RunSQL(
                    sql=CREATE_SESSIONS_TABLE_SQL,
                    reverse_sql=DROP_SESSIONS_TABLE_SQL,
                ),
                migrations.RunSQL(
                    sql=CREATE_KT_INDEXES_SQL,
                    reverse_sql=DROP_KT_INDEXES_SQL,
                ),
            ],
            state_operations=[
                # Expand status / event_type choices to the post-KT set.
                migrations.AlterField(
                    model_name="exitinterview",
                    name="status",
                    field=models.CharField(
                        choices=POST_KT_STATUS_CHOICES,
                        default="draft",
                        max_length=32,
                    ),
                ),
                migrations.AlterField(
                    model_name="exitinterviewevent",
                    name="event_type",
                    field=models.CharField(
                        choices=POST_KT_EVENT_TYPE_CHOICES, max_length=32
                    ),
                ),
                # New columns on exit_interviews.
                migrations.AddField(
                    model_name="exitinterview",
                    name="successor_user_id",
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="exitinterview",
                    name="successor_accepted_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="exitinterview",
                    name="complexity_tier",
                    field=models.CharField(
                        choices=COMPLEXITY_TIER_CHOICES,
                        default="medium",
                        max_length=16,
                    ),
                ),
                migrations.AddField(
                    model_name="exitinterview",
                    name="followup_due_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="exitinterview",
                    name="followup_completed_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="exitinterview",
                    name="followup_notes",
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="exitinterview",
                    name="manager_signed_off_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="exitinterview",
                    name="manager_signed_off_by",
                    field=models.TextField(blank=True, null=True),
                ),
                # New ExitInterviewSession model.
                migrations.CreateModel(
                    name="ExitInterviewSession",
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
                            "session_type",
                            models.CharField(
                                choices=SESSION_TYPE_CHOICES, max_length=32
                            ),
                        ),
                        ("scheduled_at", models.DateTimeField()),
                        ("duration_minutes", models.IntegerField(default=30)),
                        ("facilitator_user_id", models.TextField()),
                        ("successor_user_id", models.TextField(blank=True, null=True)),
                        ("recording_url", models.TextField(blank=True, null=True)),
                        ("notes", models.TextField(blank=True, null=True)),
                        ("completed_at", models.DateTimeField(blank=True, null=True)),
                        ("created_by", models.TextField()),
                        ("created_at", models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        "verbose_name": "Exit Interview Session",
                        "db_table": "exit_interview_sessions",
                        "indexes": [
                            models.Index(
                                fields=["interview_id"],
                                name="idx_ei_sess_interview",
                            ),
                            models.Index(
                                fields=["organization_id"],
                                name="idx_ei_sess_org",
                            ),
                            models.Index(
                                fields=["scheduled_at"],
                                name="idx_ei_sess_scheduled",
                            ),
                        ],
                    },
                ),
                # New indexes on exit_interviews for KT columns.
                migrations.AddIndex(
                    model_name="exitinterview",
                    index=models.Index(
                        fields=["successor_user_id"],
                        name="idx_exit_interviews_successor",
                    ),
                ),
                migrations.AddIndex(
                    model_name="exitinterview",
                    index=models.Index(
                        fields=["followup_due_at"],
                        name="idx_ei_followup_due",
                    ),
                ),
                migrations.AddIndex(
                    model_name="exitinterview",
                    index=models.Index(
                        fields=["complexity_tier"],
                        name="idx_exit_interviews_complexity",
                    ),
                ),
            ],
        ),
    ]
