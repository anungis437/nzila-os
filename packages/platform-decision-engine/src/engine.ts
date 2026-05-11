/**
 * @nzila/platform-decision-engine — Governance signal generation engine
 *
 * Pipeline: Ingest signals → Evaluate rules → Enrich evidence → Rank → Output
 *
 * Produces bounded governance signals, not autonomous decisions.
 * All signal outputs require human operator review before any action is taken.
 *
 * @module @nzila/platform-decision-engine/engine
 */
import type { DecisionRecord, DecisionEngineInput, DecisionSummary } from './types'
import { ALL_CATEGORIES, ALL_SEVERITIES, ALL_STATUSES } from './types'
import { DEFAULT_RULES, type DecisionRule } from './rules'

/**
 * Generate decisions by evaluating all rules against the input signals.
 */
export function generateDecisions(
  input: DecisionEngineInput,
  rules: readonly DecisionRule[] = DEFAULT_RULES,
): DecisionRecord[] {
  const decisions: DecisionRecord[] = []
  for (const rule of rules) {
    const results = rule.evaluate(input)
    decisions.push(...results)
  }
  return decisions
}

/**
 * Summarise a set of decisions into counts by severity, category, and status.
 */
export function summariseDecisions(decisions: readonly DecisionRecord[]): DecisionSummary {
  const by_severity = Object.fromEntries(ALL_SEVERITIES.map((s) => [s, 0])) as Record<string, number>
  const by_category = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0])) as Record<string, number>
  const by_status = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<string, number>

  let pending_review = 0
  let critical_open = 0

  for (const d of decisions) {
    by_severity[d.severity] = (by_severity[d.severity] ?? 0) + 1
    by_category[d.category] = (by_category[d.category] ?? 0) + 1
    by_status[d.status] = (by_status[d.status] ?? 0) + 1
    if (d.status === 'PENDING_REVIEW' || d.status === 'GENERATED') pending_review++
    if (d.severity === 'CRITICAL' && d.status !== 'CLOSED' && d.status !== 'EXPIRED') critical_open++
  }

  return {
    total: decisions.length,
    by_severity: by_severity as DecisionSummary['by_severity'],
    by_category: by_category as DecisionSummary['by_category'],
    by_status: by_status as DecisionSummary['by_status'],
    pending_review,
    critical_open,
  }
}
