/**
 * @nzila/ue-assistant — Steward Intelligence (Phase 8)
 *
 * Advanced capabilities for stewards: case summarization, clause mapping,
 * grievance drafting, missing info detection, and escalation recommendations.
 * All outputs are source-backed, structured, and auditable.
 */
import {
  type KnowledgeCitation,
  type UserContext,
  UEAssistantRoles,
  KnowledgeSourceTypes,
} from './types'

// ── Case Summary ────────────────────────────────────────────────────────────

export interface CaseSummary {
  readonly caseId: string
  readonly summary: string
  readonly keyFacts: readonly string[]
  readonly timeline: readonly TimelineEntry[]
  readonly missingInfo: readonly string[]
  readonly citations: readonly KnowledgeCitation[]
  readonly confidence: number
}

export interface TimelineEntry {
  readonly date: string
  readonly event: string
  readonly source: string
}

// ── Clause Mapping ──────────────────────────────────────────────────────────

export interface ClauseMapping {
  readonly issueDescription: string
  readonly matchedClauses: readonly MatchedClause[]
  readonly confidence: number
}

export interface MatchedClause {
  readonly clauseId: string
  readonly clauseTitle: string
  readonly relevance: number
  readonly excerpt: string
}

// ── Grievance Draft ─────────────────────────────────────────────────────────

export interface GrievanceDraft {
  readonly caseId: string
  readonly title: string
  readonly body: string
  readonly contractReferences: readonly string[]
  readonly remedySought: string
  readonly disclaimer: string
  readonly confidence: number
}

// ── Escalation Recommendation ───────────────────────────────────────────────

export interface EscalationRecommendation {
  readonly recommended: boolean
  readonly reason: string
  readonly target: string
  readonly urgency: 'low' | 'medium' | 'high' | 'critical'
  readonly missingInfo: readonly string[]
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Ensure the caller is a steward or admin.
 */
function assertStewardAccess(ctx: UserContext): void {
  if (
    ctx.userRole !== UEAssistantRoles.STEWARD &&
    ctx.userRole !== UEAssistantRoles.LOCAL_ADMIN &&
    ctx.userRole !== UEAssistantRoles.PARENT_ADMIN
  ) {
    throw new Error('Steward intelligence requires steward or admin role')
  }
}

/**
 * Generate a structured case summary with identified missing information.
 */
export function summarizeCase(
  ctx: UserContext,
  caseId: string,
  caseData: {
    description: string
    filedDate?: string
    status?: string
    grievanceType?: string
    evidence?: readonly string[]
  },
): CaseSummary {
  assertStewardAccess(ctx)

  const missingInfo: string[] = []
  if (!caseData.filedDate) missingInfo.push('Filing date not provided')
  if (!caseData.grievanceType) missingInfo.push('Grievance type not specified')
  if (!caseData.evidence || caseData.evidence.length === 0)
    missingInfo.push('No supporting evidence attached')
  if (!caseData.status) missingInfo.push('Case status unknown')

  const timeline: TimelineEntry[] = []
  if (caseData.filedDate) {
    timeline.push({
      date: caseData.filedDate,
      event: 'Grievance filed',
      source: 'case_record',
    })
  }

  const keyFacts: string[] = []
  if (caseData.grievanceType)
    keyFacts.push(`Grievance type: ${caseData.grievanceType}`)
  if (caseData.status) keyFacts.push(`Current status: ${caseData.status}`)
  if (caseData.evidence)
    keyFacts.push(`Evidence items: ${caseData.evidence.length}`)

  const citations: KnowledgeCitation[] = [
    {
      sourceType: KnowledgeSourceTypes.CASE_DATA,
      sourceId: caseId,
      title: `Case ${caseId}`,
      excerpt: caseData.description.slice(0, 200),
      relevanceScore: 1.0,
    },
  ]

  const confidence = missingInfo.length === 0 ? 0.9 : Math.max(0.4, 0.9 - missingInfo.length * 0.15)

  return {
    caseId,
    summary: `Case ${caseId}: ${caseData.description.slice(0, 100)}${caseData.description.length > 100 ? '...' : ''}`,
    keyFacts,
    timeline,
    missingInfo,
    citations,
    confidence,
  }
}

/**
 * Map an issue description to relevant contract clauses.
 */
export function mapToClauses(
  ctx: UserContext,
  issueDescription: string,
  availableClauses: readonly {
    id: string
    title: string
    content: string
  }[],
): ClauseMapping {
  assertStewardAccess(ctx)

  const lower = issueDescription.toLowerCase()
  const matched: MatchedClause[] = availableClauses
    .filter((c) => {
      const clauseLower = c.content.toLowerCase()
      // Simple keyword overlap check
      const words = lower.split(/\s+/).filter((w) => w.length > 3)
      return words.some((w) => clauseLower.includes(w))
    })
    .map((c) => ({
      clauseId: c.id,
      clauseTitle: c.title,
      relevance: 0.75,
      excerpt: c.content.slice(0, 200),
    }))

  return {
    issueDescription,
    matchedClauses: matched,
    confidence: matched.length > 0 ? 0.7 : 0.3,
  }
}

/**
 * Generate a grievance draft from case data and contract references.
 */
export function draftGrievance(
  ctx: UserContext,
  params: {
    caseId: string
    memberName: string
    description: string
    contractReferences: readonly string[]
    remedySought: string
  },
): GrievanceDraft {
  assertStewardAccess(ctx)

  const body = [
    `RE: Grievance — ${params.description}`,
    '',
    `This grievance is filed on behalf of ${params.memberName}.`,
    '',
    `Description of the issue:`,
    params.description,
    '',
    `Contract provisions violated:`,
    ...params.contractReferences.map((ref) => `  - ${ref}`),
    '',
    `Remedy sought:`,
    params.remedySought,
  ].join('\n')

  return {
    caseId: params.caseId,
    title: `Grievance — ${params.description.slice(0, 50)}`,
    body,
    contractReferences: [...params.contractReferences],
    remedySought: params.remedySought,
    disclaimer:
      'This is an AI-generated draft. It must be reviewed and approved by the steward and union representative before submission.',
    confidence: 0.7,
  }
}

/**
 * Detect missing information in a case for escalation readiness.
 */
export function detectMissingInfo(
  ctx: UserContext,
  caseData: {
    description?: string
    filedDate?: string
    grievanceType?: string
    evidence?: readonly string[]
    contractClauses?: readonly string[]
    witnesses?: readonly string[]
    timeline?: readonly string[]
  },
): readonly string[] {
  assertStewardAccess(ctx)

  const missing: string[] = []
  if (!caseData.description || caseData.description.length < 20)
    missing.push('Detailed description of the issue')
  if (!caseData.filedDate) missing.push('Date the issue occurred')
  if (!caseData.grievanceType) missing.push('Type of grievance')
  if (!caseData.evidence || caseData.evidence.length === 0)
    missing.push('Supporting evidence or documentation')
  if (!caseData.contractClauses || caseData.contractClauses.length === 0)
    missing.push('Relevant contract clause references')
  if (!caseData.witnesses || caseData.witnesses.length === 0)
    missing.push('Witness information (if applicable)')
  if (!caseData.timeline || caseData.timeline.length === 0)
    missing.push('Timeline of events')
  return missing
}

/**
 * Generate an escalation recommendation based on case analysis.
 */
export function recommendEscalation(
  ctx: UserContext,
  params: {
    caseId: string
    confidence: number
    missingInfo: readonly string[]
    isLegallyComplex: boolean
    isHighRisk: boolean
  },
): EscalationRecommendation {
  assertStewardAccess(ctx)

  const reasons: string[] = []
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low'

  if (params.isHighRisk) {
    reasons.push('Case identified as high-risk')
    urgency = 'high'
  }
  if (params.isLegallyComplex) {
    reasons.push('Legal complexity requires expert review')
    urgency = urgency === 'high' ? 'critical' : 'high'
  }
  if (params.confidence < 0.5) {
    reasons.push('Low confidence in AI analysis')
    urgency = urgency === 'low' ? 'medium' : urgency
  }
  if (params.missingInfo.length > 3) {
    reasons.push('Significant missing information')
    urgency = urgency === 'low' ? 'medium' : urgency
  }

  const recommended = reasons.length > 0

  return {
    recommended,
    reason: recommended
      ? reasons.join('; ')
      : 'No escalation needed at this time',
    target: params.isLegallyComplex ? 'legal_representative' : 'senior_steward',
    urgency,
    missingInfo: [...params.missingInfo],
  }
}
