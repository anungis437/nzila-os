/**
 * Phase 3 — P1 Payout authorization regression tests.
 *
 * Covers the following acceptance scenarios:
 *  2. finance_admin can execute payouts inside their resolved org (and only there).
 *  3. support_agent can read but cannot mutate financial actions:
 *     - GET /api/payouts: support_agent is denied (only finance_admin/client_admin allowed).
 *     - POST /api/payouts: support_agent is denied (only finance_admin allowed).
 *  4. A creator (or any non-financial role) cannot mutate payouts.
 *
 * The test pins the `requireRole` allowlists for both verbs so any future
 * widening of permissions on the payouts surface fails CI.
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

const FORBIDDEN_RESPONSE = (required: string[]) =>
  NextResponse.json(
    { error: 'Insufficient privileges', required },
    { status: 403 },
  )

beforeEach(async () => {
  vi.clearAllMocks()

  mockWithOrgScope.mockImplementation((_req, handler) =>
    handler({ orgId: 'org_alpha', userId: 'user_test' }),
  )
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

describe('Zonga payouts API — payout authorization', () => {
  describe('GET /api/payouts (list)', () => {
    it('allows finance_admin in their resolved org', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        userId: 'user_finance_alpha',
        role: 'finance_admin',
      })

      const res = await GET(new Request('https://zonga.test/api/payouts'))

      expect(res.status).toBe(200)
      expect(mockListPayouts).toHaveBeenCalledTimes(1)
      // Pin the allowlist: GET must accept only finance_admin or client_admin.
      expect(mockRequireRole).toHaveBeenCalledWith('org_alpha', ['finance_admin', 'client_admin'])
    })

    it('allows client_admin in their resolved org', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        userId: 'user_client_admin',
        role: 'client_admin',
      })

      const res = await GET(new Request('https://zonga.test/api/payouts'))

      expect(res.status).toBe(200)
      expect(mockListPayouts).toHaveBeenCalledTimes(1)
    })

    it('denies support_agent (read-only support role cannot list payouts)', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: FORBIDDEN_RESPONSE(['finance_admin', 'client_admin']),
      })

      const res = await GET(new Request('https://zonga.test/api/payouts'))
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Insufficient privileges')
      expect(json.required).toEqual(['finance_admin', 'client_admin'])
      expect(mockListPayouts).not.toHaveBeenCalled()
    })

    it('denies creator role from listing payouts', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: FORBIDDEN_RESPONSE(['finance_admin', 'client_admin']),
      })

      const res = await GET(new Request('https://zonga.test/api/payouts'))

      expect(res.status).toBe(403)
      expect(mockListPayouts).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/payouts (execute)', () => {
    function makePost() {
      return new Request('https://zonga.test/api/payouts', {
        method: 'POST',
        body: JSON.stringify({ creatorId: 'creator_alpha', amount: 100 }),
        headers: { 'content-type': 'application/json' },
      })
    }

    it('allows finance_admin to execute a payout in their resolved org', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        userId: 'user_finance_alpha',
        role: 'finance_admin',
      })

      const res = await POST(makePost())

      expect(res.status).toBe(201)
      expect(mockExecutePayout).toHaveBeenCalledTimes(1)
      // Pin the allowlist: POST must accept ONLY finance_admin (not client_admin, not support_agent).
      expect(mockRequireRole).toHaveBeenCalledWith('org_alpha', ['finance_admin'])
    })

    it('denies support_agent — cannot mutate payouts even if they can read other surfaces', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: FORBIDDEN_RESPONSE(['finance_admin']),
      })

      const res = await POST(makePost())
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.required).toEqual(['finance_admin'])
      expect(mockEnforceDecision).not.toHaveBeenCalled()
      expect(mockExecutePayout).not.toHaveBeenCalled()
    })

    it('denies creator role — creators cannot self-execute their own payouts', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: FORBIDDEN_RESPONSE(['finance_admin']),
      })

      const res = await POST(makePost())

      expect(res.status).toBe(403)
      expect(mockEnforceDecision).not.toHaveBeenCalled()
      expect(mockExecutePayout).not.toHaveBeenCalled()
    })

    it('denies client_admin from executing payouts (read-only on payouts: list yes, execute no)', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: false,
        response: FORBIDDEN_RESPONSE(['finance_admin']),
      })

      const res = await POST(makePost())

      expect(res.status).toBe(403)
      expect(mockExecutePayout).not.toHaveBeenCalled()
    })

    it('halts at the decision-engine when enforceDecision denies the preflight', async () => {
      mockRequireRole.mockResolvedValueOnce({
        ok: true,
        userId: 'user_finance_alpha',
        role: 'finance_admin',
      })
      // Role passes, but the decision engine vetoes the payout.
      mockEnforceDecision.mockResolvedValueOnce({
        allowed: false,
        decision: { id: 'dec_denied', allow: false, reason: 'policy:exceeds_threshold' },
      })

      const res = await POST(makePost())
      const json = await res.json()

      expect(res.status).toBe(422)
      expect(json.error).toBe('Decision validation failed')
      expect(mockExecutePayout).not.toHaveBeenCalled()
    })
  })
})
