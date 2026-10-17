import { describe, expect, it } from 'vitest'
import { syntheticOperating } from './synthetic.fixture'
import { commandContracts, type CommandItem } from './command'
import { fictionalScope, fictionalStart } from '../foundation/synthetic.fixture'
import { refKey } from './estate'
import { randomUUID } from 'node:crypto'

const externalItems: CommandItem[] = ['blocked-changes', 'open-incidents', 'human-approvals', 'failed-controls', 'health',
  'active-changes', 'platform-health', 'evidence-status']
export function illustrativeCommandSources(f: ReturnType<typeof syntheticOperating>) {
  for (const item of externalItems) f.commandSources.set(item, {
    reads: [], status: 'ILLUSTRATIVE', complete: true, observedAt: f.controls.now, watermark: 'fixture-v1',
    freshness: { policyRef: 'fictional-query-v1', maxAgeMs: 3600000 }, error: null,
  })
}
describe('CP4 Gate E exactly 22 read-only COMMAND contracts', () => {
  it('projects populated authoritative/local fixtures across all 22 contracts without hidden parser errors', async () => {
    const f = syntheticOperating()
    try {
      illustrativeCommandSources(f)
      const a = await f.estate('InstitutionalProduct', 'A'), b = await f.estate('Capability', 'B')
      await f.edge(a, b); await f.estate('ExternalDependency', 'D')
      const primitive = f.source('SharedPlatformPrimitive', 'primitive')
      await f.record('fictional-H1', 'estate.record', 'EstateReference', 'primitive', {
        sourceRef: primitive, classification: 'SharedPlatformPrimitive', lifecycle: 'ACTIVE', steward: null, evidenceRefs: [],
      })
      const m = await f.baseRecord('fictional-H1', 'mission.create', 'Mission', 'M', {
        title: 'M', desiredOutcome: 'Improve B', acceptanceCriteria: ['reviewed'], accountableOwner: 'fictional-H1', executionOwner: 'fictional-H1',
      })
      await f.baseRecord('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 1)
      await f.baseRecord('fictional-H1', 'engagement.create', 'SpecialistEngagement', 'E', {
        sponsor: 'fictional-H1', counterpart: 'fictional-H2', specialist: 'fictional-specialist',
        effectiveAt: fictionalStart, expiresAt: '2026-10-12T23:00:00.000Z',
      })
      await f.baseRecord('fictional-H2', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1)
      const e = await f.baseRecord('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'ACTIVE' }, 2)
      await f.record('fictional-H1', 'engagement.terms', 'EngagementTerms', 'terms', { engagementRef: f.ref(e), authorizedOutputs: ['Recommendation'], obligations: [] })
      const recommendation = await f.baseRecord('fictional-specialist', 'recommendation.submit', 'Recommendation', 'R',
        { engagementRef: f.ref(e), content: 'Fictional recommendation' })
      await f.baseRecord('fictional-H1', 'analysis.create', 'DecisionAnalysis', randomUUID(), {
        recommendationRef: f.ref(recommendation), title: 'Pending management choice', objective: 'Improve B', recommendation: 'Consider work', uncertainty: 'Synthetic',
      })
      const evidence = f.source('Evidence', 'evidence')
      await f.record('fictional-H1', 'raid.create', 'Raid', 'risk', {
        category: 'RISK', title: 'Risk', description: 'Technical debt', owner: 'fictional-H1', triggerRef: evidence,
        sourceScale: 'qualitative', priority: 'HIGH', normalizationRule: 'fictional-v1', evidenceRefs: [evidence],
        missionRefs: [f.ref(m)], changeRefs: [], decisionRefs: [], estateRefs: [b], technicalDebt: true, blockingRuleRef: null, dependency: null,
      })
      await f.record('fictional-H1', 'lane.create', 'Lane', 'lane', {
        purpose: 'Work lane', owner: 'fictional-H1', executionOwner: 'fictional-H1', status: 'ACTIVE',
        missionRefs: [f.ref(m)], engagementRefs: [f.ref(e)], capacity: {
          knowledge: 'UNKNOWN', confidence: 'UNKNOWN', unit: 'slots', windowStart: fictionalStart, windowEnd: '2026-10-12T23:00:00.000Z',
          availableChangeCapacity: null, committedCapacity: null, runReserve: null, sourceRefs: [], ruleVersion: 'fixture-v1',
        },
      })
      await f.record('fictional-H1', 'benefit.create', 'Benefit', 'V', {
        title: 'Expected value', outcomeDefinition: 'Improvement', owner: 'fictional-H1', type: 'SERVICE', baselineRef: null,
        metric: 'qualitative', unit: 'verified-condition', methodVersion: 'fixture-v1', windowStart: fictionalStart, windowEnd: '2026-10-12T20:30:00.000Z',
        attributionMethod: 'Explicit test', forecast: { value: null, basisRef: null, uncertainty: 'No estimate' },
        criteria: { version: 'v1', kind: 'QUALITATIVE_VERIFIED', threshold: null, description: 'Verified improvement' },
        missionRefs: [f.ref(m)], decisionRefs: [], changeRefs: [], estateRefs: [b],
      })
      for (const [item, kind, state] of [
        ['blocked-changes', 'OperationalChange', 'blocked'], ['open-incidents', 'Incident', 'in_progress'],
        ['human-approvals', 'Approval', 'pending'], ['failed-controls', 'Control', 'failed'],
        ['health', 'OperationalHealthState', 'degraded'], ['active-changes', 'DeploymentChange', 'approved'],
        ['platform-health', 'OperationalHealthState', 'unknown'], ['evidence-status', 'Evidence', 'referenced'],
      ] as const) {
        const ref = f.source(kind, `fictional-${item}`, state)
        f.commandSources.get(item)!.reads = [f.sourceRows.get(refKey(ref))!]
      }
      const result = await f.readCommand()
      expect(result.errors).toEqual([])
      for (const item of result.items) {
        expect(item.value?.length, item.kind).toBeGreaterThan(0)
        expect(item.status, item.kind).not.toBe('ERROR')
      }
      expect(result.items.find(i => i.kind === 'capacity-constraints')?.value?.[0]?.capacity?.free).toBeNull()
      expect(result.items.find(i => i.kind === 'pending-decisions')?.value?.[0]?.owner).toBe('fictional-H1')
    } finally { f.store.close() }
  })
  it('implements the accepted 9 TODAY, 7 PORTFOLIO and 6 ESTATE categories', async () => {
    const f = syntheticOperating()
    try {
      illustrativeCommandSources(f)
      await f.estate('InstitutionalProduct', 'A'); await f.estate('Capability', 'B')
      const read = await f.readCommand()
      expect(read.items.map(i => i.kind)).toEqual(commandContracts.map(c => c.item))
      expect(commandContracts.filter(c => c.view === 'TODAY')).toHaveLength(9)
      expect(commandContracts.filter(c => c.view === 'PORTFOLIO')).toHaveLength(7)
      expect(commandContracts.filter(c => c.view === 'ESTATE')).toHaveLength(6)
      expect(read).toMatchObject({ status: 'ILLUSTRATIVE', counts: { value: null } })
      expect(read.items.find(i => i.kind === 'products')?.value?.[0]?.title).toBe('Fictional A')
      for (const contract of commandContracts) expect((await f.readCommand(contract.item)).items).toHaveLength(1)
    } finally { f.store.close() }
  })
  it('distinguishes unavailable/error/stale/current data and never substitutes healthy or zero', async () => {
    const f = syntheticOperating()
    try {
      const absent = await f.readCommand('open-incidents')
      expect(absent).toMatchObject({ status: 'UNAVAILABLE', complete: false, counts: { value: null } })
      expect(absent.items[0]?.value).toBeNull()
      const j = f.source('Incident', 'J', 'in_progress')
      const source = { ...f.sourceRows.get(refKey(j))!, status: 'OBSERVED' as const }
      f.commandSources.set('open-incidents', {
        reads: [source], status: 'OBSERVED', complete: true, observedAt: f.controls.now, watermark: 'verified-current',
        freshness: source.freshness, error: null,
      })
      const current = await f.readCommand('open-incidents')
      expect(current).toMatchObject({ status: 'OBSERVED', complete: true, counts: { value: 1 } })
      f.controls.now = '2026-10-12T22:01:00.000Z'
      const stale = await f.readCommand('open-incidents')
      expect(stale).toMatchObject({ status: 'STALE', complete: false, counts: { value: null } })
      expect(stale.items[0]?.sourceObservedAt).toBe('2026-10-12T21:00:00.000Z')
      f.sources.commandSource = () => { throw new Error('FIXTURE_INCIDENT_OUTAGE') }
      const error = await f.readCommand('open-incidents')
      expect(error.items[0]).toMatchObject({ status: 'ERROR', value: null })
      expect(f.failures).toContain('INCIDENT_READ_FAILED')
    } finally { f.store.close() }
  })
  it('enforces explicit illustrative opt-in, denies mixes, and redacts hidden rows before counts', async () => {
    const f = syntheticOperating()
    try {
      illustrativeCommandSources(f)
      await expect(f.readCommand('products', { illustrative: false })).rejects.toThrow('ILLUSTRATIVE_REQUIRES_OPT_IN')
      const j = f.source('Incident', 'hidden-J', 'in_progress'), row = f.sourceRows.get(refKey(j))!
      f.commandSources.set('open-incidents', { reads: [row], status: 'ILLUSTRATIVE', complete: true, observedAt: f.controls.now,
        watermark: 'fixture', freshness: row.freshness, error: null })
      f.hidden.add('hidden-J')
      const hidden = await f.readCommand('open-incidents')
      expect(hidden.complete).toBe(false)
      expect(JSON.stringify(hidden)).not.toContain('hidden-J')
      expect(hidden.counts.value).toBeNull()
      f.commandSources.set('open-incidents', { reads: [], status: 'OBSERVED', complete: true, observedAt: f.controls.now,
        watermark: 'current', freshness: row.freshness, error: null })
      await expect(f.readCommand()).rejects.toThrow('ILLUSTRATIVE_OPERATIONAL_MIX_DENIED')
      f.controls.entitled = false
      await expect(f.readCommand()).rejects.toThrow('NOT_ENTITLED')
    } finally { f.store.close() }
  })
  it('does not mutate sources when reading or modifying returned projections, and paginates honestly', async () => {
    const f = syntheticOperating()
    try {
      await f.estate('InstitutionalProduct', 'A'); await f.estate('InstitutionalProduct', 'A2')
      const before = JSON.stringify(f.store.revisions(fictionalScope, 'EstateReference'))
      const sourceBefore = JSON.stringify([...f.sourceRows])
      const read = await f.readCommand('products', { pageSize: 1 })
      expect(read).toMatchObject({ complete: false, cursor: '1', counts: { value: null } })
      read.items[0]!.value![0]!.title = 'tampered'
      expect(JSON.stringify(f.store.revisions(fictionalScope, 'EstateReference'))).toBe(before)
      expect(JSON.stringify([...f.sourceRows])).toBe(sourceBefore)
      expect(f.commandRead).not.toHaveProperty('execute')
      await expect(f.readCommand('products', { mutation: 'delete-source' })).rejects.toThrow()
      await expect(f.readCommand('products', { at: fictionalStart })).rejects.toThrow('COMMAND_HISTORICAL_SNAPSHOT_UNAVAILABLE')
    } finally { f.store.close() }
  })
})
