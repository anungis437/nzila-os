import { describe, it, expect, vi } from 'vitest'
import { computeIsolationScore } from './audit'

// ── Mock DB layer ──────────────────────────────────────────────────────────

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@nzila/db/schema', () => ({
  platformIsolationAudits: {
    id: 'id',
    isolationScore: 'isolation_score',
    totalChecks: 'total_checks',
    passedChecks: 'passed_checks',
    violations: 'violations',
    auditedAt: 'audited_at',
  },
}))

vi.mock('@nzila/db/org-registry', () => ({
  ORG_SCOPED_TABLES: [
    'entityRoles',
    'entityMembers',
    'meetings',
    'auditEvents',
    'ueCases',
  ],
  NON_ORG_SCOPED_TABLES: [
    { table: 'entities', reason: 'Root entity table' },
    { table: 'people', reason: 'Global person registry' },
  ],
}))

// ── Type contract tests ────────────────────────────────────────────────────

describe('Platform Isolation — type contracts', () => {
  it('exports runIsolationAudit', async () => {
    const mod = await import('./audit')
    expect(typeof mod.runIsolationAudit).toBe('function')
  })

  it('exports computeIsolationScore', async () => {
    const mod = await import('./audit')
    expect(typeof mod.computeIsolationScore).toBe('function')
  })
})

// ── Score computation tests ─────────────────────────────────────────────────

describe('computeIsolationScore — deterministic', () => {
  it('returns 100 for all passed', () => {
    expect(computeIsolationScore(10, 10)).toBe(100)
  })

  it('returns 0 for none passed', () => {
    expect(computeIsolationScore(10, 0)).toBe(0)
  })

  it('returns 100 for zero total checks', () => {
    expect(computeIsolationScore(0, 0)).toBe(100)
  })

  it('computes correct percentage for partial pass', () => {
    expect(computeIsolationScore(4, 3)).toBe(75)
  })

  it('handles uneven divisions', () => {
    expect(computeIsolationScore(3, 1)).toBe(33.33)
  })
})

// ── Audit execution test ────────────────────────────────────────────────────

describe('runIsolationAudit — integration', () => {
  it('returns well-formed audit result', async () => {
    const { runIsolationAudit } = await import('./audit')
    const result = await runIsolationAudit()

    expect(result).toHaveProperty('isolationScore')
    expect(result).toHaveProperty('totalChecks')
    expect(result).toHaveProperty('passedChecks')
    expect(result).toHaveProperty('violations')
    expect(result).toHaveProperty('lastAuditRun')
    expect(typeof result.isolationScore).toBe('number')
    expect(result.isolationScore).toBeGreaterThanOrEqual(0)
    expect(result.isolationScore).toBeLessThanOrEqual(100)
    expect(Array.isArray(result.violations)).toBe(true)
  })
})
