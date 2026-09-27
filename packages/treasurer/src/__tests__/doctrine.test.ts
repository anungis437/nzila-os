import { describe, expect, it } from 'vitest'

import { treasurerAgent } from '../agent'
import {
  PERMITTED_AUTHORITIES,
  PROHIBITED_AUTHORITIES,
  TREASURER_IDENTITY,
  hasAuthority,
  isProhibited,
} from '../kernel'
import { assumeAuthorization, requestTransaction } from '../decision'
import { refuseReturnOnlyOptimization } from '../authority'

describe('A. doctrine', () => {
  it('identifies TREASURER as personal-capital intelligence for the Principal', () => {
    expect(treasurerAgent.key).toBe('treasurer')
    expect(treasurerAgent.name).toBe('TREASURER')
    expect(TREASURER_IDENTITY.principalName).toBe('Aubert Nungisa')
    expect(TREASURER_IDENTITY.capitalDomain).toBe('PERSONAL')
    expect(treasurerAgent.mission.toLowerCase()).toContain('personal investment capital')
  })

  it('keeps production and transaction authority closed', () => {
    expect(TREASURER_IDENTITY.productionAuthority).toBe('NO')
    expect(TREASURER_IDENTITY.financialTransactionAuthority).toBe('NEVER')
    expect(treasurerAgent.productionAuthority).toBe('NO')
    expect(treasurerAgent.financialTransactionAuthority).toBe('NEVER')
  })

  it('lists prohibited authorities and never grants them', () => {
    for (const authority of PROHIBITED_AUTHORITIES) {
      expect(isProhibited(authority)).toBe(true)
      expect(hasAuthority(authority)).toBe(false)
    }
    expect(hasAuthority('ANALYZE')).toBe(true)
    expect(PERMITTED_AUTHORITIES).toContain('RECORD_HUMAN_AUTHORIZATION')
  })

  it('requires a human authorization and refuses to assume one', () => {
    const assumed = assumeAuthorization()
    expect(assumed.ok).toBe(false)
    if (!assumed.ok) expect(assumed.code).toBe('AUTHORIZATION_REQUIRED')
    const buy = requestTransaction('BUY')
    expect(buy.ok).toBe(false)
  })

  it('refuses return-only optimization that drops liquidity or downside', () => {
    expect(refuseReturnOnlyOptimization({ ignoreLiquidity: true }).ok).toBe(false)
    expect(refuseReturnOnlyOptimization({ ignoreDownside: true }).ok).toBe(false)
    expect(refuseReturnOnlyOptimization({}).ok).toBe(true)
  })
})
