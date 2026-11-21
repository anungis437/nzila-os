/**
 * Step 1 S1-A01: the three primary-handler-only actions are refused whenever the primary standing itself is not live, not
 * independently granted, not on this case or not in this tenant. The live independently granted primary handler is the
 * positive control. Complements primary-handler-ceiling.test.ts (supervisor, collaborator, delegation, title, recusal, adverse party).
 */
import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { Capacity } from '../ontology'
import { ago, ahead, CASE_ID, DAY, HOUR, NOW, ORG_B, U, caseFacts, facts, ref, relationship, request } from './fixtures'

const caps: Capacity[] = ['member', 'chief_steward', 'steward']
const resource = ref('case', CASE_ID)
const OTHER_CASE = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000c1'
const actions = ['case:disclose_to_member', 'case:export_sealed_evidence', 'case:close'] as const

describe('primary-handler-only actions require a live, independently granted primary standing on this case in this tenant', () => {
  for (const action of actions) {
    const decideWith = (relationships: ReturnType<typeof relationship>[]) =>
      decide(request(U.chief, action, resource), facts(U.chief, caps, { relationships }), caseFacts(), NOW)
    const primary = (over: Parameters<typeof relationship>[0] = {}) =>
      relationship({ principalUserId: U.chief, relation: 'assignee', grantedBy: U.president, ...over })

    it(`${action}: the live independently granted primary handler is allowed (positive control)`, () => {
      expect(decideWith([primary()]).effect).toBe('allow')
      expect(decideWith([primary({ relation: 'owner' })]).effect).toBe('allow')
    })
    it(`${action}: an expired primary standing is refused at its boundary`, () => {
      expect(decideWith([primary({ expiresAt: ago(HOUR) })]).effect).toBe('deny')
    })
    it(`${action}: a revoked primary standing is refused`, () => {
      expect(decideWith([primary({ status: 'revoked', revokedAt: ago(HOUR) })]).effect).toBe('deny')
    })
    it(`${action}: a primary standing that is not yet effective is refused`, () => {
      expect(decideWith([primary({ effectiveAt: ahead(DAY) })]).effect).toBe('deny')
    })
    it(`${action}: a self-granted primary standing is refused`, () => {
      expect(decideWith([primary({ grantedBy: U.chief })]).effect).toBe('deny')
    })
    it(`${action}: primary standing on another case does not reach an unassigned case`, () => {
      expect(decideWith([primary({ resource: ref('case', OTHER_CASE) })]).effect).toBe('deny')
    })
    it(`${action}: a primary standing recorded in another tenant is refused`, () => {
      expect(decideWith([primary({ organizationId: ORG_B, resource: ref('case', CASE_ID, ORG_B) })]).effect).toBe('deny')
    })
  }
})
