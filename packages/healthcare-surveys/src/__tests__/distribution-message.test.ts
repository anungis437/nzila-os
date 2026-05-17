import { describe, expect, it } from 'vitest'
import { UNIT_92_CAMPAIGN_SEED } from '../campaigns/una-local-115-unit-92'
import { assertDistributionMessageSafe } from '../privacy/guardrails'

describe('distribution message', () => {
  it('avoids disallowed framing', () => {
    const message = UNIT_92_CAMPAIGN_SEED.distributionMessage.toLowerCase()
    expect(message).not.toContain('grievance intake')
    expect(message).toContain('not an employer audit')
    expect(message).toContain('do not include patient names')
    expect(message).not.toContain('your name')
    expect(message).not.toContain('base44')
    expect(message).not.toContain('nzila')
    expect(message).not.toContain('unioneyes')
  })

  it('passes distribution safety assertion', () => {
    expect(() => assertDistributionMessageSafe(UNIT_92_CAMPAIGN_SEED.distributionMessage)).not.toThrow()
  })
})
