import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SageApplicationRole } from './types'
import {
  assertAuthorizedSynthesisPath,
  buildAuthorizedEvidenceContextPayload,
  type SageEvidenceContextCandidate,
  type SageSynthesisPrincipal,
} from './synthesis-context'
import { buildSageInstitutionalQaContext } from './institutional-context'
import type { SageClaimChainEntry } from './claim-chain'

type FixtureFile = {
  org_id: string
  workspace_id: string
  candidates: SageEvidenceContextCandidate[]
}

const FIXTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'leadership-transition-institutional-memory',
)

describe('FICTIONAL leadership-transition fixtures → synthesis-context', () => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURE_DIR, 'synthesis-candidates.json'), 'utf8'),
  ) as FixtureFile

  it('incoming executive without sensitive/excluded grants cannot see restricted fixtures', () => {
    const principal: SageSynthesisPrincipal = {
      actorId: 'actor-incoming-ed',
      workspaceId: fixture.workspace_id,
      orgId: fixture.org_id,
      access: {
        hasMembership: true,
        activeRoles: ['internal_reviewer'] satisfies readonly SageApplicationRole[],
        evidenceAuthorizations: [],
      },
    }
    const payload = buildAuthorizedEvidenceContextPayload(principal, fixture.candidates)
    const ids = payload.evidence.map((e) => e.evidenceItemId)
    expect(ids).toEqual(['ev-public-plan-2022'])
    expect(JSON.stringify(payload)).not.toMatch(/why B|complaint|candidate B/i)

    expect(() =>
      assertAuthorizedSynthesisPath({
        principal,
        candidates: fixture.candidates,
        proposedOutput: 'Why we chose candidate B remains confidential in this fixture.',
      }),
    ).toThrow(/DO_NOT_REGRESS/)
  })
})

describe('FICTIONAL claim-register → institutional QA context', () => {
  it('answers why-B only when sensitive grant present; denied for incoming default', () => {
    const claimsFile = JSON.parse(
      readFileSync(join(FIXTURE_DIR, 'claim-register.json'), 'utf8'),
    ) as { claims: SageClaimChainEntry[] }
    const candFile = JSON.parse(
      readFileSync(join(FIXTURE_DIR, 'synthesis-candidates.json'), 'utf8'),
    ) as FixtureFile
    const candidates: SageEvidenceContextCandidate[] = [
      ...candFile.candidates,
      {
        evidenceItemId: 'ev-internal-retirement-announce',
        sourceId: 'src-internal-retirement-announce',
        workspaceId: candFile.workspace_id,
        orgId: candFile.org_id,
        authorizationLevel: 'internal',
        excerpt: 'FICTIONAL: Outgoing ED announced planned retirement',
      },
    ]

    const denied = buildSageInstitutionalQaContext({
      actorId: 'actor-incoming-ed',
      workspaceId: candFile.workspace_id,
      orgId: candFile.org_id,
      access: {
        hasMembership: true,
        activeRoles: ['internal_reviewer'],
        evidenceAuthorizations: [],
      },
      candidates,
      claimRegister: claimsFile.claims,
      question: 'why B / what changed / what unresolved?',
    })
    expect(JSON.stringify(denied)).not.toMatch(/Why choose B|advocacy funding|complaint/i)
    expect(denied.claims.every((c) => c.authorizationLevel !== 'sensitive')).toBe(true)

    const allowed = buildSageInstitutionalQaContext({
      actorId: 'actor-board-chair',
      workspaceId: candFile.workspace_id,
      orgId: candFile.org_id,
      access: {
        hasMembership: true,
        activeRoles: ['decision_record_approver'],
        evidenceAuthorizations: ['sensitive'],
      },
      candidates,
      claimRegister: claimsFile.claims,
      question: 'why B?',
    })
    const why = allowed.claims.find((c) => c.claimId === 'CLM-why-b')
    expect(why?.provenance.sourceId).toBe('src-sensitive-why-b')
    expect(why?.whatChanged).toMatch(/2023/)
    expect(why?.whatUnresolved).toMatch(/funding/)
  })
})
