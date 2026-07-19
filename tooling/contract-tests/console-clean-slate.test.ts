/**
 * Contract Test — Console Clean Slate
 *
 * Ensures the console workspace does not project demo portfolio numbers.
 */
import { describe, expect, it } from 'vitest'
import { buildVentureDomains, loadVentures, summarizePortfolio } from '../../apps/console/app/(dashboard)/workspace/_lib/ventures'

describe('CONSOLE-CLEAN-SLATE-001 — no demo portfolio projection', () => {
  it('returns an empty venture list', () => {
    expect(loadVentures()).toEqual([])
  })

  it('summarizes to zeroed portfolio metrics', () => {
    expect(summarizePortfolio(loadVentures())).toMatchObject({
      totalVentures: 0,
      activeVentures: 0,
      livePilots: 0,
      totalArr: 0,
      totalPipeline: 0,
      totalCustomers: 0,
    })
  })

  it('builds planned venture domains with zero metrics', () => {
    const domains = buildVentureDomains(loadVentures())
    expect(domains.every((domain) => domain.status === 'planned')).toBe(true)
    expect(domains.every((domain) => domain.arr === 0 && domain.pilots === 0 && domain.customers === 0)).toBe(true)
  })
})