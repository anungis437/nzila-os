import { describe, expect, it } from 'vitest'
import { UNIT_92_CAMPAIGN_SEED } from '../campaigns/una-local-115-unit-92'

describe('Unit 92 campaign seed', () => {
  it('targets Local 115 and Unit 92 with anonymous default', () => {
    expect(UNIT_92_CAMPAIGN_SEED.localName).toBe('UNA Local 115')
    expect(UNIT_92_CAMPAIGN_SEED.unitName).toBe('Unit 92, Short Stay Cardiology')
    expect(UNIT_92_CAMPAIGN_SEED.anonymous).toBe(true)
    expect(UNIT_92_CAMPAIGN_SEED.status).toBe('draft')
  })

  it('keeps champion label internal-only', () => {
    expect(UNIT_92_CAMPAIGN_SEED.championLabel).toBe('Heather Haberli')
    expect(UNIT_92_CAMPAIGN_SEED.championInternalOnly).toBe(true)
  })

  it('does not include respondent name/email fields in template', () => {
    const text = UNIT_92_CAMPAIGN_SEED.template.questions.map((q) => q.text.toLowerCase()).join(' ')
    expect(text).not.toContain('your name')
    expect(text).not.toContain('email address')
  })
})
