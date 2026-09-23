import { describe, expect, it } from 'vitest'
import {
  buildSageInstitutionalQaContext,
  filterExportEvidenceResourcesThroughAuthorizedContext,
} from '@nzila/sage-core'

/**
 * Regression: unauthorized evidence must never appear in institutional-context
 * or export-adjacent JSON assembled for answers.
 */
describe('platform-admin sage — institutional context choke (wired primitive)', () => {
  it('denies sensitive claim in context JSON for incoming-style principal', () => {
    const doc = buildSageInstitutionalQaContext({
      actorId: 'incoming-ed',
      workspaceId: 'ws',
      orgId: 'org',
      access: {
        hasMembership: true,
        activeRoles: ['internal_reviewer'],
        evidenceAuthorizations: [],
      },
      candidates: [
        {
          evidenceItemId: 'ev-open',
          sourceId: 'src-open',
          workspaceId: 'ws',
          orgId: 'org',
          authorizationLevel: 'internal',
          excerpt: 'Outgoing ED announced retirement in 2024',
        },
        {
          evidenceItemId: 'ev-secret',
          sourceId: 'src-secret',
          workspaceId: 'ws',
          orgId: 'org',
          authorizationLevel: 'sensitive',
          excerpt: 'Why we chose candidate B remains confidential',
        },
      ],
      claimRegister: [
        {
          claimId: 'CLM-secret',
          claim: 'Why choose B',
          evidenceItemId: 'ev-secret',
          sourceId: 'src-secret',
          occurredAt: '2024-09-12',
          authorityActorId: 'board',
          authorizationLevel: 'sensitive',
          workspaceId: 'ws',
          orgId: 'org',
        },
      ],
    })
    const json = JSON.stringify(doc)
    expect(json).toContain('ev-open')
    expect(json).not.toMatch(/candidate B|CLM-secret|Why choose B/i)
  })

  it('export filter strips unauthorized evidence_item from package resource list', () => {
    const { resources } = filterExportEvidenceResourcesThroughAuthorizedContext({
      actorId: 'incoming-ed',
      workspaceId: 'ws',
      orgId: 'org',
      access: {
        hasMembership: true,
        activeRoles: ['read_only_observer'],
        evidenceAuthorizations: [],
      },
      resources: [
        {
          resourceType: 'evidence_item',
          resourceId: 'ev-secret',
          authorizationLevel: 'excluded',
          contentHash: 'x',
          content: { sourceId: 's', excerpt: 'Unresolved complaint narrative' },
        },
      ],
    })
    expect(resources).toHaveLength(0)
  })
})
