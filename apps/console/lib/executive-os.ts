/**
 * apps/console/lib/executive-os.ts
 *
 * Host-side glue for @nzila/executive-os:
 *   - resolves the executive org (Nzila) id
 *   - persists agent runs / insights / actions
 *   - approves / rejects actions
 *
 * Read-only by default. Material side effects (executing approved actions)
 * are dispatched separately by domain-specific runners (Phases 2–6).
 */
import { eq, and, desc } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import {
  orgs,
  executiveAgentRuns,
  executiveAgentInsights,
  executiveAgentActions,
  executiveRecommendations,
  executiveRecommendationFeedback,
} from '@nzila/db/schema'
import {
  type ExecutiveAgent,
  type AgentRequest,
  type AgentResult,
  enforceApprovalDefaults,
  approve as approveTransition,
  reject as rejectTransition,
  type ActionRecord,
} from '@nzila/executive-os'

export async function getExecutiveOrgId(): Promise<string | null> {
  try {
    const rows = await platformDb
      .select({ id: orgs.id, legalName: orgs.legalName })
      .from(orgs)
      .orderBy(orgs.createdAt)
    const nzila = rows.find((r) => r.legalName.toLowerCase().includes('nzila'))
    return nzila?.id ?? rows[0]?.id ?? null
  } catch {
    return null
  }
}

export interface PersistedRun {
  runId: string
  result: AgentResult
}

/**
 * Run an agent and persist the run + insights + actions atomically (per row;
 * platformDb may not provide tx in all environments).
 */
export async function runAndPersist<T>(
  agent: ExecutiveAgent<T>,
  req: AgentRequest<T>,
): Promise<PersistedRun> {
  const startedAt = new Date()
  let status: 'succeeded' | 'failed' = 'succeeded'
  let errorMessage: string | undefined
  let result: AgentResult = { summary: undefined, insights: [], actions: [] }

  try {
    result = await agent.run(req)
  } catch (err) {
    status = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()

  const [runRow] = await platformDb
    .insert(executiveAgentRuns)
    .values({
      orgId: req.orgId,
      agentKey: agent.key,
      agentVersion: agent.version,
      triggeredBy: req.triggeredBy ?? 'manual',
      actorId: req.actorId,
      correlationId: req.correlationId,
      status,
      durationMs,
      summary: result.summary ?? null,
      errorMessage: errorMessage ?? null,
      startedAt,
      completedAt,
    })
    .returning({ id: executiveAgentRuns.id })

  const runId = runRow!.id

  // Insights
  const insightIdByTitle = new Map<string, string>()
  for (const insight of result.insights) {
    const [row] = await platformDb
      .insert(executiveAgentInsights)
      .values({
        orgId: req.orgId,
        runId,
        agentKey: agent.key,
        domain: insight.domain,
        title: insight.title,
        body: insight.body,
        severity: insight.severity,
        confidence: insight.confidence,
        evidence: insight.evidence ?? null,
        consequenceIfIgnored: insight.consequenceIfIgnored ?? null,
        recommendedNextStep: insight.recommendedNextStep ?? null,
      })
      .returning({ id: executiveAgentInsights.id })
    if (row) {
      // Last-writer-wins if agents emit duplicate titles within a single run;
      // agents should emit distinct titles (or use a numeric suffix) to keep
      // the insightRef → id mapping deterministic.
      insightIdByTitle.set(insight.title, row.id)
    }
  }

  // Actions
  for (const raw of result.actions) {
    const action = enforceApprovalDefaults(raw)
    const linkedInsightId = action.insightRef
      ? insightIdByTitle.get(action.insightRef) ?? null
      : null
    await platformDb.insert(executiveAgentActions).values({
      orgId: req.orgId,
      runId,
      insightId: linkedInsightId,
      agentKey: agent.key,
      actionClass: action.actionClass,
      title: action.title,
      description: action.description ?? null,
      payload: action.payload ?? null,
      requiresApproval: action.requiresApproval,
      approvalState: action.requiresApproval ? 'pending' : 'auto',
      confidence: action.confidence,
      riskLevel: action.riskLevel,
      dueDate: action.dueDate ?? null,
    })
  }

  return { runId, result }
}

export interface PendingActionRow {
  id: string
  agentKey: string
  actionClass: 'insight' | 'recommendation' | 'draft_action'
  title: string
  description: string | null
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  approvalState: 'pending' | 'approved' | 'rejected' | 'auto' | 'expired'
  createdAt: Date
  dueDate: string | null
}

export async function listPendingActions(orgId: string, limit = 50): Promise<PendingActionRow[]> {
  const rows = await platformDb
    .select({
      id: executiveAgentActions.id,
      agentKey: executiveAgentActions.agentKey,
      actionClass: executiveAgentActions.actionClass,
      title: executiveAgentActions.title,
      description: executiveAgentActions.description,
      riskLevel: executiveAgentActions.riskLevel,
      confidence: executiveAgentActions.confidence,
      approvalState: executiveAgentActions.approvalState,
      createdAt: executiveAgentActions.createdAt,
      dueDate: executiveAgentActions.dueDate,
    })
    .from(executiveAgentActions)
    .where(and(eq(executiveAgentActions.orgId, orgId), eq(executiveAgentActions.approvalState, 'pending')))
    .orderBy(desc(executiveAgentActions.createdAt))
    .limit(limit)

  return rows as unknown as PendingActionRow[]
}

export async function approveAction(orgId: string, actionId: string, approverId: string): Promise<void> {
  const [current] = await platformDb
    .select({
      id: executiveAgentActions.id,
      actionClass: executiveAgentActions.actionClass,
      approvalState: executiveAgentActions.approvalState,
      executionStatus: executiveAgentActions.executionStatus,
      requiresApproval: executiveAgentActions.requiresApproval,
    })
    .from(executiveAgentActions)
    .where(and(eq(executiveAgentActions.orgId, orgId), eq(executiveAgentActions.id, actionId)))
    .limit(1)

  if (!current) throw new Error(`Action not found: ${actionId}`)

  const next = approveTransition(current as ActionRecord, { approverId })

  await platformDb
    .update(executiveAgentActions)
    .set({
      approvalState: next.approvalState,
      approverId: next.approverId,
      approvedAt: next.approvedAt,
      updatedAt: new Date(),
    })
    .where(eq(executiveAgentActions.id, actionId))

  await recordFeedbackForAction(orgId, actionId, approverId, 'accept')
}

export async function rejectAction(
  orgId: string,
  actionId: string,
  approverId: string,
  reason?: string,
): Promise<void> {
  const [current] = await platformDb
    .select({
      id: executiveAgentActions.id,
      actionClass: executiveAgentActions.actionClass,
      approvalState: executiveAgentActions.approvalState,
      executionStatus: executiveAgentActions.executionStatus,
      requiresApproval: executiveAgentActions.requiresApproval,
    })
    .from(executiveAgentActions)
    .where(and(eq(executiveAgentActions.orgId, orgId), eq(executiveAgentActions.id, actionId)))
    .limit(1)

  if (!current) throw new Error(`Action not found: ${actionId}`)

  const next = rejectTransition(current as ActionRecord, { approverId, reason })

  await platformDb
    .update(executiveAgentActions)
    .set({
      approvalState: next.approvalState,
      approverId: next.approverId,
      approvedAt: next.approvedAt,
      rejectionReason: next.rejectionReason,
      updatedAt: new Date(),
    })
    .where(eq(executiveAgentActions.id, actionId))

  await recordFeedbackForAction(orgId, actionId, approverId, 'reject', reason)
}

/**
 * Best-effort correlation from an approved/rejected action back to the
 * originating recommendation(s) in the learning loop. Matches by
 * `source_run_id = action.run_id`. If the action came from an agent that
 * doesn't write to `executive_recommendations` (most agents), this is a
 * silent no-op.
 */
async function recordFeedbackForAction(
  orgId: string,
  actionId: string,
  actorId: string,
  verdict: 'accept' | 'reject',
  note?: string,
): Promise<void> {
  try {
    const [action] = await platformDb
      .select({ runId: executiveAgentActions.runId, title: executiveAgentActions.title })
      .from(executiveAgentActions)
      .where(eq(executiveAgentActions.id, actionId))
      .limit(1)
    if (!action) return

    const recs = await platformDb
      .select({ id: executiveRecommendations.id })
      .from(executiveRecommendations)
      .where(
        and(
          eq(executiveRecommendations.orgId, orgId),
          eq(executiveRecommendations.sourceRunId, action.runId),
          eq(executiveRecommendations.status, 'open'),
        ),
      )

    for (const r of recs) {
      await platformDb.insert(executiveRecommendationFeedback).values({
        recommendationId: r.id,
        actorId,
        verdict,
        note: note ?? null,
      })
    }
  } catch {
    // Non-fatal — learning loop shouldn't block approval transitions.
  }
}
