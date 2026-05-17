export type AnswerRecord = Record<string, unknown>

export const WORKFLOW_QUESTION_MAP: Record<string, string> = {
  q7: 'schedule_change_tracking',
  q8: 'open_shift_transparency',
  q9: 'shift_exchange_clarity',
  q10: 'agreement_review_prompts',
  q11: 'evidence_timeline',
  q12: 'evidence_packet',
}

function toRating(value: unknown): number | null {
  if (typeof value === 'number' && value >= 1 && value <= 5) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) return parsed
  }
  return null
}

export function computeWorkflowScores(answers: AnswerRecord): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const [questionId, workflow] of Object.entries(WORKFLOW_QUESTION_MAP)) {
    const rating = toRating(answers[questionId])
    if (rating !== null) scores[workflow] = rating
  }
  return scores
}

export function aggregateWorkflowScores(
  responses: Array<{ answers: AnswerRecord; workflowScores?: Record<string, number> }>,
): Record<string, number> {
  const totals: Record<string, { total: number; count: number }> = {}

  for (const response of responses) {
    const source = response.workflowScores ?? computeWorkflowScores(response.answers)
    for (const [workflow, score] of Object.entries(source)) {
      if (!totals[workflow]) totals[workflow] = { total: 0, count: 0 }
      totals[workflow].total += score
      totals[workflow].count += 1
    }
  }

  const averages: Record<string, number> = {}
  for (const [workflow, info] of Object.entries(totals)) {
    averages[workflow] = Number((info.total / info.count).toFixed(2))
  }
  return averages
}
