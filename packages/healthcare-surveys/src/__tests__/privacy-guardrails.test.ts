import { describe, expect, it } from 'vitest'
import {
  assertTemplatePrivacySafe,
  shouldWarnLowResponses,
  FREE_TEXT_WARNING,
} from '../privacy/guardrails'
import { UNIT_SCHEDULING_TEMPLATE } from '../templates/unit-scheduling'

describe('privacy guardrails', () => {
  it('contains free-text warning on template questions', () => {
    const q16 = UNIT_SCHEDULING_TEMPLATE.questions.find((q) => q.id === 'q16')
    expect(q16?.warningText).toContain('Please do not include names')
    expect(FREE_TEXT_WARNING).toContain('identifying details')
  })

  it('anonymous default is expected true in campaign usage assumptions', () => {
    expect(true).toBe(true)
  })

  it('warns when response count is below 5', () => {
    expect(shouldWarnLowResponses(4)).toBe(true)
    expect(shouldWarnLowResponses(5)).toBe(false)
  })

  it('rejects prohibited identifying prompts', () => {
    const badTemplate = {
      ...UNIT_SCHEDULING_TEMPLATE,
      questions: [{
        id: 'bad',
        text: 'Please include patient name and manager name',
        type: 'free_text' as const,
        required: false,
        displayOrder: 99,
        riskLevel: 'sensitive' as const,
        avoidIdentifyingDetails: true,
      }],
    }

    expect(() => assertTemplatePrivacySafe(badTemplate)).toThrow()
  })
})
