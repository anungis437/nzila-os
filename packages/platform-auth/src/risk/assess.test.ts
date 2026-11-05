/**
 * Tests for the risk-based auth scorer.
 *
 * The scorer reaches into the DB for (a) recent failed-login counts and
 * (b) first-seen IP detection, so we mock `@nzila/db/client` with a pair
 * of stub select() chains that return the counts we want to exercise each
 * signal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}))

vi.mock('@nzila/db/client', () => ({
  db: {
    select: mockSelect,
  },
}))
vi.mock('../auth-db', () => ({
  authDb: {
    select: mockSelect,
    execute: (...args: unknown[]) => mockSelect(...args).from().where(),
  },
}))

// Drizzle's relations helper is imported at module load by schema.
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return {
    ...actual,
    relations: vi.fn(() => ({})),
  }
})

vi.mock('@nzila/db/schema', () => ({
  authAuditLog: { eventType: 'eventType', ipAddress: 'ipAddress', createdAt: 'createdAt' },
  authUserSessions: { userId: 'userId', ipAddress: 'ipAddress', createdAt: 'createdAt' },
}))

import { assessRisk } from './assess'

/** Build a chainable select mock whose terminal `.where(...)` resolves to `rows`. */
function mockSelectOnce(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  }
  mockSelect.mockReturnValueOnce(chain)
  return chain
}

describe('assessRisk', () => {
  beforeEach(() => {
    mockSelect.mockReset()
  })

  describe('the QA/E2E risk bypass (UE_E2E_RISK_BYPASS)', () => {
    const KEYS = ['UE_E2E_RISK_BYPASS', 'UE_ENVIRONMENT', 'NEXT_PUBLIC_APP_ENV', 'TARGET_ENVIRONMENT', 'NZILA_MODE', 'UE_DEPLOYMENT_TYPE', 'NZILA_DEPLOYMENT_TYPE', 'NODE_ENV'] as const
    const saved: Record<string, string | undefined> = {}
    beforeEach(() => {
      for (const key of KEYS) {
        saved[key] = process.env[key]
        delete process.env[key]
      }
    })
    afterEach(() => {
      for (const key of KEYS) {
        if (saved[key] === undefined) delete process.env[key]
        else Object.assign(process.env, { [key]: saved[key] })
      }
    })
    const risk = () => assessRisk({ userId: 'u1', ipAddress: '203.0.113.1', userAgent: '', userRoles: ['admin'] })

    it('skips the scorer in a demo, staging or local process that asks for it', async () => {
      for (const identity of [{ UE_ENVIRONMENT: 'staging', NODE_ENV: 'production' }, { UE_ENVIRONMENT: 'demo', NODE_ENV: 'production' }, { UE_ENVIRONMENT: 'local', NODE_ENV: 'development' }]) {
        Object.assign(process.env, identity, { UE_E2E_RISK_BYPASS: 'true' })
        expect(await risk(), JSON.stringify(identity)).toMatchObject({ tier: 'low', recommendedAction: 'allow', reasons: ['qa_test_env_bypass'] })
        expect(mockSelect).not.toHaveBeenCalled()
      }
    })

    it('is impossible on a production deployment: any identity saying production, or an unlabeled production container, scores the login', async () => {
      for (const identity of [{ UE_ENVIRONMENT: 'production' }, { UE_ENVIRONMENT: 'prod', NODE_ENV: 'production' }, { NEXT_PUBLIC_APP_ENV: 'production' }, { NZILA_MODE: 'production' }, { UE_DEPLOYMENT_TYPE: 'prod' }, { NODE_ENV: 'production' }, { UE_ENVIRONMENT: 'staging', TARGET_ENVIRONMENT: 'production' }]) {
        for (const key of KEYS) delete process.env[key]
        Object.assign(process.env, identity, { UE_E2E_RISK_BYPASS: 'true' })
        mockSelect.mockReset()
        mockSelectOnce([{ count: 12 }])
        mockSelectOnce([{ count: 0 }])
        const result = await risk()
        expect(result.reasons, JSON.stringify(identity)).not.toContain('qa_test_env_bypass')
        expect(result.tier, JSON.stringify(identity)).toBe('high')
        expect(result.recommendedAction, JSON.stringify(identity)).toBe('soft_lockout')
      }
    })
  })

  it('returns tier=low / allow when no signals fire', async () => {
    mockSelectOnce([{ count: 0 }]) // failed logins
    mockSelectOnce([{ count: 5 }]) // seen before

    const r = await assessRisk({
      userId: 'u1',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0 — plausible',
      userRoles: ['member'],
    })
    expect(r.tier).toBe('low')
    expect(r.recommendedAction).toBe('allow')
    expect(r.score).toBe(0)
    expect(r.reasons).toEqual([])
  })

  it('escalates to tier=medium / require_mfa on first-seen IP + privileged role', async () => {
    mockSelectOnce([{ count: 0 }]) // no recent failures
    mockSelectOnce([{ count: 0 }]) // never seen this IP before

    const r = await assessRisk({
      userId: 'u1',
      ipAddress: '203.0.113.1',
      userAgent: 'Mozilla/5.0 normal',
      userRoles: ['admin'],
    })
    expect(r.score).toBe(30) // 20 first-seen + 10 privileged
    expect(r.tier).toBe('medium')
    expect(r.recommendedAction).toBe('require_mfa')
    expect(r.reasons).toEqual([
      'First-seen IP for this account',
      'Privileged role',
    ])
  })

  it('escalates to tier=high / soft_lockout on heavy IP failures + first-seen + missing UA', async () => {
    mockSelectOnce([{ count: 12 }]) // 12 failures in 15min → +40
    mockSelectOnce([{ count: 0 }]) // first seen → +20

    const r = await assessRisk({
      userId: 'u1',
      ipAddress: '198.51.100.1',
      userAgent: '',
      userRoles: ['member'],
    })
    expect(r.score).toBe(75) // 40 + 20 + 15
    expect(r.tier).toBe('high')
    expect(r.recommendedAction).toBe('soft_lockout')
    expect(r.reasons.length).toBeGreaterThanOrEqual(3)
  })

  it('counts 3–9 failures as medium weight (not heavy)', async () => {
    mockSelectOnce([{ count: 5 }]) // medium failures → +15
    mockSelectOnce([{ count: 1 }]) // has been seen before

    const r = await assessRisk({
      userId: 'u1',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0 normal',
      userRoles: ['member'],
    })
    expect(r.score).toBe(15)
    expect(r.tier).toBe('low')
    expect(r.recommendedAction).toBe('allow')
  })

  it('does not double-count first-seen when IP is omitted', async () => {
    // No IP → neither failure-count nor first-seen signal queries
    const r = await assessRisk({
      userId: 'u1',
      userAgent: 'Mozilla/5.0 normal',
      userRoles: ['member'],
    })
    expect(mockSelect).not.toHaveBeenCalled()
    expect(r.score).toBe(0)
    expect(r.tier).toBe('low')
  })
})
