import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import { capacitiesForRole, NON_CUSTOMER_AUTHORITY_ROLES, ROLE_CAPACITIES } from '../capacity'
import { liveness } from '../common'
import type { Decision, ReasonCode } from '../ontology'
import {
  CASE_ID, DAY, HOUR, NOW, ORG, ORG_B, TERR_ID, U, UNIT_ID, ago, ahead, caseFacts, delegation, facts,
  mandate, membership, ref, relationship, recusal, request,
} from './fixtures'

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)
const readCase = (userId: string, over = {}) => request(userId, 'case:read', ref('case', CASE_ID), over)

describe('kernel preflight: identity, tenancy, integrity (fail closed)', () => {
  it('denies an unauthenticated principal even with a perfect relationship', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()] })
    f.principal.authenticated = false
    expect(decide(readCase(U.steward), f, caseFacts(), NOW)).toMatchObject({ effect: 'deny' })
  })

  it('denies when the request principal differs from the authenticated principal', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()] })
    const d = decide(readCase(U.officer), f, caseFacts(), NOW)
    expect(codes(d)).toContain('PRINCIPAL_MISMATCH')
  })

  it('denies when resource facts are missing', () => {
    expect(codes(decide(readCase(U.steward), facts(U.steward, ['steward']), null, NOW))).toContain('RESOURCE_FACTS_MISSING')
  })

  it('FOREIGN TENANT: a resource in another organization is denied even for an owner there', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()] })
    const foreignCase = caseFacts({ organizationId: ORG_B })
    const req = request(U.steward, 'case:read', ref('case', CASE_ID, ORG_B))
    expect(codes(decide(req, f, foreignCase, NOW))).toContain('FOREIGN_TENANT')
  })

  it('FOREIGN TENANT: active-org header says A but resource says B', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()] })
    const req = request(U.steward, 'case:read', ref('case', CASE_ID, ORG_B), { organizationId: ORG })
    expect(codes(decide(req, f, caseFacts({ organizationId: ORG_B }), NOW))).toContain('FOREIGN_TENANT')
  })

  it('FOREIGN TENANT: request ref names org B while the loaded facts claim org A (ref/facts disagreement)', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()] })
    const req = request(U.steward, 'case:read', ref('case', CASE_ID, ORG_B), { organizationId: ORG })
    expect(codes(decide(req, f, caseFacts({ organizationId: ORG }), NOW))).toContain('FOREIGN_TENANT')
  })

  it('FOREIGN TENANT: membership in another organization grants nothing here', () => {
    const f = facts(U.steward, ['steward'], {
      memberships: [membership(U.steward, ['steward'], { organizationId: ORG_B })],
      relationships: [relationship()],
    })
    expect(codes(decide(readCase(U.steward), f, caseFacts(), NOW))).toContain('NOT_AN_ACTIVE_MEMBER')
  })

  it('fails closed when the loader returns another organization\'s mandate (contradictory facts)', () => {
    const f = facts(U.chief, ['chief_steward'], { mandates: [mandate({ organizationId: ORG_B })] })
    expect(codes(decide(readCase(U.chief), f, caseFacts(), NOW))).toContain('FACTS_CONTRADICTORY')
  })

  it('fails closed on duplicate membership rows', () => {
    const f = facts(U.steward, ['steward'], {
      memberships: [membership(U.steward, ['steward']), membership(U.steward, ['officer'])],
      relationships: [relationship()],
    })
    expect(codes(decide(readCase(U.steward), f, caseFacts(), NOW))).toContain('FACTS_CONTRADICTORY')
  })

  it('fails closed (never throws) on malformed facts', () => {
    const broken = { ...facts(U.steward, ['steward']), mandates: undefined } as never
    const d = decide(readCase(U.steward), broken, caseFacts(), NOW)
    expect(d.effect).toBe('deny')
  })

  it.each(['suspended', 'inactive', 'pending', 'revoked'] as const)('a %s membership authorizes nothing', (status) => {
    const f = facts(U.steward, ['steward'], {
      memberships: [membership(U.steward, ['steward'], { status })],
      relationships: [relationship()],
    })
    expect(codes(decide(readCase(U.steward), f, caseFacts(), NOW))).toContain('NOT_AN_ACTIVE_MEMBER')
  })

  it('rejects an action applied to the wrong resource family', () => {
    const req = request(U.treasurer, 'finance:approve', ref('case', CASE_ID))
    expect(codes(decide(req, facts(U.treasurer, ['financial_officer']), caseFacts(), NOW))).toContain('ACTION_NOT_COVERED')
  })

  it('platform-staff status is carried but never contributes to a decision', () => {
    const f = facts(U.platform, [], { principal: { userId: U.platform, authenticated: true, platformStaff: true } })
    f.memberships = [membership(U.platform, [])]
    expect(decide(readCase(U.platform), f, caseFacts(), NOW).effect).toBe('deny')
  })

  it('every decision records the policy version and evaluation time', () => {
    const d = decide(readCase(U.steward), facts(U.steward, ['steward']), caseFacts(), NOW)
    expect(d.policyVersion).toMatch(/^ue-authority-kernel\//)
    expect(d.evaluatedAt).toBe(NOW.toISOString())
  })
})

describe('role is eligibility, never authority', () => {
  it('maps platform, federation and national roles to NO customer capacity', () => {
    for (const role of NON_CUSTOMER_AUTHORITY_ROLES) expect(capacitiesForRole(role)).toEqual([])
  })

  it('unknown roles and empty roles map to nothing', () => {
    expect(capacitiesForRole('wizard')).toEqual([])
    expect(capacitiesForRole(null)).toEqual([])
    expect(capacitiesForRole('constructor')).toEqual([])
  })

  it('organization admin carries no representation, financial or governance capacity', () => {
    expect(capacitiesForRole('admin')).toEqual(['member'])
  })

  it('no stored role maps to an appointment-only capacity', () => {
    const appointed = ['auditor', 'trustee', 'governance_reviewer', 'privacy_officer']
    for (const caps of Object.values(ROLE_CAPACITIES)) for (const a of appointed) expect(caps).not.toContain(a)
  })

  it('a president with the highest role in the org still cannot read a case they have no relationship to', () => {
    const f = facts(U.president, capacitiesForRole('president'))
    expect(codes(decide(readCase(U.president), f, caseFacts(), NOW))).toContain('NO_SOURCE_OF_AUTHORITY')
  })

  it('an organization admin cannot read any case by role', () => {
    const f = facts(U.admin, capacitiesForRole('admin'))
    expect(decide(readCase(U.admin), f, caseFacts(), NOW).effect).toBe('deny')
  })

  it('a CLC executive / system admin / compliance manager gets nothing from the title', () => {
    for (const role of ['clc_executive', 'system_admin', 'compliance_manager', 'national_officer']) {
      const f = facts(U.clc, capacitiesForRole(role))
      expect(decide(readCase(U.clc), f, caseFacts(), NOW).effect).toBe('deny')
    }
  })
})

describe('liveness: expiry and revocation are authoritative over status', () => {
  const row = (over = {}) => ({ status: 'active', effectiveAt: ago(DAY), expiresAt: ahead(DAY), revokedAt: null as Date | null, ...over })

  it('live', () => expect(liveness(row(), NOW)).toBe('live'))
  it('expired by time even though status says active', () => expect(liveness(row({ expiresAt: ago(1) }), NOW)).toBe('expired'))
  it('expiry exactly now is expired (half-open window)', () => expect(liveness(row({ expiresAt: NOW }), NOW)).toBe('expired'))
  it('not yet effective', () => expect(liveness(row({ effectiveAt: ahead(HOUR) }), NOW)).toBe('not_yet_effective'))
  it('revoked', () => expect(liveness(row({ status: 'revoked', revokedAt: ago(HOUR) }), NOW)).toBe('revoked'))
  it('active status with a revocation timestamp is contradictory', () => expect(liveness(row({ revokedAt: ago(HOUR) }), NOW)).toBe('inconsistent'))
  it('revoked status with no timestamp is contradictory', () => expect(liveness(row({ status: 'revoked' }), NOW)).toBe('inconsistent'))
  it('inverted window is contradictory', () => expect(liveness(row({ effectiveAt: ahead(DAY), expiresAt: ahead(HOUR) }), NOW)).toBe('inconsistent'))
  it('unknown status is contradictory, never live', () => expect(liveness(row({ status: 'enabled' }), NOW)).toBe('inconsistent'))
  it('suspended is not live', () => expect(liveness(row({ status: 'suspended' }), NOW)).not.toBe('live'))
})

describe('case policy — relationships', () => {
  it('assigned steward reads with internal visibility', () => {
    const d = decide(readCase(U.steward), facts(U.steward, ['steward'], { relationships: [relationship()] }), caseFacts(), NOW)
    expect(d.effect).toBe('allow')
    expect(d.scope.visibility).toBe('internal')
    expect(d.obligations).toContain('audit_required')
    expect(d.authority[0]).toMatchObject({ kind: 'relationship' })
  })

  it('the represented member reads member-visible only and cannot read internal notes', () => {
    const rel = relationship({ principalUserId: U.member, relation: 'represented_member' })
    const f = facts(U.member, ['member'], { relationships: [rel] })
    const read = decide(readCase(U.member), f, caseFacts(), NOW)
    expect(read.effect).toBe('allow')
    expect(read.scope.visibility).toBe('member_visible')
    expect(read.obligations).toContain('redact_internal_notes')
    expect(decide(request(U.member, 'case:read_internal', ref('case', CASE_ID)), f, caseFacts(), NOW).effect).toBe('deny')
  })

  it('a member who is merely assigned (no representation capacity) gets nothing', () => {
    const f = facts(U.member, ['member'], { relationships: [relationship({ principalUserId: U.member })] })
    expect(codes(decide(readCase(U.member), f, caseFacts(), NOW))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('an unrelated steward gets nothing (isStewardPlus replacement)', () => {
    expect(codes(decide(readCase(U.steward), facts(U.steward, ['steward']), caseFacts(), NOW))).toContain('NO_SOURCE_OF_AUTHORITY')
  })

  it('a relationship to ANOTHER case grants nothing here', () => {
    const other = relationship({ resource: ref('case', '00000000-0000-4000-8000-0000000fffff') })
    expect(decide(readCase(U.steward), facts(U.steward, ['steward'], { relationships: [other] }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('an expired or revoked relationship grants nothing', () => {
    const f = (r: object) => facts(U.steward, ['steward'], { relationships: [relationship(r)] })
    expect(decide(readCase(U.steward), f({ expiresAt: ago(HOUR) }), caseFacts(), NOW).effect).toBe('deny')
    expect(decide(readCase(U.steward), f({ status: 'revoked', revokedAt: ago(HOUR) }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('an assignee may write and transition but not assign', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()] })
    for (const a of ['case:write_notes', 'case:transition', 'case:comment'] as const) {
      expect(decide(request(U.steward, a, ref('case', CASE_ID)), f, caseFacts(), NOW).effect).toBe('allow')
    }
    expect(decide(request(U.steward, 'case:assign', ref('case', CASE_ID)), f, caseFacts(), NOW).effect).toBe('deny')
  })

  it('collaborator permissions are explicit and bounded; a self-granted collaboration is void', () => {
    const grant = relationship({ relation: 'collaborator', origin: 'explicit', grantedBy: U.chief, permissions: ['read'] })
    const f = facts(U.steward, ['steward'], { relationships: [grant] })
    expect(decide(readCase(U.steward), f, caseFacts(), NOW).effect).toBe('allow')
    expect(decide(request(U.steward, 'case:write_notes', ref('case', CASE_ID)), f, caseFacts(), NOW).effect).toBe('deny')
    const selfGrant = relationship({ relation: 'collaborator', origin: 'explicit', grantedBy: U.steward, permissions: ['read'] })
    expect(codes(decide(readCase(U.steward), facts(U.steward, ['steward'], { relationships: [selfGrant] }), caseFacts(), NOW))).toContain('INSTRUMENT_INVALID')
  })

  it('collaborator cannot be granted assign even if the row claims it', () => {
    const grant = relationship({ relation: 'collaborator', origin: 'explicit', grantedBy: U.chief, permissions: ['assign', 'read'] })
    const f = facts(U.steward, ['steward'], { relationships: [grant] })
    expect(decide(request(U.steward, 'case:assign', ref('case', CASE_ID)), f, caseFacts(), NOW).effect).toBe('deny')
  })
})

describe('case policy — supervisory mandates (case_read_any replacement)', () => {
  const chief = (over = {}) => facts(U.chief, ['chief_steward'], { mandates: [mandate(over)] })

  it('allows read within the mandate unit, member-visible with notes redacted', () => {
    const d = decide(readCase(U.chief), chief({ powers: ['read'] }), caseFacts(), NOW)
    expect(d.effect).toBe('allow')
    expect(d.scope.visibility).toBe('member_visible')
    expect(d.authority[0]).toMatchObject({ kind: 'mandate' })
  })

  it('internal notes need the separate read_internal power', () => {
    const d = decide(request(U.chief, 'case:read_internal', ref('case', CASE_ID)), chief({ powers: ['read'] }), caseFacts(), NOW)
    expect(codes(d)).toContain('ACTION_NOT_COVERED')
  })

  it('denies a case outside the mandate unit and territory', () => {
    const other = caseFacts({ unitId: '00000000-0000-4000-8000-0000000eeeee', territoryId: '00000000-0000-4000-8000-0000000ddddd' })
    expect(codes(decide(readCase(U.chief), chief(), other, NOW))).toContain('OUT_OF_SCOPE')
  })

  it('territory scope covers cases in the territory', () => {
    const d = decide(readCase(U.chief), chief({ scope: { territoryIds: [TERR_ID] } }), caseFacts({ unitId: null }), NOW)
    expect(d.effect).toBe('allow')
  })

  it('an unbounded supervisory mandate is an invalid instrument and grants nothing', () => {
    expect(codes(decide(readCase(U.chief), chief({ scope: {} }), caseFacts(), NOW))).toContain('INSTRUMENT_INVALID')
  })

  it('an expired / revoked / suspended mandate grants nothing', () => {
    expect(decide(readCase(U.chief), chief({ expiresAt: ago(HOUR) }), caseFacts(), NOW).effect).toBe('deny')
    expect(decide(readCase(U.chief), chief({ status: 'revoked', revokedAt: ago(HOUR) }), caseFacts(), NOW).effect).toBe('deny')
    expect(decide(readCase(U.chief), chief({ status: 'suspended' }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('a confidential case needs a mandate with a confidential classification ceiling', () => {
    const conf = caseFacts({ confidential: true })
    expect(codes(decide(readCase(U.chief), chief(), conf, NOW))).toContain('CLASSIFICATION_EXCEEDS_MANDATE')
    const ceiling = chief({ scope: { unitIds: [UNIT_ID], classificationCeiling: 'standard' } })
    expect(decide(readCase(U.chief), ceiling, conf, NOW).effect).toBe('deny')
    const ok = chief({ scope: { unitIds: [UNIT_ID], classificationCeiling: 'confidential' } })
    expect(decide(readCase(U.chief), ok, conf, NOW).effect).toBe('allow')
    // Confidential is not privileged: a non-confidential case is unaffected.
    expect(decide(readCase(U.chief), chief(), caseFacts(), NOW).effect).toBe('allow')
  })

  it('a mandate with no expiry is rejected: renewal must be affirmative', () => {
    expect(codes(decide(readCase(U.chief), chief({ expiresAt: null }), caseFacts(), NOW))).toContain('INSTRUMENT_INVALID')
  })

  it('a self-granted mandate is void', () => {
    expect(codes(decide(readCase(U.chief), chief({ grantedBy: U.chief }), caseFacts(), NOW))).toContain('INSTRUMENT_INVALID')
  })

  it('a mandate without a source instrument is void', () => {
    expect(decide(readCase(U.chief), chief({ sourceInstrument: '  ' }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('a mandate does not make a plain member eligible (capacity gates it)', () => {
    const f = facts(U.chief, ['member'], { mandates: [mandate()] })
    expect(codes(decide(readCase(U.chief), f, caseFacts(), NOW))).toContain('CAPACITY_NOT_ELIGIBLE')
  })

  it('a supervisory mandate cannot carry the privileged-read power', () => {
    expect(codes(decide(readCase(U.chief), chief({ powers: ['read', 'read_privileged'] }), caseFacts(), NOW))).toContain('INSTRUMENT_INVALID')
  })

  it('another principal\'s mandate is not usable', () => {
    const f = facts(U.officer, ['officer'], { mandates: [mandate({ principalUserId: U.chief })] })
    expect(decide(readCase(U.officer), f, caseFacts(), NOW).effect).toBe('deny')
  })

  it('supervisory assign requires the assign power and covers the case', () => {
    const f = chief({ powers: ['assign'] })
    expect(decide(request(U.chief, 'case:assign', ref('case', CASE_ID)), f, caseFacts(), NOW).effect).toBe('allow')
    expect(decide(readCase(U.chief), f, caseFacts(), NOW).effect).toBe('deny')
  })
})

describe('case policy — privileged and counsel-controlled matters', () => {
  const priv = caseFacts({ classification: 'privileged' })

  it('a supervisor with every power cannot read a privileged matter', () => {
    const f = facts(U.chief, ['chief_steward'], { mandates: [mandate({ powers: ['read', 'read_internal', 'assign'] })] })
    for (const a of ['case:read', 'case:read_internal', 'case:read_privileged'] as const) {
      expect(codes(decide(request(U.chief, a, ref('case', CASE_ID)), f, priv, NOW))).toContain('PRIVILEGED_MATTER')
    }
  })

  it('but may assign a privileged matter without reading it', () => {
    const f = facts(U.chief, ['chief_steward'], { mandates: [mandate({ powers: ['assign'] })] })
    expect(decide(request(U.chief, 'case:assign', ref('case', CASE_ID)), f, priv, NOW).effect).toBe('allow')
  })

  it('an ordinary assignee cannot read a privileged matter without an explicit grant', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()] })
    expect(codes(decide(readCase(U.steward), f, priv, NOW))).toContain('PRIVILEGED_MATTER')
  })

  it('an explicit, independently granted privileged-access relationship opens it', () => {
    const rel = relationship({ origin: 'explicit', grantedBy: U.president, privilegedAccess: true })
    const f = facts(U.steward, ['steward'], { relationships: [rel] })
    expect(decide(request(U.steward, 'case:read_privileged', ref('case', CASE_ID)), f, priv, NOW).effect).toBe('allow')
  })

  it('privileged access cannot be derived or self-granted', () => {
    for (const r of [
      relationship({ origin: 'derived', privilegedAccess: true }),
      relationship({ origin: 'explicit', grantedBy: U.steward, privilegedAccess: true }),
      relationship({ origin: 'explicit', grantedBy: null, privilegedAccess: true }),
    ]) {
      expect(decide(readCase(U.steward), facts(U.steward, ['steward'], { relationships: [r] }), priv, NOW).effect).toBe('deny')
    }
  })

  it('counsel-controlled content is never reachable via the case policy', () => {
    const rel = relationship({ origin: 'explicit', grantedBy: U.president, privilegedAccess: true })
    const f = facts(U.steward, ['steward'], { relationships: [rel] })
    const d = decide(request(U.steward, 'case:read_privileged', ref('case', CASE_ID)), f, caseFacts({ classification: 'privileged', counselControlled: true }), NOW)
    expect(codes(d)).toContain('COUNSEL_CONTROLLED')
  })
})

describe('case policy — recusal and adversity are absolute', () => {
  it('a recused assignee is denied despite a live relationship', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()], recusals: [recusal()] })
    expect(codes(decide(readCase(U.steward), f, caseFacts(), NOW))).toContain('RECUSED')
  })

  it('a lifted recusal no longer blocks', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()], recusals: [recusal({ liftedAt: ago(1), liftedBy: U.chief })] })
    expect(decide(readCase(U.steward), f, caseFacts(), NOW).effect).toBe('allow')
  })

  it('a recusal on a different case does not block this one', () => {
    const f = facts(U.steward, ['steward'], { relationships: [relationship()], recusals: [recusal({ resource: ref('case', '00000000-0000-4000-8000-0000000fffff') })] })
    expect(decide(readCase(U.steward), f, caseFacts(), NOW).effect).toBe('allow')
  })

  it('a respondent cannot read the complaint against them via any source', () => {
    const adverse = caseFacts({ adverseUserIds: [U.chief] })
    const f = facts(U.chief, ['chief_steward'], { mandates: [mandate()], relationships: [relationship({ principalUserId: U.chief })] })
    expect(codes(decide(readCase(U.chief), f, adverse, NOW))).toContain('ADVERSE_PARTY')
  })

  it('recusal beats emergency access', () => {
    const em = mandate({ kind: 'emergency_access', powers: ['read'], scope: { resourceIds: [CASE_ID] }, justification: 'urgent safety matter, supervisor unavailable', approvedBy: U.president, effectiveAt: ago(HOUR), expiresAt: ahead(HOUR) })
    const f = facts(U.chief, ['chief_steward'], { mandates: [em], recusals: [recusal({ principalUserId: U.chief })] })
    expect(codes(decide(readCase(U.chief), f, caseFacts(), NOW))).toContain('RECUSED')
  })
})

describe('case policy — emergency access (explicit, justified, time-boxed, read-only)', () => {
  const em = (over = {}) => mandate({
    kind: 'emergency_access', powers: ['read'], scope: { resourceIds: [CASE_ID] },
    justification: 'urgent safety matter, supervisor unavailable', approvedBy: U.president,
    effectiveAt: ago(HOUR), expiresAt: ahead(HOUR), ...over,
  })
  const f = (over = {}) => facts(U.chief, ['chief_steward'], { mandates: [em(over)] })

  it('allows a valid grant, flagged for emergency review and read-only', () => {
    const d = decide(readCase(U.chief), f(), caseFacts(), NOW)
    expect(d.effect).toBe('allow')
    expect(d.obligations).toEqual(expect.arrayContaining(['emergency_review_required', 'read_only', 'audit_required']))
    expect(d.authority[0].kind).toBe('emergency_grant')
  })

  it.each([
    ['no justification', { justification: null }],
    ['a token justification', { justification: 'need it' }],
    ['no independent approver', { approvedBy: null }],
    ['self-approval', { approvedBy: U.chief }],
    ['a window over 24 hours', { effectiveAt: ago(HOUR), expiresAt: ahead(25 * HOUR) }],
    ['no named resource', { scope: {} }],
    ['write power', { powers: ['read', 'write_notes'] }],
    ['expiry', { expiresAt: ago(1) }],
  ])('is void with %s', (_n, over) => {
    expect(decide(readCase(U.chief), f(over), caseFacts(), NOW).effect).toBe('deny')
  })

  it('does not extend to a different case', () => {
    const d = decide(readCase(U.chief), f({ scope: { resourceIds: ['00000000-0000-4000-8000-0000000fffff'] } }), caseFacts(), NOW)
    expect(d.effect).toBe('deny')
  })

  it('never reaches a privileged matter', () => {
    expect(codes(decide(readCase(U.chief), f(), caseFacts({ classification: 'privileged' }), NOW))).toContain('PRIVILEGED_MATTER')
  })

  it('cannot write even if requested', () => {
    expect(decide(request(U.chief, 'case:write_notes', ref('case', CASE_ID)), f(), caseFacts(), NOW).effect).toBe('deny')
  })
})

describe('case policy — executive delegation', () => {
  const office = mandate({ id: '00000000-0000-4000-8000-0000000a0001', principalUserId: U.president, kind: 'executive_office', powers: ['read'], scope: {}, grantedBy: U.other })
  const dlg = delegation({ actions: ['case:read'], resourceTypes: ['case'] })
  const base = (over = {}) => facts(U.delegate, ['officer'], {
    memberships: [membership(U.delegate, ['officer']), membership(U.president, ['executive'])],
    mandates: [office], delegations: [dlg], ...over,
  })
  const r = () => readCase(U.delegate, { delegationId: dlg.id })

  it('allows a delegated read, counted under the delegator', () => {
    const d = decide(r(), base(), caseFacts(), NOW)
    expect(d.effect).toBe('allow')
    expect(d.authorityLineUserId).toBe(U.president)
    expect(d.authority[0].kind).toBe('delegation')
  })

  it('refuses when the delegation is revoked, expired, or names other actions', () => {
    expect(decide(r(), base({ delegations: [{ ...dlg, status: 'revoked', revokedAt: ago(1) }] }), caseFacts(), NOW).effect).toBe('deny')
    expect(decide(r(), base({ delegations: [{ ...dlg, expiresAt: ago(1) }] }), caseFacts(), NOW).effect).toBe('deny')
    expect(decide(r(), base({ delegations: [{ ...dlg, actions: ['case:write_notes'] }] }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('refuses when the delegator\'s office mandate has lapsed (office term ended)', () => {
    expect(decide(r(), base({ mandates: [{ ...office, expiresAt: ago(1) }] }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('refuses when the delegator has left the organization', () => {
    const f = base({ memberships: [membership(U.delegate, ['officer']), membership(U.president, ['executive'], { status: 'inactive' })] })
    expect(codes(decide(r(), f, caseFacts(), NOW))).toContain('DELEGATION_INVALID')
  })

  it('the delegator\'s recusal and adversity pass through to the delegate', () => {
    expect(codes(decide(r(), base({ recusals: [recusal({ principalUserId: U.president })] }), caseFacts(), NOW))).toContain('RECUSED')
    expect(codes(decide(r(), base(), caseFacts({ adverseUserIds: [U.president] }), NOW))).toContain('ADVERSE_PARTY')
  })

  it('a delegation cannot be used by anyone other than its delegate', () => {
    const f = facts(U.other, ['officer'], { memberships: [membership(U.other, ['officer']), membership(U.president, ['executive'])], mandates: [office], delegations: [dlg] })
    expect(decide(readCase(U.other, { delegationId: dlg.id }), f, caseFacts(), NOW).effect).toBe('deny')
  })

  it('self-delegation and open-ended delegations are void', () => {
    expect(decide(r(), base({ delegations: [{ ...dlg, delegatorUserId: U.delegate }] }), caseFacts(), NOW).effect).toBe('deny')
    expect(decide(r(), base({ delegations: [{ ...dlg, expiresAt: null }] }), caseFacts(), NOW).effect).toBe('deny')
    expect(decide(r(), base({ delegations: [{ ...dlg, actions: [] }] }), caseFacts(), NOW).effect).toBe('deny')
  })

  it('a delegation never reaches a privileged matter', () => {
    expect(codes(decide(r(), base(), caseFacts({ classification: 'privileged' }), NOW))).toContain('PRIVILEGED_MATTER')
  })

  it('an unknown delegation id grants nothing', () => {
    expect(decide(readCase(U.delegate, { delegationId: '00000000-0000-4000-8000-0000000bad00' }), base(), caseFacts(), NOW).effect).toBe('deny')
  })
})

void UNIT_ID
