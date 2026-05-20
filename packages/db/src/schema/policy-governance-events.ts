/**
 * Policy Governance Events — Durable, append-only governance lifecycle ledger.
 *
 * This is SEPARATE from `decision_events` (authorization outcomes).
 *
 * decision_events answers: "What did the platform authorize?"
 * policy_governance_events answers: "What happened to a policy?"
 *
 * These are distinct audit domains. Do not conflate them.
 *
 * Every policy lifecycle action is recorded here:
 *  - creation, review, approval, publication, activation
 *  - supersession, deprecation, revocation, archival
 *  - replay execution, conflict detection, signing, rollback
 *
 * Rows are IMMUTABLE: UPDATE and DELETE are blocked by DB trigger.
 */
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { governedPolicies } from './governed-policies'

// ── Event type enum ──────────────────────────────────────────────────────────

export const policyGovernanceEventTypeEnum = pgEnum('policy_governance_event_type', [
  'policy.created',
  'policy.submitted_for_review',
  'policy.review_started',
  'policy.approval_requested',
  'policy.approved',
  'policy.rejected',
  'policy.published',
  'policy.activated',
  'policy.superseded',
  'policy.deprecated',
  'policy.revoked',
  'policy.archived',
  'policy.signed',
  'policy.integrity_verified',
  'policy.integrity_failed',
  'policy.replay_executed',
  'policy.conflict_detected',
  'policy.conflict_resolved',
  'policy.rollback_initiated',
  'policy.approval_delegated',
  'policy.snapshot_taken',
])

// ── policy_governance_events ──────────────────────────────────────────────────

export const policyGovernanceEvents = pgTable(
  'policy_governance_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Scope
    /**
     * Org scope. NULL = platform-wide event (e.g. platform-level policy change).
     */
    orgId: uuid('org_id'),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => governedPolicies.id),
    /** Semver of the policy at event time. Redundant but denormalized for replay. */
    policyVersion: text('policy_version').notNull(),
    /** Governance domain (denormalized for efficient filtering). */
    domain: text('domain').notNull(),

    // Event taxonomy
    eventType: policyGovernanceEventTypeEnum('event_type').notNull(),

    // Actor
    actorUserId: text('actor_user_id'),
    actorRole: text('actor_role'),

    // State transition (if applicable)
    previousState: text('previous_state'),
    nextState: text('next_state'),

    // Integrity snapshot at event time
    /** Content hash of the policy at the moment this event was recorded. */
    contentHash: text('content_hash'),

    // Payload — event-type-specific structured data
    payload: jsonb('payload').notNull().default({}),

    // Correlation
    correlationId: text('correlation_id'),
    traceId: text('trace_id'),

    // Immutable timestamp — set at INSERT, never changed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pge_policy_idx').on(table.policyId, table.createdAt),
    index('pge_event_type_idx').on(table.eventType, table.createdAt),
    index('pge_domain_idx').on(table.domain, table.createdAt),
    index('pge_org_idx').on(table.orgId, table.createdAt),
    index('pge_actor_idx').on(table.actorUserId),
    index('pge_correlation_idx').on(table.correlationId),
    index('pge_created_idx').on(table.createdAt),
  ],
)

export type PolicyGovernanceEventRow = typeof policyGovernanceEvents.$inferSelect
export type NewPolicyGovernanceEventRow = typeof policyGovernanceEvents.$inferInsert
