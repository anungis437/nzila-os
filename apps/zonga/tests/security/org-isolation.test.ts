/**
 * Phase 3 — P1 Org-isolation regression tests for the Zonga payouts surface.
 *
 * Covers the following acceptance scenarios:
 *  1. Creator (or any caller scoped to OrgA) cannot list/mutate payouts for OrgB.
 *  4. Missing org membership returns 403 (ORG_SCOPE_REQUIRED) and short-circuits.
 *  7. The payout action layer receives the orgId resolved by withOrgScope, and any
 *     attempt to override it via the request body is ignored.
 *
 * These tests pin the route's behaviour around `withOrgScope` so that no future
 * regression can let a payout call escape the resolved org boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

// ── Mock module boundaries (declared before dynamic import) ─────────────────
const mockWithOrgScope = vi.fn()
const mockRequireRole = vi.fn()
const mockListPayouts = vi.fn()
const mockExecutePayout = vi.fn()
const mockEnforceDecision = vi.fn()

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user_test' }),
}))

vi.mock('@/lib/api-guards', () => ({
  withOrgScope: (req: Request, handler: (ctx: { orgId: string; userId: string }) => Promise<Response>) =>
    mockWithOrgScope(req, handler),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  withSpan: (_name: string, _attrs: unknown, fn: () => Promise<unknown>) => fn(),
  withRequestContext: (_req: unknown, fn: () => Promise<unknown>) => fn(),
  createRequestContext: vi.fn(() => ({})),
  runWithContext: (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
}))

vi.mock('@/lib/actions/payout-actions', () => ({
  listPayouts: (...args: unknown[]) => mockListPayouts(...args),
  executePayout: (...args: unknown[]) => mockExecutePayout(...args),
}))

vi.mock('@nzila/decision-core', () => ({
  enforceDecision: (...args: unknown[]) => mockEnforceDecision(...args),
}))

vi.mock('@nzila/nar', () => ({
  createNarProofAdapter: vi.fn(() => ({ id: 'nar_test_adapter' })),
  getNarSigningSecret: vi.fn(async () => 'test_secret'),
}))

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@nzila/db/schema', () => ({
  auditRecords: {
    organizationId: { name: 'organization_id' },
    narHash: { name: 'nar_hash' },
    createdAt: { name: 'created_at' },
  },
  orgMembers: {
    orgId: { name: 'org_id' },
    userId: { name: 'user_id' },
  },
}))

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return {
    ...actual,
    relations: vi.fn(() => ({})),
    eq: vi.fn(() => ({ __op: 'eq' })),
    and: vi.fn(() => ({ __op: 'and' })),
    desc: vi.fn(() => ({ __op: 'desc' })),
    sql: vi.fn(() => ({ __op: 'sql' })),
  }
})

let GET: (req: Request) => Promise<Response>
let POST: (req: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()

  // Default: withOrgScope behaves like the real wrapper — invokes the handler
  // with the orgId/userId derived from the (mocked) auth context. Individual
  // tests override this when simulating denial.
  mockWithOrgScope.mockImplementation((_req, handler) =>
    handler({ orgId: 'org_alpha', userId: 'user_creator_alpha' }),
  )
  mockRequireRole.mockResolvedValue({ ok: true, userId: 'user_creator_alpha', role: 'finance_admin' })
  mockEnforceDecision.mockResolvedValue({
    allowed: true,
    decision: { id: 'dec_test', allow: true },
  })
  mockListPayouts.mockResolvedValue([])
  mockExecutePayout.mockResolvedValue({ success: true, payoutId: 'po_test' })

  const mod = await import('../../app/api/payouts/route')
  GET = mod.GET
  POST = mod.POST
})

afterEach(() => {
  vi.resetModules()
})

describe('Zonga payouts API — org isolation', () => {
  it('returns the ORG_SCOPE_REQUIRED 403 from withOrgScope without invoking listPayouts', async () => {
    // Simulate withOrgScope denying the request because no active org is selected.
    mockWithOrgScope.mockImplementationOnce(async () =>
      NextResponse.json(
        {
          error: 'Org scope required',
          message: 'Select an active organization before accessing this resource.',
          code: 'ORG_SCOPE_REQUIRED',
        },
        { status: 403 },
      ),
    )

    const res = await GET(new Request('https://zonga.test/api/payouts'))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.code).toBe('ORG_SCOPE_REQUIRED')
    expect(mockRequireRole).not.toHaveBeenCalled()
    expect(mockListPayouts).not.toHaveBeenCalled()
  })

  it('returns the ORG_SCOPE_REQUIRED 403 from withOrgScope without invoking executePayout', async () => {
    mockWithOrgScope.mockImplementationOnce(async () =>
      NextResponse.json(
        {
          error: 'Org scope required',
          message: 'Select an active organization before accessing this resource.',
          code: 'ORG_SCOPE_REQUIRED',
        },
        { status: 403 },
      ),
    )

    const res = await POST(
      new Request('https://zonga.test/api/payouts', {
        method: 'POST',
        body: JSON.stringify({ creatorId: 'creator_alpha', amount: 100 }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.code).toBe('ORG_SCOPE_REQUIRED')
    expect(mockRequireRole).not.toHaveBeenCalled()
    expect(mockEnforceDecision).not.toHaveBeenCalled()
    expect(mockExecutePayout).not.toHaveBeenCalled()
  })

  it('always passes the withOrgScope-resolved orgId to requireRole — body cannot override it', async () => {
    // Caller is anchored to org_alpha by withOrgScope, but the request body
    // tries to address org_beta. The route must use the resolved orgId
    // (org_alpha) for role checks; the body field must be ignored.
    mockWithOrgScope.mockImplementationOnce((_req, handler) =>
      handler({ orgId: 'org_alpha', userId: 'user_creator_alpha' }),
    )

    await POST(
      new Request('https://zonga.test/api/payouts', {
        method: 'POST',
        body: JSON.stringify({
          creatorId: 'creator_alpha',
          amount: 250,
          orgId: 'org_beta', // attempted override
          organizationId: 'org_beta', // attempted override
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(mockRequireRole).toHaveBeenCalledTimes(1)
    const [orgIdArg, allowedRolesArg] = mockRequireRole.mock.calls[0]
    expect(orgIdArg).toBe('org_alpha')
    expect(allowedRolesArg).toEqual(['finance_admin'])
  })

  it('passes the resolved orgId into the enforceDecision payload (audit/decision evidence is org-scoped)', async () => {
    mockWithOrgScope.mockImplementationOnce((_req, handler) =>
      handler({ orgId: 'org_alpha', userId: 'user_finance_alpha' }),
    )

    await POST(
      new Request('https://zonga.test/api/payouts', {
        method: 'POST',
        body: JSON.stringify({
          creatorId: 'creator_alpha',
          amount: 99,
          orgId: 'org_beta',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    // Both preflight + recorded enforceDecision calls must carry the resolved orgId.
    expect(mockEnforceDecision).toHaveBeenCalledTimes(2)
    for (const call of mockEnforceDecision.mock.calls) {
      const payload = call[0] as { organizationId: string; actor: { id: string } }
      expect(payload.organizationId).toBe('org_alpha')
      expect(payload.actor.id).toBe('user_finance_alpha')
    }
  })

  it('only invokes executePayout after a successful org-scoped guard chain', async () => {
    mockWithOrgScope.mockImplementationOnce((_req, handler) =>
      handler({ orgId: 'org_alpha', userId: 'user_finance_alpha' }),
    )

    const res = await POST(
      new Request('https://zonga.test/api/payouts', {
        method: 'POST',
        body: JSON.stringify({ creatorId: 'creator_alpha', amount: 100 }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(res.status).toBe(201)
    expect(mockRequireRole).toHaveBeenCalledTimes(1)
    expect(mockEnforceDecision).toHaveBeenCalledTimes(2)
    expect(mockExecutePayout).toHaveBeenCalledTimes(1)
    // Order matters: guards must complete before any payout work occurs.
    const requireRoleOrder = mockRequireRole.mock.invocationCallOrder[0]
    const executePayoutOrder = mockExecutePayout.mock.invocationCallOrder[0]
    expect(executePayoutOrder).toBeGreaterThan(requireRoleOrder)
  })

  it('rejects POST with 400 (no payout work) when required body fields are missing — even with a valid org context', async () => {
    mockWithOrgScope.mockImplementationOnce((_req, handler) =>
      handler({ orgId: 'org_alpha', userId: 'user_finance_alpha' }),
    )

    const res = await POST(
      new Request('https://zonga.test/api/payouts', {
        method: 'POST',
        body: JSON.stringify({}), // missing creatorId + amount
        headers: { 'content-type': 'application/json' },
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('required')
    expect(mockEnforceDecision).not.toHaveBeenCalled()
    expect(mockExecutePayout).not.toHaveBeenCalled()
  })
})
