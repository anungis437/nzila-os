/**
 * Fleet boundaries. TREASURER may inform peers. It does not inherit their authority.
 * No existing agent may silently become a proxy for TREASURER.
 */
import { FLEET_PEERS, TREASURER_IDENTITY, fail, ok, type FleetPeer, type Result } from './kernel'

export const BOUNDARY_STATEMENTS = {
  CAPITAL: 'CAPITAL = enterprise/venture capitalization and corporate capital strategy.',
  TREASURER: "TREASURER = Principal's personal investment-capital intelligence and stewardship.",
  NORTHSTAR: "NORTHSTAR = Principal's long-horizon ambitions and dream portfolio.",
  COMMAND: 'COMMAND = execution authority within governed missions.',
  inheritance: 'TREASURER does not inherit peer authority.',
} as const

const CORPORATE_AGENT_KEYS = [
  'treasury',
  'internal-cfo',
  'portfolio-allocator',
  'controller',
  'fpa',
  'finops',
  'CAPITAL',
  'capital-allocation',
] as const

export function inheritPeerAuthority(peer: FleetPeer): Result<never> {
  return fail('AUTHORITY_NOT_INHERITED', `TREASURER does not inherit ${peer} authority`)
}

export function bindAgentAsTreasurerProxy(agentKey: string): Result<never> {
  return fail('PROXY_FORBIDDEN', `${agentKey} cannot silently become TREASURER`)
}

export function ingestCorporateCapitalCatalog(_catalog: unknown): Result<never> {
  return fail(
    'CORPORATE_CAPITAL_BOUNDARY',
    'CAPITAL catalog is enterprise capital and cannot enter the personal ledger',
  )
}

export function ingestCorporateTreasurySignal(_signal: unknown): Result<never> {
  return fail(
    'CORPORATE_CAPITAL_BOUNDARY',
    'ExecutiveOS treasury cash is corporate cash reality, not personal investment capital',
  )
}

export function dispatchCommand(_command: unknown): Result<never> {
  return fail('AUTHORITY_NOT_INHERITED', 'TREASURER does not dispatch COMMAND')
}

export function assertPersonalDomain(domain: string): Result<'PERSONAL'> {
  if (domain !== 'PERSONAL') {
    return fail('CORPORATE_CAPITAL_BOUNDARY', 'only PERSONAL capital is in scope')
  }
  return ok('PERSONAL')
}

export function peerBoundaryReport(): readonly { peer: FleetPeer; inheritsAuthority: false; mayInform: true }[] {
  return FLEET_PEERS.map((peer) => ({ peer, inheritsAuthority: false as const, mayInform: true as const }))
}

export function isCorporateAgentKey(agentKey: string): boolean {
  return (CORPORATE_AGENT_KEYS as readonly string[]).includes(agentKey)
}

export function treasurerIdentityKey(): typeof TREASURER_IDENTITY.key {
  return TREASURER_IDENTITY.key
}
