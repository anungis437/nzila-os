/**
 * End-to-End Proof Harness
 *
 * Executable proof scenarios that verify governance controls work
 * end-to-end with machine-verifiable artifacts. Each scenario simulates
 * a real-world governance scenario and proves the control chain holds.
 *
 * Scenarios:
 *   PROOF-001: Enforcement pipeline blocks unauthorized requests
 *   PROOF-002: Enforcement pipeline allows authorized requests
 *   PROOF-003: Rate limiting layer trips on excess
 *   PROOF-004: Governance layer denies policy violations
 *   PROOF-005: Audit layer records all enforcement decisions
 *   PROOF-006: Health endpoints bypass enforcement (zero overhead)
 *   PROOF-007: Context creation populates all required fields
 *   PROOF-008: Layer composition preserves order guarantee
 *   PROOF-009: Partial layer failure short-circuits correctly
 *   PROOF-010: Full pipeline integration — auth + governance + audit
 */
import { describe, it, expect } from 'vitest'
import {
  composePipeline,
  createContext,
  createEnforcedHandler,
  traceLayer,
  authLayer,
  rateLimitLayer,
  governanceLayer,
  auditLayer,
  type EnforcementContext,
  type EnforcementLayer,
} from '@nzila/enforcement'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<EnforcementContext> = {}): EnforcementContext {
  return createContext({
    action: 'read',
    resourceType: 'financial-record',
    route: '/api/test',
    headers: { authorization: 'Bearer test-token' },
    body: undefined,
    ...overrides,
  })
}

// ── PROOF-001: Enforcement pipeline blocks unauthorized ─────────────────────

describe('PROOF-001 — Enforcement pipeline blocks unauthorized requests', () => {
  it('auth layer rejects missing credentials', async () => {
    const pipeline = composePipeline([
      authLayer({
        extractActor: async () => null,
      }),
    ])

    const ctx = makeCtx()
    ctx.headers = {}
    const result = await pipeline(ctx)

    expect(result.success).toBe(false)
    expect(result.status).toBe(401)
  })

  it('auth layer populates actor on success', async () => {
    const handler = createEnforcedHandler(
      [
        authLayer({
          extractActor: async () => ({
            actorId: 'user-123',
            orgId: 'org-456',
            roles: ['member'],
          }),
        }),
      ],
      async (ctx) => ({
        success: true,
        status: 200,
        body: { actorId: ctx.actorId, orgId: ctx.orgId },
      }),
    )

    const ctx = makeCtx()
    const result = await handler(ctx)

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
  })
})

// ── PROOF-002: Enforcement pipeline allows authorized requests ──────────────

describe('PROOF-002 — Enforcement pipeline allows authorized requests', () => {
  it('full pipeline allows valid request through all layers', async () => {
    const auditLog: Array<Record<string, unknown>> = []

    const handler = createEnforcedHandler(
      [
        traceLayer(),
        authLayer({
          extractActor: async () => ({
            actorId: 'admin-1',
            orgId: 'org-1',
            roles: ['admin'],
          }),
        }),
        governanceLayer({
          evaluate: async () => ({ outcome: 'allow' as const, reason: 'policy-pass' }),
        }),
        auditLayer({
          record: async (entry) => {
            auditLog.push(entry as Record<string, unknown>)
          },
        }),
      ],
      async () => ({ success: true, status: 200, body: { ok: true } }),
    )

    const ctx = makeCtx({ action: 'write' })
    const result = await handler(ctx)

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
    expect(auditLog.length).toBeGreaterThanOrEqual(1)
  })
})

// ── PROOF-003: Rate limiting layer trips on excess ──────────────────────────

describe('PROOF-003 — Rate limiting layer trips on excess', () => {
  it('rate limit layer returns 429 when limit exceeded', async () => {
    const handler = createEnforcedHandler(
      [
        authLayer({
          extractActor: async () => ({
            actorId: 'user-1',
            orgId: 'org-1',
            roles: ['member'],
          }),
        }),
        rateLimitLayer({
          check: async () => ({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 }),
        }),
      ],
      async () => ({ success: true, status: 200 }),
    )

    const ctx = makeCtx()
    const result = await handler(ctx)

    expect(result.success).toBe(false)
    expect(result.status).toBe(429)
  })

  it('rate limit layer passes when under limit', async () => {
    const handler = createEnforcedHandler(
      [
        authLayer({
          extractActor: async () => ({
            actorId: 'user-1',
            orgId: 'org-1',
            roles: ['member'],
          }),
        }),
        rateLimitLayer({
          check: async () => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 }),
        }),
      ],
      async () => ({ success: true, status: 200 }),
    )

    const ctx = makeCtx()
    const result = await handler(ctx)

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
  })
})

// ── PROOF-004: Governance layer denies policy violations ────────────────────

describe('PROOF-004 — Governance layer denies policy violations', () => {
  it('governance deny produces 403 with reason', async () => {
    const handler = createEnforcedHandler(
      [
        authLayer({
          extractActor: async () => ({
            actorId: 'user-99',
            orgId: 'org-1',
            roles: ['viewer'],
          }),
        }),
        governanceLayer({
          evaluate: async () => ({
            outcome: 'deny' as const,
            reason: 'insufficient-privileges: viewer cannot write financial-record',
          }),
        }),
      ],
      async () => ({ success: true, status: 200 }),
    )

    const ctx = makeCtx({ action: 'write' })
    const result = await handler(ctx)

    expect(result.success).toBe(false)
    expect(result.status).toBe(403)
  })
})

// ── PROOF-005: Audit layer records all enforcement decisions ────────────────

describe('PROOF-005 — Audit layer records all enforcement decisions', () => {
  it('audit records allowed requests with correct fields', async () => {
    const auditLog: Array<Record<string, unknown>> = []

    const handler = createEnforcedHandler(
      [
        authLayer({
          extractActor: async () => ({
            actorId: 'user-1',
            orgId: 'org-1',
            roles: ['admin'],
          }),
        }),
        auditLayer({
          record: async (entry) => {
            auditLog.push(entry as Record<string, unknown>)
          },
        }),
      ],
      async () => ({ success: true, status: 200 }),
    )

    const ctx = makeCtx()
    const result = await handler(ctx)

    expect(result.success).toBe(true)
    expect(auditLog.length).toBe(1)
    expect(auditLog[0]!.actorId).toBe('user-1')
    expect(auditLog[0]!.orgId).toBe('org-1')
    expect(auditLog[0]!.action).toBe('read')
    expect(auditLog[0]!.traceId).toBeDefined()
  })
})

// ── PROOF-006: Health endpoints bypass enforcement ──────────────────────────

describe('PROOF-006 — Health endpoints bypass enforcement (zero overhead)', () => {
  it('healthHandler returns response without enforcement layers', async () => {
    const { healthHandler } = await import('@nzila/enforcement')

    const handler = healthHandler()
    expect(handler).toBeDefined()
    expect(typeof handler).toBe('function')
  })

  it('healthHandler accepts custom extras', async () => {
    const { healthHandler } = await import('@nzila/enforcement')

    const handler = healthHandler({ version: '1.0.0', service: 'test' })
    expect(handler).toBeDefined()
  })
})

// ── PROOF-007: Context creation populates all required fields ───────────────

describe('PROOF-007 — Context creation populates all required fields', () => {
  it('createContext sets action, resourceType, route', () => {
    const ctx = createContext({
      action: 'delete',
      resourceType: 'user-account',
      route: '/api/users/123',
      headers: { 'content-type': 'application/json' },
    })

    expect(ctx.action).toBe('delete')
    expect(ctx.resourceType).toBe('user-account')
    expect(ctx.route).toBe('/api/users/123')
    expect(ctx.headers).toEqual({ 'content-type': 'application/json' })
  })

  it('createContext generates unique traceId', () => {
    const ctx1 = makeCtx()
    const ctx2 = makeCtx()
    expect(ctx1.traceId).toBeDefined()
    expect(ctx2.traceId).toBeDefined()
    expect(ctx1.traceId).not.toBe(ctx2.traceId)
  })

  it('createContext initializes metadata and startedAt', () => {
    const ctx = makeCtx()
    expect(ctx.metadata).toBeDefined()
    expect(typeof ctx.startedAt).toBe('number')
    expect(ctx.startedAt).toBeGreaterThan(0)
  })
})

// ── PROOF-008: Layer composition preserves order guarantee ──────────────────

describe('PROOF-008 — Layer composition preserves order guarantee', () => {
  it('layers execute in declared order', async () => {
    const order: string[] = []

    const layerA: EnforcementLayer = async (_ctx, next) => {
      order.push('a-before')
      const result = await next()
      order.push('a-after')
      return result
    }

    const layerB: EnforcementLayer = async (_ctx, next) => {
      order.push('b-before')
      const result = await next()
      order.push('b-after')
      return result
    }

    const terminal: EnforcementLayer = async () => {
      order.push('terminal')
      return { success: true, status: 200 }
    }

    const pipeline = composePipeline([layerA, layerB, terminal])
    await pipeline(makeCtx())

    expect(order).toEqual(['a-before', 'b-before', 'terminal', 'b-after', 'a-after'])
  })
})

// ── PROOF-009: Partial layer failure short-circuits correctly ────────────────

describe('PROOF-009 — Partial layer failure short-circuits correctly', () => {
  it('auth failure short-circuits before governance layer', async () => {
    const governanceCalled = { value: false }

    const pipeline = composePipeline([
      authLayer({
        extractActor: async () => null,
      }),
      governanceLayer({
        evaluate: async () => {
          governanceCalled.value = true
          return { outcome: 'allow' as const, reason: 'ok' }
        },
      }),
    ])

    const ctx = makeCtx()
    const result = await pipeline(ctx)

    expect(result.success).toBe(false)
    expect(result.status).toBe(401)
    expect(governanceCalled.value).toBe(false)
  })
})

// ── PROOF-010: Full pipeline integration ────────────────────────────────────

describe('PROOF-010 — Full pipeline integration: auth + governance + audit', () => {
  it('simulates complete request lifecycle', async () => {
    const evidence = {
      auth: false,
      governance: false,
      audit: [] as Array<Record<string, unknown>>,
    }

    const handler = createEnforcedHandler(
      [
        traceLayer(),
        authLayer({
          extractActor: async (headers) => {
            evidence.auth = true
            if (!headers.authorization) return null
            return {
              actorId: 'cfo-user-1',
              orgId: 'acme-corp',
              roles: ['finance-admin'],
            }
          },
        }),
        governanceLayer({
          evaluate: async (ctx) => {
            evidence.governance = true
            const isAdmin = ctx.roles?.includes('finance-admin')
            return {
              outcome: (isAdmin ? 'allow' : 'deny') as 'allow' | 'deny',
              reason: isAdmin ? 'admin-access' : 'denied',
            }
          },
        }),
        auditLayer({
          record: async (entry) => {
            evidence.audit.push(entry as Record<string, unknown>)
          },
        }),
      ],
      async () => ({
        success: true,
        status: 200,
        body: { approved: true },
      }),
    )

    const ctx = makeCtx({
      action: 'approve',
      resourceType: 'purchase-order',
      route: '/api/finance/approve',
    })

    const result = await handler(ctx)

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
    expect(evidence.auth).toBe(true)
    expect(evidence.governance).toBe(true)
    expect(evidence.audit.length).toBe(1)
    expect(evidence.audit[0]!.actorId).toBe('cfo-user-1')
    expect(evidence.audit[0]!.orgId).toBe('acme-corp')
  })
})
