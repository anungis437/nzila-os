import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canonical: vi.fn(),
  activeTenantDb: vi.fn(),
  withSystemContext: vi.fn(),
}))

vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: m.canonical }))
vi.mock('@/db/tenant-context-storage', () => ({ getActiveTenantDb: m.activeTenantDb }))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }))

import { withOrgOwnedContext } from '../org-owned-context'

describe('withOrgOwnedContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.withSystemContext.mockImplementation((operation: () => Promise<unknown>) => operation())
  })

  it('canonical: runs inside the caller tenant transaction and never opens a SYSTEM context', async () => {
    m.canonical.mockReturnValue(true)
    m.activeTenantDb.mockReturnValue({})
    await expect(withOrgOwnedContext(async () => 'rows')).resolves.toBe('rows')
    expect(m.withSystemContext).not.toHaveBeenCalled()
  })

  it('canonical: fails closed without an active tenant transaction and does not run the work', async () => {
    m.canonical.mockReturnValue(true)
    m.activeTenantDb.mockReturnValue(undefined)
    const work = vi.fn(async () => 'rows')
    await expect(withOrgOwnedContext(work)).rejects.toThrow('ORG_OWNED_CONTEXT_REQUIRES_TENANT_TRANSACTION')
    expect(work).not.toHaveBeenCalled()
    expect(m.withSystemContext).not.toHaveBeenCalled()
  })

  it('legacy: keeps the historical SYSTEM context', async () => {
    m.canonical.mockReturnValue(false)
    await expect(withOrgOwnedContext(async () => 'rows')).resolves.toBe('rows')
    expect(m.withSystemContext).toHaveBeenCalledTimes(1)
  })
})
