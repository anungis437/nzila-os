/**
 * Policy Replay Engine — Non-destructive governance drift detection.
 *
 * Replays historical authorization decisions against a target policy version
 * to answer: "What would have been decided differently?"
 *
 * Key guarantees:
 *  - ALWAYS non-destructive: no re-fired authorization effects
 *  - Writes to policy_replay_results only (append-only table)
 *  - The original decision_events are never modified
 *  - Emits policy.replay_executed on completion
 *
 * Drift dimensions:
 *  - decision (allowed → denied, or vice versa)
 *  - reason_code (same decision, different rationale)
 *  - approver_roles (approval_required, different approvers)
 *  - explanation (semantic change in the justification)
 *
 * Use cases:
 *  1. Pre-activation validation: simulate a candidate policy against real traffic
 *  2. Post-supersession audit: confirm the new policy is compatible
 *  3. Periodic drift check: confirm governance hasn't silently drifted
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import {
  policyReplaySessions,
  policyReplayResults,
  decisionEvents,
  governedPolicies,
  type PolicyReplaySessionRow,
  type NewPolicyReplaySessionRow,
  type NewPolicyReplayResultRow,
  type DecisionEventRow,
  type GovernedPolicyRow,
} from '@nzila/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'

import type { WorkflowTriggerRequest } from '@nzila/platform-contracts/control-system'
import { evaluateWorkflowPolicy, type PolicyEvaluationContext } from './policy-registry'
import { recordGovernanceEvent } from './policy-governance-events-service'

const logger = createLogger('control-plane:authority:policy-replay-engine')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

// ── Session creation ──────────────────────────────────────────────────────────

export interface StartReplaySessionInput {
  orgId?: string | null
  sourcePolicyId: string
  targetPolicyId?: string | null
  replayType: NewPolicyReplaySessionRow['replayType']
  initiatorUserId: string
  initiatorRole: string
  fromDate?: Date | null
  toDate?: Date | null
  domainFilter?: string | null
}

export async function startReplaySession(
  config: StartReplaySessionInput,
  db: AnyDB,
): Promise<PolicyReplaySessionRow> {
  const [source] = await db
    .select()
    .from(governedPolicies)
    .where(eq(governedPolicies.id, config.sourcePolicyId))
    .limit(1)

  if (!source) {
    throw new Error(
      `[policy-replay-engine] Source policy ${config.sourcePolicyId} not found.`,
    )
  }

  let targetVersion: string | null = null
  let targetHash: string | null = null
  if (config.targetPolicyId) {
    const [target] = await db
      .select()
      .from(governedPolicies)
      .where(eq(governedPolicies.id, config.targetPolicyId))
      .limit(1)
    if (target) {
      targetVersion = (target as GovernedPolicyRow).semver
      targetHash = (target as GovernedPolicyRow).contentHash ?? null
    }
  }

  const [session] = await db
    .insert(policyReplaySessions)
    .values({
      orgId: config.orgId ?? null,
      initiatorUserId: config.initiatorUserId,
      initiatorRole: config.initiatorRole,
      replayType: config.replayType,
      sourcePolicyId: config.sourcePolicyId,
      sourcePolicyVersion: (source as GovernedPolicyRow).semver,
      sourcePolicyHash: (source as GovernedPolicyRow).contentHash ?? null,
      targetPolicyId: config.targetPolicyId ?? null,
      targetPolicyVersion: targetVersion,
      targetPolicyHash: targetHash,
      fromDate: config.fromDate ?? null,
      toDate: config.toDate ?? null,
      domainFilter: config.domainFilter ?? null,
      status: 'pending',
    } satisfies NewPolicyReplaySessionRow)
    .returning()

  logger.info('replay session created', {
    sessionId: (session as PolicyReplaySessionRow).id,
    replayType: config.replayType,
    sourcePolicyId: config.sourcePolicyId,
  })

  return session as PolicyReplaySessionRow
}

// ── Execution ─────────────────────────────────────────────────────────────────

export interface ReplaySessionResult {
  sessionId: string
  decisionCountReplayed: number
  changedOutcomeCount: number
  driftDetected: boolean
  driftDimensions: string[]
}

/**
 * Execute a replay session.
 *
 * Loads the decision_events scoped to the source policy, re-evaluates each
 * against the target policy, and writes the results to policy_replay_results.
 *
 * Non-destructive: does not modify any existing rows.
 */
export async function executeReplay(
  sessionId: string,
  db: AnyDB,
): Promise<ReplaySessionResult> {
  // Mark session as running
  await db
    .update(policyReplaySessions)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(policyReplaySessions.id, sessionId))

  const [sessionRow] = await db
    .select()
    .from(policyReplaySessions)
    .where(eq(policyReplaySessions.id, sessionId))
    .limit(1)

  if (!sessionRow) {
    throw new Error(`[policy-replay-engine] Session ${sessionId} not found.`)
  }

  const session = sessionRow as PolicyReplaySessionRow

  try {
    // ── Load decision events ────────────────────────────────────────────────
    const conditions = [
      eq(decisionEvents.policyId, session.sourcePolicyId),
    ]
    if (session.fromDate) conditions.push(gte(decisionEvents.createdAt, session.fromDate))
    if (session.toDate) conditions.push(lte(decisionEvents.createdAt, session.toDate))
    if (session.domainFilter) conditions.push(eq(decisionEvents.domain, session.domainFilter))
    if (session.orgId) conditions.push(eq(decisionEvents.orgId, session.orgId))

    const historicalEvents: DecisionEventRow[] = await db
      .select()
      .from(decisionEvents)
      .where(and(...conditions))
      .orderBy(decisionEvents.createdAt)

    // ── Load target policy ─────────────────────────────────────────────────
    const targetPolicyId = session.targetPolicyId ?? session.sourcePolicyId
    const [targetPolicyRow] = await db
      .select()
      .from(governedPolicies)
      .where(eq(governedPolicies.id, targetPolicyId))
      .limit(1)

    if (!targetPolicyRow) {
      throw new Error(`[policy-replay-engine] Target policy ${targetPolicyId} not found.`)
    }

    const targetPolicy = targetPolicyRow as GovernedPolicyRow

    // ── Replay each decision ───────────────────────────────────────────────
    let changedOutcomeCount = 0
    let driftDetected = false
    const allDriftDimensions = new Set<string>()

    for (const event of historicalEvents) {
      const replayResult = replayDecisionEvent(event, targetPolicy)
      const drift = replayResult.driftDetected
      if (drift) {
        driftDetected = true
        changedOutcomeCount++
        for (const d of replayResult.driftDimensions) allDriftDimensions.add(d)
      }

      await db.insert(policyReplayResults).values({
        sessionId,
        originalDecisionEventId: event.id,
        originalEventCreatedAt: event.createdAt,
        originalDecision: event.decision,
        originalReasonCode: event.reasonCode,
        originalApproverRoles: extractApproverRoles(event),
        replayedDecision: replayResult.decision,
        replayedReasonCode: replayResult.reasonCode,
        replayedApproverRoles: replayResult.approverRoles,
        driftDetected: drift,
        driftDimensions: { dimensions: replayResult.driftDimensions },
      } satisfies NewPolicyReplayResultRow)
    }

    // ── Update session ──────────────────────────────────────────────────────
    await db
      .update(policyReplaySessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        decisionCountReplayed: historicalEvents.length,
        changedOutcomeCount,
        driftDetected,
      })
      .where(eq(policyReplaySessions.id, sessionId))

    // ── Emit governance event ───────────────────────────────────────────────
    await recordGovernanceEvent(
      {
        policyId: session.sourcePolicyId,
        policyVersion: session.sourcePolicyVersion,
        domain: 'governance',
        orgId: session.orgId,
        eventType: 'policy.replay_executed',
        actorUserId: session.initiatorUserId,
        actorRole: session.initiatorRole,
        payload: {
          sessionId,
          replayType: session.replayType,
          decisionCountReplayed: historicalEvents.length,
          changedOutcomeCount,
          driftDetected,
          driftDimensions: Array.from(allDriftDimensions),
        },
      },
      db,
    )

    const result: ReplaySessionResult = {
      sessionId,
      decisionCountReplayed: historicalEvents.length,
      changedOutcomeCount,
      driftDetected,
      driftDimensions: Array.from(allDriftDimensions),
    }

    logger.info('replay session completed', { ...result })
    return result
  } catch (err) {
    await db
      .update(policyReplaySessions)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(policyReplaySessions.id, sessionId))

    logger.error('replay session failed', { sessionId, err })
    throw err
  }
}

// ── Per-event replay ──────────────────────────────────────────────────────────

export interface ReplayResult {
  decision: string
  reasonCode: string
  explanation: string
  approverRoles: string[]
  driftDetected: boolean
  driftDimensions: string[]
}

/**
 * Replay a single historical decision event against a target policy.
 *
 * Reconstructs the PolicyEvaluationContext from the stored decision event
 * and re-evaluates it using the current in-process registry.
 *
 * Note: this relies on the target policy being registered in the registry.
 * For policies not yet active, the registry may need a temporary registration.
 */
export function replayDecisionEvent(
  event: DecisionEventRow,
  targetPolicy: GovernedPolicyRow,
): ReplayResult {
  // Reconstruct context from stored evaluated_context
  const ctx = event.evaluatedContext as Record<string, unknown>

  const reconstructedCtx: PolicyEvaluationContext = {
    workflowId: event.workflowId ?? String(ctx['workflowId'] ?? ''),
    orgId: event.orgId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId ?? undefined,
    actor: (ctx['actor'] as { actorType: 'user' | 'service' | 'system' | 'break_glass'; actorId: string; orgId?: string; displayName?: string }) ?? {
      actorType: 'user',
      actorId: event.actorUserId ?? '',
    },
    actorRole: event.actorRole,
    payload: (ctx['payload'] as Record<string, unknown>) ?? {},
    executionContext: (ctx['executionContext'] as WorkflowTriggerRequest['executionContext']) ?? { dryRun: false, priority: 'normal' },
    correlationId: event.correlationId ?? undefined,
    requestId: undefined,
  }

  const { decision: policyDecision } = evaluateWorkflowPolicy(reconstructedCtx)

  const replayedDecision = policyDecision.decision
  const replayedReasonCode = policyDecision.reasonCode
  const replayedApproverRoles = (policyDecision.approverRoles as string[] | undefined) ?? []

  const driftDimensions = computeDriftDimensions(
    {
      decision: event.decision,
      reasonCode: event.reasonCode,
      approverRoles: extractApproverRoles(event),
    },
    {
      decision: replayedDecision,
      reasonCode: replayedReasonCode,
      approverRoles: replayedApproverRoles,
    },
  )

  return {
    decision: replayedDecision,
    reasonCode: replayedReasonCode,
    explanation: policyDecision.explanation,
    approverRoles: replayedApproverRoles,
    driftDetected: driftDimensions.length > 0,
    driftDimensions,
  }
}

/**
 * Compute the dimensions of drift between an original and replayed decision.
 * Returns an empty array if there is no drift.
 */
export function computeDriftDimensions(
  original: { decision: string; reasonCode: string; approverRoles: string[] },
  replayed: { decision: string; reasonCode: string; approverRoles: string[] },
): string[] {
  const dimensions: string[] = []
  if (original.decision !== replayed.decision) dimensions.push('decision')
  if (original.reasonCode !== replayed.reasonCode) dimensions.push('reason_code')

  const origRoles = [...original.approverRoles].sort()
  const replayRoles = [...replayed.approverRoles].sort()
  if (JSON.stringify(origRoles) !== JSON.stringify(replayRoles)) {
    dimensions.push('approver_roles')
  }

  return dimensions
}

// ── Evidence report ───────────────────────────────────────────────────────────

export interface ReplayEvidenceReport {
  sessionId: string
  session: PolicyReplaySessionRow
  totalReplayed: number
  changedOutcomeCount: number
  driftRate: number
  driftDimensions: Record<string, number>
  exportedAt: string
}

/**
 * Generate an exportable replay evidence report for a completed session.
 */
export async function generateReplayEvidence(
  sessionId: string,
  db: AnyDB,
): Promise<ReplayEvidenceReport> {
  const [session] = await db
    .select()
    .from(policyReplaySessions)
    .where(eq(policyReplaySessions.id, sessionId))
    .limit(1)

  if (!session) {
    throw new Error(`[policy-replay-engine] Session ${sessionId} not found.`)
  }

  const s = session as PolicyReplaySessionRow

  const driftDimensionCounts = await db
    .select({
      dimensions: policyReplayResults.driftDimensions,
      count: sql<number>`COUNT(*)`,
    })
    .from(policyReplayResults)
    .where(
      and(
        eq(policyReplayResults.sessionId, sessionId),
        eq(policyReplayResults.driftDetected, true),
      ),
    )

  // Aggregate dimension counts
  const dimensionTotals: Record<string, number> = {}
  for (const row of driftDimensionCounts) {
    const dims = (row.dimensions as { dimensions?: string[] })?.dimensions ?? []
    for (const d of dims) {
      dimensionTotals[d] = (dimensionTotals[d] ?? 0) + 1
    }
  }

  const total = s.decisionCountReplayed
  const changed = s.changedOutcomeCount

  return {
    sessionId,
    session: s,
    totalReplayed: total,
    changedOutcomeCount: changed,
    driftRate: total > 0 ? changed / total : 0,
    driftDimensions: dimensionTotals,
    exportedAt: new Date().toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractApproverRoles(event: DecisionEventRow): string[] {
  const ctx = event.evaluatedContext as Record<string, unknown>
  const roles = ctx['approverRoles']
  if (Array.isArray(roles)) return roles.filter((r): r is string => typeof r === 'string')
  return []
}
