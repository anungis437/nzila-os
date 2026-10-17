import { describe, expect, it } from 'vitest'
import { syntheticOperating } from './synthetic.fixture'
import { fictionalScope } from '../foundation/synthetic.fixture'
import { raidStoredSchema } from './raid'

export async function raidFixture() {
  const f = syntheticOperating()
  const m = await f.baseRecord('fictional-H1', 'mission.create', 'Mission', 'M', {
    title: 'Fictional M', desiredOutcome: 'Improve B', acceptanceCriteria: ['verified'],
    accountableOwner: 'fictional-H1', executionOwner: 'fictional-H1',
  })
  await f.baseRecord('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 1)
  const evidence = f.source('Evidence', 'evidence')
  const input = {
    category: 'RISK', title: 'Fictional risk', description: 'Evidence-backed risk', owner: 'fictional-H1',
    triggerRef: evidence, sourceScale: 'fictional qualitative', priority: 'HIGH', normalizationRule: 'fictional-risk-v1',
    evidenceRefs: [evidence], missionRefs: [f.ref(m)], changeRefs: [], decisionRefs: [], estateRefs: [],
    technicalDebt: false, blockingRuleRef: 'fictional-start-condition', dependency: null,
  }
  const transition = (id: string, next: string, version: number, actor = 'fictional-H1') =>
    f.record(actor, 'raid.transition', 'Raid', id, { next, resolution: 'Fictional reviewed evidence',
      evidenceRefs: [evidence], expiresAt: ['accepted', 'waived'].includes(next) ? '2026-10-12T23:00:00.000Z' : null }, version)
  return { ...f, m, evidence, input, transition }
}

describe('CP4 Gate B governed RAID and dependencies', () => {
  it('permits attributed agent proposals but denies agent risk acceptance and system issue closure', async () => {
    const f = await raidFixture()
    try {
      await f.record('fictional-agent', 'raid.propose', 'RaidProposal', 'proposal', f.input)
      const r = await f.record('fictional-H1', 'raid.create', 'Raid', 'R1', f.input)
      expect(raidStoredSchema.parse(r.data).origin.actor).toBe('fictional-H1')
      await f.transition('R1', 'assessed', 1)
      expect(() => f.execute('fictional-agent', 'raid.transition', 'Raid', 'R1',
        { next: 'accepted', resolution: 'self', evidenceRefs: [f.evidence], expiresAt: '2026-10-12T23:00:00.000Z' }, 2))
        .toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      await f.record('fictional-H1', 'raid.create', 'Raid', 'issue', { ...f.input, category: 'ISSUE' })
      await f.transition('issue', 'resolving', 1); await f.transition('issue', 'resolved', 2)
      expect(() => f.execute('fictional-system', 'raid.transition', 'Raid', 'issue',
        { next: 'closed', resolution: 'self', evidenceRefs: [f.evidence], expiresAt: null }, 3)).toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      await f.transition('issue', 'closed', 3, 'fictional-H2')
      expect(f.store.revisions(fictionalScope, 'Raid').filter(r => r.id === 'issue')).toHaveLength(4)
    } finally { f.store.close() }
  })
  it('blocks Mission starts/unblocks until explicit risk disposition, rechecking expiry', async () => {
    const f = await raidFixture()
    try {
      await f.record('fictional-H1', 'raid.create', 'Raid', 'R1', f.input)
      expect(() => f.foundation.execute('fictional-H1', 'mission.transition',
        f.command('Mission', 'M', { next: 'active' }, 2))).toThrow('MISSION_REQUIRED_RAID_UNRESOLVED')
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'blocked' }, 2)
      await f.transition('R1', 'assessed', 1); await f.transition('R1', 'accepted', 2, 'fictional-H2')
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 3)
      f.controls.now = '2026-10-12T23:00:00.000Z'
      expect(() => f.foundation.execute('fictional-H1', 'mission.transition',
        f.command('Mission', 'M', { next: 'active' }, 4))).toThrow('MISSION_REQUIRED_RAID_UNRESOLVED')
      const projection = await f.readCommand('risk')
      expect(projection.items[0]?.value?.[0]?.raid).toMatchObject({
        dispositionCurrent: 'EXPIRED', dispositionExpiresAt: '2026-10-12T23:00:00.000Z',
      })
      expect(projection.complete).toBe(false)
    } finally { f.store.close() }
  })
  it('keeps required unknown/unmet dependencies blocked and rejects work cycles', async () => {
    const f = await raidFixture()
    try {
      const prerequisite = f.source('Service', 'prerequisite', 'unavailable')
      const d = { ...f.input, category: 'DEPENDENCY', dependency: {
        dependent: f.ref(f.m), prerequisite, requiredCondition: 'active', evaluatorVersion: 'fictional-exact-status-v1',
        neededBy: '2026-10-12T23:00:00.000Z',
      } }
      await f.record('fictional-H1', 'raid.create', 'Raid', 'D1', d)
      await f.transition('D1', 'confirmed', 1); await f.transition('D1', 'unmet', 2)
      await expect(f.transition('D1', 'satisfied', 3)).rejects.toThrow('DEPENDENCY_CONDITION_UNMET')
      expect(() => f.foundation.execute('fictional-H1', 'mission.transition',
        f.command('Mission', 'M', { next: 'active' }, 2))).toThrow('MISSION_REQUIRED_RAID_UNRESOLVED')
      expect(() => f.execute('fictional-H1', 'raid.create', 'Raid', 'cycle',
        { ...d, dependency: { ...d.dependency, prerequisite: f.ref(f.m) } })).toThrow('REQUIRED_WORK_CYCLE')
    } finally { f.store.close() }
  })
  it('never silently assigns missing owners, guesses scales, or closes without evidence', async () => {
    const f = await raidFixture()
    try {
      expect(() => f.execute('fictional-H1', 'raid.create', 'Raid', 'missing', { ...f.input, owner: '' })).toThrow()
      expect(() => f.execute('fictional-H1', 'raid.create', 'Raid', 'agent', { ...f.input, owner: 'fictional-agent' })).toThrow('ASSIGNED_INTERNAL_OWNER_REQUIRED')
      expect(() => f.execute('fictional-H1', 'raid.create', 'Raid', 'scale', { ...f.input, normalizationRule: null })).toThrow('EXPLICIT_PRIORITY_RULE_REQUIRED')
      await f.record('fictional-H1', 'raid.create', 'Raid', 'R1', f.input)
      expect(() => f.execute('fictional-H1', 'raid.transition', 'Raid', 'R1',
        { next: 'closed', resolution: 'skip', evidenceRefs: [], expiresAt: null }, 1)).toThrow()
      expect(f.store.get(fictionalScope, 'Raid', 'missing')).toBeUndefined()
    } finally { f.store.close() }
  })
  it('requires independent human assumption validation and retains invalidation/retirement', async () => {
    const f = await raidFixture()
    try {
      await f.record('fictional-H1', 'raid.create', 'Raid', 'assumption', { ...f.input, category: 'ASSUMPTION' })
      await expect(f.transition('assumption', 'validated', 1)).rejects.toThrow('INDEPENDENT_ACCEPTOR_REQUIRED')
      await expect(f.transition('assumption', 'validated', 1, 'fictional-agent')).rejects.toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      await f.transition('assumption', 'validated', 1, 'fictional-H2')
      await f.transition('assumption', 'invalidated', 2, 'fictional-H2')
      await f.transition('assumption', 'retired', 3, 'fictional-H2')
      expect(f.store.revisions(fictionalScope, 'Raid').filter(r => r.id === 'assumption')).toHaveLength(4)
    } finally { f.store.close() }
  })
  it('requires closure independence from the material resolver rather than only the original creator', async () => {
    const f = await raidFixture()
    try {
      await f.record('fictional-H1', 'raid.create', 'Raid', 'issue', { ...f.input, category: 'ISSUE' })
      await f.transition('issue', 'resolving', 1)
      await f.transition('issue', 'resolved', 2, 'fictional-H2')
      await expect(f.transition('issue', 'closed', 3, 'fictional-H2')).rejects.toThrow('INDEPENDENT_ACCEPTOR_REQUIRED')
      await f.transition('issue', 'closed', 3, 'fictional-H1')
    } finally { f.store.close() }
  })
  it('preserves an independently closed waiver only until its original expiry, without inventing satisfaction', async () => {
    const f = await raidFixture()
    try {
      const prerequisite = f.source('Service', 'unmet-prerequisite', 'degraded')
      await f.record('fictional-H1', 'raid.create', 'Raid', 'D1', { ...f.input, category: 'DEPENDENCY',
        dependency: { dependent: f.ref(f.m), prerequisite, requiredCondition: 'active',
          evaluatorVersion: 'fictional-v1', neededBy: '2026-10-12T23:00:00.000Z' } })
      await f.transition('D1', 'confirmed', 1)
      await f.transition('D1', 'waived', 2, 'fictional-H2')
      const closed = await f.transition('D1', 'closed', 3, 'fictional-H1')
      expect(raidStoredSchema.parse(closed.data)).toMatchObject({
        status: 'closed', closureDisposition: 'WAIVED', dispositionExpiresAt: '2026-10-12T23:00:00.000Z',
      })
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 2)
      f.controls.now = '2026-10-12T23:00:00.000Z'
      expect(() => f.foundation.execute('fictional-H1', 'mission.transition',
        f.command('Mission', 'M', { next: 'completed', evidenceRefs: [f.ref(f.m)] }, 3))).toThrow('MISSION_REQUIRED_RAID_UNRESOLVED')
    } finally { f.store.close() }
  })
})
