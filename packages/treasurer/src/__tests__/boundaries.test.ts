import { describe, expect, it } from 'vitest'

import { treasurerAgent } from '../agent'
import { FLEET_PEERS } from '../kernel'
import {
  assertPersonalDomain,
  bindAgentAsTreasurerProxy,
  dispatchCommand,
  ingestCorporateCapitalCatalog,
  ingestCorporateTreasurySignal,
  inheritPeerAuthority,
  isCorporateAgentKey,
  peerBoundaryReport,
} from '../boundaries'
import { decideDreamShouldExist, capacityFromNorthstarAmbition } from '../northstar'
import { validateSnapshot } from '../integrity'
import { AS_OF, constraints, position, snapshot } from '../fixtures'

describe('B. boundaries', () => {
  it('refuses every peer authority, including CAPITAL, COMMAND, and NORTHSTAR', () => {
    for (const peer of FLEET_PEERS) {
      const inherited = inheritPeerAuthority(peer)
      expect(inherited.ok).toBe(false)
      if (!inherited.ok) expect(inherited.code).toBe('AUTHORITY_NOT_INHERITED')
    }
    expect(peerBoundaryReport().every((row) => row.inheritsAuthority === false)).toBe(true)
    expect(dispatchCommand({ name: 'place-order' }).ok).toBe(false)
  })

  it('keeps corporate CAPITAL and corporate treasury out of the personal ledger', () => {
    expect(ingestCorporateCapitalCatalog({ decision: 'FUND NOW' }).ok).toBe(false)
    expect(ingestCorporateTreasurySignal({ cashToday: 1 }).ok).toBe(false)
    expect(assertPersonalDomain('CORPORATE').ok).toBe(false)
    expect(assertPersonalDomain('PERSONAL').ok).toBe(true)
    const leaked = validateSnapshot(
      {
        ...snapshot(),
        positions: [
          position({
            id: 'p-corp',
            instrumentId: 'corp:union-eyes',
            marketValueMinor: 1_000,
            exposureGroupId: 'corp',
            evidenceId: 'ev-eq',
          }),
        ],
      },
      AS_OF,
      constraints(),
    )
    expect(leaked.ok).toBe(false)
    if (!leaked.ok) expect(leaked.code).toBe('CORPORATE_CAPITAL_BOUNDARY')
  })

  it('forbids corporate agents from becoming a TREASURER proxy', () => {
    for (const key of ['treasury', 'internal-cfo', 'portfolio-allocator', 'CAPITAL']) {
      expect(isCorporateAgentKey(key)).toBe(true)
      expect(bindAgentAsTreasurerProxy(key).ok).toBe(false)
    }
    expect(treasurerAgent.key).not.toBe('treasury')
  })

  it('does not let NORTHSTAR invent capacity or decide that a dream exists', () => {
    expect(decideDreamShouldExist().ok).toBe(false)
    expect(
      capacityFromNorthstarAmbition({
        id: 'dream',
        name: 'studio',
        fundingNeedMinor: 1,
        currency: 'CAD',
        asOf: AS_OF,
      }).ok,
    ).toBe(false)
  })
})
