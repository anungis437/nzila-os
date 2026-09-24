import { describe, expect, it } from 'vitest'
import { buildSageInstitutionalQaContext, filterExportEvidenceResourcesThroughAuthorizedContext } from './institutional-context'
import type { SageClaimChainEntry } from './claim-chain'
import type { SageEvidenceContextCandidate } from './synthesis-context'

const ORG = 'org-a'
const WS = 'ws-a'

const open: SageEvidenceContextCandidate = {
  evidenceItemId: 'ev-open',
  sourceId: 'src-open',
  workspaceId: WS,
  orgId: ORG,
  authorizationLevel: 'internal',
  title: 'Published transition timeline',
  excerpt: 'Outgoing ED announced retirement in 2024',
}

const secret: SageEvidenceContextCandidate = {
  evidenceItemId: 'ev-secret',
  sourceId: 'src-secret',
  workspaceId: WS,
  orgId: ORG,
  authorizationLevel: 'sensitive',
  title: 'Why choose B pack',
  excerpt: 'Why we chose candidate B remains confidential',
}

const register: SageClaimChainEntry[] = [
  {
    claimId: 'CLM-why-b',
    claim: 'Why choose B',
    evidenceItemId: 'ev-secret',
    sourceId: 'src-secret',
    occurredAt: '2024-09-12',
    authorityActorId: 'board-chair',
    authorityRoleLabel: 'board_member',
    whatChanged: 'Membership model change in 2023',
    whatUnresolved: '2026 advocacy funding',
    authorizationLevel: 'sensitive',
    workspaceId: WS,
    orgId: ORG,
  },
  {
    claimId: 'CLM-retire',
    claim: 'Retirement announced',
    evidenceItemId: 'ev-open',
    sourceId: 'src-open',
    occurredAt: '2024-01-20',
    authorityActorId: 'outgoing-ed',
    authorityRoleLabel: 'outgoing_executive',
    authorizationLevel: 'internal',
    workspaceId: WS,
    orgId: ORG,
  },
]

describe('institutional Q&A context choke point', () => {
  it('incoming executive without sensitive grant gets only authorized claims + provenance', () => {
    const doc = buildSageInstitutionalQaContext({
      actorId: 'incoming-ed',
      workspaceId: WS,
      orgId: ORG,
      access: {
        hasMembership: true,
        activeRoles: ['internal_reviewer'],
        evidenceAuthorizations: [],
      },
      candidates: [open, secret],
      claimRegister: register,
      question: 'why B / what changed / what unresolved?',
    })
    expect(doc.authorizedContextOnly).toBe(true)
    expect(doc.evidence.map((e) => e.evidenceItemId)).toEqual(['ev-open'])
    expect(doc.claims.map((c) => c.claimId)).toEqual(['CLM-retire'])
    expect(doc.claims[0]?.provenance.occurredAt).toBe('2024-01-20')
    expect(JSON.stringify(doc)).not.toMatch(/candidate B|Why choose B|advocacy funding/i)
    expect(doc.excludedCandidateCount).toBe(1)
  })

  it('with sensitive grant, why-B claim appears with full provenance chain', () => {
    const doc = buildSageInstitutionalQaContext({
      actorId: 'board-chair',
      workspaceId: WS,
      orgId: ORG,
      access: {
        hasMembership: true,
        activeRoles: ['decision_record_approver'],
        evidenceAuthorizations: ['sensitive'],
      },
      candidates: [open, secret],
      claimRegister: register,
      question: 'why B?',
    })
    expect(doc.claims.map((c) => c.claimId).sort()).toEqual(['CLM-retire', 'CLM-why-b'])
    const why = doc.claims.find((c) => c.claimId === 'CLM-why-b')!
    expect(why.provenance).toEqual({
      evidenceItemId: 'ev-secret',
      sourceId: 'src-secret',
      occurredAt: '2024-09-12',
      authorityActorId: 'board-chair',
    })
    expect(why.whatChanged).toContain('2023')
    expect(why.whatUnresolved).toContain('funding')
  })

  it('export evidence resources choke drops unauthorized narrative content', () => {
    const { resources, context } = filterExportEvidenceResourcesThroughAuthorizedContext({
      actorId: 'incoming-ed',
      workspaceId: WS,
      orgId: ORG,
      access: {
        hasMembership: true,
        activeRoles: ['internal_reviewer'],
        evidenceAuthorizations: [],
      },
      resources: [
        {
          resourceType: 'evidence_item',
          resourceId: 'ev-open',
          authorizationLevel: 'internal',
          contentHash: 'h1',
          content: { sourceId: 'src-open', title: 'ok' },
        },
        {
          resourceType: 'evidence_item',
          resourceId: 'ev-secret',
          authorizationLevel: 'sensitive',
          contentHash: 'h2',
          content: {
            sourceId: 'src-secret',
            title: 'Why choose B pack',
            excerpt: 'Why we chose candidate B remains confidential',
          },
        },
        {
          resourceType: 'boundary_flag',
          resourceId: 'bf-1',
          authorizationLevel: 'internal',
          contentHash: 'h3',
          content: { note: 'workspace flag' },
        },
      ],
    })
    expect(resources.map((r) => r.resourceId)).toEqual(['ev-open', 'bf-1'])
    expect(JSON.stringify(resources)).not.toMatch(/candidate B/i)
    expect(context.excludedCandidateCount).toBe(1)
  })
})
