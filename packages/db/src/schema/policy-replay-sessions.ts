/**
 * Policy Replay Sessions & Results — Non-destructive governance replay.
 *
 * The replay engine re-evaluates historical decision_events against a
 * target policy version to detect governance drift, validate candidate
 * policies, and generate explainability evidence.
 *
 * Replay is ALWAYS non-destructive:
 *  - No re-fired authorization effects
 *  - Writes to policy_replay_results only
 *  - Emits a policy.replay_executed governance event on completion
 *
 * The resulting drift dimensions answer:
 *  "What would have been decided differently under this policy version?"
 */
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { governedPolicies } from './governed-policies'

// ── Enums ────────────────────────────────────────────────────────────────────

export const replayTypeEnum = pgEnum('replay_type', [
  'historical',   // replay existing decisions against the same policy version (integrity check)
  'candidate',    // replay existing decisions against a new candidate policy version
  'drift_check',  // detect governance drift between two consecutive active versions
])

export const replaySessionStatusEnum = pgEnum('replay_session_status', [
  'pending',
  'running',
  'completed',
  'failed',
])

// ── policy_replay_sessions ────────────────────────────────────────────────────

export const policyReplaySessions = pgTable(
  'policy_replay_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    orgId: uuid('org_id'),
    initiatorUserId: text('initiator_user_id').notNull(),
    initiatorRole: text('initiator_role').notNull(),

    replayType: replayTypeEnum('replay_type').notNull(),

    // Source: the policy version whose historical decisions are replayed
    sourcePolicyId: uuid('source_policy_id')
      .notNull()
      .references(() => governedPolicies.id),
    sourcePolicyVersion: text('source_policy_version').notNull(),
    sourcePolicyHash: text('source_policy_hash'),

    // Target: the policy version to replay decisions against
    // NULL = same as source (integrity check)
    targetPolicyId: uuid('target_policy_id')
      .references(() => governedPolicies.id),
    targetPolicyVersion: text('target_policy_version'),
    targetPolicyHash: text('target_policy_hash'),

    // Scope filters
    /** ISO timestamp lower bound for decision_events to include. */
    fromDate: timestamp('from_date', { withTimezone: true }),
    /** ISO timestamp upper bound for decision_events to include. */
    toDate: timestamp('to_date', { withTimezone: true }),
    /** Filter replay to a specific domain. NULL = all domains. */
    domainFilter: text('domain_filter'),

    // Execution state
    status: replaySessionStatusEnum('status').notNull().default('pending'),
    decisionCountReplayed: integer('decision_count_replayed').notNull().default(0),
    changedOutcomeCount: integer('changed_outcome_count').notNull().default(0),
    driftDetected: boolean('drift_detected').notNull().default(false),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('replay_sessions_org_idx').on(table.orgId, table.createdAt),
    index('replay_sessions_source_idx').on(table.sourcePolicyId),
    index('replay_sessions_target_idx').on(table.targetPolicyId),
    index('replay_sessions_status_idx').on(table.status),
  ],
)

export type PolicyReplaySessionRow = typeof policyReplaySessions.$inferSelect
export type NewPolicyReplaySessionRow = typeof policyReplaySessions.$inferInsert

// ── policy_replay_results ─────────────────────────────────────────────────────
//
// One row per decision_event replayed. Append-only.

export const policyReplayResults = pgTable(
  'policy_replay_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => policyReplaySessions.id),

    // Reference to the original decision event
    originalDecisionEventId: text('original_decision_event_id').notNull(),
    originalEventCreatedAt: timestamp('original_event_created_at', { withTimezone: true }),

    // Original outcome
    originalDecision: text('original_decision').notNull(),
    originalReasonCode: text('original_reason_code').notNull(),
    originalApproverRoles: text('original_approver_roles').array(),

    // Replayed outcome
    replayedDecision: text('replayed_decision').notNull(),
    replayedReasonCode: text('replayed_reason_code').notNull(),
    replayedApproverRoles: text('replayed_approver_roles').array(),

    // Drift analysis
    driftDetected: boolean('drift_detected').notNull().default(false),
    /**
     * Which dimensions changed between original and replayed outcome.
     * e.g. ["decision", "reason_code", "approver_roles"]
     */
    driftDimensions: jsonb('drift_dimensions').notNull().default([]),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('replay_results_session_idx').on(table.sessionId),
    index('replay_results_drift_idx').on(table.sessionId, table.driftDetected),
    index('replay_results_original_idx').on(table.originalDecisionEventId),
  ],
)

export type PolicyReplayResultRow = typeof policyReplayResults.$inferSelect
export type NewPolicyReplayResultRow = typeof policyReplayResults.$inferInsert
