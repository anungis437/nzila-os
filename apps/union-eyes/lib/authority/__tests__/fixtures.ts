import type {
  AuthorityFacts,
  AuthorityRequest,
  Capacity,
  CaseFacts,
  Delegation,
  DisclosureConsent,
  Mandate,
  Membership,
  Recusal,
  ResourceRef,
  ResourceRelationship,
  ResourceType,
  Action,
} from '../ontology'

export const NOW = new Date('2026-10-24T12:00:00.000Z')
export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR
export const ago = (ms: number) => new Date(NOW.getTime() - ms)
export const ahead = (ms: number) => new Date(NOW.getTime() + ms)

export const ORG = '00000000-0000-4000-8000-00000000000a'
export const ORG_B = '00000000-0000-4000-8000-00000000000b'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const U = {
  member: id(1), steward: id(2), chief: id(3), officer: id(4), president: id(5),
  treasurer: id(6), auditor: id(7), reviewer: id(8), other: id(9), admin: id(10),
  platform: id(11), clc: id(12), delegate: id(13), clerk: id(14), respondent: id(15),
}
export const CASE_ID = id(100)
export const UNIT_ID = id(101)
export const TERR_ID = id(102)
export const ACCT = id(200)
export const TX_ID = id(201)
export const APPROVAL_ID = id(300)
export const REVIEW_ID = id(400)
export const MATTER_ID = id(500)

export const membership = (
  userId: string,
  capacities: Capacity[],
  over: Partial<Membership> = {},
): Membership => ({ userId, organizationId: ORG, status: 'active', capacities, ...over })

export function facts(userId: string, capacities: Capacity[], over: Partial<AuthorityFacts> = {}): AuthorityFacts {
  return {
    principal: { userId, authenticated: true },
    memberships: [membership(userId, capacities)],
    mandates: [],
    relationships: [],
    delegations: [],
    recusals: [],
    consents: [],
    ...over,
  }
}

export const ref = (type: ResourceType, rid: string, organizationId = ORG): ResourceRef => ({ type, id: rid, organizationId })

export function request(
  userId: string,
  action: Action,
  resource: ResourceRef,
  over: Partial<AuthorityRequest> = {},
): AuthorityRequest {
  return { principalUserId: userId, organizationId: ORG, action, resource, ...over }
}

export const caseFacts = (over: Partial<CaseFacts> = {}): CaseFacts => ({
  kind: 'case', id: CASE_ID, organizationId: ORG, unitId: UNIT_ID, territoryId: TERR_ID,
  classification: 'standard', counselControlled: false, adverseUserIds: [], ...over,
})

export const mandate = (over: Partial<Mandate> = {}): Mandate => ({
  id: id(900), organizationId: ORG, principalUserId: U.chief, kind: 'supervisory',
  powers: ['read', 'read_internal'], scope: { unitIds: [UNIT_ID] },
  sourceInstrument: 'Bylaw 12.3', grantedBy: U.president, status: 'active',
  effectiveAt: ago(30 * DAY), expiresAt: ahead(30 * DAY), revokedAt: null, ...over,
})

let relSeq = 1000
export const relationship = (over: Partial<ResourceRelationship> = {}): ResourceRelationship => ({
  id: id(relSeq++), organizationId: ORG, principalUserId: U.steward, resource: ref('case', CASE_ID),
  relation: 'assignee', permissions: [], privilegedAccess: false, origin: 'derived', grantedBy: null,
  status: 'active', effectiveAt: ago(DAY), expiresAt: null, revokedAt: null, ...over,
})

export const delegation = (over: Partial<Delegation> = {}): Delegation => ({
  id: id(950), organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.delegate,
  office: 'President', actions: ['governance:approve'], resourceTypes: ['approval_request'],
  status: 'active', effectiveAt: ago(DAY), expiresAt: ahead(7 * DAY), revokedAt: null, ...over,
})

export const recusal = (over: Partial<Recusal> = {}): Recusal => ({
  id: id(960), organizationId: ORG, principalUserId: U.steward, resource: ref('case', CASE_ID),
  reason: 'conflict of interest', declaredAt: ago(HOUR), liftedAt: null, liftedBy: null, ...over,
})

export const consent = (over: Partial<DisclosureConsent> = {}): DisclosureConsent => ({
  id: id(970), organizationId: ORG, memberUserId: U.member, matterId: MATTER_ID,
  direction: 'union_to_workaid', issuer: 'member', categories: ['case_summary'],
  recipientUserId: null, purpose: 'referral to WorkAid counsel', grantedAt: ago(DAY),
  expiresAt: ahead(30 * DAY), revokedAt: null, ...over,
})
