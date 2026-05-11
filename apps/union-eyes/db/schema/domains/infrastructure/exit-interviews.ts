import {
  pgEnum,
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

export const exitInterviewStatusEnum = pgEnum('exit_interview_status', [
  'draft',
  'submitted',
  'reviewed',
  'published',
  'handover_complete',
  'archived',
]);

export const exitInterviewRoleEnum = pgEnum('exit_interview_role', [
  'member',
  'steward',
  'chief_steward',
  'officer',
  'admin',
]);

export const exitInterviewRetirementReasonEnum = pgEnum('exit_interview_retirement_reason', [
  'retirement',
  'career_change',
  'health',
  'relocation',
  'other',
]);

export const exitInterviewEventTypeEnum = pgEnum('exit_interview_event_type', [
  'created',
  'updated',
  'submitted',
  'reviewed',
  'published',
  'archived',
  'viewed',
  'searched',
  'indexed',
  'summarized',
  'governance_updated',
  'session_scheduled',
  'session_completed',
  'successor_assigned',
  'successor_accepted',
  'followup_scheduled',
  'followup_completed',
  'followup_overdue',
  'manager_signed_off',
  'rotation_triggered',
]);

/**
 * Type of handover session: walkthrough (officer guides successor),
 * shadow (successor observes), qa (Q&A), recording_review (async).
 */
export const exitInterviewSessionTypeEnum = pgEnum('exit_interview_session_type', [
  'walkthrough',
  'shadow',
  'qa',
  'recording_review',
]);

/**
 * Complexity tier drives required handover rigor:
 *   high   — officer/chief_steward or 10+ yrs of service: ≥1 completed session before sign-off
 *   medium — default
 *   low    — short tenure / member rotation
 */
export const exitInterviewComplexityTierEnum = pgEnum('exit_interview_complexity_tier', [
  'high',
  'medium',
  'low',
]);

/**
 * Sensitivity classification for governance-aware publishing.
 * Determines RAG indexing eligibility and access scope.
 */
export const exitInterviewSensitivityEnum = pgEnum('exit_interview_sensitivity', [
  'public_internal',
  'restricted',
  'privileged',
  'legal_sensitive',
  'executive_confidential',
]);

/** Lifecycle state of semantic indexing in the knowledge_base vector store. */
export const exitInterviewIndexingStatusEnum = pgEnum('exit_interview_indexing_status', [
  'pending',
  'indexing',
  'indexed',
  'failed',
  'skipped',
]);

export const exitInterviews = pgTable(
  'exit_interviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    status: exitInterviewStatusEnum('status').notNull().default('draft'),

    retiringEmployeeName: text('retiring_employee_name').notNull(),
    roleInUnion: exitInterviewRoleEnum('role_in_union').notNull(),
    yearsOfService: integer('years_of_service').notNull().default(0),
    retirementReason: exitInterviewRetirementReasonEnum('retirement_reason').default('retirement'),

    title: text('title').notNull(),
    summary: text('summary'),
    keyLessons: text('key_lessons').notNull(),
    bestPractices: text('best_practices'),
    bargainingAdvice: text('bargaining_advice'),
    mediationAdvice: text('mediation_advice'),
    incomingOfficerAdvice: text('incoming_officer_advice'),

    topics: jsonb('topics').$type<string[]>(),
    keyCases: jsonb('key_cases').$type<Array<{ id?: string; label: string; notes?: string }>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    containsPii: boolean('contains_pii').notNull().default(false),

    // --- Intelligence Layer ---
    /** Governance sensitivity classification. Controls indexing eligibility and access. */
    sensitivityLevel: exitInterviewSensitivityEnum('sensitivity_level').notNull().default('public_internal'),
    /** Retiree consent granted before indexing for RAG search. */
    consentGranted: boolean('consent_granted').notNull().default(false),
    consentGrantedAt: timestamp('consent_granted_at', { withTimezone: true }),
    consentGrantedBy: text('consent_granted_by'),
    /** AI-extracted expertise tag clusters (systems, vendors, procedures, compliance areas). */
    expertiseTags: jsonb('expertise_tags').$type<string[]>(),
    /** 0–100 operational continuity risk score. Higher = more concentrated / fragile. */
    continuityRiskScore: integer('continuity_risk_score'),
    /** Human-readable continuity risk flags surfaced by the risk detector. */
    continuityRiskFlags: jsonb('continuity_risk_flags').$type<string[]>(),
    /** RAG indexing lifecycle state. */
    indexingStatus: exitInterviewIndexingStatusEnum('indexing_status').notNull().default('pending'),
    indexedAt: timestamp('indexed_at', { withTimezone: true }),
    /** AI-generated operational handoff summary. Always traceable to source content. */
    aiSummary: text('ai_summary'),
    aiSummaryGeneratedAt: timestamp('ai_summary_generated_at', { withTimezone: true }),
    // --- end Intelligence Layer ---

    knowledgeBaseId: uuid('knowledge_base_id'),

    // --- Handover Lifecycle Layer ---
    /** Identified successor user. Set on assignment; transitions interview into handover phase. */
    successorUserId: text('successor_user_id'),
    /** Timestamp when successor explicitly acknowledged the handover. */
    successorAcceptedAt: timestamp('successor_accepted_at', { withTimezone: true }),
    /** Auto-derived rigor tier (high/medium/low) — drives sign-off preconditions. */
    complexityTier: exitInterviewComplexityTierEnum('complexity_tier').notNull().default('medium'),
    /** Scheduled date of the 21-day post-publication knowledge follow-up. */
    followupDueAt: timestamp('followup_due_at', { withTimezone: true }),
    followupCompletedAt: timestamp('followup_completed_at', { withTimezone: true }),
    followupNotes: text('followup_notes'),
    /** Manager sign-off — closes the handover loop and transitions to handover_complete. */
    managerSignedOffAt: timestamp('manager_signed_off_at', { withTimezone: true }),
    managerSignedOffBy: text('manager_signed_off_by'),
    // --- end Handover Lifecycle Layer ---

    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgStatusIdx: index('idx_exit_interviews_org_status').on(table.organizationId, table.status),
    orgCreatedIdx: index('idx_exit_interviews_org_created').on(table.organizationId, table.createdAt),
    publishedIdx: index('idx_exit_interviews_published').on(table.publishedAt),
    kbIdx: index('idx_exit_interviews_knowledge_base').on(table.knowledgeBaseId),
    sensitivityIdx: index('idx_exit_interviews_sensitivity').on(table.sensitivityLevel),
    indexingStatusIdx: index('idx_exit_interviews_indexing_status').on(table.indexingStatus),
    riskScoreIdx: index('idx_exit_interviews_risk_score').on(table.continuityRiskScore),
    successorIdx: index('idx_exit_interviews_successor').on(table.successorUserId),
    followupDueIdx: index('idx_exit_interviews_followup_due').on(table.followupDueAt),
    complexityIdx: index('idx_exit_interviews_complexity').on(table.complexityTier),
  }),
);

/**
 * Handover session — concrete walkthrough/shadow/Q&A/recording-review event
 * scheduled between the retiring officer and the identified successor.
 * Completion of ≥1 session is required for sign-off when complexityTier='high'.
 */
export const exitInterviewSessions = pgTable(
  'exit_interview_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => exitInterviews.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    sessionType: exitInterviewSessionTypeEnum('session_type').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),

    facilitatorUserId: text('facilitator_user_id').notNull(),
    successorUserId: text('successor_user_id'),

    recordingUrl: text('recording_url'),
    notes: text('notes'),

    completedAt: timestamp('completed_at', { withTimezone: true }),

    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    interviewIdx: index('idx_exit_interview_sessions_interview').on(table.interviewId),
    orgIdx: index('idx_exit_interview_sessions_org').on(table.organizationId),
    scheduledIdx: index('idx_exit_interview_sessions_scheduled').on(table.scheduledAt),
  }),
);

export const exitInterviewDocuments = pgTable(
  'exit_interview_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => exitInterviews.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    fileUrl: text('file_url').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes'),
    transcriptText: text('transcript_text'),

    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    interviewIdx: index('idx_exit_interview_documents_interview').on(table.interviewId),
    orgIdx: index('idx_exit_interview_documents_org').on(table.organizationId),
  }),
);

export const exitInterviewEvents = pgTable(
  'exit_interview_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interviewId: uuid('interview_id')
      .notNull()
      .references(() => exitInterviews.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    eventType: exitInterviewEventTypeEnum('event_type').notNull(),
    notes: text('notes'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),

    actorUserId: text('actor_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    interviewIdx: index('idx_exit_interview_events_interview').on(table.interviewId),
    orgIdx: index('idx_exit_interview_events_org').on(table.organizationId),
    eventTypeIdx: index('idx_exit_interview_events_type').on(table.eventType),
    createdIdx: index('idx_exit_interview_events_created').on(table.createdAt),
  }),
);

export type ExitInterview = typeof exitInterviews.$inferSelect;
export type NewExitInterview = typeof exitInterviews.$inferInsert;
export type ExitInterviewDocument = typeof exitInterviewDocuments.$inferSelect;
export type ExitInterviewEvent = typeof exitInterviewEvents.$inferSelect;
export type ExitInterviewSession = typeof exitInterviewSessions.$inferSelect;
export type NewExitInterviewSession = typeof exitInterviewSessions.$inferInsert;
export type ExitInterviewSensitivityLevel = (typeof exitInterviewSensitivityEnum.enumValues)[number];
export type ExitInterviewIndexingStatus = (typeof exitInterviewIndexingStatusEnum.enumValues)[number];
export type ExitInterviewSessionType = (typeof exitInterviewSessionTypeEnum.enumValues)[number];
export type ExitInterviewComplexityTier = (typeof exitInterviewComplexityTierEnum.enumValues)[number];
