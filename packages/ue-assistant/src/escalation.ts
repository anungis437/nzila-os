/**
 * @nzila/ue-assistant — Escalation System (Phase 9)
 *
 * Triggers escalation when the AI encounters legal ambiguity, high-risk
 * cases, missing data, or low confidence. Outputs clearly state the
 * escalation reason and target.
 */
import {
  EscalationTargets,
  type EscalationRecord,
  type EscalationTarget,
  type IntentType,
  type UserContext,
  IntentTypes,
  type KnowledgeCitation,
} from './types'

// ── Escalation Triggers ─────────────────────────────────────────────────────

export interface EscalationCheck {
  readonly trigger: string
  readonly check: (params: EscalationParams) => boolean
  readonly target: EscalationTarget
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface EscalationParams {
  readonly query: string
  readonly intent: IntentType
  readonly confidence: number
  readonly citations: readonly KnowledgeCitation[]
  readonly ctx: UserContext
}

const ESCALATION_CHECKS: readonly EscalationCheck[] = [
  {
    trigger: 'legal_ambiguity',
    check: (p) => {
      const legalTerms = ['legal', 'lawyer', 'attorney', 'court', 'litigation', 'arbitration ruling', 'binding']
      const lower = p.query.toLowerCase()
      return legalTerms.some((t) => lower.includes(t)) && p.citations.length < 2
    },
    target: EscalationTargets.STEWARD,
    severity: 'high',
  },
  {
    trigger: 'high_risk_case',
    check: (p) => {
      const highRiskTerms = ['termination', 'fired', 'discrimination', 'harassment', 'retaliation', 'wrongful']
      const lower = p.query.toLowerCase()
      return highRiskTerms.some((t) => lower.includes(t))
    },
    target: EscalationTargets.STEWARD,
    severity: 'high',
  },
  {
    trigger: 'safety_emergency',
    check: (p) => {
      if (p.intent !== IntentTypes.SAFETY) return false
      const emergencyTerms = ['emergency', 'immediate danger', 'injured', 'life threatening', 'chemical spill']
      const lower = p.query.toLowerCase()
      return emergencyTerms.some((t) => lower.includes(t))
    },
    target: EscalationTargets.SAFETY_OFFICER,
    severity: 'critical',
  },
  {
    trigger: 'low_confidence',
    check: (p) => p.confidence < 0.3,
    target: EscalationTargets.STEWARD,
    severity: 'medium',
  },
  {
    trigger: 'missing_data',
    check: (p) => p.citations.length === 0 && p.intent !== IntentTypes.NAVIGATION && p.intent !== IntentTypes.UNKNOWN,
    target: EscalationTargets.ADMIN,
    severity: 'medium',
  },
]

// ── Escalation Log ──────────────────────────────────────────────────────────

const escalationLog: EscalationRecord[] = []

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate all escalation triggers and return the most severe one if any match.
 */
export function evaluateEscalation(
  params: EscalationParams,
): EscalationRecord | null {
  const severityOrder: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  }

  let worstEscalation: EscalationRecord | null = null
  let worstSeverity = -1

  for (const check of ESCALATION_CHECKS) {
    if (check.check(params)) {
      const sev = severityOrder[check.severity] ?? 0
      if (sev > worstSeverity) {
        worstSeverity = sev
        worstEscalation = {
          target: check.target,
          reason: check.trigger,
          severity: check.severity,
          context: {
            query: params.query,
            intent: params.intent,
            confidence: params.confidence,
            citationCount: params.citations.length,
          },
        }
      }
    }
  }

  if (worstEscalation) {
    escalationLog.push(worstEscalation)
  }

  return worstEscalation
}

/**
 * Check if escalation is required without recording it.
 */
export function shouldEscalate(params: EscalationParams): boolean {
  return ESCALATION_CHECKS.some((check) => check.check(params))
}

/**
 * Get the escalation audit log.
 */
export function getEscalationLog(): readonly EscalationRecord[] {
  return [...escalationLog]
}

/**
 * Clear the escalation log (for testing).
 */
export function clearEscalationLog(): void {
  escalationLog.length = 0
}
