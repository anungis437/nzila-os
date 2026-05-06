import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stable mock references ────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  withRequiredRole: vi.fn(),
  getResolvedSubscription: vi.fn(),
  canExportAudit: vi.fn(),
  canAccessTrustCenter: vi.fn(),
  canExportEvidence: vi.fn(),
  FREE_REMINDER_LIMIT: 5,
}))

vi.mock('@/lib/rbac/requireRole', () => ({
  withRequiredRole: mocks.withRequiredRole,
}))

vi.mock('@/lib/billing/getSubscription', () => ({
  getResolvedSubscription: mocks.getResolvedSubscription,
}))

vi.mock('@/lib/billing/featureAccess', () => ({
  canExportAudit: mocks.canExportAudit,
  canAccessTrustCenter: mocks.canAccessTrustCenter,
  canExportEvidence: mocks.canExportEvidence,
  FREE_REMINDER_LIMIT: mocks.FREE_REMINDER_LIMIT,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────
const fakeCtx = { userId: 'user_1', orgId: 'org_1', role: 'org_admin' as const }

const proSubscription = {
  plan: 'pro',
  status: 'active',
  isActive: true,
  currentPeriodEnd: new Date('2026-12-31T00:00:00.000Z'),
}

const freeSubscription = {
  plan: 'free',
  status: 'active',
  isActive: true,
  currentPeriodEnd: null,
}

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/billing/subscription', { method: 'GET' })
}

describe('GET /api/billing/subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mocks.withRequiredRole.mockImplementation(
      (_roles: unknown, handler: Function) =>
        (request: NextRequest) =>
          handler(request, fakeCtx),
    )
    mocks.canExportAudit.mockReturnValue(true)
    mocks.canAccessTrustCenter.mockReturnValue(true)
    mocks.canExportEvidence.mockReturnValue(true)
    mocks.getResolvedSubscription.mockResolvedValue(proSubscription)
  })

  it('returns success:true with subscription data', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.plan).toBe('pro')
    expect(body.data.status).toBe('active')
    expect(body.data.isActive).toBe(true)
  })

  it('serializes currentPeriodEnd as ISO string', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.currentPeriodEnd).toBe('2026-12-31T00:00:00.000Z')
  })

  it('returns null for currentPeriodEnd when not set', async () => {
    mocks.getResolvedSubscription.mockResolvedValue(freeSubscription)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.currentPeriodEnd).toBeNull()
  })

  it('pro plan has unlimitedReminders:true and reminderLimit:null', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.features.unlimitedReminders).toBe(true)
    expect(body.data.features.reminderLimit).toBeNull()
  })

  it('free plan has unlimitedReminders:false and reminderLimit equal to FREE_REMINDER_LIMIT', async () => {
    mocks.getResolvedSubscription.mockResolvedValue(freeSubscription)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.features.unlimitedReminders).toBe(false)
    expect(body.data.features.reminderLimit).toBe(5)
  })

  it('includes feature access flags from billing helpers', async () => {
    mocks.canExportAudit.mockReturnValue(false)
    mocks.canAccessTrustCenter.mockReturnValue(true)
    mocks.canExportEvidence.mockReturnValue(false)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.features.auditExport).toBe(false)
    expect(body.data.features.trustCenter).toBe(true)
    expect(body.data.features.evidenceExport).toBe(false)
  })

  it('calls getResolvedSubscription with the org ID from context', async () => {
    const { GET } = await import('./route')
    await GET(makeRequest())
    expect(mocks.getResolvedSubscription).toHaveBeenCalledWith('org_1')
  })
})
