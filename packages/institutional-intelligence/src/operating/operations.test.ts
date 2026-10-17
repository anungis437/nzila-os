import { describe, expect, it } from 'vitest'
import { fictionalScope, fictionalStart } from '../foundation/synthetic.fixture'
import { syntheticOperating } from './synthetic.fixture'
import { refKey } from './estate'
import { laneStoredSchema } from './operations'

export async function engagementFixture(f: ReturnType<typeof syntheticOperating>) {
  await f.baseRecord('fictional-H1', 'engagement.create', 'SpecialistEngagement', 'E', {
    sponsor: 'fictional-H1', counterpart: 'fictional-H2', specialist: 'fictional-specialist',
    effectiveAt: fictionalStart, expiresAt: '2026-10-12T23:00:00.000Z',
  })
  await f.baseRecord('fictional-H2', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1)
  const e = await f.baseRecord('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'ACTIVE' }, 2)
  await f.record('fictional-H1', 'engagement.terms', 'EngagementTerms', 'E-terms', {
    engagementRef: f.ref(e), authorizedOutputs: ['Recommendation'],
    obligations: [{ id: 'review', criteria: 'reviewed', status: 'OPEN', evidenceRef: null, producer: 'fictional-specialist' }],
  })
  return e
}
export const unknownCapacity = {
  knowledge: 'UNKNOWN', confidence: 'UNKNOWN', unit: 'coarse-slots',
  windowStart: fictionalStart, windowEnd: '2026-10-12T23:00:00.000Z',
  availableChangeCapacity: null, committedCapacity: null, runReserve: null, sourceRefs: [], ruleVersion: 'fictional-v1',
}
describe('CP4 Gate C source-preserving operations and specialist visibility', () => {
  it('links independent sources without cloning or mutating incidents/Changes and reports outages/staleness', async () => {
    const f = syntheticOperating()
    try {
      const m = await f.baseRecord('fictional-H1', 'mission.create', 'Mission', 'M', {
        title: 'M', desiredOutcome: 'Improve B', acceptanceCriteria: ['reviewed'], accountableOwner: 'fictional-H1', executionOwner: 'fictional-H1',
      })
      const c = await f.estate('Service', 'C'), j = f.source('Incident', 'J', 'in_progress')
      const o = f.source('OperationalChange', 'O', 'approved'), p = f.source('DeploymentChange', 'P', 'approved')
      const before = JSON.stringify([...f.sourceRows])
      const link = await f.record('fictional-H1', 'operations.link', 'OperationalLink', 'operations', {
        missionRef: f.ref(m), incidentRefs: [j], problemRefs: [], operationalChangeRefs: [o],
        deploymentChangeRefs: [p], estateRefs: [c], decisionRefs: [],
      })
      const read = () => f.runtime.operations('fictional-H1', f.command('OperationsRead', 'query', { ref: f.ref(link) }))
      expect(read()).toMatchObject({ missionState: 'proposed', complete: true, health: 'NOT_EVALUATED', causalMeaning: 'CORRELATED_NOT_CONFIRMED' })
      expect(JSON.stringify([...f.sourceRows])).toBe(before)
      expect(f.store.list(fictionalScope, 'Incident')).toHaveLength(0)
      expect(f.store.list(fictionalScope, 'DeploymentChange')).toHaveLength(0)
      f.sourceRows.set(refKey(j), { ...f.sourceRows.get(refKey(j))!, status: 'UNAVAILABLE', value: null, complete: false })
      expect(read()).toMatchObject({ complete: false, health: 'UNKNOWN' })
      expect(read().reads[0]).toMatchObject({ status: 'UNAVAILABLE', value: null })
      f.sourceRows.set(refKey(j), { ...f.sourceRows.get(refKey(o))!, ref: j, status: 'OBSERVED', observedAt: fictionalStart,
        freshness: { policyRef: 'fictional-observation-v1', maxAgeMs: 1800000 } })
      expect(read().reads[0]).toMatchObject({ status: 'STALE', observedAt: fictionalStart })
    } finally { f.store.close() }
  })
  it('exposes authorized outputs, expiry, evidence, independent acceptance and unresolved obligations', async () => {
    const f = syntheticOperating()
    try {
      const e = await engagementFixture(f)
      const r = await f.baseRecord('fictional-specialist', 'recommendation.submit', 'Recommendation', 'R',
        { engagementRef: f.ref(e), content: 'Fictional recommendation' })
      expect(() => f.foundation.execute('fictional-specialist', 'output.accept',
        f.command('OutputAcceptance', 'self', { outputRef: f.ref(r), criteria: 'reviewed' }))).toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      const a = await f.baseRecord('fictional-H2', 'output.accept', 'OutputAcceptance', 'accepted',
        { outputRef: f.ref(r), criteria: 'reviewed' })
      await f.record('fictional-H2', 'engagement.terms', 'EngagementTerms', 'E-terms', {
        engagementRef: f.ref(e), authorizedOutputs: ['Recommendation'],
        obligations: [{ id: 'review', criteria: 'reviewed', status: 'ACCEPTED', evidenceRef: f.ref(a), producer: 'fictional-specialist' }],
      }, 1)
      const read = () => f.runtime.specialist('fictional-H1', f.command('SpecialistRead', 'q', { id: 'E' }))
      expect(read()).toMatchObject({ status: 'ACTIVE', sponsor: 'fictional-H1', authorizedOutputs: ['Recommendation'], complete: true })
      expect(read().acceptanceRefs).toHaveLength(1)
      f.hidden.add('accepted')
      const restricted = read()
      expect(restricted.complete).toBe(false)
      expect(restricted.obligations?.[0]?.evidenceRef).toBeNull()
      expect(restricted.acceptanceRefs).toHaveLength(0)
      expect(JSON.stringify(restricted)).not.toContain('"sourceId":"accepted"')
      f.hidden.clear()
      f.controls.now = '2026-10-12T23:00:00.000Z'
      expect(read().status).toBe('EXPIRED')
      await expect(f.baseRecord('fictional-specialist', 'recommendation.submit', 'Recommendation', 'late',
        { engagementRef: f.ref(e), content: 'late' })).rejects.toThrow('ENGAGEMENT_NOT_ACTIVE')
    } finally { f.store.close() }
  })
  it('keeps unknown capacity null, denies fabrication and uses CAS to prevent double reservation', async () => {
    const f = syntheticOperating()
    try {
      const m = await f.baseRecord('fictional-H1', 'mission.create', 'Mission', 'M', {
        title: 'M', desiredOutcome: 'B', acceptanceCriteria: ['reviewed'], accountableOwner: 'fictional-H1', executionOwner: 'fictional-agent',
      })
      const input = { purpose: 'Improve B', owner: 'fictional-H1', executionOwner: 'fictional-agent', status: 'ACTIVE',
        missionRefs: [f.ref(m)], engagementRefs: [], capacity: unknownCapacity }
      const lane = await f.record('fictional-H1', 'lane.create', 'Lane', 'unknown', input)
      expect(laneStoredSchema.parse(lane.data).capacity.availableChangeCapacity).toBeNull()
      expect(() => f.execute('fictional-H1', 'lane.create', 'Lane', 'zero',
        { ...input, capacity: { ...unknownCapacity, availableChangeCapacity: 0 } })).toThrow('UNKNOWN_CAPACITY_MUST_BE_NULL')
      const reserve = { workRef: f.ref(m), quantity: 1, unit: 'coarse-slots' }
      expect(() => f.execute('fictional-H1', 'lane.reserve', 'Lane', 'unknown', reserve, 1)).toThrow('CAPACITY_UNKNOWN')
      await f.record('fictional-H1', 'lane.create', 'Lane', 'known', { ...input, capacity: {
        ...unknownCapacity, knowledge: 'KNOWN', confidence: 'DECLARED', availableChangeCapacity: 1,
        committedCapacity: 0, runReserve: 1, sourceRefs: [f.source('Evidence', 'planner-declaration')],
      } })
      await f.record('fictional-H1', 'lane.reserve', 'Lane', 'known', reserve, 1)
      expect(() => f.execute('fictional-H1', 'lane.reserve', 'Lane', 'known', reserve, 1)).toThrow('CONFLICT')
      expect(() => f.execute('fictional-H1', 'lane.reserve', 'Lane', 'known', reserve, 2)).toThrow('CAPACITY_OVERCOMMITTED')
    } finally { f.store.close() }
  })
})
