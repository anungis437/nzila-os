import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import { assessDelegation, assessMandate, PRIMARY_CASE_HANDLER_ONLY_ACTIONS } from '../common'
import { decideIssuance, type IssuanceRule, type IssuanceRequest } from '../issuance'
import type { Action, Capacity } from '../ontology'
import { ahead, ago, CASE_ID, DAY, HOUR, NOW, ORG, ORG_B, U, caseFacts, delegation, facts, mandate, membership, recusal, ref, relationship, request } from './fixtures'

const caps: Capacity[] = ['member', 'chief_steward', 'steward']
const resource = ref('case', CASE_ID)
const primary = (relation: 'owner' | 'assignee') => relationship({ principalUserId: U.chief, relation })
const actions = ['case:disclose_to_member', 'case:export_sealed_evidence', 'case:close'] as const

describe('primary case-handler-only authority is a hard ceiling', () => {
  it('pins the complete primary-only set independently of the implementation', () => {
    expect([...PRIMARY_CASE_HANDLER_ONLY_ACTIONS].sort()).toEqual([...actions].sort())
  })

  for (const action of actions) {
    const power = action.split(':')[1]
    const d = (over: Parameters<typeof facts>[2] = {}, extra: Parameters<typeof request>[3] = {}, c = caseFacts()) =>
      decide(request(U.chief, action, resource, extra), facts(U.chief, caps, over), c, NOW)
    it(action + ': scoped supervisory facts cannot grant the power, even with an accepted live custom mandate', () => {
      const m = mandate({ powers: [power], scope: { resourceIds: [CASE_ID] }, requiresAcceptance: true, acceptedAt: ago(HOUR) })
      expect(assessMandate(m, ORG, NOW).effective).toBe(false)
      expect(d({ mandates: [m] }).effect).toBe('deny')
      expect(d({ mandates: [mandate({ powers: [action] })] }).effect).toBe('deny')
    })
    it(action + ': derived primary relationship still authorizes within its scope', () => {
      for (const relation of ['owner', 'assignee'] as const) {
        const r = d({ relationships: [primary(relation)] })
        expect(r.effect).toBe('allow')
        expect(r.authority.every(x => x.kind === 'relationship')).toBe(true)
      }
      const independentlyAllowed = d({ relationships: [primary('owner')], mandates: [mandate({ powers: [power] })] })
      expect(independentlyAllowed.effect).toBe('allow')
      expect(independentlyAllowed.authority.every(x => x.kind === 'relationship')).toBe(true)
    })
    it(action + ': collaborator overgrant, member creator, and title alone are denied', () => {
      expect(d({ relationships: [relationship({ principalUserId: U.chief, relation: 'collaborator', origin: 'explicit', grantedBy: U.president, permissions: [power] })] }).effect).toBe('deny')
      expect(d({ relationships: [relationship({ principalUserId: U.chief, relation: 'creator' })] }).effect).toBe('deny')
      expect(d().effect).toBe('deny')
    })
    it(action + ': injected executive delegation is refused independently of issuance/storage constraints', () => {
      const del = delegation({ delegateUserId: U.chief, actions: [action], resourceTypes: ['case'] })
      const office = mandate({ kind: 'executive_office', principalUserId: U.president, grantedBy: U.other, powers: [power], scope: {} })
      const out = d({ memberships: [membership(U.chief, caps), membership(U.president, ['member','executive'])], delegations: [del], mandates: [office] }, { delegationId: del.id })
      expect(out.effect).toBe('deny')
      expect(out.reasons.map(x => x.code)).toContain('DELEGATION_INVALID')
    })
    it(action + ': recusal, adverse-party, removed membership and privilege remain effective', () => {
      const relationships = [primary('owner')]
      expect(d({ relationships, recusals: [recusal({ principalUserId: U.chief })] }).effect).toBe('deny')
      expect(d({ relationships }, {}, caseFacts({ adverseUserIds: [U.chief] })).effect).toBe('deny')
      expect(d({ relationships, memberships: [membership(U.chief, caps, { status: 'revoked' })] }).effect).toBe('deny')
      expect(d({ relationships }, {}, caseFacts({ classification: 'privileged' })).effect).toBe('deny')
    })
    it(action + ': custom issue/amend rule cannot confer the forbidden power at request or execution stage', () => {
      for (const operation of ['issue','amend'] as const) {
        const rule: IssuanceRule = { id: 'synthetic-rule', organizationId: ORG, domain: 'supervisory', operation, issuerCapacities: ['executive'], issuerMandateKind: null, issuerMandatePower: null, allowedPowers: [power, 'read'], maxTermDays: 365, requiresAcceptance: true, requiredIndependentApprovals: 1, version: 1, status: 'active', sourceInstrument: 'Synthetic fixture rule', draftedBy: U.other, approvedBy: [U.treasurer,U.officer] }
        for (const stage of ['request','execute'] as const) {
          const req: IssuanceRequest = { issuerUserId: U.president, holderUserId: U.chief, organizationId: ORG, domain: 'supervisory', operation, powers: [power], effectiveAt: ago(HOUR), expiresAt: ahead(DAY), scope: { resourceIds: [CASE_ID] }, stage, approval: { status: 'satisfied', approvingLines: [U.treasurer] } }
          expect(decideIssuance(req, facts(U.president, ['executive']), membership(U.chief,caps),rule,NOW).effect).toBe('deny')
        }
      }
    })
  }

  it('rejects malformed validity timestamps on primary relationships and supervisory grants', () => {
    for (const validity of [{ effectiveAt: new Date(NaN) }, { expiresAt: new Date(NaN) }, { revokedAt: new Date(NaN) }]) {
      const owner = relationship({ principalUserId: U.chief, relation: 'owner', ...validity })
      const m = mandate({ powers: ['read'], scope: { resourceIds: [CASE_ID] }, ...validity })
      expect(decide(request(U.chief, 'case:close', resource), facts(U.chief, caps, { relationships: [owner] }), caseFacts(), NOW).effect).toBe('deny')
      expect(assessMandate(m, ORG, NOW).effective).toBe(false)
      expect(decide(request(U.chief, 'case:read', resource), facts(U.chief, caps, { mandates: [m] }), caseFacts(), NOW).effect).toBe('deny')
    }
  })

  it('requires a valid acceptance timestamp for mandate and delegation activation', () => {
    const invalid = new Date(NaN)
    const m = mandate({ requiresAcceptance: true, acceptedAt: invalid })
    const d = delegation({ requiresAcceptance: true, acceptedAt: invalid })
    expect(assessMandate(m, ORG, NOW).effective).toBe(false)
    expect(assessMandate(m, ORG, NOW).reasons.map(x => x.code)).toContain('NOT_ACCEPTED')
    expect(assessDelegation(d, ORG, NOW).effective).toBe(false)
    expect(assessDelegation(d, ORG, NOW).reasons.map(x => x.code)).toContain('NOT_ACCEPTED')
  })

  it('constrains delegated case read to the delegator office mandate resource scope', () => {
    const del = delegation({ delegateUserId: U.chief, actions: ['case:read'], resourceTypes: ['case'] })
    const office = mandate({ kind: 'executive_office', principalUserId: U.president, grantedBy: U.other, powers: ['read'], scope: { resourceIds: [U.other] } })
    const f = facts(U.chief, caps, {
      memberships: [membership(U.chief, caps), membership(U.president, ['member', 'executive'])],
      delegations: [del], mandates: [office],
    })
    const req = request(U.chief, 'case:read', resource, { delegationId: del.id })
    expect(decide(req, f, caseFacts(), NOW).effect).toBe('deny')
    const inScope = { ...office, scope: { resourceIds: [CASE_ID] } }
    expect(decide(req, { ...f, mandates: [inScope] }, caseFacts(), NOW).effect).toBe('allow')
  })

  it('rejects contradictory nested resource tenant on relationships and recusals', () => {
    const req = request(U.chief, 'case:close', resource)
    const owner = primary('owner')
    const foreignRef = ref('case', CASE_ID, ORG_B)
    const foreignOwner = { ...owner, resource: foreignRef }
    const foreignRecusal = recusal({ principalUserId: U.chief, resource: foreignRef, liftedAt: ago(HOUR) })
    for (const f of [
      facts(U.chief, caps, { relationships: [foreignOwner] }),
      facts(U.chief, caps, { relationships: [owner], recusals: [foreignRecusal] }),
    ]) {
      const result = decide(req, f, caseFacts(), NOW)
      expect(result.effect).toBe('deny')
      expect(result.reasons.map(x => x.code)).toContain('FACTS_CONTRADICTORY')
    }
    expect(decide(req, facts(U.chief, caps, { relationships: [owner] }), caseFacts(), NOW).effect).toBe('allow')
  })

  it('retains legitimate scoped read and assignment powers', () => {
    for (const action of ['case:read','case:assign'] as const) {
      const m = mandate({powers:[action.split(':')[1]],scope:{resourceIds:[CASE_ID]}})
      expect(decide(request(U.chief,action,resource),facts(U.chief,caps,{mandates:[m]}),caseFacts(),NOW).effect).toBe('allow')
    }
  })
  it('fails closed on a contaminated mixed mandate without using an invalid source to authorize even a read', () => {
    const m=mandate({powers:['read','export_sealed_evidence'],scope:{resourceIds:[CASE_ID]}})
    expect(assessMandate(m,ORG,NOW).effective).toBe(false)
    expect(decide(request(U.chief,'case:read' as Action,resource),facts(U.chief,caps,{mandates:[m]}),caseFacts(),NOW).effect).toBe('deny')
  })
})
