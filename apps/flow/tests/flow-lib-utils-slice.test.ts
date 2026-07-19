import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAuth,
  mockCurrentUser,
  mockCreateRequestContext,
  mockRunWithContext,
  mockCalcQc,
  mockFormatCurrency,
  mockCalcOrgTaxes,
  mockFormatOrgCurrency,
  mockBuildCommerceEvidencePack,
  mockBuildTransitionAuditEntry,
  mockIsSuperAdmin,
  mockGetOrgCommerceConfig,
  mockDbLimit,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCurrentUser: vi.fn(),
  mockCreateRequestContext: vi.fn(),
  mockRunWithContext: vi.fn(async (_ctx, handler: () => Promise<unknown>) => handler()),
  mockCalcQc: vi.fn((n: number) => ({ subtotal: n, total: n * 1.14975 })),
  mockFormatCurrency: vi.fn((_n: number, c: string) => `${c}-fmt`),
  mockCalcOrgTaxes: vi.fn((n: number) => ({ subtotal: n, total: n + 1 })),
  mockFormatOrgCurrency: vi.fn((n: number) => `org-${n}`),
  mockBuildCommerceEvidencePack: vi.fn(async (req) => ({ ok: true, request: req })),
  mockBuildTransitionAuditEntry: vi.fn(() => ({ audit: true })),
  mockIsSuperAdmin: vi.fn(() => false),
  mockGetOrgCommerceConfig: vi.fn(async () => ({ currency: 'CAD', locale: 'en-CA' })),
  mockDbLimit: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mockAuth,
  currentUser: mockCurrentUser,
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  createRequestContext: mockCreateRequestContext,
  runWithContext: mockRunWithContext,
}))

vi.mock('@nzila/pricing-engine', () => ({
  calculateQuebecTaxes: mockCalcQc,
  formatCurrency: mockFormatCurrency,
}))

vi.mock('@nzila/platform-commerce-org/pricing', () => ({
  calculateTaxes: mockCalcOrgTaxes,
  formatCurrency: mockFormatOrgCurrency,
}))

vi.mock('@nzila/commerce-audit', () => ({
  buildCommerceEvidencePack: mockBuildCommerceEvidencePack,
  buildTransitionAuditEntry: mockBuildTransitionAuditEntry,
  CommerceEntityType: { QUOTE: 'QUOTE' },
  AuditAction: {},
}))

vi.mock('@nzila/os-core', () => ({
  isSuperAdmin: mockIsSuperAdmin,
}))

vi.mock('@nzila/platform-commerce-org/service', () => ({
  getOrgCommerceConfig: mockGetOrgCommerceConfig,
}))

vi.mock('@nzila/db', () => {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: mockDbLimit,
  }
  return {
    db: { select: vi.fn(() => chain) },
    orgs: { id: 'id_col', clerkOrgId: 'clerk_col' },
  }
})

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
}))

vi.mock('@nzila/commerce-core', () => ({
  OrgRole: { OWNER: 'owner', ADMIN: 'admin', MANAGER: 'manager', SALES: 'sales', VIEWER: 'viewer' },
}))

describe('Flow lib utilities slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('api guards authenticate user/org and apply request context wrapper', async () => {
    const { authenticateUser, authenticateOrgUser, withRequestContext } = await import('@/lib/api-guards')

    mockAuth.mockResolvedValueOnce({ userId: null })
    const unauth = await authenticateUser()
    expect(unauth.ok).toBe(false)

    mockAuth.mockResolvedValueOnce({ userId: 'u-2' })
    const userOnly = await authenticateUser()
    expect(userOnly).toEqual({ ok: true, userId: 'u-2' })

    mockAuth.mockResolvedValueOnce({ userId: 'u-1', orgId: null })
    const noOrg = await authenticateOrgUser()
    expect(noOrg.ok).toBe(false)

    mockAuth.mockResolvedValueOnce({ userId: 'u-1', orgId: 'o-1' })
    const ok = await authenticateOrgUser()
    expect(ok.ok).toBe(true)

    mockCreateRequestContext.mockReturnValue({ requestId: 'r-1' })
    const wrapped = await withRequestContext(new Request('http://localhost/test'), async () => 'done')
    expect(wrapped).toBe('done')
    expect(mockRunWithContext).toHaveBeenCalledTimes(1)
  })

  it('pricing delegates to pricing engines and exports display constants', async () => {
    const pricing = await import('@/lib/pricing')

    expect(pricing.calculateQuebecTaxes(100).total).toBeCloseTo(114.975, 6)
    expect((pricing.calculateOrgTaxes(100, { currency: 'CAD', locale: 'en-CA' } as never) as unknown as { total: number }).total).toBe(101)
    expect(pricing.formatCAD(22)).toBe('CAD-fmt')
    expect(pricing.formatOrgCurrency(33, { currency: 'CAD', locale: 'en-CA' } as never)).toBe('org-33')
    expect(pricing.TIER_LABELS.PREMIUM).toBe('Premium')
    expect(pricing.STATUS_CONFIG.ACCEPTED.label).toBe('Accepted')
  })

  it('evidence helpers build transition and evidence pack requests', async () => {
    const evidence = await import('@/lib/evidence')

    const audit = evidence.auditQuoteTransition({
      quoteId: 'q-1',
      fromStatus: 'DRAFT',
      toStatus: 'SENT',
      userId: 'u-1',
      orgId: 'o-1',
    })
    expect(audit).toEqual({ audit: true })

    const req = evidence.buildEvidencePackFromAction({ actionType: 'Quote_Sent', orgId: 'o-1', actorId: 'u-1' })
    expect(req.triggerEvent).toBe('quote_sent')

    const pack = await evidence.processEvidencePack(req)
    expect((pack as unknown as { ok: boolean }).ok).toBe(true)
  })

  it('org-resolver resolves org IDs and builds read/db contexts', async () => {
    const { resolveInternalOrgId, getReadContext, getDbContext } = await import('@/lib/org-resolver')

    mockDbLimit.mockResolvedValueOnce([{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }])
    const resolved = await resolveInternalOrgId('org_ext')
    expect(resolved).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')

    mockAuth.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org_ext' })
    const readCtx = await getReadContext()
    expect(readCtx.orgId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')

    mockAuth.mockResolvedValueOnce({ userId: 'u-1', orgId: 'org_ext' })
    const dbCtx = await getDbContext()
    expect(dbCtx.actorId).toBe('u-1')
  })

  it('resolve-org derives roles/permissions and commerce context', async () => {
    const { resolveOrgContext, resolveOrgCommerceContext } = await import('@/lib/resolve-org')

    mockDbLimit.mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }])
    mockAuth.mockResolvedValue({ userId: 'u-1', orgId: 'ext-org', orgRole: 'org:member' })
    mockCurrentUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'root@example.com' } })
    mockIsSuperAdmin.mockReturnValue(true)

    const ctx = await resolveOrgContext()
    expect(ctx.role).toBe('admin')
    expect(ctx.permissions).toContain('quote:approve')

    const cc = await resolveOrgCommerceContext()
    expect(cc.ctx.orgId).toBe('11111111-1111-4111-8111-111111111111')
    expect((cc.config as unknown as { currency: string }).currency).toBe('CAD')
  })
})
