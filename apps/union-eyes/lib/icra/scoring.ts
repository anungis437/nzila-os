/**
 * ARTIFACT TYPE: Scoring Engine
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Operational
 *
 * ICRA Scoring Engine — fully explainable, dimension-weighted institutional
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
  InstitutionalContinuityProfile,
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

export interface ComputeProfileInput {
  assessmentId: string
  answers: Answer[]
}

export function buildAnswer(question: Question, rawValue: string | number, note?: string): Answer {
  return {
    questionId: question.id,
    questionVersion: QUESTION_BANK_VERSION,
    rawValue,
    normalizedScore: normalizeQuestionScore(question, rawValue),
    weightsSnapshot: { ...question.weights },
    riskInverted: question.riskInverted ?? false,
    note: note?.trim() || undefined,
    answeredAt: new Date().toISOString(),
  }
}

export function computeProfile({
  assessmentId,
  answers,
}: ComputeProfileInput): InstitutionalContinuityProfile {
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

export function scoreAssessment(
  assessmentId: string,
  answers: Answer[],
): {
  profile: InstitutionalContinuityProfile
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

  const observations = generateObservations(dimensionScores, sections, questionTraces)
  const recommendations = generateRecommendations(composite, dimensionScores)
  const insightOutput = generateInsights(dimensionScores, sections)

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
  const profile: InstitutionalContinuityProfile = {
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

function generateObservations(
  dimensions: DimensionScore[],
  sections: SectionScore[],
  traces: QuestionTrace[],
): ContinuityObservation[] {
  const observations: ContinuityObservation[] = []
  let counter = 0

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
        'This organization shows characteristics of personality-dependent continuity — institutional operations are significantly reliant on specific individuals rather than documented processes.',
      evidence: ['institutional_continuity dimension score below 40'],
    })
  if (gf < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'governance',
      statement:
        'Governance fragility indicators are elevated. Decisions may not be traceable, oversight may rely on individual gatekeeping, or governance procedures are inconsistently applied.',
      evidence: ['governance_fragility dimension score indicates significant structural risk'],
    })
  if (td < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'trust',
      statement:
        'Institutional trust debt is a material concern. Accumulated unresolved decisions, unexplained conduct, or informal authority patterns represent ongoing risk to governance legitimacy.',
      evidence: ['trust_debt dimension score indicates elevated accumulated risk'],
    })
  if (om < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'memory',
      statement:
        'Operational memory is critically low. Critical institutional knowledge exists primarily in individuals rather than organizational systems, creating acute vulnerability to personnel changes.',
      evidence: ['operational_memory dimension score below 40'],
    })
  if (tr < 40)
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'transition',
      statement:
        'Transition readiness is severely underdeveloped. This organization is likely to experience significant operational disruption from planned or unplanned leadership changes.',
      evidence: ['transition_readiness dimension score below 40'],
    })

  const lowSections = sections.filter((s) => s.score < 50)
  for (const sec of lowSections) {
    const alreadyMaterial = observations.some((o) =>
      o.statement.toLowerCase().includes(sec.section.replace(/_/g, ' ')),
    )
    if (!alreadyMaterial) {
      observations.push({
        id: `obs_${++counter}`,
        severity: 'attention',
        category: sectionToCategory(sec.section),
        statement: `The ${sectionLabel(sec.section)} dimension shows results warranting structured review. Average maturity is below mid-scale, indicating underdeveloped institutional practices in this area.`,
        evidence: [`Section score: ${sec.score}/100`],
      })
    }
  }

  const criticalLow = traces.filter((t) => t.effectiveScore === 0)
  if (criticalLow.length >= 5) {
    observations.push({
      id: `obs_${++counter}`,
      severity: 'material',
      category: 'operational',
      statement: `${criticalLow.length} assessment dimensions were rated as entirely absent. This pattern indicates systemic underdevelopment across institutional continuity infrastructure.`,
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
    institutional_memory: 'Institutional Memory',
    transition_readiness: 'Transition Readiness',
    operational_coordination: 'Operational Coordination',
    explainability_trust: 'Explainability & Trust',
    sovereignty_governance: 'Sovereignty & Data Governance',
  }
  return labels[section]
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
        'Given the assessment results, a structured continuity review with an experienced ICRA facilitator can help your organization develop a prioritized intervention plan.',
      ctaLabel: 'Request a Continuity Review',
      ctaHref: '/continuity-assessment#contact',
    })
  if (composite < 60)
    recs.push({
      id: 'rec_starter_kit',
      kind: 'starter_kit',
      title: 'ICRA Institutional Continuity Starter Kit',
      description:
        'Access practical templates, documentation frameworks, and guidance developed specifically for labour organizations at this maturity stage.',
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
        'A focused workshop on governance documentation practices, decision traceability, and oversight infrastructure for your leadership team.',
      ctaLabel: 'Explore Workshop Options',
      ctaHref: '/services/governance-workshops',
    })
  if (composite >= 60)
    recs.push({
      id: 'rec_pilot_conversation',
      kind: 'pilot_conversation',
      title: 'Schedule an Assessment Walkthrough',
      description:
        'Your organization shows meaningful continuity maturity. A walkthrough conversation can help identify the highest-leverage next steps given your specific profile.',
      ctaLabel: 'Schedule a Conversation',
      ctaHref: '/continuity-assessment#contact',
    })

  return recs
}
