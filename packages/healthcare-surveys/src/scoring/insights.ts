import type { HealthcareSurveyInsight } from '../types'
import { aggregateWorkflowScores } from './workflow-scores'

export function generateInsights(input: {
  surveyId: string
  responses: Array<{ answers: Record<string, unknown>; workflowScores?: Record<string, number> }>
  recommendationTitle: string
}): HealthcareSurveyInsight[] {
  const workflowAverages = aggregateWorkflowScores(input.responses)
  const topWorkflow = Object.entries(workflowAverages).sort((a, b) => b[1] - a[1])[0]

  const now = new Date().toISOString()

  const insights: HealthcareSurveyInsight[] = []

  if (topWorkflow) {
    insights.push({
      id: `insight-top-workflow-${input.surveyId}`,
      surveyId: input.surveyId,
      insightType: 'top_workflow',
      title: 'Strongest first workflow signal',
      summary: `${topWorkflow[0]} scored highest at ${topWorkflow[1]}.`,
      supportingMetric: topWorkflow[1],
      supportingCount: input.responses.length,
      confidence: input.responses.length >= 10 ? 'high' : input.responses.length >= 5 ? 'medium' : 'low',
      recommendedAction: input.recommendationTitle,
      createdAt: now,
    })
  }

  return insights
}
