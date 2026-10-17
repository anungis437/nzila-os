import { afterEach, describe, expect, it, vi } from 'vitest'

const append = vi.fn()
vi.mock('../canonical-audit-chain', () => ({ appendCanonicalAuditLog: append }))

describe('appendMandatoryAudit', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })
  const entry = {
    organizationId: '3086b9ba-7e02-4b29-8ed5-0636d590e22b',
    action: 'claim.create',
    resourceType: 'claims',
    details: {},
  }

  it('appends to the canonical sink in Canonical V2 and lets failures propagate', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    const { appendMandatoryAudit } = await import('../mandatory-audit')
    append.mockResolvedValueOnce({ contentHash: 'h', previousHash: null })
    expect(await appendMandatoryAudit({} as never, entry)).toBe(true)
    append.mockRejectedValueOnce(new Error('audit_sink_down'))
    await expect(appendMandatoryAudit({} as never, entry)).rejects.toThrow('audit_sink_down')
  })

  it('does nothing outside Canonical V2 (legacy writer remains the caller responsibility)', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { appendMandatoryAudit } = await import('../mandatory-audit')
    expect(await appendMandatoryAudit({} as never, entry)).toBe(false)
    expect(append).not.toHaveBeenCalled()
  })
})
