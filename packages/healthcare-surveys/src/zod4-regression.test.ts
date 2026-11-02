import { describe, expect, it } from 'vitest'
import { HealthcareSurveyResponseSchema, HealthcareSurveyQuestionSchema } from './types'
describe('Zod 4 healthcare survey boundary', () => {
  it('preserves response defaults and typed record boundaries', () => {
    const response = { id: 'response-1', surveyId: 'survey-1', anonymousResponseId: 'anon-1', submittedAt: '2026-11-02T00:00:00Z', answers: { q1: ['yes', 'no'] }, workflowScores: { scheduling: 0.75 }, createdAt: '2026-11-02T00:00:00Z' }
    const parsed = HealthcareSurveyResponseSchema.parse(response)
    expect(parsed.reviewStatus).toBe('unreviewed')
    expect(parsed.concernTags).toEqual([])
    expect(parsed.answers).toEqual(response.answers)
    expect(HealthcareSurveyResponseSchema.safeParse({ ...response, workflowScores: { scheduling: 'high' } }).success).toBe(false)
    expect(HealthcareSurveyResponseSchema.safeParse({ ...response, answers: ['not-a-record'] }).success).toBe(false)
  })
  it('retains privacy defaults and rejects unknown question types', () => {
    const question = { id: 'q1', text: 'Question', type: 'yes_no_unsure', displayOrder: 0 }
    expect(HealthcareSurveyQuestionSchema.parse(question).avoidIdentifyingDetails).toBe(true)
    expect(HealthcareSurveyQuestionSchema.safeParse({ ...question, type: 'unrecognized' }).success).toBe(false)
  })
})
