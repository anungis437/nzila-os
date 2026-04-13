import { describe, it, expect } from 'vitest'
import { evaluateProgramEligibility, rankProgramOptions, comparePrograms } from './engine'
import type { ClientProfile } from './engine'
import { PROGRAM_CATALOG, type ProgramDefinition } from './data'

/* ── Helpers ──────────────────────────────────────────────── */

const baseProfile: ClientProfile = {
  primaryNationality: 'ZA',
  residenceCountry: 'ZA',
  wealthTier: 'hnw',
  riskProfile: 'low',
  familySize: 2,
  investmentBudget: 500_000,
  physicalPresenceOk: true,
}

const grenada = PROGRAM_CATALOG.find((p) => p.countryCode === 'GD')!
const malta = PROGRAM_CATALOG.find((p) => p.countryCode === 'MT')!
const uae = PROGRAM_CATALOG.find((p) => p.countryCode === 'AE')!

/* ── evaluateProgramEligibility ───────────────────────────── */

describe('evaluateProgramEligibility', () => {
  it('returns eligible for a qualifying profile', () => {
    const result = evaluateProgramEligibility(baseProfile, grenada)
    expect(result.eligible).toBe(true)
    expect(result.score).toBeGreaterThan(0)
    expect(result.blockers).toHaveLength(0)
  })

  it('blocks restricted nationalities', () => {
    const restrictedProgram: ProgramDefinition = {
      ...grenada,
      restrictedNationalities: ['ZA'],
    }
    const result = evaluateProgramEligibility(baseProfile, restrictedProgram)
    expect(result.eligible).toBe(false)
    expect(result.score).toBe(0)
    expect(result.blockers).toContainEqual(expect.stringContaining('restricted'))
  })

  it('penalises insufficient investment budget', () => {
    const lowBudget: ClientProfile = { ...baseProfile, investmentBudget: 50_000 }
    const result = evaluateProgramEligibility(lowBudget, malta)
    expect(result.score).toBeLessThan(100)
    expect(result.blockers).toContainEqual(expect.stringContaining('below minimum'))
  })

  it('blocks physical presence constraint', () => {
    const noRelocate: ClientProfile = { ...baseProfile, physicalPresenceOk: false }
    const result = evaluateProgramEligibility(noRelocate, malta)
    expect(result.blockers).toContainEqual(expect.stringContaining('physical presence'))
  })

  it('penalises critical risk profile', () => {
    const critical: ClientProfile = { ...baseProfile, riskProfile: 'critical' }
    const result = evaluateProgramEligibility(critical, grenada)
    expect(result.blockers).toContainEqual(expect.stringContaining('Critical risk'))
    expect(result.score).toBeLessThan(100)
  })

  it('penalises high risk profile with enhanced screening', () => {
    const high: ClientProfile = { ...baseProfile, riskProfile: 'high' }
    const result = evaluateProgramEligibility(high, grenada)
    expect(result.reasons).toContainEqual(expect.stringContaining('High risk profile'))
    expect(result.score).toBeLessThan(100)
  })

  it('adds region preference bonus', () => {
    const pref: ClientProfile = { ...baseProfile, preferredRegions: ['GD'] }
    const result = evaluateProgramEligibility(pref, grenada)
    expect(result.reasons).toContainEqual(expect.stringContaining('matches client preference'))
    expect(result.score).toBe(Math.min(100, 100 + 5))
  })

  it('does not add region bonus when preferred region differs', () => {
    const pref: ClientProfile = { ...baseProfile, preferredRegions: ['PT'] }
    const result = evaluateProgramEligibility(pref, grenada)
    expect(result.reasons).not.toContainEqual(expect.stringContaining('matches client preference'))
  })

  it('no penalty when physicalPresenceRequired and physicalPresenceOk is true', () => {
    const ok: ClientProfile = { ...baseProfile, physicalPresenceOk: true }
    const result = evaluateProgramEligibility(ok, malta)
    expect(result.blockers).not.toContainEqual(expect.stringContaining('physical presence'))
  })

  it('handles missing optional fields gracefully', () => {
    const minimal: ClientProfile = {
      primaryNationality: 'GB',
      residenceCountry: 'GB',
      wealthTier: 'standard',
      riskProfile: 'low',
      familySize: 1,
    }
    const result = evaluateProgramEligibility(minimal, grenada)
    expect(result.eligible).toBe(true)
  })
})

/* ── rankProgramOptions ───────────────────────────────────── */

describe('rankProgramOptions', () => {
  it('returns results sorted by descending score', () => {
    const results = rankProgramOptions(baseProfile, [...PROGRAM_CATALOG])
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('returns one result per program', () => {
    const results = rankProgramOptions(baseProfile, [...PROGRAM_CATALOG])
    expect(results).toHaveLength(PROGRAM_CATALOG.length)
  })
})

/* ── comparePrograms ──────────────────────────────────────── */

describe('comparePrograms', () => {
  it('produces comparison rows for requested countries', () => {
    const comparison = comparePrograms(['GD', 'MT'], PROGRAM_CATALOG)
    expect(comparison.programIds).toEqual(['GD', 'MT'])
    expect(comparison.programs).toHaveLength(2)
    expect(comparison.rows.length).toBeGreaterThan(0)
  })

  it('includes all 12 comparison fields', () => {
    const comparison = comparePrograms(['GD'], PROGRAM_CATALOG)
    expect(comparison.rows).toHaveLength(12)
  })

  it('skips unknown country codes silently', () => {
    const comparison = comparePrograms(['GD', 'XX'], PROGRAM_CATALOG)
    expect(comparison.programIds).toEqual(['GD'])
    expect(comparison.programs).toHaveLength(1)
  })

  it('renders N/A for programs without a citizenship path timeline', () => {
    const comparison = comparePrograms(['AE'], PROGRAM_CATALOG)
    const row = comparison.rows.find((r) => r.field === 'Time to Citizenship')
    expect(row?.values['AE']).toBe('N/A')
  })
})
