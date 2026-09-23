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

type FixtureFile = {
  org_id: string
  workspace_id: string
  candidates: SageEvidenceContextCandidate[]
}

describe('FICTIONAL leadership-transition fixtures → synthesis-context', () => {
  const path = join(
    __dirname,
    '..',
    '..',
    '..',
    'fixtures',
    'leadership-transition-institutional-memory',
    'synthesis-candidates.json',
  )
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as FixtureFile

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
