"""
Django models for exit_interviews app — Knowledge Transfer (KT) framework.

Mirrors the canonical Drizzle schema at:
  apps/union-eyes/db/schema/domains/infrastructure/exit-interviews.ts

This app owns exit_interviews and related tables in the `public` schema.
The pre-KT shape (migrations 0042 + 0043) was created by Drizzle and is faked
into Django state via 0001_initial. KT lifecycle deltas land in 0002.
"""

import uuid

from django.db import models

# ---------------------------------------------------------------------------
# Choices (mirror Postgres ENUM types created by Drizzle migrations)
# ---------------------------------------------------------------------------

EXIT_INTERVIEW_STATUS_CHOICES = [
    ("draft", "Draft"),
    ("submitted", "Submitted"),
    ("reviewed", "Reviewed"),
    ("published", "Published"),
    ("handover_complete", "Handover Complete"),
    ("archived", "Archived"),
]

EXIT_INTERVIEW_ROLE_CHOICES = [
    ("member", "Member"),
    ("steward", "Steward"),
    ("chief_steward", "Chief Steward"),
    ("officer", "Officer"),
    ("admin", "Admin"),
]

EXIT_INTERVIEW_RETIREMENT_REASON_CHOICES = [
    ("retirement", "Retirement"),
    ("career_change", "Career Change"),
    ("health", "Health"),
    ("relocation", "Relocation"),
    ("other", "Other"),
]

EXIT_INTERVIEW_SENSITIVITY_CHOICES = [
    ("public_internal", "Public Internal"),
    ("restricted", "Restricted"),
    ("privileged", "Privileged"),
    ("legal_sensitive", "Legal Sensitive"),
    ("executive_confidential", "Executive Confidential"),
]

EXIT_INTERVIEW_INDEXING_STATUS_CHOICES = [
    ("pending", "Pending"),
    ("indexing", "Indexing"),
    ("indexed", "Indexed"),
    ("failed", "Failed"),
    ("skipped", "Skipped"),
]

EXIT_INTERVIEW_COMPLEXITY_TIER_CHOICES = [
    ("high", "High"),
    ("medium", "Medium"),
    ("low", "Low"),
]

EXIT_INTERVIEW_SESSION_TYPE_CHOICES = [
    ("walkthrough", "Walkthrough"),
    ("shadow", "Shadow"),
    ("qa", "Q&A"),
    ("recording_review", "Recording Review"),
]

EXIT_INTERVIEW_EVENT_TYPE_CHOICES = [
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


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ExitInterview(models.Model):
    """Retirement / exit interview record. Owns the KT lifecycle for a retiring official."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_id = models.UUIDField()

    status = models.CharField(
        max_length=32, choices=EXIT_INTERVIEW_STATUS_CHOICES, default="draft"
    )

    retiring_employee_name = models.TextField()
    role_in_union = models.CharField(max_length=32, choices=EXIT_INTERVIEW_ROLE_CHOICES)
    years_of_service = models.IntegerField(default=0)
    retirement_reason = models.CharField(
        max_length=32,
        choices=EXIT_INTERVIEW_RETIREMENT_REASON_CHOICES,
        null=True,
        blank=True,
        default="retirement",
    )

    title = models.TextField()
    summary = models.TextField(null=True, blank=True)
    key_lessons = models.TextField()
    best_practices = models.TextField(null=True, blank=True)
    bargaining_advice = models.TextField(null=True, blank=True)
    mediation_advice = models.TextField(null=True, blank=True)
    incoming_officer_advice = models.TextField(null=True, blank=True)

    topics = models.JSONField(null=True, blank=True)
    key_cases = models.JSONField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)

    contains_pii = models.BooleanField(default=False)

    # Intelligence Layer
    sensitivity_level = models.CharField(
        max_length=32,
        choices=EXIT_INTERVIEW_SENSITIVITY_CHOICES,
        default="public_internal",
    )
    consent_granted = models.BooleanField(default=False)
    consent_granted_at = models.DateTimeField(null=True, blank=True)
    consent_granted_by = models.TextField(null=True, blank=True)
    expertise_tags = models.JSONField(null=True, blank=True)
    continuity_risk_score = models.IntegerField(null=True, blank=True)
    continuity_risk_flags = models.JSONField(null=True, blank=True)
    indexing_status = models.CharField(
        max_length=32,
        choices=EXIT_INTERVIEW_INDEXING_STATUS_CHOICES,
        default="pending",
    )
    indexed_at = models.DateTimeField(null=True, blank=True)
    ai_summary = models.TextField(null=True, blank=True)
    ai_summary_generated_at = models.DateTimeField(null=True, blank=True)

    knowledge_base_id = models.UUIDField(null=True, blank=True)

    # Handover Lifecycle Layer (KT deltas — added in migration 0002)
    successor_user_id = models.TextField(null=True, blank=True)
    successor_accepted_at = models.DateTimeField(null=True, blank=True)
    complexity_tier = models.CharField(
        max_length=16,
        choices=EXIT_INTERVIEW_COMPLEXITY_TIER_CHOICES,
        default="medium",
    )
    followup_due_at = models.DateTimeField(null=True, blank=True)
    followup_completed_at = models.DateTimeField(null=True, blank=True)
    followup_notes = models.TextField(null=True, blank=True)
    manager_signed_off_at = models.DateTimeField(null=True, blank=True)
    manager_signed_off_by = models.TextField(null=True, blank=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.TextField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    created_by = models.TextField()
    updated_by = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exit_interviews"
        verbose_name = "Exit Interview"
        indexes = [
            models.Index(
                fields=["organization_id", "status"], name="idx_exit_interviews_org_status"
            ),
            models.Index(
                fields=["organization_id", "created_at"],
                name="idx_ei_org_created",
            ),
            models.Index(fields=["published_at"], name="idx_exit_interviews_published"),
            models.Index(
                fields=["knowledge_base_id"], name="idx_ei_knowledge_base"
            ),
            models.Index(
                fields=["sensitivity_level"], name="idx_ei_sensitivity"
            ),
            models.Index(
                fields=["indexing_status"], name="idx_ei_indexing_status"
            ),
            models.Index(
                fields=["continuity_risk_score"], name="idx_exit_interviews_risk_score"
            ),
            models.Index(fields=["successor_user_id"], name="idx_exit_interviews_successor"),
            models.Index(fields=["followup_due_at"], name="idx_ei_followup_due"),
            models.Index(fields=["complexity_tier"], name="idx_exit_interviews_complexity"),
        ]


class ExitInterviewSession(models.Model):
    """Concrete handover session (walkthrough / shadow / Q&A / recording review).

    Completion of >=1 session is required for sign-off when complexity_tier='high'.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interview_id = models.UUIDField()
    organization_id = models.UUIDField()

    session_type = models.CharField(max_length=32, choices=EXIT_INTERVIEW_SESSION_TYPE_CHOICES)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.IntegerField(default=30)

    facilitator_user_id = models.TextField()
    successor_user_id = models.TextField(null=True, blank=True)

    recording_url = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    completed_at = models.DateTimeField(null=True, blank=True)

    created_by = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exit_interview_sessions"
        verbose_name = "Exit Interview Session"
        indexes = [
            models.Index(fields=["interview_id"], name="idx_ei_sess_interview"),
            models.Index(fields=["organization_id"], name="idx_ei_sess_org"),
            models.Index(fields=["scheduled_at"], name="idx_ei_sess_scheduled"),
        ]


class ExitInterviewDocument(models.Model):
    """Attached artifact (recording transcript, slide deck, etc.) for an exit interview."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interview_id = models.UUIDField()
    organization_id = models.UUIDField()

    title = models.TextField()
    file_url = models.TextField()
    mime_type = models.TextField()
    size_bytes = models.IntegerField(null=True, blank=True)
    transcript_text = models.TextField(null=True, blank=True)

    created_by = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exit_interview_documents"
        verbose_name = "Exit Interview Document"
        indexes = [
            models.Index(fields=["interview_id"], name="idx_ei_docs_interview"),
            models.Index(fields=["organization_id"], name="idx_ei_docs_org"),
        ]


class ExitInterviewEvent(models.Model):
    """Append-only audit/event log for an exit interview's lifecycle."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    interview_id = models.UUIDField()
    organization_id = models.UUIDField()

    event_type = models.CharField(max_length=32, choices=EXIT_INTERVIEW_EVENT_TYPE_CHOICES)
    notes = models.TextField(null=True, blank=True)
    payload = models.JSONField(null=True, blank=True)

    actor_user_id = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exit_interview_events"
        verbose_name = "Exit Interview Event"
        indexes = [
            models.Index(fields=["interview_id"], name="idx_ei_events_interview"),
            models.Index(fields=["organization_id"], name="idx_exit_interview_events_org"),
            models.Index(fields=["event_type"], name="idx_exit_interview_events_type"),
            models.Index(fields=["created_at"], name="idx_ei_events_created"),
        ]
