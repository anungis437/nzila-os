/**
 * Fleet interaction obligations.
 *
 * On main there is no machine registry of SCOUT, VERIFIER, REDTEAM, BUILDER,
 * FORGE, or COUNSEL. These records are obligations CIVITAS imposes on itself.
 * They do not register those peers and they do not grant them permissions.
 */

export const PEER_ROLES = ['SCOUT', 'VERIFIER', 'REDTEAM', 'BUILDER', 'FORGE', 'COUNSEL'] as const

export type PeerRole = (typeof PEER_ROLES)[number]

export interface PeerObligation {
  readonly peer: PeerRole
  readonly civitasOwns: string
  readonly permissionsGrantedByCivitas: readonly string[]
  readonly legalDecisionAuthorityGranted: false
}

export const FLEET_INTERACTION: readonly PeerObligation[] = [
  {
    peer: 'SCOUT',
    civitasOwns: 'CIVITAS does not treat SCOUT discovery as verified.',
    permissionsGrantedByCivitas: [],
    legalDecisionAuthorityGranted: false,
  },
  {
    peer: 'VERIFIER',
    civitasOwns: 'VERIFIER validates authority, quotations, jurisdiction, currentness, amendments, and legal effect. CIVITAS does not replace that validation.',
    permissionsGrantedByCivitas: [],
    legalDecisionAuthorityGranted: false,
  },
  {
    peer: 'REDTEAM',
    civitasOwns: 'REDTEAM may challenge assumptions, pseudolaw contamination, tax, creditor, and fiduciary exposure, privacy leakage, and contradictory authority. CIVITAS does not silence that challenge.',
    permissionsGrantedByCivitas: [],
    legalDecisionAuthorityGranted: false,
  },
  {
    peer: 'BUILDER',
    civitasOwns: 'BUILDER may implement an approved capability. CIVITAS grants no legal decision authority.',
    permissionsGrantedByCivitas: [],
    legalDecisionAuthorityGranted: false,
  },
  {
    peer: 'FORGE',
    civitasOwns: 'FORGE may implement an approved capability. CIVITAS grants no legal decision authority.',
    permissionsGrantedByCivitas: [],
    legalDecisionAuthorityGranted: false,
  },
  {
    peer: 'COUNSEL',
    civitasOwns: 'COUNSEL is not CIVITAS. CIVITAS is not counsel of record.',
    permissionsGrantedByCivitas: [],
    legalDecisionAuthorityGranted: false,
  },
]

export interface ScoutAcceptance {
  readonly verified: boolean
  readonly reason: string
}

/** SCOUT cannot verify its own discovery. */
export function treatScoutDiscovery(input: {
  readonly verifiedByScout: boolean
  readonly acceptedBy: 'VERIFIER' | 'HUMAN' | null
}): ScoutAcceptance {
  if (input.acceptedBy === null) {
    return {
      verified: false,
      reason: 'SCOUT discovery stays unverified until VERIFIER or a human accepts it.',
    }
  }
  return {
    verified: true,
    reason: `Accepted by ${input.acceptedBy}. SCOUT self-verification was not used.`,
  }
}

export function suppressRedTeamChallenge(): { readonly suppressed: false } {
  return { suppressed: false }
}

export interface PeerGrantRefusal {
  readonly ok: false
  readonly code: 'PEER_PERMISSIONS_UNCHANGED'
  readonly reason: string
}

/** CIVITAS cannot grant a permission to any other fleet member. */
export function grantPeerPermission(_peer: string, _permission: string): PeerGrantRefusal {
  return {
    ok: false,
    code: 'PEER_PERMISSIONS_UNCHANGED',
    reason: 'CIVITAS does not grant permissions to other fleet members.',
  }
}
