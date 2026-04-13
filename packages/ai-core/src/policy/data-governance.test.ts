import { describe, it, expect } from 'vitest'
import { assertNoCrossTenantAggregation, checkCrossTenantPolicy } from './data-governance'

const ORG_A = 'org-aaaa'
const ORG_B = 'org-bbbb'

function makeRequest(targetOrgIds: string[], requestingOrgId = ORG_A) {
  return {
    requestingOrgId,
    targetOrgIds,
    purpose: 'analytics test',
    actor: 'user-1',
  }
}

describe('assertNoCrossTenantAggregation', () => {
  it('allows single-org operation (requesting org = only target)', () => {
    const result = assertNoCrossTenantAggregation(makeRequest([ORG_A]))
    expect(result.allowed).toBe(true)
  })

  it('allows when targetOrgIds is empty', () => {
    const result = assertNoCrossTenantAggregation(makeRequest([]))
    expect(result.allowed).toBe(true)
  })

  it('throws when multiple orgs are involved', () => {
    expect(() => assertNoCrossTenantAggregation(makeRequest([ORG_A, ORG_B]))).toThrow()
  })

  it('throws even with a different requesting org vs single target', () => {
    expect(() =>
      assertNoCrossTenantAggregation(makeRequest([ORG_B], ORG_A))
    ).toThrow()
  })

  it('thrown error mentions NZ-RISK-017', () => {
    try {
      assertNoCrossTenantAggregation(makeRequest([ORG_A, ORG_B]))
    } catch (err) {
      expect((err as Error).message).toContain('NZ-RISK-017')
    }
  })
})

describe('checkCrossTenantPolicy', () => {
  it('returns allowed:true for single-org operation', () => {
    const result = checkCrossTenantPolicy(makeRequest([ORG_A]))
    expect(result.allowed).toBe(true)
    expect(typeof result.reason).toBe('string')
  })

  it('returns allowed:false for cross-tenant operation', () => {
    const result = checkCrossTenantPolicy(makeRequest([ORG_A, ORG_B]))
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('prohibited')
  })

  it('returns allowed:true when targetOrgIds is empty', () => {
    const result = checkCrossTenantPolicy(makeRequest([]))
    expect(result.allowed).toBe(true)
  })
})
