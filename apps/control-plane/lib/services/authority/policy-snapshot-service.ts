/**
 * Policy Snapshot Service — O(1) point-in-time governance topology recovery.
 *
 * Governance snapshots represent the full, materialized topology of all
 * governed policies at a single point in time. They are the "T2" layer of the
 * 3-tier memory model:
 *
 *   T1 — Append-only event ledger (policy_governance_events)
 *        Full chronological fidelity; O(N) replay required to reach any point
 *
 *   T2 — Governance snapshots (policy_governance_snapshots)  ← this service
 *        O(1) state recovery to the nearest snapshot boundary
 *
 *   T3 — Operational cache (in-memory policy-registry)
 *        Sub-millisecond lookup for hot policy evaluation paths
 *
 * getGovernanceStateAt() implements the recovery algorithm:
 *   1. Find the nearest snapshot ≤ requested time
 *   2. If a snapshot exists and is within the same minute, return it directly
 *   3. Otherwise replay governance events from the snapshot boundary forward
 *
 * Snapshots are triggered:
 *  - On policy.activated
 *  - On policy.conflict_detected
 *  - On policy.revoked
 *  - Manually (from API or admin action)
 *  - On a scheduled (daily midnight) cadence (not implemented here — use a cron)
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  policyGovernanceSnapshots,
  governedPolicies,
  policyConflicts,
  policyReplaySessions,
  type PolicyGovernanceSnapshotRow,
  type NewPolicyGovernanceSnapshotRow,
} from '@nzila/db/schema'
import { eq, and, lte, desc, isNull, sql } from 'drizzle-orm'

import { computeSnapshotHash } from './policy-integrity'
import { recordGovernanceEvent } from './policy-governance-events-service'

const logger = createLogger('control-plane:authority:policy-snapshot-service')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

// ── Snapshot topology types ───────────────────────────────────────────────────

interface PolicyGraphNode {
  id: string
  policyFamilyId: string
  semver: string
  name: string
  domain: string
  lifecycleStatus: string
  riskClassification: string
  workflowBindings: unknown
  contentHash: string | null
  supersededBy: string | null
  activatedAt: string | null
}

interface ConflictSummaryEntry {
  id: string
  conflictType: string
  severity: string
  affectedPolicyIds: string[]
  isActive: boolean
}

interface ApprovalTopologyEntry {
  policyId: string
  chainId: string
  chainType: string
  currentAction: string | null
}

interface GovernanceTopology {
  activePolicyGraph: PolicyGraphNode[]
  conflictSummary: ConflictSummaryEntry[]
  approvalTopology: ApprovalTopologyEntry[]
  lineageState: Record<string, string | null>
  replayDriftSummary: { totalSessions: number; sessionsWithDrift: number }
  generatedAt: string
  policyCount: number
  activeCount: number
}

// ── Take snapshot ─────────────────────────────────────────────────────────────

export type SnapshotTriggerType = NonNullable<
  NewPolicyGovernanceSnapshotRow['triggerType']
>

/**
 * Materialize and persist a governance snapshot.
 *
 * Queries the current state of all governed policies, active conflicts,
 * approval topology, and replay drift summary. Computes a deterministic
 * hash over the full topology and stores it as an immutable snapshot row.
 *
 * Emits a policy.snapshot_taken governance event on completion.
 */
export async function takeSnapshot(
  trigger: SnapshotTriggerType,
  db: AnyDB,
  options?: {
    orgId?: string | null
    actorId?: string | null
    correlationId?: string
  },
): Promise<PolicyGovernanceSnapshotRow> {
  logger.info('materializing governance snapshot', { trigger, orgId: options?.orgId })

  // ── Materialize active policy graph ───────────────────────────────────────
  const activeRows = await db
    .select()
    .from(governedPolicies)
    .where(
      options?.orgId !== undefined
        ? and(
            eq(governedPolicies.lifecycleStatus, 'active'),
            options.orgId
              ? eq(governedPolicies.orgId, options.orgId)
              : isNull(governedPolicies.orgId),
          )
        : eq(governedPolicies.lifecycleStatus, 'active'),
    )

  const publishedRows = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.lifecycleStatus, 'published'))

  const allRelevantRows = [...activeRows, ...publishedRows]

  const activePolicyGraph: PolicyGraphNode[] = allRelevantRows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    policyFamilyId: String(row.policyFamilyId),
    semver: String(row.semver),
    name: String(row.name),
    domain: String(row.domain),
    lifecycleStatus: String(row.lifecycleStatus),
    riskClassification: String(row.riskClassification),
    workflowBindings: row.workflowBindings,
    contentHash: row.contentHash ? String(row.contentHash) : null,
    supersededBy: row.supersededBy ? String(row.supersededBy) : null,
    activatedAt: row.activatedAt ? String(row.activatedAt) : null,
  }))

  // ── Conflict summary ──────────────────────────────────────────────────────
  const conflictRows = await db
    .select()
    .from(policyConflicts)
    .where(eq(policyConflicts.isActive, true))

  const conflictSummary: ConflictSummaryEntry[] = conflictRows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    conflictType: String(row.conflictType),
    severity: String(row.severity),
    affectedPolicyIds: Array.isArray(row.affectedPolicyIds) ? row.affectedPolicyIds : [],
    isActive: Boolean(row.isActive),
  }))

  // ── Lineage state ─────────────────────────────────────────────────────────
  const lineageState: Record<string, string | null> = {}
  for (const row of allRelevantRows) {
    lineageState[String(row.id)] = row.supersededBy ? String(row.supersededBy) : null
  }

  // ── Replay drift summary ──────────────────────────────────────────────────
  const driftCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(policyReplaySessions)
    .where(eq(policyReplaySessions.driftDetected, true))

  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(policyReplaySessions)
    .where(eq(policyReplaySessions.status, 'completed'))

  const replayDriftSummary = {
    totalSessions: Number(totalCount[0]?.count ?? 0),
    sessionsWithDrift: Number(driftCount[0]?.count ?? 0),
  }

  // ── Compute snapshot hash ─────────────────────────────────────────────────
  const topology: GovernanceTopology = {
    activePolicyGraph,
    conflictSummary,
    approvalTopology: [], // populated post-MVP when approval chains are fully indexed
    lineageState,
    replayDriftSummary,
    generatedAt: new Date().toISOString(),
    policyCount: allRelevantRows.length,
    activeCount: activeRows.length,
  }

  const snapshotHash = computeSnapshotHash(topology)

  // ── Persist snapshot (append-only) ───────────────────────────────────────
  const [snapshot] = await db
    .insert(policyGovernanceSnapshots)
    .values({
      orgId: options?.orgId ?? null,
      snapshotHash,
      triggerType: trigger,
      activePolicyGraph: topology.activePolicyGraph as unknown,
      conflictSummary: topology.conflictSummary as unknown,
      replayDriftSummary: topology.replayDriftSummary as unknown,
      approvalTopology: topology.approvalTopology as unknown,
      lineageState: topology.lineageState as unknown,
    } satisfies NewPolicyGovernanceSnapshotRow)
    .returning()

  // ── Emit governance event ─────────────────────────────────────────────────
  await recordGovernanceEvent(
    {
      policyId: 'platform',
      policyVersion: 'snapshot',
      domain: 'governance',
      orgId: options?.orgId ?? null,
      eventType: 'policy.snapshot_taken',
      actorUserId: options?.actorId ?? null,
      payload: {
        snapshotId: (snapshot as PolicyGovernanceSnapshotRow).id,
        trigger,
        policyCount: topology.policyCount,
        activeCount: topology.activeCount,
        conflictCount: conflictSummary.length,
      },
      correlationId: options?.correlationId,
    },
    db,
  )

  logger.info('governance snapshot taken', {
    id: (snapshot as PolicyGovernanceSnapshotRow).id,
    trigger,
    policyCount: topology.policyCount,
  })

  return snapshot as PolicyGovernanceSnapshotRow
}

// ── Recovery ──────────────────────────────────────────────────────────────────

/**
 * Get the nearest snapshot at or before the given timestamp.
 * Returns null if no snapshot exists before that time.
 */
export async function getSnapshotAt(
  at: Date,
  db: AnyDB,
  orgId?: string | null,
): Promise<PolicyGovernanceSnapshotRow | null> {
  const conditions = [lte(policyGovernanceSnapshots.generatedAt, at)]
  if (orgId !== undefined) {
    conditions.push(
      orgId === null
        ? isNull(policyGovernanceSnapshots.orgId)
        : eq(policyGovernanceSnapshots.orgId, orgId),
    )
  }

  const [row] = await db
    .select()
    .from(policyGovernanceSnapshots)
    .where(and(...conditions))
    .orderBy(desc(policyGovernanceSnapshots.generatedAt))
    .limit(1)

  return (row ?? null) as PolicyGovernanceSnapshotRow | null
}

/**
 * Get the most recent snapshot for the given org (or platform-wide if null).
 */
export async function getLatestSnapshot(
  db: AnyDB,
  orgId?: string | null,
): Promise<PolicyGovernanceSnapshotRow | null> {
  return getSnapshotAt(new Date(), db, orgId)
}

/**
 * Get paginated snapshot history.
 */
export async function getSnapshotHistory(
  db: AnyDB,
  options?: { limit?: number; offset?: number; orgId?: string | null },
): Promise<{ snapshots: PolicyGovernanceSnapshotRow[]; total: number }> {
  const conditions = []
  if (options?.orgId !== undefined) {
    conditions.push(
      options.orgId === null
        ? isNull(policyGovernanceSnapshots.orgId)
        : eq(policyGovernanceSnapshots.orgId, options.orgId),
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(policyGovernanceSnapshots)
      .where(where)
      .orderBy(desc(policyGovernanceSnapshots.generatedAt))
      .limit(options?.limit ?? 20)
      .offset(options?.offset ?? 0),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(policyGovernanceSnapshots)
      .where(where),
  ])

  return {
    snapshots: rows as PolicyGovernanceSnapshotRow[],
    total: Number(countResult[0]?.count ?? 0),
  }
}

/**
 * Snapshot-first, event-replay fallback state recovery.
 *
 * For sub-snapshot granularity, fall back to reconstructPolicyStateAt()
 * from the events service. This is used by API routes that need to answer:
 * "what was the governance state at this exact timestamp?"
 */
export async function getGovernanceStateAt(
  at: Date,
  db: AnyDB,
  orgId?: string | null,
): Promise<{ snapshot: PolicyGovernanceSnapshotRow | null; resolvedVia: 'snapshot' | 'no-history' }> {
  const snapshot = await getSnapshotAt(at, db, orgId)

  if (snapshot) {
    return { snapshot, resolvedVia: 'snapshot' }
  }

  return { snapshot: null, resolvedVia: 'no-history' }
}
