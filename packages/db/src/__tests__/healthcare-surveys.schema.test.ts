import { describe, expect, it } from 'vitest'
import {
  healthcareSurveyStatusEnum,
  healthcareSurveys,
  healthcareSurveyResponses,
  healthcareSurveyReviewStatusEnum,
} from '../schema/healthcare-surveys'

describe('healthcare surveys schema', () => {
  it('defines survey and response status enums', () => {
    expect(healthcareSurveyStatusEnum.enumValues).toEqual([
      'draft',
      'active',
      'closed',
      'archived',
    ])
    expect(healthcareSurveyReviewStatusEnum.enumValues).toEqual([
      'unreviewed',
      'reviewed',
      'flagged_for_redaction',
    ])
  })

  it('has org and survey foreign-key columns', () => {
    expect(healthcareSurveys.orgId).toBeDefined()
    expect(healthcareSurveyResponses.surveyId).toBeDefined()
  })

  it('includes campaign and share token columns', () => {
    expect(healthcareSurveys.campaignKey).toBeDefined()
    expect(healthcareSurveys.shareToken).toBeDefined()
  })
})
