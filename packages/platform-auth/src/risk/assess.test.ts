/**
 * Tests for the risk-based auth scorer.
 *
 * The scorer reaches into the DB for (a) recent failed-login counts and
 * (b) first-seen IP detection, so we mock `@nzila/db/client` with a pair
 * of stub select() chains that return the counts we want to exercise each
 * signal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}))

vi.mock('@nzila/db/client', () => ({
  db: {
    select: mockSelect,
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
