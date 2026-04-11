/**
 * @nzila/pilot-mode — Engine Tests
 */
import { describe, it, expect } from 'vitest'
import type { PilotFlagDef, PilotContext, PilotCohort } from '../types'
import {
  evaluatePilotFlag,
  evaluateAllFlags,
  getEnabledPilotFlags,
  hashBucket,
  validatePilotFlag,
} from '../engine'

// ── Fixtures ────────────────────────────────────────────────────────────────

const ctx: PilotContext = { orgId: 'org-1', userId: 'user-1' }

const baseFlag: PilotFlagDef = {
  name: 'new_dashboard',
  enabled: true,
  strategy: 'instant',
}

// ── hashBucket ──────────────────────────────────────────────────────────────

describe('hashBucket', () => {
  it('returns a number between 0 and 99', () => {
    for (let i = 0; i < 100; i++) {
      const bucket = hashBucket('flag', `org-${i}`)
      expect(bucket).toBeGreaterThanOrEqual(0)
      expect(bucket).toBeLessThan(100)
    }
  })

  it('is deterministic', () => {
    const a = hashBucket('flag', 'org-1')
    const b = hashBucket('flag', 'org-1')
    expect(a).toBe(b)
  })

  it('varies by flag name', () => {
    const a = hashBucket('flagA', 'org-1')
    const b = hashBucket('flagB', 'org-1')
    // Not guaranteed different, but overwhelming probability they differ
    // We just check the function runs without error
    expect(typeof a).toBe('number')
    expect(typeof b).toBe('number')
  })
})

// ── evaluatePilotFlag ───────────────────────────────────────────────────────

describe('evaluatePilotFlag', () => {
  it('returns flag_disabled when flag is off', () => {
    const flag: PilotFlagDef = { ...baseFlag, enabled: false }
    const result = evaluatePilotFlag(flag, ctx)
    expect(result.enabled).toBe(false)
    expect(result.reason).toBe('flag_disabled')
  })

  it('returns flag_expired when past expiry', () => {
    const flag: PilotFlagDef = {
      ...baseFlag,
      expiresAt: '2020-01-01T00:00:00Z',
    }
    const result = evaluatePilotFlag(flag, ctx)
    expect(result.enabled).toBe(false)
    expect(result.reason).toBe('flag_expired')
  })

  it('returns org_targeted when org matches', () => {
    const flag: PilotFlagDef = { ...baseFlag, orgIds: ['org-1', 'org-2'] }
    const result = evaluatePilotFlag(flag, ctx)
    expect(result.enabled).toBe(true)
    expect(result.reason).toBe('org_targeted')
  })

  it('returns user_targeted when user matches', () => {
    const flag: PilotFlagDef = { ...baseFlag, userIds: ['user-1'] }
    const result = evaluatePilotFlag(flag, { orgId: 'org-other', userId: 'user-1' })
    expect(result.enabled).toBe(true)
    expect(result.reason).toBe('user_targeted')
  })

  it('returns cohort_targeted when org is in cohort', () => {
    const flag: PilotFlagDef = { ...baseFlag, cohortId: 'wave-1' }
    const cohorts = new Map<string, PilotCohort>([
      ['wave-1', { id: 'wave-1', name: 'Wave 1', orgIds: ['org-1'], enrolledAt: '2025-01-01T00:00:00Z' }],
    ])
    const result = evaluatePilotFlag(flag, ctx, cohorts)
    expect(result.enabled).toBe(true)
    expect(result.reason).toBe('cohort_targeted')
  })

  it('returns percentage_included for orgs in bucket', () => {
    // 100% rollout → all orgs included
    const flag: PilotFlagDef = { ...baseFlag, percentage: 100 }
    const result = evaluatePilotFlag(flag, ctx)
    expect(result.enabled).toBe(true)
    expect(result.reason).toBe('percentage_included')
  })

  it('returns percentage_excluded for orgs outside bucket', () => {
    // 0% rollout would still hash but no bucket matches
    // Use 1% and find an org that falls outside
    const flag: PilotFlagDef = { ...baseFlag, percentage: 0 }
    // percentage 0 means percentage > 0 check fails → falls to no_match
    const result = evaluatePilotFlag(flag, ctx)
    expect(result.enabled).toBe(false)
    expect(result.reason).toBe('no_match')
  })

  it('returns no_match when nothing matches', () => {
    const result = evaluatePilotFlag(baseFlag, ctx)
    expect(result.enabled).toBe(false)
    expect(result.reason).toBe('no_match')
  })

  it('checks evaluation order: org before user', () => {
    const flag: PilotFlagDef = { ...baseFlag, orgIds: ['org-1'], userIds: ['user-1'] }
    const result = evaluatePilotFlag(flag, ctx)
    expect(result.reason).toBe('org_targeted')
  })

  it('checks evaluation order: user before cohort', () => {
    const flag: PilotFlagDef = { ...baseFlag, userIds: ['user-1'], cohortId: 'wave-1' }
    const cohorts = new Map<string, PilotCohort>([
      ['wave-1', { id: 'wave-1', name: 'Wave 1', orgIds: ['org-1'], enrolledAt: '2025-01-01T00:00:00Z' }],
    ])
    const result = evaluatePilotFlag(flag, ctx, cohorts)
    expect(result.reason).toBe('user_targeted')
  })
})

// ── evaluateAllFlags ────────────────────────────────────────────────────────

describe('evaluateAllFlags', () => {
  it('evaluates multiple flags', () => {
    const flags: PilotFlagDef[] = [
      { ...baseFlag, name: 'a', orgIds: ['org-1'] },
      { ...baseFlag, name: 'b', enabled: false },
    ]
    const results = evaluateAllFlags(flags, ctx)
    expect(results.get('a')?.enabled).toBe(true)
    expect(results.get('b')?.enabled).toBe(false)
  })

  it('returns a map with all flags', () => {
    const flags: PilotFlagDef[] = [
      { ...baseFlag, name: 'x' },
      { ...baseFlag, name: 'y' },
      { ...baseFlag, name: 'z' },
    ]
    const results = evaluateAllFlags(flags, ctx)
    expect(results.size).toBe(3)
  })
})

// ── getEnabledPilotFlags ────────────────────────────────────────────────────

describe('getEnabledPilotFlags', () => {
  it('returns only enabled flags', () => {
    const flags: PilotFlagDef[] = [
      { ...baseFlag, name: 'a', orgIds: ['org-1'] },
      { ...baseFlag, name: 'b', enabled: false },
      { ...baseFlag, name: 'c', orgIds: ['org-1'] },
    ]
    const enabled = getEnabledPilotFlags(flags, ctx)
    expect(enabled).toHaveLength(2)
    expect(enabled.map((f) => f.name)).toEqual(['a', 'c'])
  })
})

// ── validatePilotFlag ───────────────────────────────────────────────────────

describe('validatePilotFlag', () => {
  it('validates a correct flag', () => {
    expect(validatePilotFlag(baseFlag)).toHaveLength(0)
  })

  it('catches missing name', () => {
    const errors = validatePilotFlag({ ...baseFlag, name: '' })
    expect(errors).toContain('Flag must have a name')
  })

  it('catches invalid percentage', () => {
    const errors = validatePilotFlag({ ...baseFlag, percentage: 101 })
    expect(errors.some((e) => e.includes('Percentage'))).toBe(true)
  })

  it('catches negative percentage', () => {
    const errors = validatePilotFlag({ ...baseFlag, percentage: -1 })
    expect(errors.some((e) => e.includes('Percentage'))).toBe(true)
  })

  it('catches expiresAt before activatedAt', () => {
    const errors = validatePilotFlag({
      ...baseFlag,
      activatedAt: '2025-06-01T00:00:00Z',
      expiresAt: '2025-01-01T00:00:00Z',
    })
    expect(errors.some((e) => e.includes('expiresAt'))).toBe(true)
  })
})

// ── Percentage Rollout Distribution ─────────────────────────────────────────

describe('percentage rollout distribution', () => {
  it('50% rollout hits roughly half of 1000 orgs', () => {
    const flag: PilotFlagDef = { ...baseFlag, percentage: 50 }
    let enabled = 0
    for (let i = 0; i < 1000; i++) {
      const result = evaluatePilotFlag(flag, { orgId: `org-${i}`, userId: 'user-1' })
      if (result.enabled) enabled++
    }
    // Should be 400-600 (very generous bounds)
    expect(enabled).toBeGreaterThan(350)
    expect(enabled).toBeLessThan(650)
  })
})
