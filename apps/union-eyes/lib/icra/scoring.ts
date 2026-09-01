/**
 * ARTIFACT TYPE: Scoring Engine
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Operational
 *
 * ICRA Scoring Engine — fully explainable, dimension-weighted organizational
 * maturity scoring. No opaque model. Every number is traceable to a question
 * answer and a published weight.
 *
 * Risk dimensions (governance_fragility, trust_debt) are inverted before
 * composition: high raw = more fragility → final score = (1 - raw) * 100
 * so all dimension scores are continuity-positive (higher = better).
 *
 * Composite = institutional_continuity dimension score.
 * MaturityBand is resolved from composite via resolveMaturityBand().
 */

import type {
  Answer,
  ContinuityObservation,
  DimensionId,
  DimensionScore,
  FollowupRecommendation,
  OrganizationalContinuityProfile,
  MaturityBand,
  Question,
  SectionId,
  SectionScore,
} from './types'
import { resolveMaturityBand } from './maturity'
import { ALL_QUESTIONS, QUESTION_BANK_VERSION } from './questions'
import { generateInsights } from './insight-engine'

export const SCORING_VERSION = '1.0.0'

const RISK_DIMENSIONS: Set<DimensionId> = new Set(['governance_fragility', 'trust_debt'])

/**
 * Public-sector kill switch for the free-text `note` field on `Answer`.
 *
 * When `OCI_PUBLIC_SECTOR_MODE=1` (or `=true`, case-insensitive) is set in the
 * process environment, `buildAnswer` throws if a non-empty `note` is supplied.
 * This turns the documented "callers must disable free text" posture in
 * `docs/oci/superseded/government-readiness/SECURITY_AND_DATA_HANDLING_BRIEF.md` §2.1
 * into an enforced runtime control at the single source-of-entry for answers.
 */
export function isPublicSectorModeEnabled(): boolean {
  const raw = process.env.OCI_PUBLIC_SECTOR_MODE
  if (raw === undefined) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export interface ComputeProfileInput {
  assessmentId: string
  answers: Answer[]
}

/**
 * Build an `Answer` from a `Question` and its raw response value.
 *
 * @param question   The scoring question being answered.
 * @param rawValue   The reviewer's response value.
 * @param note       Optional reviewer note. **SENSITIVE FREE TEXT.**
 *
 *   `note` is not covered by the *"PII-free by construction"* property of the
 *   derived scoring/finding/traceability artifacts (see
 *   `docs/oci/superseded/government-readiness/SECURITY_AND_DATA_HANDLING_BRIEF.md` §2.1).
 *   Callers **must** treat any string passed here as potentially personal,
 *   confidential, or otherwise sensitive material and are responsible for:
 *
 *   1. **Disabling capture** in engagements that cannot accept free-text; or
 *   2. **Ephemeralizing** the field (do not persist the `Answer` beyond the
 *      score computation, or drop `answer.note` immediately after scoring); or
 *   3. **Routing** any retained value into a separately-secured evidence
 *      repository outside the derived-artifact estate.
 *
 *   This value is intentionally read only by the caller who supplies it; it
 *   is not used by any scoring, obligation, consequence, confidence, or
 *   traceability logic in this package and is not surfaced by the government-
 *   readiness layer.
 *
 * @throws {Error}
 *   When `OCI_PUBLIC_SECTOR_MODE=1` (or `=true`) is set in the process
 *   environment and a non-empty `note` is supplied. This is the deployment-
 *   time kill switch that turns the documented "callers must disable" posture
 *   into a hard runtime control for public-sector engagements. Set the flag
 *   at process start (e.g. Container App env var) to guarantee that no
 *   free-text sneaks in through this call site regardless of caller
 *   discipline.
 */
export function buildAnswer(question: Question, rawValue: string | number, note?: string): Answer {
  if (note !== undefined && note.trim() !== '' && isPublicSectorModeEnabled()) {
    throw new Error(
      'buildAnswer: free-text `note` is not permitted when OCI_PUBLIC_SECTOR_MODE is enabled. ' +
        'Disable note capture, ephemeralize the field, or route it to a separately-secured evidence repository. ' +
        'See docs/oci/superseded/government-readiness/SECURITY_AND_DATA_HANDLING_BRIEF.md §2.1.',
    )
  }
  return {
    questionId: question.id,
    questionVersion: QUESTION_BANK_VERSION,
    rawValue,
    normalizedScore: normalizeQuestionScore(question, rawValue),
    weightsSnapshot: { ...question.weights },
    riskInverted: question.riskInverted ?? false,
    // SENSITIVE FREE TEXT — see docblock above. Not PII-safe by construction.
    note: note?.trim() || undefined,
    answeredAt: new Date().toISOString(),
  }
}

export function computeProfile({
  assessmentId,
  answers,
}: ComputeProfileInput): OrganizationalContinuityProfile {
  return scoreAssessment(assessmentId, answers).profile
}

function normalizeQuestionScore(question: Question, rawValue: string | number): number {
  if (question.type === 'likert_5') {
    const numericValue = Number(rawValue)
    if (!Number.isInteger(numericValue)) {
      throw new Error(`Invalid numeric answer for question ${question.id}`)
    }
    if (numericValue < question.scale.min || numericValue > question.scale.max) {
      throw new Error(`Answer is outside the allowed scale for question ${question.id}`)
    }
    return (numericValue - question.scale.min) / (question.scale.max - question.scale.min)
  }

  const option = question.options.find((o) => o.value === String(rawValue))
  if (!option) {
    throw new Error(`Invalid option for question ${question.id}`)
  }
  return option.score
}

export interface QuestionTrace {
  questionId: string
  sectionId: SectionId
  rawValue: string
  normalizedScore: number
  riskInverted: boolean
  effectiveScore: number
  weights: Partial<Record<DimensionId, number>>
  dimensionContributions: Partial<Record<DimensionId, number>>
}

export interface DimensionTrace {
  dimension: DimensionId
  isRisk: boolean
  totalWeightedContribution: number
  totalWeight: number
  rawScore: number
  finalScore: number
}

export interface ScoringTrace {
  assessmentId: string
  scoringVersion: string
  questionBankVersion: number
  scoredAt: string
  questionTraces: QuestionTrace[]
  dimensionTraces: DimensionTrace[]
  composite: number
  maturityBand: MaturityBand
}

/**
 * Raw organizational context as captured by the assessment form.
 * Keys correspond to METADATA_QUESTIONS ids (ctx_org_type, ctx_sector,
 * ctx_membership_size, ctx_years_operating, ctx_primary_challenge).
 * Used only to sharpen editorial framing — never to influence scoring.
 */
export type ScoringOrgContext = Record<string, string> | null | undefined

export function scoreAssessment(
  assessmentId: string,
  answers: Answer[],
  orgContext?: ScoringOrgContext,
): {
  profile: OrganizationalContinuityProfile
  trace: ScoringTrace
} {
  const now = new Date().toISOString()
  const answerMap = new Map(answers.map((a) => [a.questionId, a]))

  const dimensionWeightedSum: Partial<Record<DimensionId, number>> = {}
  const dimensionWeightTotal: Partial<Record<DimensionId, number>> = {}
  const sectionSum: Partial<Record<SectionId, number>> = {}
  const sectionCount: Partial<Record<SectionId, number>> = {}
  const questionTraces: QuestionTrace[] = []

  for (const question of ALL_QUESTIONS) {
    const answer = answerMap.get(question.id)
    if (!answer) continue

    const normalized = answer.normalizedScore
    const riskInverted = question.riskInverted ?? false
    const effectiveScore = riskInverted ? 1 - normalized : normalized
    const dimensionContributions: Partial<Record<DimensionId, number>> = {}

    for (const [dim, weight] of Object.entries(question.weights) as [DimensionId, number][]) {
      const contribution = effectiveScore * weight
      dimensionContributions[dim] = contribution
      dimensionWeightedSum[dim] = (dimensionWeightedSum[dim] ?? 0) + contribution
      dimensionWeightTotal[dim] = (dimensionWeightTotal[dim] ?? 0) + weight
    }

    const primaryWeight =
      question.weights.institutional_continuity ?? Object.values(question.weights)[0] ?? 1
    sectionSum[question.section] =
      (sectionSum[question.section] ?? 0) + effectiveScore * primaryWeight
    sectionCount[question.section] = (sectionCount[question.section] ?? 0) + 1

    questionTraces.push({
      questionId: question.id,
      sectionId: question.section,
      rawValue: answer.rawValue as string,
      normalizedScore: normalized,
      riskInverted,
      effectiveScore,
      weights: { ...question.weights },
      dimensionContributions,
    })
  }

  const allDimensions: DimensionId[] = [
    'institutional_continuity',
    'governance_fragility',
    'trust_debt',
    'operational_memory',
    'transition_readiness',
  ]

  const dimensionTraces: DimensionTrace[] = []
  const dimensionScores: DimensionScore[] = []

  for (const dim of allDimensions) {
    const weightedSum = dimensionWeightedSum[dim] ?? 0
    const weightTotal = dimensionWeightTotal[dim] ?? 0
    if (weightTotal === 0) continue

    const rawScore = weightedSum / weightTotal
    const isRisk = RISK_DIMENSIONS.has(dim)
    const finalScore = Math.round(rawScore * 100)

    dimensionTraces.push({
      dimension: dim,
      isRisk,
      totalWeightedContribution: weightedSum,
      totalWeight: weightTotal,
      rawScore,
      finalScore,
    })
    dimensionScores.push({
      dimension: dim,
      score: finalScore,
      contributingQuestions: questionTraces.filter((qt) => qt.weights[dim] !== undefined).length,
      weightTotal,
    })
  }

  const composite =
    dimensionScores.find((d) => d.dimension === 'institutional_continuity')?.score ?? 0
  const maturityBand = resolveMaturityBand(composite)

  const sections: SectionScore[] = Object.entries(sectionSum)
    .map(([section, sum]) => {
      const count = sectionCount[section as SectionId] ?? 1
      return {
        section: section as SectionId,
        score: Math.round(((sum ?? 0) / count) * 100),
        questionsAnswered: count,
      }
    })
    .sort((a, b) => a.section.localeCompare(b.section))

  const observations = generateObservations(dimensionScores, sections, questionTraces, orgContext)
  const recommendations = generateRecommendations(composite, dimensionScores)
  const insightOutput = generateInsights(dimensionScores, sections, undefined, orgContext)

  const trace: ScoringTrace = {
    assessmentId,
    scoringVersion: SCORING_VERSION,
    questionBankVersion: QUESTION_BANK_VERSION,
    scoredAt: now,
    questionTraces,
    dimensionTraces,
    composite,
    maturityBand,
  }
  const profile: OrganizationalContinuityProfile = {
    assessmentId,
    generatedAt: now,
    maturityBand,
    composite,
    dimensions: dimensionScores,
    sections,
    observations,
    recommendations,
    answeredQuestionCount: answers.length,
    questionBankVersion: QUESTION_BANK_VERSION,
    insights: insightOutput.insights,
    continuitySignals: insightOutput.continuitySignals,
    stewardshipSignals: insightOutput.stewardshipSignals,
    burdenIndex: insightOutput.burdenIndex,
  }

  return { profile, trace }
}

type SectionBand = 'critical' | 'material' | 'attention'

/**
 * Bespoke per-section, per-band editorial copy for continuity observations.
 *
 * Grounded in the OCI/OCRA framing developed in
 * `The Continuity Gap` (Nzila OS Research Initiative, v3.0):
 * institutional memory erosion, governance entropy, continuity debt,
 * stewardship concentration, runtime truth, and the invisible labour
 * of continuity. Each entry is intentionally narrative — not a score
 * restated as prose — so that a reader recognizes the institutional
 * pattern in their own organization.
 */
const SECTION_OBSERVATION_COPY: Record<SectionId, Record<SectionBand, string>> = {
  organizational_context: {
    critical:
      'This organization does not yet hold a coherent operational picture of itself. Mission, governance scope, stakeholder map, and operational footprint are interpreted differently across roles, leaving the institution dependent on whoever happens to be in the room to define what it is.',
    material:
      'Institutional self-understanding is partial. The organization can describe what it does, but not consistently why, for whom, or under what governance posture — and that gap quietly widens every time leadership, membership, or scope changes.',
    attention:
      'Organizational context is established but not yet operationally embedded. Newcomers, transitioning leaders, and external counterparts are likely receiving subtly different versions of the same institution.',
  },
  operational_dependency: {
    critical:
      'Core operations are held together by specific individuals rather than institutional systems. If one or two people stopped showing up next week, the organization would not so much slow down as lose the ability to explain how it functions.',
    material:
      'Operational continuity is concentrated in a small number of long-tenured people. The institution still works — but the cost of that working is paid privately, in invisible stewardship the organization does not formally recognize.',
    attention:
      'Operational dependency on key individuals is visible at the edges. Vacations, sick leave, and turnover surface seams that would otherwise be invisible, and reveal which workflows have not yet been institutionalized.',
  },
  governance_visibility: {
    critical:
      'Governance is happening, but it cannot reliably be reconstructed. Decisions, exceptions, and rationale live in inboxes, side conversations, and individual memory, which means the institution cannot defend its own past to itself.',
    material:
      'Governance lineage is partial. The organization can usually answer what was decided, but rarely why, under what conditions, or by what authority — and this is exactly the gap that compounds into governance entropy over time.',
    attention:
      'Governance is visible in formal artifacts but inconsistently traceable in practice. The distance between the documented institution and the operational institution is small today, but tends to widen silently.',
  },
  institutional_memory: {
    critical:
      'Institutional memory exists almost entirely inside people, not inside the institution. Precedent, context, and operational rationale are being held by individuals whose departure would force the organization to reconstruct itself from fragments.',
    material:
      'A meaningful portion of what this institution knows is unique to specific employees. When they are unavailable, work slows or restarts — not because of incompetence elsewhere, but because the memory itself never left their head.',
    attention:
      'Institutional memory is being captured, but unevenly. Some domains are well-documented; others rely on lived experience that has not yet been transferred, and the boundary between the two is rarely mapped.',
  },
  transition_readiness: {
    critical:
      'This organization is not currently prepared to transfer leadership, key roles, or governance authority without significant operational disruption. Succession is treated as a personnel event rather than a continuity event.',
    material:
      'Transition planning exists in name but not in operational depth. The institution knows who might come next, but has not yet preserved the judgment, relationships, and historical context the successor would need to actually carry the role.',
    attention:
      'Transition readiness is forming, but uneven across roles. Some positions could change hands cleanly; others would surface dependencies the organization has not yet been forced to confront.',
  },
  operational_coordination: {
    critical:
      'Coordination across teams, committees, or units is improvised. Handoffs depend on personal relationships and informal channels, which means the institution operates well only when the same people stay in the same rooms.',
    material:
      'Operational coordination works, but quietly absorbs significant friction. Information moves through people rather than through institutional structure, and that friction is paid for in time, duplication, and slow erosion of trust.',
    attention:
      'Coordination is largely intact but not yet structurally guaranteed. The organization is one reorganization, secondment, or membership shift away from rediscovering where coordination really lives.',
  },
  explainability_trust: {
    critical:
      'When stakeholders ask how a decision was made, why an exception was granted, or what authority underlies a position, this organization cannot consistently answer. Trust here is sustained by the goodwill of those still present, not by the institution itself.',
    material:
      'Operational trust is largely intact, but it leans on people rather than on infrastructure. Repeated moments of institutional forgetting — duplicated requests, inconsistent answers, unexplained reversals — are the early signals that trust is being slowly spent down.',
    attention:
      'Decisions and operational positions are usually explainable, but the explanation often requires finding the right person. The institution has not yet made explainability a property of the system itself.',
  },
  sovereignty_governance: {
    critical:
      'The organization does not yet exercise meaningful sovereignty over its own operational evidence, records, and digital infrastructure. Critical continuity material is dispersed across third-party systems whose lifecycle the institution does not control.',
    material:
      'Data, evidence, and operational records are partially under institutional control, but the boundaries are unclear. In a dispute, a transition, or a vendor failure, the organization would discover gaps in what it can actually retrieve and defend.',
    attention:
      'Sovereignty and data governance are taking shape, but operational lineage and evidence integrity are not yet uniformly enforceable across systems.',
  },
}

function sectionBand(score: number): SectionBand | null {
  if (score < 35) return 'critical'
  if (score < 55) return 'material'
  if (score < 70) return 'attention'
  return null
}

function bandSeverity(band: SectionBand): ContinuityObservation['severity'] {
  if (band === 'critical') return 'material'
  if (band === 'material') return 'material'
  return 'attention'
}

function generateObservations(
  dimensions: DimensionScore[],
  sections: SectionScore[],
  traces: QuestionTrace[],
  orgContext?: ScoringOrgContext,
): ContinuityObservation[] {
  const observations: ContinuityObservation[] = []
  let counter = 0

  // Sector-aware peer framing — prepended only when sector is provided and at least
  // one dimension is below mid-scale. Does not affect scoring or thresholds.
  const sectorFrame = orgContext ? sectorPeerStatement(orgContext.ctx_sector) : null
  const anyBelowMid = dimensions.some((d) => d.score < 60)
  if (sectorFrame && anyBelowMid) {
    observations.push({
      id: `obs_${++counter}`,
      severity: 'attention',
      category: 'governance',
      statement: sectorFrame,
      evidence: [`Organizational context: sector = ${orgContext!.ctx_sector}`],
    })
  }

  const dimMap = new Map(dimensions.map((d) => [d.dimension, d]))
  const ic = dimMap.get('institutional_continuity')?.score ?? 100
  const gf = dimMap.get('governance_fragility')?.score ?? 100
  const td = dimMap.get('trust_debt')?.score ?? 100
  const om = dimMap.get('operational_memory')?.score ?? 100
  const tr = dimMap.get('transition_readiness')?.score ?? 100

  if (ic < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'governance',
      statement:
        'Institutional continuity in this organization is presently carried by individuals rather than by the institution itself. Operations remain coherent only as long as specific people remain present, available, and willing to absorb the continuity work no one has been asked to formalize.',
      evidence: ['institutional_continuity dimension score below 40'],
    })
  else if (ic < 60)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'attention',
      category: 'governance',
      statement:
        'Institutional continuity is partially structured, but still leans on a narrow base of veterans. The organization can describe its operations more cleanly than it can transfer them — and that gap is exactly where continuity debt accumulates over time.',
      evidence: [`institutional_continuity dimension score: ${ic}/100`],
    })
  if (gf < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'governance',
      statement:
        'Governance entropy is materially advanced. Decisions cannot be reliably reconstructed, oversight depends on individual gatekeeping, and policy application has drifted enough that the institution would struggle to defend its own past consistency under structured review.',
      evidence: ['governance_fragility dimension score indicates significant structural risk'],
    })
  else if (gf < 60)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'attention',
      category: 'governance',
      statement:
        'Early governance entropy signals are present. Policy is largely followed, but rationale, precedent, and authority are not yet preserved with enough rigour to prevent inconsistent application as people and roles change.',
      evidence: [`governance_fragility dimension score: ${gf}/100`],
    })
  if (td < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'trust',
      statement:
        'Institutional trust debt is a material concern. Accumulated unresolved decisions, unexplained conduct, and informal authority patterns represent a continuing draw on legitimacy — one the organization is unlikely to fully see until a transition or external review forces the ledger open.',
      evidence: ['trust_debt dimension score indicates elevated accumulated risk'],
    })
  else if (td < 60)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'attention',
      category: 'trust',
      statement:
        'Trust debt is accumulating quietly. Most decisions still hold, but a growing number cannot be cleanly explained to those who were not in the room when they were made, and that gap is what stakeholders eventually experience as inconsistency.',
      evidence: [`trust_debt dimension score: ${td}/100`],
    })
  if (om < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'memory',
      statement:
        'Operational memory is critically thin. The most consequential institutional knowledge — judgment, precedent, escalation patterns, relational context — exists almost entirely inside specific people, which means a planned or unplanned departure forces the organization to reconstruct itself rather than continue.',
      evidence: ['operational_memory dimension score below 40'],
    })
  else if (om < 60)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'attention',
      category: 'memory',
      statement:
        'Operational memory is partially preserved but unevenly held. Documentation captures what happens; the why, the exceptions, and the institutional context still travel mostly through conversation with long-tenured staff.',
      evidence: [`operational_memory dimension score: ${om}/100`],
    })
  if (tr < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'transition',
      statement:
        'Transition readiness is severely underdeveloped. Succession is treated here as a personnel question rather than a continuity question, and the institution would absorb significant operational degradation through any meaningful leadership or role change.',
      evidence: ['transition_readiness dimension score below 40'],
    })
  else if (tr < 60)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'attention',
      category: 'transition',
      statement:
        'Transition planning exists but has not yet been operationalized. The institution can identify who might come next; it has not yet preserved the judgment, relationships, and historical interpretation those successors would actually need to carry the role intact.',
      evidence: [`transition_readiness dimension score: ${tr}/100`],
    })

  for (const sec of sections) {
    const band = sectionBand(sec.score)
    if (!band) continue
    const alreadyMaterial = observations.some((o) =>
      o.statement.toLowerCase().includes(sectionLabel(sec.section).toLowerCase()),
    )
    if (alreadyMaterial) continue
    observations.push({
      id: `obs_${++counter}`,
      severity: bandSeverity(band),
      category: sectionToCategory(sec.section),
      statement: SECTION_OBSERVATION_COPY[sec.section][band],
      evidence: [
        `${sectionLabel(sec.section)} section score: ${sec.score}/100 (${band} band)`,
      ],
    })
  }

  const criticalLow = traces.filter((t) => t.effectiveScore === 0)
  if (criticalLow.length >= 5) {
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'operational',
      statement: `Across ${criticalLow.length} assessment items, the institution reports the practice as entirely absent. Taken together, this is not a series of isolated gaps — it is the signature of an organization whose continuity infrastructure has not yet been built, and which is currently sustained by individual effort alone.`,
      evidence: criticalLow.slice(0, 3).map((t) => `Question ${t.questionId} rated absent`),
    })
  }

  return observations
}

function sectionToCategory(section: SectionId): ContinuityObservation['category'] {
  const map: Record<SectionId, ContinuityObservation['category']> = {
    organizational_context: 'governance',
    operational_dependency: 'operational',
    governance_visibility: 'governance',
    institutional_memory: 'memory',
    transition_readiness: 'transition',
    operational_coordination: 'operational',
    explainability_trust: 'trust',
    sovereignty_governance: 'sovereignty',
  }
  return map[section]
}

function sectionLabel(section: SectionId): string {
  const labels: Record<SectionId, string> = {
    organizational_context: 'Organizational Context',
    operational_dependency: 'Operational Dependency',
    governance_visibility: 'Governance Visibility',
    institutional_memory: 'Organizational Memory',
    transition_readiness: 'Transition Readiness',
    operational_coordination: 'Operational Coordination',
    explainability_trust: 'Explainability & Trust',
    sovereignty_governance: 'Sovereignty & Data Governance',
  }
  return labels[section]
}

/**
 * Sector-aware peer framing. Maps the metadata sector code to an editorial
 * line that situates the institution among comparable organizations. Returns
 * null for unknown or unspecified sectors, so the caller can fall back to
 * sector-agnostic copy.
 */
function sectorPeerStatement(sector?: string): string | null {
  if (!sector) return null
  const lines: Record<string, string> = {
    public_sector:
      'Public-sector institutions of this type typically carry their continuity risk in two places: in the discretion held by long-tenured staff who interpret policy day to day, and in the documentary trail required to defend decisions through ministerial, AG, or oversight review. Both surfaces appear in this profile.',
    private_sector:
      'Private-sector organizations of this scale most often experience continuity risk through the unrecognized dependence on a small group of senior operators \u2014 the people who hold customer history, vendor relationships, and informal authority in roles that have never been formally documented.',
    healthcare:
      'Healthcare and social-services organizations typically absorb their continuity load through clinical and administrative staff doing informal coordination work that the formal structure does not name. This profile is consistent with that pattern.',
    education:
      'Education institutions typically experience continuity risk most acutely at the seams between governance bodies, administration, and instructional staff \u2014 where decisions are made in one structure and implemented in another, often without a shared record of how the two were reconciled.',
    construction:
      'Skilled-trades and construction organizations carry continuity primarily in the experiential judgement of senior tradespeople and field leadership \u2014 a form of institutional memory that is rarely captured in formal systems and rarely transferred deliberately.',
    transportation:
      'Transportation and logistics organizations typically depend on operational coordination that has been refined informally over years \u2014 routing decisions, vendor relationships, and exception handling that exist in the heads of dispatchers and operations leads rather than in formal procedure.',
    retail_hospitality:
      'Retail and hospitality organizations typically carry continuity through long-tenured store and venue managers whose operational judgement is rarely formalized \u2014 visible only when one of them leaves and the gap appears in service, throughput, or staff retention.',
    media_communications:
      'Media and communications organizations typically experience continuity risk through the editorial judgement, source relationships, and brand interpretation that travel with specific people rather than being captured in institutional process.',
    financial_services:
      'Financial-services organizations of this scale typically carry continuity risk most consequentially in the audit and decision-evidence layer \u2014 where regulatory exposure depends on the institution being able to reconstruct why a decision was made, by whom, and against what record.',
    other:
      'For organizations of this composition, the most consequential continuity risk usually sits in the informal stewardship layer \u2014 the people who carry institutional understanding that has not yet been named, measured, or distributed.',
  }
  return lines[sector] ?? null
}

function generateRecommendations(
  composite: number,
  dimensions: DimensionScore[],
): FollowupRecommendation[] {
  const recs: FollowupRecommendation[] = []

  if (composite < 35)
    recs.push({
      id: 'rec_continuity_review',
      kind: 'continuity_review',
      title: 'Structured Continuity Review',
      description:
        'At this band, the most productive next step is rarely another initiative — it is a calm, structured continuity review that names what the institution is already carrying invisibly, and sequences a short list of interventions that will hold across the next transition.',
      ctaLabel: 'Request a Continuity Review',
      ctaHref: '/continuity-assessment#contact',
    })
  if (composite < 60)
    recs.push({
      id: 'rec_starter_kit',
      kind: 'starter_kit',
      title: 'Continuity Starter Kit',
      description:
        'A short, plain-language reference for institutions beginning to formalize operational memory: templates for governance lineage, transition handover, and the documentation patterns that survive turnover rather than decay with it.',
      ctaLabel: 'Access the Starter Kit',
      ctaHref: '/resources/continuity-starter-kit',
    })

  const gf = dimensions.find((d) => d.dimension === 'governance_fragility')?.score ?? 100
  if (gf < 50)
    recs.push({
      id: 'rec_governance_workshop',
      kind: 'governance_workshop',
      title: 'Governance Documentation Workshop',
      description:
        'A facilitated working session for leadership and governance bodies focused on decision traceability, precedent capture, and the practical question of how policy is actually interpreted between meetings. Designed to leave the room with artifacts, not a deck.',
      ctaLabel: 'Explore Workshop Options',
      ctaHref: '/services/governance-workshops',
    })
  if (composite >= 60)
    recs.push({
      id: 'rec_pilot_conversation',
      kind: 'pilot_conversation',
      title: 'Assessment Walkthrough',
      description:
        'The institution already holds meaningful continuity maturity. A short walkthrough conversation translates this profile into the two or three highest-leverage moves available to you this quarter — without commitment, sales pressure, or a vendor pitch.',
      ctaLabel: 'Schedule a Conversation',
      ctaHref: '/continuity-assessment#contact',
    })

  return recs
}
