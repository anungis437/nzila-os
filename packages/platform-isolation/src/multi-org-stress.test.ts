import { describe, it, expect } from 'vitest'
import {
  runMultiOrgStress,
  computeStressIsolationScore,
  generateOrgProfiles,
  DEFAULT_STRESS_CONFIG,
  type MultiOrgStressResult,
} from './multi-org-stress'

// ── Type contract tests ────────────────────────────────────────────────────

describe('Multi-Org Stress — type contracts', () => {
  it('exports runMultiOrgStress', () => {
    expect(typeof runMultiOrgStress).toBe('function')
  })

  it('exports computeStressIsolationScore', () => {
    expect(typeof computeStressIsolationScore).toBe('function')
  })

  it('exports generateOrgProfiles', () => {
    expect(typeof generateOrgProfiles).toBe('function')
  })
})

// ── Org profile generation ─────────────────────────────────────────────────

describe('generateOrgProfiles — deterministic', () => {
  it('generates correct number of profiles', () => {
    const profiles = generateOrgProfiles(5)
    expect(profiles).toHaveLength(5)
  })

  it('assigns sequential org IDs', () => {
    const profiles = generateOrgProfiles(3)
    expect(profiles.map((p) => p.orgId)).toEqual([
      'org_stress_001',
      'org_stress_002',
      'org_stress_003',
    ])
  })

  it('uses custom RPS when provided', () => {
    const profiles = generateOrgProfiles(2, 100)
    expect(profiles.every((p) => p.rps === 100)).toBe(true)
  })

  it('defaults to 50 RPS', () => {
    const profiles = generateOrgProfiles(2)
    expect(profiles.every((p) => p.rps === 50)).toBe(true)
  })
})

// ── Multi-org stress execution ─────────────────────────────────────────────

describe('runMultiOrgStress — isolation invariants', () => {
  let result: MultiOrgStressResult

  it('runs with default config', () => {
    result = runMultiOrgStress()
    expect(result).toHaveProperty('orgResults')
    expect(result).toHaveProperty('crossOrgLeaks')
    expect(result).toHaveProperty('totalRequests')
    expect(result).toHaveProperty('throughput')
    expect(result).toHaveProperty('orgCount')
    expect(result).toHaveProperty('isolationPassed')
    expect(result).toHaveProperty('performancePassed')
    expect(result).toHaveProperty('passed')
    expect(result).toHaveProperty('completedAt')
  })

  it('has zero cross-org leaks (isolation invariant)', () => {
    result = runMultiOrgStress()
    expect(result.crossOrgLeaks).toHaveLength(0)
    expect(result.isolationPassed).toBe(true)
  })

  it('tests the configured number of orgs', () => {
    result = runMultiOrgStress()
    expect(result.orgCount).toBe(DEFAULT_STRESS_CONFIG.orgs.length)
    expect(result.orgResults).toHaveLength(DEFAULT_STRESS_CONFIG.orgs.length)
  })

  it('all orgs have zero isolation violations', () => {
    result = runMultiOrgStress()
    for (const orgResult of result.orgResults) {
      expect(orgResult.isolationViolations).toBe(0)
    }
  })

  it('each org generates expected request count', () => {
    const config = {
      orgs: generateOrgProfiles(3, 10),
      durationSec: 5,
    }
    result = runMultiOrgStress(config)
    for (const orgResult of result.orgResults) {
      expect(orgResult.totalRequests).toBe(50) // 10 rps * 5 sec
    }
  })

  it('total requests is sum of all org requests', () => {
    result = runMultiOrgStress()
    const sum = result.orgResults.reduce((s, r) => s + r.totalRequests, 0)
    expect(result.totalRequests).toBe(sum)
  })

  it('throughput is positive', () => {
    result = runMultiOrgStress()
    expect(result.throughput).toBeGreaterThan(0)
  })
})

// ── Scaling behaviour ──────────────────────────────────────────────────────

describe('runMultiOrgStress — scaling', () => {
  it('handles 1 org', () => {
    const result = runMultiOrgStress({
      orgs: generateOrgProfiles(1, 10),
      durationSec: 5,
    })
    expect(result.orgCount).toBe(1)
    expect(result.totalRequests).toBe(50)
    expect(result.isolationPassed).toBe(true)
  })

  it('handles 50 orgs concurrently', () => {
    const result = runMultiOrgStress({
      orgs: generateOrgProfiles(50, 10),
      durationSec: 5,
    })
    expect(result.orgCount).toBe(50)
    expect(result.totalRequests).toBe(2500)
    expect(result.isolationPassed).toBe(true)
    expect(result.crossOrgLeaks).toHaveLength(0)
  })

  it('p95 increases with org count (contention simulation)', () => {
    const result1 = runMultiOrgStress({
      orgs: generateOrgProfiles(1, 50),
      durationSec: 10,
    })
    const result20 = runMultiOrgStress({
      orgs: generateOrgProfiles(20, 50),
      durationSec: 10,
    })

    const avgP95_1 =
      result1.orgResults.reduce((s, r) => s + r.p95, 0) / result1.orgResults.length
    const avgP95_20 =
      result20.orgResults.reduce((s, r) => s + r.p95, 0) / result20.orgResults.length

    // 20 orgs should have higher latency than 1 org due to contention factor
    expect(avgP95_20).toBeGreaterThan(avgP95_1)
  })
})

// ── Isolation score computation ────────────────────────────────────────────

describe('computeStressIsolationScore — deterministic', () => {
  it('returns 100 for zero leaks', () => {
    const result = runMultiOrgStress()
    expect(computeStressIsolationScore(result)).toBe(100)
  })

  it('returns 100 for empty result', () => {
    const empty: MultiOrgStressResult = {
      orgResults: [],
      crossOrgLeaks: [],
      totalRequests: 0,
      throughput: 0,
      orgCount: 0,
      isolationPassed: true,
      performancePassed: true,
      passed: true,
      completedAt: new Date().toISOString(),
    }
    expect(computeStressIsolationScore(empty)).toBe(100)
  })

  it('decreases with leaks', () => {
    const result: MultiOrgStressResult = {
      orgResults: [],
      crossOrgLeaks: [
        {
          sourceOrgId: 'org_1',
          targetOrgId: 'org_2',
          route: '/api/test',
          detectedAt: new Date().toISOString(),
        },
      ],
      totalRequests: 100,
      throughput: 100,
      orgCount: 2,
      isolationPassed: false,
      performancePassed: true,
      passed: false,
      completedAt: new Date().toISOString(),
    }
    const score = computeStressIsolationScore(result)
    expect(score).toBe(99)
  })
})

// ── Edge cases ─────────────────────────────────────────────────────────────

describe('runMultiOrgStress — edge cases', () => {
  it('handles custom p95 budget', () => {
    const result = runMultiOrgStress({
      orgs: generateOrgProfiles(3, 10),
      durationSec: 5,
      p95BudgetMs: 10_000,
    })
    expect(result.performancePassed).toBe(true)
  })

  it('fails performance check with impossibly tight budget', () => {
    const result = runMultiOrgStress({
      orgs: generateOrgProfiles(3, 10),
      durationSec: 5,
      p95BudgetMs: 1,
    })
    expect(result.performancePassed).toBe(false)
  })

  it('completedAt is valid ISO timestamp', () => {
    const result = runMultiOrgStress()
    expect(() => new Date(result.completedAt)).not.toThrow()
    expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt)
  })

})
