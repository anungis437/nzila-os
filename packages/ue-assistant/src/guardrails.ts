/**
 * @nzila/ue-assistant — Safety & Guardrails (Phase 13)
 *
 * Prevents hallucinated legal advice, unauthorized data access,
 * cross-org leakage, and unsafe guidance. Includes confidence scoring
 * and fallback to escalation.
 */
import {
  type UserContext,
  type IntentType,
  type KnowledgeCitation,
  ResponseTypes,
  type ResponseType,
  IntentTypes,
} from './types'

// ── Guardrail Check Result ──────────────────────────────────────────────────

export interface GuardrailResult {
  readonly passed: boolean
  readonly violations: readonly string[]
  readonly adjustedResponseType?: ResponseType
}

// ── Guardrail Checks ────────────────────────────────────────────────────────

/**
 * Prevent hallucinated legal advice: any response about rights or
 * contracts must have citations.
 */
function checkNoHallucinatedLegalAdvice(
  intent: IntentType,
  citations: readonly KnowledgeCitation[],
  content: string,
): string | null {
  const legalIntents: IntentType[] = [IntentTypes.RIGHTS, IntentTypes.CONTRACT]
  if (!legalIntents.includes(intent)) return null

  const legalClaims = ['you are legally entitled', 'the law requires', 'you have a legal right']
  const lower = content.toLowerCase()
  const hasLegalClaim = legalClaims.some((c) => lower.includes(c))

  if (hasLegalClaim && citations.length === 0) {
    return 'Legal claim made without supporting citations'
  }
  return null
}

/**
 * Prevent cross-org data leakage: response must not reference
 * data from a different org.
 */
function checkNoCrossOrgLeakage(
  ctx: UserContext,
  citations: readonly KnowledgeCitation[],
): string | null {
  // Citations should already be org-scoped by the knowledge layer
  // This is a defense-in-depth check
  for (const citation of citations) {
    if (
      citation.sourceId.includes('org:') &&
      !citation.sourceId.includes(`org:${ctx.orgId}`)
    ) {
      return `Cross-org data leakage detected: citation references different org`
    }
  }
  return null
}

/**
 * Ensure confidence meets the minimum threshold for the response type.
 */
function checkConfidenceThreshold(
  confidence: number,
  responseType: ResponseType,
): string | null {
  const thresholds: Partial<Record<ResponseType, number>> = {
    [ResponseTypes.DIRECT_ANSWER]: 0.6,
    [ResponseTypes.ANALYTICAL_OUTPUT]: 0.5,
    [ResponseTypes.CITED_EXPLANATION]: 0.4,
    [ResponseTypes.GUIDED_STEPS]: 0.3,
  }
  const threshold = thresholds[responseType]
  if (threshold !== undefined && confidence < threshold) {
    return `Confidence ${confidence} below threshold ${threshold} for ${responseType}`
  }
  return null
}

/**
 * Prevent unsafe safety guidance: safety responses must include
 * emergency protocol reference when urgency detected.
 */
function checkSafetyGuidance(
  intent: IntentType,
  content: string,
): string | null {
  if (intent !== IntentTypes.SAFETY) return null
  const lower = content.toLowerCase()
  const urgentIndicators = ['emergency', 'immediate danger', 'injured']
  const hasUrgency = urgentIndicators.some((i) => lower.includes(i))
  const hasEmergencyRef =
    lower.includes('emergency services') ||
    lower.includes('call 911') ||
    lower.includes('safety officer')
  if (hasUrgency && !hasEmergencyRef) {
    return 'Safety response mentions urgency without emergency protocol reference'
  }
  return null
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run all guardrail checks on a response before delivery.
 */
export function runGuardrails(params: {
  intent: IntentType
  ctx: UserContext
  citations: readonly KnowledgeCitation[]
  content: string
  confidence: number
  responseType: ResponseType
}): GuardrailResult {
  const violations: string[] = []

  const legalCheck = checkNoHallucinatedLegalAdvice(
    params.intent,
    params.citations,
    params.content,
  )
  if (legalCheck) violations.push(legalCheck)

  const orgCheck = checkNoCrossOrgLeakage(params.ctx, params.citations)
  if (orgCheck) violations.push(orgCheck)

  const confidenceCheck = checkConfidenceThreshold(
    params.confidence,
    params.responseType,
  )
  if (confidenceCheck) violations.push(confidenceCheck)

  const safetyCheck = checkSafetyGuidance(params.intent, params.content)
  if (safetyCheck) violations.push(safetyCheck)

  if (violations.length > 0) {
    return {
      passed: false,
      violations,
      adjustedResponseType: ResponseTypes.ESCALATION_REQUIRED,
    }
  }

  return { passed: true, violations: [] }
}

/**
 * Compute a confidence score based on citation quality and count.
 */
export function computeConfidence(
  citations: readonly KnowledgeCitation[],
  intentConfidence: number,
): number {
  if (citations.length === 0) return Math.min(intentConfidence, 0.3)
  const avgRelevance =
    citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length
  return Math.min(0.95, (intentConfidence + avgRelevance) / 2)
}
