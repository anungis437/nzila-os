import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROFILE,
  PROFILE_TARGETS,
  getProfileTargets,
  isSeedProfile,
} from '../src/core/profiles'
import { SEED_PROFILES } from '../src/core/types'

describe('profiles', () => {
  it('exposes targets for every profile', () => {
    for (const profile of SEED_PROFILES) {
      const t = getProfileTargets(profile)
      expect(t.people).toBeGreaterThan(0)
      expect(t.organizations).toBeGreaterThan(0)
      expect(t.users).toBeGreaterThan(0)
      expect(t.dashboardIntensity).toBeGreaterThanOrEqual(0)
      expect(t.dashboardIntensity).toBeLessThanOrEqual(1)
      expect(t.historyMonths).toBeGreaterThan(0)
      expect(t.futureWindowDays).toBeGreaterThan(0)
    }
  })

  it('volumes scale up across the four profiles', () => {
    const order = ['demo-light', 'demo-standard', 'executive-showcase', 'investor-showcase'] as const
    for (let i = 1; i < order.length; i++) {
      expect(PROFILE_TARGETS[order[i]!].people).toBeGreaterThan(
        PROFILE_TARGETS[order[i - 1]!].people,
      )
      expect(PROFILE_TARGETS[order[i]!].dashboardIntensity).toBeGreaterThanOrEqual(
        PROFILE_TARGETS[order[i - 1]!].dashboardIntensity,
      )
    }
  })

  it('isSeedProfile only accepts known names', () => {
    expect(isSeedProfile('demo-standard')).toBe(true)
    expect(isSeedProfile('nope')).toBe(false)
    expect(isSeedProfile(undefined)).toBe(false)
    expect(isSeedProfile(42)).toBe(false)
  })

  it('default profile is registered', () => {
    expect(SEED_PROFILES).toContain(DEFAULT_PROFILE)
  })
})
