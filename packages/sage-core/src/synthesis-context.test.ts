import { describe, expect, it } from 'vitest'
import type { SageAccessContext } from './access-model'
import {
  assertAuthorizedSynthesisPath,
  assertSynthesisOutputDoesNotLeakInaccessibleEvidence,
  buildAuthorizedEvidenceContextPayload,
  type SageEvidenceContextCandidate,
  type SageSynthesisPrincipal,
} from './synthesis-context'
import { SageInvariantError } from './invariants'

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const WS_A = 'ws-a'
const WS_B = 'ws-b'

function principal(partial: {
  access?: Partial<SageAccessContext>
  workspaceId?: string
  orgId?: string
}): SageSynthesisPrincipal {
  return {
    actorId: 'incoming-executive',
    workspaceId: partial.workspaceId ?? WS_A,
    orgId: partial.orgId ?? ORG_A,
    access: {
      hasMembership: true,
      activeRoles: ['internal_reviewer'],
      evidenceAuthorizations: [],
      ...partial.access,
    },
  }
}

function candidate(
  overrides: Partial<SageEvidenceContextCandidate> &
    Pick<SageEvidenceContextCandidate, 'evidenceItemId' | 'authorizationLevel'>,
): SageEvidenceContextCandidate {
  return {
    sourceId: `src-${overrides.evidenceItemId}`,
    workspaceId: WS_A,
    orgId: ORG_A,
    title: `Title ${overrides.evidenceItemId}`,
    excerpt: `Excerpt body for ${overrides.evidenceItemId}`,
    ...overrides,
  }
}

describe('DO_NOT_REGRESS — authorization-before-context (synthesis/retrieval)', () => {
  it('same-tenant allowed: internal evidence enters the payload', () => {
    const p = principal({})
    const allowed = candidate({
      evidenceItemId: 'ev-internal-ok',
      authorizationLevel: 'internal',
    })
    const payload = buildAuthorizedEvidenceContextPayload(p, [allowed])
    expect(payload.authorizedContextOnly).toBe(true)
    expect(payload.evidence).toHaveLength(1)
    expect(payload.evidence[0]?.evidenceItemId).toBe('ev-internal-ok')
    expect(payload.evidence[0]?.excerpt).toContain('ev-internal-ok')
    expect(payload.excludedCandidateCount).toBe(0)

    expect(() =>
      assertAuthorizedSynthesisPath({
        principal: p,
        candidates: [allowed],
        proposedOutput: 'Based on Title ev-internal-ok: Excerpt body for ev-internal-ok',
      }),
    ).not.toThrow()
  })

  it('same-tenant denied: sensitive without grant never enters payload or output', () => {
    const p = principal({ access: { evidenceAuthorizations: [] } })
    const denied = candidate({
      evidenceItemId: 'ev-sensitive-secret',
      authorizationLevel: 'sensitive',
      title: 'Board-only succession rationale',
      excerpt: 'Why we chose candidate B remains confidential',
    })
    const payload = buildAuthorizedEvidenceContextPayload(p, [denied])
    expect(payload.evidence).toHaveLength(0)
    expect(payload.excludedCandidateCount).toBe(1)
    expect(JSON.stringify(payload)).not.toContain('Board-only succession rationale')
    expect(JSON.stringify(payload)).not.toContain('candidate B')

    expect(() =>
      assertAuthorizedSynthesisPath({
        principal: p,
        candidates: [denied],
        proposedOutput: 'Why we chose candidate B remains confidential',
      }),
    ).toThrow(SageInvariantError)
  })

  it('same-tenant allowed after explicit sensitive grant', () => {
    const p = principal({ access: { evidenceAuthorizations: ['sensitive'] } })
    const sens = candidate({
      evidenceItemId: 'ev-sensitive-granted',
      authorizationLevel: 'sensitive',
    })
    const payload = buildAuthorizedEvidenceContextPayload(p, [sens])
    expect(payload.evidence).toHaveLength(1)
    expect(payload.evidence[0]?.evidenceItemId).toBe('ev-sensitive-granted')
  })

  it('cross-workspace candidates are excluded even at public level', () => {
    const p = principal({ workspaceId: WS_A })
    const foreign = candidate({
      evidenceItemId: 'ev-other-ws',
      authorizationLevel: 'public',
      workspaceId: WS_B,
      title: 'Foreign workspace memo',
    })
    const payload = buildAuthorizedEvidenceContextPayload(p, [foreign])
    expect(payload.evidence).toHaveLength(0)
    expect(payload.excludedCandidateCount).toBe(1)
    expect(() =>
      assertAuthorizedSynthesisPath({
        principal: p,
        candidates: [foreign],
        proposedOutput: 'Foreign workspace memo',
      }),
    ).toThrow(/DO_NOT_REGRESS/)
  })

  it('cross-tenant candidates are excluded', () => {
    const p = principal({ orgId: ORG_A })
    const foreign = candidate({
      evidenceItemId: 'ev-other-org',
      authorizationLevel: 'internal',
      orgId: ORG_B,
      excerpt: 'Other tenant institutional memory',
    })
    const payload = buildAuthorizedEvidenceContextPayload(p, [foreign])
    expect(payload.evidence).toHaveLength(0)
    expect(() =>
      assertSynthesisOutputDoesNotLeakInaccessibleEvidence({
        output: 'Other tenant institutional memory',
        inaccessibleCandidates: [foreign],
      }),
    ).toThrow(/DO_NOT_REGRESS/)
  })

  it('revoked grant: sensitive level absent from access → excluded', () => {
    // Callers load access with revoked grants already stripped; model the
    // post-revoke principal explicitly (no sensitive in evidenceAuthorizations).
    const p = principal({ access: { evidenceAuthorizations: ['authorized_only'] } })
    const revokedSensitive = candidate({
      evidenceItemId: 'ev-revoked',
      authorizationLevel: 'sensitive',
      title: 'Revoked grant material',
    })
    const stillOk = candidate({
      evidenceItemId: 'ev-auth-only',
      authorizationLevel: 'authorized_only',
      title: 'Still authorized',
    })
    const payload = buildAuthorizedEvidenceContextPayload(p, [revokedSensitive, stillOk])
    expect(payload.evidence.map((e) => e.evidenceItemId)).toEqual(['ev-auth-only'])
    expect(payload.excludedCandidateCount).toBe(1)
    expect(JSON.stringify(payload)).not.toContain('Revoked grant material')
  })

  it('mixed authorized/unauthorized: only authorized snippets survive; no leak in answer', () => {
    const p = principal({ access: { evidenceAuthorizations: [] } })
    const open = candidate({
      evidenceItemId: 'ev-open',
      authorizationLevel: 'administrative',
      title: 'Published transition timeline',
      excerpt: 'Outgoing ED announced retirement in 2024',
    })
    const secret = candidate({
      evidenceItemId: 'ev-secret',
      authorizationLevel: 'excluded',
      title: 'HR investigation note',
      excerpt: 'Unresolved complaint against candidate B',
    })
    const payload = assertAuthorizedSynthesisPath({
      principal: p,
      candidates: [open, secret],
      proposedOutput:
        'Per Published transition timeline: Outgoing ED announced retirement in 2024.',
    })
    expect(payload.evidence).toHaveLength(1)
    expect(payload.evidence[0]?.evidenceItemId).toBe('ev-open')
    expect(payload.excludedCandidateCount).toBe(1)
    expect(JSON.stringify(payload)).not.toMatch(/HR investigation|candidate B|ev-secret/i)

    expect(() =>
      assertAuthorizedSynthesisPath({
        principal: p,
        candidates: [open, secret],
        proposedOutput:
          'Inference: Unresolved complaint against candidate B explains the choice.',
      }),
    ).toThrow(/DO_NOT_REGRESS/)
  })

  it('no membership → nothing enters the payload', () => {
    const p = principal({ access: { hasMembership: false, activeRoles: [], evidenceAuthorizations: [] } })
    const internal = candidate({
      evidenceItemId: 'ev-no-member',
      authorizationLevel: 'internal',
    })
    const payload = buildAuthorizedEvidenceContextPayload(p, [internal])
    expect(payload.evidence).toHaveLength(0)
    expect(payload.excludedCandidateCount).toBe(1)
  })
})
