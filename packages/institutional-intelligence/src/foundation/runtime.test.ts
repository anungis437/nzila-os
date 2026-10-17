import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { InstitutionalReference } from '@nzila/platform-contracts'
import { InstitutionalFoundationRuntime, type FoundationAction } from './runtime'
import { syntheticFoundation, fictionalScope, fictionalStart } from './synthetic.fixture'
import type { StoredInstitutionalRecord } from './local-store'

export function runtimeFixture(seed = true, filename = ':memory:') {
  const f = syntheticFoundation(filename, seed)
  const runtime = new InstitutionalFoundationRuntime(f.boundary)
  const ref = (row: StoredInstitutionalRecord): InstitutionalReference => ({
    scope: row.scope, kind: row.kind, namespace: 'fictional-local', sourceId: row.id, revision: row.version,
  })
  const execute = (actor: string, action: FoundationAction, kind: string, id: string, payload: unknown, version = 0) =>
    runtime.execute(actor, action, f.command(f.target(kind, id, Math.max(1, version)), payload, version))
  const recorded = async (actor: string, action: FoundationAction, kind: string, id: string, payload: unknown, version = 0) => {
    const row = execute(actor, action, kind, id, payload, version)
    const envelope = row.data as { auditEventId: string }
    await f.boundary.deliver(row.scope, envelope.auditEventId)
    return f.store.get(row.scope, row.kind, row.id, row.version)!
  }
  const missionPayload = {
    title: 'Fictional capability improvement', desiredOutcome: 'Recommendation reviewed',
    acceptanceCriteria: ['Recommendation reviewed'], accountableOwner: 'fictional-H1', executionOwner: 'fictional-H1',
  }
  const engagementPayload = {
    sponsor: 'fictional-H1', counterpart: 'fictional-H2', specialist: 'fictional-specialist',
    effectiveAt: fictionalStart, expiresAt: '2026-10-12T23:00:00.000Z',
  }
  const engage = async () => {
    await recorded('fictional-H1', 'engagement.create', 'SpecialistEngagement', 'E', engagementPayload)
    await recorded('fictional-H2', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1)
    return recorded('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'ACTIVE' }, 2)
  }
  const recommendation = async (engagement: StoredInstitutionalRecord) =>
    recorded('fictional-specialist', 'recommendation.submit', 'Recommendation', 'R',
      { engagementRef: ref(engagement), content: 'Fictional recommendation; no deployment permission.' })
  return { ...f, runtime, ref, execute, recorded, missionPayload, engagementPayload, engage, recommendation }
}

describe('Checkpoint 3 Gate D Mission and specialist lifecycles', () => {
  it('completion is not closure, acceptance is independent, and closed/cancelled are terminal', async () => {
    const f = runtimeFixture()
    try {
      const r = await f.recommendation(await f.engage())
      const a = await f.recorded('fictional-H2', 'output.accept', 'OutputAcceptance', 'A',
        { outputRef: f.ref(r), criteria: 'Recommendation reviewed' })
      await f.recorded('fictional-H1', 'mission.create', 'Mission', 'M', f.missionPayload)
      await f.recorded('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 1)
      await f.recorded('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 2)
      await f.recorded('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'blocked' }, 3)
      await f.recorded('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 4)
      const completed = await f.recorded('fictional-H1', 'mission.transition', 'Mission', 'M',
        { next: 'completed', evidenceRefs: [f.ref(r)] }, 5)
      expect(completed.data).toMatchObject({ status: 'completed' })
      expect(() => f.execute('fictional-H1', 'mission.transition', 'Mission', 'M',
        { next: 'closed', evidenceRefs: [f.ref(a)] }, 6)).toThrow('INDEPENDENT_ACCEPTOR_REQUIRED')
      expect(() => f.execute('fictional-H2', 'mission.transition', 'Mission', 'M',
        { next: 'closed', evidenceRefs: [f.ref(r)] }, 6)).toThrow('MISSION_CRITERIA_NOT_ACCEPTED')
      await f.recorded('fictional-H2', 'mission.transition', 'Mission', 'M',
        { next: 'closed', evidenceRefs: [f.ref(a)] }, 6)
      expect(() => f.execute('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 7)).toThrow('MISSION_TERMINAL')
      await f.recorded('fictional-H1', 'mission.create', 'Mission', 'cancelled', f.missionPayload)
      await f.recorded('fictional-H1', 'mission.transition', 'Mission', 'cancelled', { next: 'cancelled' }, 1)
      expect(() => f.execute('fictional-H1', 'mission.transition', 'Mission', 'cancelled', { next: 'authorized' }, 2)).toThrow('MISSION_TERMINAL')
    } finally { f.store.close() }
  })

  it('rejects agent/specialist ownership and scope expansion without reauthorization', async () => {
    const f = runtimeFixture()
    try {
      expect(() => f.execute('fictional-agent', 'mission.create', 'Mission', 'M', f.missionPayload))
        .toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      for (const accountableOwner of ['fictional-agent', 'fictional-specialist']) {
        expect(() => f.execute('fictional-H1', 'mission.create', 'Mission', 'M', { ...f.missionPayload, accountableOwner }))
          .toThrow('ASSIGNED_INTERNAL_OWNER_REQUIRED')
      }
      expect(() => f.execute('fictional-H1', 'mission.create', 'Mission', 'M',
        { ...f.missionPayload, executionOwner: 'fictional-specialist' }))
        .toThrow('EXECUTION_OWNER_NOT_INTERNAL_OR_GOVERNED_MACHINE')
      await f.recorded('fictional-H1', 'mission.create', 'Mission', 'M', f.missionPayload)
      await f.recorded('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 1)
      const amended = await f.recorded('fictional-H1', 'mission.amend', 'Mission', 'M',
        { desiredOutcome: 'Changed outcome', acceptanceCriteria: ['New criteria'] }, 2)
      expect(amended.data).toMatchObject({ status: 'proposed', amendmentPending: true })
      expect(() => f.execute('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 3))
        .toThrow('MISSION_TRANSITION_DENIED')
      await f.recorded('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 3)
      await f.recorded('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 4)
      expect(() => f.execute('fictional-H1', 'mission.amend', 'Mission', 'M',
        { desiredOutcome: 'Unauthorized expansion', acceptanceCriteria: ['x'] }, 5))
        .toThrow('ACTIVE_SCOPE_EXPANSION_REQUIRES_SUSPENSION')
    } finally { f.store.close() }
  })

  it('denies premature activation, specialist approval/extension/self-acceptance, expiry and revocation', async () => {
    const f = runtimeFixture()
    try {
      const draft = await f.recorded('fictional-H1', 'engagement.create', 'SpecialistEngagement', 'E', f.engagementPayload)
      expect(() => f.execute('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'ACTIVE' }, 1))
        .toThrow('ENGAGEMENT_TRANSITION_DENIED')
      expect(() => f.execute('fictional-specialist', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1))
        .toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      expect(() => f.execute('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1))
        .toThrow('INDEPENDENT_ACCEPTOR_REQUIRED')
      await f.recorded('fictional-H2', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1)
      const active = await f.recorded('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'ACTIVE' }, 2)
      const r = await f.recommendation(active)
      expect(r.data).toMatchObject({ producer: 'fictional-specialist', status: 'SUBMITTED' })
      expect(() => f.execute('fictional-specialist', 'output.accept', 'OutputAcceptance', 'self',
        { outputRef: f.ref(r), criteria: 'self-accept' })).toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      expect(() => f.execute('fictional-specialist', 'engagement.transition', 'SpecialistEngagement', 'E',
        { next: 'ACTIVE', expiresAt: '2099-01-01T00:00:00.000Z' }, 3)).toThrow()
      f.controls.now = '2026-10-12T23:00:00.000Z'
      expect(() => f.execute('fictional-specialist', 'recommendation.submit', 'Recommendation', 'late',
        { engagementRef: f.ref(active), content: 'late' })).toThrow('ENGAGEMENT_NOT_ACTIVE')
      f.controls.now = '2026-10-12T21:00:00.000Z'
      await f.recorded('fictional-H2', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'REVOKED' }, 3)
      expect(() => f.execute('fictional-specialist', 'recommendation.submit', 'Recommendation', 'revoked',
        { engagementRef: f.ref(draft), content: 'uses obsolete active reference' })).toThrow('ENGAGEMENT_NOT_ACTIVE')
    } finally { f.store.close() }
  })

  it('records canonical analysis/rationale, preserves original bytes and allows only one racing successor', async () => {
    const f = runtimeFixture()
    try {
      const r = await f.recommendation(await f.engage())
      const analysis = await f.recorded('fictional-H1', 'analysis.create', 'DecisionAnalysis', randomUUID(), {
        recommendationRef: f.ref(r), title: 'Fictional decision', objective: 'Evaluate R',
        recommendation: 'Consider capability improvement', uncertainty: 'Synthetic measurements only',
      })
      const payload = {
        analysisRef: f.ref(analysis), outcome: 'Proceed with bounded work', rationale: 'Human management choice',
        uncertaintyStatement: 'No deployment granted',
      }
      const x = await f.recorded('fictional-H1', 'rationale.record', 'GovernanceRationale', randomUUID(), payload)
      const original = JSON.stringify(x)
      expect(() => f.runtime.mutateDecidedRationale()).toThrow('DECIDED_RATIONALE_IMMUTABLE')
      expect(() => f.store.transaction(() => f.store.append(fictionalScope, 'GovernanceRationale', x.id, 1, {})))
        .toThrow('DECIDED_RATIONALE_IMMUTABLE')
      const results = await Promise.allSettled([1, 2].map(async () =>
        f.recorded('fictional-H1', 'rationale.supersede', 'GovernanceRationale', randomUUID(),
          { ...payload, predecessorRef: f.ref(x), outcome: 'Replacement choice' })))
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
      expect(JSON.stringify(f.store.get(fictionalScope, 'GovernanceRationale', x.id))).toBe(original)
      expect(f.store.list(fictionalScope, 'GovernanceRationale')).toHaveLength(2)
      expect(f.store.successor(fictionalScope, x.id)).toBeTruthy()
    } finally { f.store.close() }
  })
})
