import { describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  options: [] as Array<Record<string, unknown>>,
  contracts: [] as Array<{ summary: string; role: string }>,
}))

vi.mock('@/lib/api/with-api', () => ({
  withApi: (config: { openapi: { summary: string }; auth: { minRole: string } }) => {
    calls.contracts.push({ summary: config.openapi.summary, role: config.auth.minRole })
    return vi.fn()
  },
}))
vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }))

describe('testimonials item route: private editorial read boundary', () => {
  it('does not expose raw draft or restricted testimonial reads at the ordinary member floor', async () => {
    const { GET, PATCH, DELETE } = await import('../route')
    expect(typeof GET).toBe('function')
    expect(typeof PATCH).toBe('function')
    expect(typeof DELETE).toBe('function')

    const role = (action: string) => calls.contracts.find((entry) => entry.summary.startsWith(action))?.role
    expect(role('Get')).toBe('content_manager')
    expect(role('Update')).toBe('content_manager')
    expect(role('Delete')).toBe('content_manager')
  })
})
