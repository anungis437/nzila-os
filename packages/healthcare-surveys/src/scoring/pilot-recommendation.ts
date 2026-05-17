import type { HealthcarePilotRecommendation } from '../types'
import { aggregateWorkflowScores } from './workflow-scores'

type ResponseInput = {
  surveyId: string
  answers: Record<string, unknown>
  workflowScores?: Record<string, number>
}

type CampaignContext = {
  localName?: string
  unitName?: string
  championLabel?: string
}

const WEDGE_BY_WORKFLOW: Record<string, HealthcarePilotRecommendation['recommendedWedge']> = {
  schedule_change_tracking: 'schedule_change_log',
  open_shift_transparency: 'open_shift_offer_trace',
  shift_exchange_clarity: 'shift_exchange_checklist',
  agreement_review_prompts: 'agreement_review_prompts',
  evidence_timeline: 'scheduling_event_timeline',
  evidence_packet: 'evidence_packet',
}

function topConcernTags(responses: ResponseInput[]): string[] {
  const counts = new Map<string, number>()
  for (const r of responses) {
    const concerns = Array.isArray(r.answers.q15) ? (r.answers.q15 as string[]) : []
    for (const concern of concerns) {
      counts.set(concern, (counts.get(concern) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
}

function topQ13Choice(responses: ResponseInput[]): string | null {
  const counts = new Map<string, number>()
  for (const r of responses) {
    const choice = typeof r.answers.q13 === 'string' ? r.answers.q13 : null
    if (!choice) continue
    counts.set(choice, (counts.get(choice) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

function resolveConfidence(responseCount: number, top: number, runnerUp: number): 'low' | 'medium' | 'high' {
  if (responseCount < 5) return 'low'
  if (responseCount < 10) return 'medium'
  const margin = top - runnerUp
  if (margin > 0.5) return 'high'
  return 'medium'
}

function targetAwareTitle(wedge: HealthcarePilotRecommendation['recommendedWedge']): string {
  if (wedge === 'schedule_change_log') return 'Start with a small Schedule Change Log for Unit 92.'
  if (wedge === 'open_shift_offer_trace') return 'Start with Open Shift Offer Trace for Unit 92.'
  if (wedge === 'scheduling_event_timeline') return 'Start with Scheduling Event Timeline for Unit 92.'
  if (wedge === 'shift_exchange_checklist') return 'Start with Shift Exchange Checklist for Unit 92.'
  return 'Start with a small discovery workflow for Unit 92.'
}

function targetAwareRationale(wedge: HealthcarePilotRecommendation['recommendedWedge']): string {
  if (wedge === 'schedule_change_log') {
    return 'Respondents indicated that before/after schedule visibility and notice-window clarity may be the safest first workflow to validate.'
  }
  if (wedge === 'open_shift_offer_trace') {
    return 'Respondents indicated that offer sequence, eligibility, and response visibility are important enough to validate first.'
  }
  if (wedge === 'scheduling_event_timeline') {
    return 'Respondents indicated that reconstructing what happened after a scheduling issue is difficult. A timeline is a low-risk first workflow because it can support multiple scheduling issues without replacing any employer scheduling system.'
  }
  return 'Respondents signaled this as a practical low-risk discovery workflow to validate first on Unit 92.'
}

export function recommendPilotWedge(
  surveyId: string,
  responses: ResponseInput[],
  campaignContext?: CampaignContext,
): HealthcarePilotRecommendation {
  const averages = aggregateWorkflowScores(responses)
  const entries = Object.entries(averages).sort((a, b) => b[1] - a[1])
  const [topWorkflow, topScore] = entries[0] ?? ['schedule_change_tracking', 0]
  const runnerUp = entries[1]?.[1] ?? 0

  const concerns = topConcernTags(responses)
  const q13 = topQ13Choice(responses)

  let recommendedWedge = WEDGE_BY_WORKFLOW[topWorkflow] ?? 'discovery_only'

  if ((averages.evidence_timeline ?? 0) >= 4 && (averages.evidence_packet ?? 0) >= 4) {
    recommendedWedge = 'scheduling_event_timeline'
  }

  if (
    topWorkflow === 'schedule_change_tracking' &&
    q13 === 'Schedule change tracking'
  ) {
    recommendedWedge = 'schedule_change_log'
  }

  if (
    topWorkflow === 'open_shift_transparency' &&
    q13 === 'Open shift offer transparency'
  ) {
    recommendedWedge = 'open_shift_offer_trace'
  }

  if (topWorkflow === 'shift_exchange_clarity') {
    recommendedWedge = 'shift_exchange_checklist'
  }

  const privacyConcernHits = concerns.filter((c) =>
    ['Privacy', 'Being identified', 'Employer access'].includes(c),
  ).length
  const misinterpretationHits = concerns.filter((c) =>
    ['Misinterpretation of the collective agreement'].includes(c),
  ).length

  const adoptionRisks: string[] = []
  if (privacyConcernHits > 0) {
    adoptionRisks.push('Clarify data governance before any pilot.')
  }
  if (privacyConcernHits > 0 || misinterpretationHits > 0) {
    adoptionRisks.push(
      'Before any workflow pilot, clarify data governance, anonymity, employer access boundaries, and how Local/UNA review would work.',
    )
  }

  if (topWorkflow === 'agreement_review_prompts' && (privacyConcernHits > 0 || misinterpretationHits > 0)) {
    recommendedWedge = 'discovery_only'
  }

  const confidence = resolveConfidence(responses.length, topScore, runnerUp)

  const useTargetLanguage = Boolean(
    campaignContext?.localName === 'UNA Local 115' && campaignContext?.unitName?.includes('Unit 92'),
  )

  const title = useTargetLanguage
    ? targetAwareTitle(recommendedWedge)
    : `Recommended first wedge: ${recommendedWedge}`

  const rationale = useTargetLanguage
    ? targetAwareRationale(recommendedWedge)
    : `Top workflow signal is ${topWorkflow}.`

  return {
    surveyId,
    recommendedWedge,
    title,
    rationale,
    supportingScores: averages,
    adoptionRisks,
    confidence,
    recommendedNextStep:
      'Run one small governed pilot workflow only after confirming privacy guardrails and stakeholder understanding.',
  }
}
