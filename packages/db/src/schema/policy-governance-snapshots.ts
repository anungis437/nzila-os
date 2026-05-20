/**
 * Policy Governance Snapshots — Point-in-time topology materialization.
 *
 * Snapshots are the O(1) governance state reconstruction layer.
 *
 * 3-tier governance memory model:
 *   policy_governance_events    — chronological truth (O(n) replay)
 *   policy_governance_snapshots — point-in-time topology recovery (O(1))
 *   policy_replay_results       — counterfactual governance analysis
 *
 * The snapshot captures the full governance topology at a moment in time:
 *  - All active/published policies and their workflow bindings
 *  - Active conflict summary with severity scores
 *  - Open approval chain topology and completion state
 *  - Policy lineage state (supersession chains, version counts)
 *  - Most recent replay drift summary per domain
 *
 * Rows are IMMUTABLE: UPDATE and DELETE are blocked by DB trigger.
 * Never mutate a snapshot — take a new one instead.
 *
 * Auto-triggered on:
 *  - every policy.activated event
 *  - every policy.conflict_detected event
 *  - every policy.revoked event
 *  - daily at midnight UTC (scheduled)
 *  - any manual request
 */
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const snapshotTriggerTypeEnum = pgEnum('snapshot_trigger_type', [
  'scheduled',
  'on_publish',
  'on_activation',
  'on_conflict',
  'on_revocation',
  'manual',
])

// ── policy_governance_snapshots ───────────────────────────────────────────────

export const policyGovernanceSnapshots = pgTable(
  'policy_governance_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Org scope. NULL = platform-wide snapshot covering all orgs.
     * Org-scoped snapshots include only policies visible to that org.
     */
    orgId: uuid('org_id'),

    /**
     * SHA-256 hash of the canonical JSON of the full snapshot payload.
     * Used for integrity verification of the snapshot itself.
     */
    snapshotHash: text('snapshot_hash').notNull(),

    triggerType: snapshotTriggerTypeEnum('trigger_type').notNull(),
    /** The governance event that triggered this snapshot (if event-driven). */
    triggerEventId: uuid('trigger_event_id'),

    /**
     * All active/published governed_policies at snapshot time.
     * Shape: Array<{ id, policyFamilyId, semver, domain, lifecycleStatus,
     *   workflowBindings, contentHash, riskClassification, effectiveFrom, effectiveUntil }>
     */
    activePolicyGraph: jsonb('active_policy_graph').notNull().default([]),

    /**
     * All active policy_conflicts at snapshot time.
     * Shape: Array<{ id, policyIdA, policyIdB, conflictType, severity,
     *   description, affectedWorkflowIds }>
     */
    conflictSummary: jsonb('conflict_summary').notNull().default([]),

    /**
     * Most recent completed replay session per domain at snapshot time.
     * Shape: Record<domain, { sessionId, replayType, driftDetected,
     *   changedOutcomeCount, decisionCountReplayed, completedAt }>
     */
    replayDriftSummary: jsonb('replay_drift_summary').notNull().default({}),

    /**
     * All open approval chains and their completion state at snapshot time.
     * Shape: Array<{ chainId, policyId, policyVersion, chainType,
     *   requiredApprovals, approvedCount, status }>
     */
    approvalTopology: jsonb('approval_topology').notNull().default([]),

    /**
     * Policy version lineage at snapshot time.
     * Shape: Array<{ policyFamilyId, currentVersionId, currentSemver,
     *   versionCount, supersessionChain: string[] }>
     */
    lineageState: jsonb('lineage_state').notNull().default([]),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    generatedByUserId: text('generated_by_user_id'),
  },
  (table) => [
    index('pgs_org_generated_idx').on(table.orgId, table.generatedAt),
    index('pgs_generated_idx').on(table.generatedAt),
    index('pgs_trigger_idx').on(table.triggerType, table.generatedAt),
    index('pgs_hash_idx').on(table.snapshotHash),
  ],
)

export type PolicyGovernanceSnapshotRow = typeof policyGovernanceSnapshots.$inferSelect
export type NewPolicyGovernanceSnapshotRow = typeof policyGovernanceSnapshots.$inferInsert
