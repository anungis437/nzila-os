/**
 * TrustCore — Compliance Engine
 *
 * Evaluates the compliance posture for an organisation.
 *
 * v1 exposes the evaluation contract without persistence; the
 * implementation will be wired to the database schema in the next prompt.
 */

import type { ComplianceResult, ComplianceStatus } from '@/types/core'
import { trustcoreConfig } from '@/config/app'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ComplianceInput {
  /** Controls that have been verified / evidenced for the org. */
  verifiedControlIds: string[]
  /** Full list of controls applicable to the org's framework. */
  applicableControlIds: string[]
  /** Open risks recorded for the org. */
  openRisks: string[]
}

// ── Engine ─────────────────────────────────────────────────────────────────

/**
 * Derive a 0–100 compliance score from the ratio of verified controls.
 */
function computeScore(verified: number, total: number): number {
  if (total === 0) return 0
  return Math.round((verified / total) * 100)
}

function deriveStatus(score: number, openRisks: string[]): ComplianceStatus {
  const { passingScore } = trustcoreConfig.compliance
  if (score >= passingScore && openRisks.length === 0) return 'compliant'
  if (score >= passingScore - 15) return 'at-risk'
  return 'non-compliant'
}

/**
 * Evaluate the compliance posture for an organisation.
 *
 * This function is stateless and pure — all inputs are passed explicitly.
 * Callers are responsible for fetching the required data before invoking.
 *
 * @param orgId  - The organisation being evaluated.
 * @param input  - Control coverage and open-risk snapshot.
 */
export function evaluateCompliance(
  orgId: string,
  input: ComplianceInput,
): ComplianceResult {
  const score = computeScore(
    input.verifiedControlIds.length,
    input.applicableControlIds.length,
  )

  const status = deriveStatus(score, input.openRisks)

  return {
    orgId,
    score,
    risks: input.openRisks,
    status,
    evaluatedAt: new Date().toISOString(),
  }
}
