/**
 * Evidence Classification — NACP Exams
 *
 * Defines which exam lifecycle evidence actions are **mandatory**
 * (must succeed or the parent action rolls back) versus **best-effort**
 * (logged but failure does not block the action).
 *
 * Mandatory actions:
 *   - session.sealed        — cryptographic integrity must be recorded
 *   - session.exported       — export proof is regulatory evidence
 *   - session.closed         — final lifecycle event, must be immutable
 *   - session.status_changed — when target is sealed/exported/closed
 *
 * Best-effort actions:
 *   - session.created        — helpful audit trail, not regulatory
 *   - session.status_changed — when target is opened/in_progress
 *
 * @module @nacp/evidence-classification
 */
import { ExamSessionStatus } from '@nzila/nacp-core'

// ── Classification types ────────────────────────────────────────────────────

export type EvidenceClassification = 'mandatory' | 'best-effort'

export interface EvidenceClassificationRule {
  action: string
  classification: EvidenceClassification
  description: string
}

// ── Static action classifications ───────────────────────────────────────────

export const EVIDENCE_CLASSIFICATIONS: EvidenceClassificationRule[] = [
  {
    action: 'session.created',
    classification: 'best-effort',
    description: 'Session creation — audit trail only, not regulatory',
  },
  {
    action: 'session.sealed',
    classification: 'mandatory',
    description: 'Seal event — cryptographic integrity proof required',
  },
  {
    action: 'session.exported',
    classification: 'mandatory',
    description: 'Export event — regulatory evidence of data handoff',
  },
  {
    action: 'session.closed',
    classification: 'mandatory',
    description: 'Close event — final lifecycle evidence, immutable',
  },
]

/**
 * Statuses whose transition evidence is mandatory.
 * If updateSessionStatus targets one of these, the evidence pack
 * must succeed or the action must fail.
 */
export const MANDATORY_TARGET_STATUSES: ReadonlySet<string> = new Set([
  ExamSessionStatus.SEALED,
  ExamSessionStatus.EXPORTED,
  ExamSessionStatus.CLOSED,
])

/**
 * Determine the evidence classification for a session status transition.
 */
export function classifyTransitionEvidence(
  targetStatus: ExamSessionStatus,
): EvidenceClassification {
  return MANDATORY_TARGET_STATUSES.has(targetStatus) ? 'mandatory' : 'best-effort'
}

/**
 * Determine the evidence classification for a static action name.
 */
export function classifyActionEvidence(
  action: string,
): EvidenceClassification {
  const rule = EVIDENCE_CLASSIFICATIONS.find((r) => r.action === action)
  return rule?.classification ?? 'best-effort'
}
