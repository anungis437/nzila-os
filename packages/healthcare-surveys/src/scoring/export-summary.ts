type ExportableResponse = {
  id: string
  reviewStatus: 'unreviewed' | 'reviewed' | 'flagged_for_redaction'
  answers: Record<string, unknown>
}

export function buildExecutiveSummary(options: {
  surveyTitle: string
  responseCount: number
  recommendationTitle: string
  freeTextResponses: ExportableResponse[]
}): string {
  const reviewedFreeText = options.freeTextResponses
    .filter((r) => r.reviewStatus === 'reviewed')
    .map((r) => ({ id: r.id, q16: r.answers.q16, q17: r.answers.q17 }))

  return JSON.stringify(
    {
      surveyTitle: options.surveyTitle,
      responseCount: options.responseCount,
      recommendationTitle: options.recommendationTitle,
      reviewedFreeText,
      note: 'Unreviewed free-text content is excluded by policy.',
    },
    null,
    2,
  )
}
