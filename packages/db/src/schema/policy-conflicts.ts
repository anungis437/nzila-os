/**
 * Policy Conflicts — Detected governance conflicts between policies.
 *
 * The conflict analyzer runs eagerly on lifecycle transitions (publish/activate)
 * and stores detected conflicts here. Critical-severity conflicts BLOCK the
 * transition (fail-closed). Lower severity conflicts are surfaced as warnings.
 *
 * Conflicts are resolved by updating is_active = false and recording
 * the resolution in resolved_by / resolution_notes. The detection event
 * is also recorded in policy_governance_events.
 */
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { governedPolicies } from './governed-policies'

// ── Enums ────────────────────────────────────────────────────────────────────

export const policyConflictTypeEnum = pgEnum('policy_conflict_type', [
  'workflow_binding',       // two+ active policies claim the same workflowId
  'contradictory_behavior', // same workflow, different decision for same role/action
  'overlapping_domain',     // overlapping operational scope across domains
  'cyclic_approval',        // A requires B's approval; B requires A's approval
  'ambiguous_actor',        // actor-role resolution is ambiguous across policies
  'duplicate_ownership',    // two policies both claim ownership of the same workflow
])

export const policyConflictSeverityEnum = pgEnum('policy_conflict_severity', [
  'info',
  'warning',
  'error',
  'critical', // blocks lifecycle transition (fail-closed)
])

// ── policy_conflicts ──────────────────────────────────────────────────────────

export const policyConflicts = pgTable(
  'policy_conflicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The two policies in conflict (policy_id_b is NULL for self-conflicts)
    policyIdA: uuid('policy_id_a')
      .notNull()
      .references(() => governedPolicies.id),
    policyIdB: uuid('policy_id_b')
      .references(() => governedPolicies.id),

    conflictType: policyConflictTypeEnum('conflict_type').notNull(),
    severity: policyConflictSeverityEnum('severity').notNull(),

    /** Human-readable description of the conflict. */
    description: text('description').notNull(),
    /** Machine-readable structured detail (type-specific). */
    conflictDetail: jsonb('conflict_detail').notNull().default({}),

    /** WorkflowIDs involved in the conflict (for workflow_binding / contradictory_behavior). */
    affectedWorkflowIds: text('affected_workflow_ids').array().notNull().default([]),

    // Status
    isActive: boolean('is_active').notNull().default(true),

    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    detectedBy: text('detected_by'), // 'system' or user ID
    detectedDuringTransition: text('detected_during_transition'), // e.g. 'approved→published'

    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    resolutionNotes: text('resolution_notes'),
  },
  (table) => [
    index('policy_conflicts_a_idx').on(table.policyIdA),
    index('policy_conflicts_b_idx').on(table.policyIdB),
    index('policy_conflicts_active_idx').on(table.isActive, table.severity),
    index('policy_conflicts_severity_idx').on(table.severity, table.detectedAt),
  ],
)

export type PolicyConflictRow = typeof policyConflicts.$inferSelect
export type NewPolicyConflictRow = typeof policyConflicts.$inferInsert
