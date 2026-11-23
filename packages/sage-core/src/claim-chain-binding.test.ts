import { describe, expect, it } from 'vitest'
import { filterClaimRegisterToAuthorizedContext, type SageClaimChainEntry } from './claim-chain'
import {
  buildAuthorizedEvidenceContextPayload,
  type SageEvidenceContextCandidate,
  type SageSynthesisPrincipal,
} from './synthesis-context'

const principal: SageSynthesisPrincipal = {
  actorId: 'reviewer-1',
  orgId: 'institution-a',
  workspaceId: 'workspace-a',
  access: {
    hasMembership: true,
    activeRoles: ['internal_reviewer'],
    evidenceAuthorizations: ['sensitive'],
  },
}

const candidate: SageEvidenceContextCandidate = {
  evidenceItemId: 'evidence-1',
  sourceId: 'source-verified-1',
  orgId: principal.orgId,
  workspaceId: principal.workspaceId,
  authorizationLevel: 'sensitive',
}

function entry(overrides: Partial<SageClaimChainEntry> = {}): SageClaimChainEntry {
  return {
    claimId: 'claim-1',
    claim: 'Why the institution chose a direction',
    evidenceItemId: candidate.evidenceItemId,
    sourceId: candidate.sourceId,
    occurredAt: '2024-09-12',
    authorityActorId: 'chair-1',
    authorizationLevel: candidate.authorizationLevel,
    workspaceId: principal.workspaceId,
    orgId: principal.orgId,
    ...overrides,
  }
}

function filtered(
  claims: readonly SageClaimChainEntry[],
  candidates: readonly SageEvidenceContextCandidate[] = [candidate],
) {
  const payload = buildAuthorizedEvidenceContextPayload(principal, candidates)
  return filterClaimRegisterToAuthorizedContext(payload, claims)
}

describe('SAGE claim-chain authorized source binding', () => {
  it('retains a claim matching the authorized item, source and sensitivity', () => {
    const found = filtered([entry()])
    expect(found).toHaveLength(1)
    expect(found[0]?.provenance.sourceId).toBe('source-verified-1')
    expect(found[0]?.authorizationLevel).toBe('sensitive')
  })

  it('denies source substitution even when the evidence item id is visible', () => {
    expect(filtered([entry({ sourceId: 'source-attacker-labelled' })])).toEqual([])
    expect(filtered([entry({ sourceId: 'source-secret-other-file' })])).toEqual([])
  })

  it('denies an authorization downgrade on a visible sensitive evidence item', () => {
    expect(filtered([entry({ authorizationLevel: 'internal' })])).toEqual([])
    expect(filtered([entry({ authorizationLevel: 'public' })])).toEqual([])
  })

  it('denies a misleading sensitivity upgrade as an exact source-binding mismatch', () => {
    const open: SageEvidenceContextCandidate = {
      ...candidate,
      authorizationLevel: 'internal',
    }
    expect(filtered([entry({ authorizationLevel: 'sensitive' })], [open])).toEqual([])
  })

  it('denies cross-tenant or cross-workspace claims without revealing source ids', () => {
    expect(filtered([entry({ orgId: 'institution-b' })])).toEqual([])
    expect(filtered([entry({ workspaceId: 'workspace-b' })])).toEqual([])
  })

  it('denies claims on an item not visible to the principal', () => {
    const noGrant: SageSynthesisPrincipal = {
      ...principal,
      access: { ...principal.access, evidenceAuthorizations: [] },
    }
    const payload = buildAuthorizedEvidenceContextPayload(noGrant, [candidate])
    expect(filterClaimRegisterToAuthorizedContext(payload, [entry()])).toEqual([])
  })

  it('refuses ambiguous duplicate evidence-item ids in the candidate context', () => {
    const contaminated: SageEvidenceContextCandidate = {
      ...candidate,
      sourceId: 'source-pretend-2',
    }
    expect(filtered([entry()], [candidate, contaminated])).toEqual([])
  })

  it('does not let a matching source id on a different evidence item confer access', () => {
    expect(filtered([entry({ evidenceItemId: 'evidence-not-in-context' })])).toEqual([])
  })
})
