/** Step 1 S1-A06 / C18: leadership indicators require an authenticated officer; below that nothing is computed or audited. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ authed: true, hasMinRole: vi.fn(), metrics: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (req: Request, ctx: { userId: string; organizationId: string }) => Promise<Response>) =>
    async (req: Request) => m.authed ? handler(req, { userId: 'u1', organizationId: 'org-1' })
      : new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 }),
}))
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }))
vi.mock('@/lib/audit/cape-audit-events', () => ({ emitCapeAuditEvent: m.audit, CAPE_AUDIT_EVENTS: { LEADERSHIP_REPORT_VIEWED: 'LEADERSHIP_REPORT_VIEWED' } }))
vi.mock('@/lib/services/dashboard-kpi-service', () => ({ getLeadershipDashboardMetrics: m.metrics }))

const get = async () => {
  const { GET } = await import('../dashboard/leadership/route')
  return (GET as unknown as (r: Request) => Promise<Response>)(new Request('http://localhost/api/dashboard/leadership?timeframe=weekly'))
}

describe('GET /api/dashboard/leadership authority', () => {
  beforeEach(() => { vi.clearAllMocks(); m.authed = true; m.metrics.mockResolvedValue({ totals: {} }) })
  it('refuses an unauthenticated caller with 401 before any metric is computed', async () => {
    m.authed = false
    expect((await get()).status).toBe(401)
    expect(m.metrics).not.toHaveBeenCalled()
  })
  it('refuses a caller below officer with 403; no metrics and no audit event', async () => {
    m.hasMinRole.mockResolvedValue(false)
    expect((await get()).status).toBe(403)
    expect(m.hasMinRole).toHaveBeenCalledWith('officer')
    expect(m.metrics).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })
  it('an officer reads the bound organization only, and the view is audited', async () => {
    m.hasMinRole.mockResolvedValue(true)
    expect((await get()).status).toBe(200)
    expect(m.metrics).toHaveBeenCalledWith({ organizationId: 'org-1', timeframe: 'weekly' })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', organizationId: 'org-1' }))
  })
})
