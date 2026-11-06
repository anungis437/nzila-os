import { describe, expect, it, vi } from 'vitest'

// DEF-0B3-ARBITRATION-RECORD-NO-CASE-AUTHORITY: both arbitration routes read through the case authority's per-row verdict, the item
// route never deletes, and the grievance and the arbitration number are not rewritten after creation.
const captured = vi.hoisted(() => ({ opts: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: (opts: Record<string, unknown>) => {
    captured.opts.push(opts)
    return opts.itemRoute ? { GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() } : { GET: vi.fn(), POST: vi.fn() }
  },
}))

import { arbitrationRowReadable } from '@/lib/arbitration/arbitration-case-authority'

describe('arbitration routes read under the case authority', () => {
  it('the collection lists only arbitrations of cases the caller may read, and creates only the referral fields', async () => {
    captured.opts = []
    await import('@/app/api/arbitrations/route')
    const [opts] = captured.opts
    expect(opts.rowReadAuthority).toBe(arbitrationRowReadable)
    const writable = opts.writableFields as string[]
    expect(writable).toContain('grievanceId')
    for (const field of ['status', 'award', 'awardDate', 'actualCost', 'organizationId', 'arbitratorIds']) expect(writable).not.toContain(field)
  })

  it('the item answers 404 for a case the caller may not read, retains on delete, and re-checks writes under the lock', async () => {
    captured.opts = []
    await import('@/app/api/arbitrations/[id]/route')
    const [opts] = captured.opts
    expect(opts.rowReadAuthority).toBe(arbitrationRowReadable)
    expect(opts.retainOnDelete).toBe(true)
    expect(typeof opts.lockedAuthCheck).toBe('function')
    const writable = opts.writableFields as string[]
    for (const field of ['grievanceId', 'arbitrationNumber', 'organizationId', 'arbitratorIds']) expect(writable).not.toContain(field)
  })
})
