import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import type { WorkAidMatterFacts } from '../ontology'
import { CASE_ID, MATTER_ID, NOW, ORG, U, consent, facts, ref, request } from './fixtures'

describe('WorkAid counsel disclosure member boundary', () => {
  const matter: WorkAidMatterFacts = {
    kind: 'workaid_matter', id: MATTER_ID, organizationId: ORG,
    caseId: CASE_ID, memberUserId: U.member, counselControlled: true,
  }
  const disclosure = consent({
    direction: 'workaid_to_union', issuer: 'counsel', recipientUserId: U.steward,
  })
  const req = request(U.steward, 'workaid:receive_disclosure', ref('workaid_matter', MATTER_ID), {
    disclosureId: disclosure.id, categories: ['case_summary'],
  })
  it('permits counsel-issued disclosure for the matching member and named recipient', () => {
    expect(decide(req, facts(U.steward, ['steward'], { consents: [disclosure] }), matter, NOW).effect).toBe('allow')
  })
  it('refuses a contradictory member identity even when matter and recipient match', () => {
    expect(decide(req, facts(U.steward, ['steward'], {
      consents: [{ ...disclosure, memberUserId: U.other }],
    }), matter, NOW).effect).toBe('deny')
  })
})
