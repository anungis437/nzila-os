/**
 * @nzila/intelligence — Decision
 *
 * Delegates decision-generation to @nzila/platform-decision-engine
 * and translates results into the unified IntelligenceResponse shape.
 */
import { randomUUID } from 'node:crypto'
import type { IntelligenceRequest, IntelligenceResponse, RiskLevel } from './types'
import { buildContext } from './context'
import { traceFromDecisionRecord, emptyTrace } from './explainability'
import { NilError } from './types'
import {
  generateDecisions,
  type DecisionRecord,
  type DecisionSeverity,
} from '@nzila/platform-decision-engine'

// ── Severity → Risk mapping ─────────────────────────────────────────────────

const severityToRisk: Record<DecisionSeverity, RiskLevel> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run a decision-generation use-case through the platform-decision-engine
 * and return a unified IntelligenceResponse.
 */
export async function executeDecision(
  request: IntelligenceRequest,
): Promise<IntelligenceResponse> {
  const start = Date.now()
  const ctx = buildContext(request)

  try {
    const decisions: readonly DecisionRecord[] = await generateDecisions({
      org_id: request.orgId,
      anomalies: (request.input['anomalies'] as never[]) ?? [],
      insights: (request.input['insights'] as never[]) ?? [],
      signals: (request.input['signals'] as never[]) ?? [],
      governance_status: request.input['governance_status'] as never,
      change_records: request.input['change_records'] as never[],
      environment: mapEnvironment(ctx.environment),
    })

    const primary = decisions[0] as DecisionRecord | undefined
    const explanation = primary
      ? traceFromDecisionRecord(primary)
      : emptyTrace('No decisions generated for the provided inputs.')

    return {
      requestId: randomUUID(),
      success: true,
      output: {
        decisions: decisions.map((d) => ({
          id: d.decision_id,
          title: d.title,
          summary: d.summary,
          category: d.category,
          severity: d.severity,
          status: d.status,
          recommendedActions: d.recommended_actions,
        })),
      },
      explanation,
      confidence: primary?.confidence_score ?? 0,
      riskLevel: primary ? severityToRisk[primary.severity] : 'low',
      durationMs: Date.now() - start,
      completedAt: new Date().toISOString(),
    }
  } catch (err) {
    throw new NilError(
      'decision_failed',
      `Decision execution failed: ${err instanceof Error ? err.message : String(err)}`,
      500,
    )
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapEnvironment(
  env?: string,
): 'LOCAL' | 'PREVIEW' | 'STAGING' | 'PRODUCTION' {
  switch (env) {
    case 'local':
      return 'LOCAL'
    case 'preview':
      return 'PREVIEW'
    case 'staging':
      return 'STAGING'
    default:
      return 'PRODUCTION'
  }
}
