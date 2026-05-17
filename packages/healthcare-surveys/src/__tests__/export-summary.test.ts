import { describe, expect, it } from 'vitest'
import { buildExecutiveSummary } from '../scoring/export-summary'

describe('executive export summary', () => {
  it('excludes unreviewed free-text content', () => {
    const summary = buildExecutiveSummary({
      surveyTitle: 'Unit 92 Scheduling Experience Survey',
      responseCount: 2,
      recommendationTitle: 'Start with Scheduling Event Timeline for Unit 92.',
      freeTextResponses: [
        {
          id: 'r1',
          reviewStatus: 'unreviewed',
          answers: { q16: 'hidden', q17: 'hidden-2' },
        },
        {
          id: 'r2',
          reviewStatus: 'reviewed',
          answers: { q16: 'allowed text', q17: 'allowed text 2' },
        },
      ],
    })

    expect(summary).toContain('allowed text')
    expect(summary).not.toContain('hidden')
  })
})
