import { describe, expect, it } from 'vitest'
import { syntheticOperating } from './synthetic.fixture'
import { fictionalScope } from '../foundation/synthetic.fixture'
import { estateStoredSchema } from './estate'
import { refKey } from './estate'

describe('CP4 Gate A estate and scoped directed graph', () => {
  it('finds B/A incoming impact and D outgoing prerequisite without claiming causation', async () => {
    const f = syntheticOperating()
    try {
      const a = await f.estate('InstitutionalProduct', 'A'), b = await f.estate('Capability', 'B')
      const c = await f.estate('Service', 'C'), d = await f.estate('ExternalDependency', 'D')
      await f.edge(c, d); await f.edge(a, b); await f.edge(b, c)
      const impact = await f.traverse(c)
      expect(impact.nodes.map(n => n.sourceRef.sourceId).sort()).toEqual(['A', 'B', 'C'])
      expect(impact.complete).toBe(true)
      expect((await f.traverse(c, 'outgoing')).nodes.map(n => n.sourceRef.sourceId).sort()).toEqual(['C', 'D'])
      expect(impact.causalMeaning).toBe('DEPENDENCY_IMPACT_NOT_CONFIRMED_CAUSATION')
      const before = JSON.stringify(impact)
      expect(JSON.stringify(await f.traverse(c))).toBe(before)
    } finally { f.store.close() }
  })
  it('denies cross-institution reads, unauthorized relationships and cross-scope edges', async () => {
    const f = syntheticOperating()
    try {
      const c = await f.estate('Service', 'C'), d = await f.estate('ExternalDependency', 'D')
      f.controls.entitled = false
      await expect(f.traverse(c)).rejects.toThrow('NOT_ENTITLED')
      expect(() => f.execute('fictional-H1', 'relationship.record', 'InstitutionalRelationship', 'denied',
        { from: c, to: d, relation: 'DEPENDS_ON', purpose: 'x', binding: true, status: 'CURRENT' })).toThrow('NOT_ENTITLED')
      f.controls.entitled = true
      const other = { type: 'PLATFORM_INSTITUTION' as const, id: 'fictional-other' }
      await expect(f.runtime.traverse('fictional-H1', {
        ...f.command('EstateRead', 'q', {}), locator: f.target('EstateRead', 'q', 1, other),
      })).rejects.toThrow()
      expect(() => f.execute('fictional-H1', 'relationship.record', 'InstitutionalRelationship', 'cross',
        { from: c, to: { ...d, scope: other }, relation: 'DEPENDS_ON', purpose: 'x', binding: true, status: 'CURRENT' }))
        .toThrow('REFERENCE_SCOPE_OR_READ_DENIED')
      expect(f.store.list(fictionalScope, 'InstitutionalRelationship')).toHaveLength(0)
    } finally { f.store.close() }
  })
  it('redacts hidden identifiers and marks inaccessible branches incomplete without counts', async () => {
    const f = syntheticOperating()
    try {
      const c = await f.estate('Service', 'C'), d = await f.estate('ExternalDependency', 'secret-D')
      await f.edge(c, d)
      f.hidden.add('secret-D')
      const result = await f.traverse(c, 'outgoing')
      expect(result.complete).toBe(false)
      expect(JSON.stringify(result)).not.toContain('secret-D')
      expect(result).not.toHaveProperty('hiddenCount')
    } finally { f.store.close() }
  })
  it('reports cycles and truncation and retains retired nodes in historical trace', async () => {
    const f = syntheticOperating()
    try {
      const c = await f.estate('Service', 'C'), s = await f.estate('Service', 'S')
      await f.edge(c, s); await f.edge(s, c)
      expect((await f.traverse(c)).cycles).toHaveLength(1)
      const bounded = await f.traverse(c, 'outgoing', { nodeBudget: 1 })
      expect(bounded).toMatchObject({ truncated: true, complete: false })
      const old = estateStoredSchema.parse(f.store.get(fictionalScope, 'EstateReference', 'S')!.data)
      const evidence = f.source('Evidence', 'retirement-evidence')
      f.controls.now = '2026-10-12T21:01:00.000Z'
      await f.record('fictional-H1', 'estate.record', 'EstateReference', 'S',
        { sourceRef: s, classification: 'Service', lifecycle: 'DEPRECATED', steward: old.steward, evidenceRefs: [evidence] }, 1)
      await f.record('fictional-H1', 'estate.record', 'EstateReference', 'S',
        { sourceRef: s, classification: 'Service', lifecycle: 'RETIRED', steward: old.steward, evidenceRefs: [evidence] }, 2)
      expect(await f.traverse(c, 'outgoing')).toMatchObject({ complete: false })
      const history = await f.traverse(c, 'outgoing', { mode: 'HISTORICAL_AT', at: '2026-10-12T21:00:00.000Z' })
      expect(history.nodes.find(n => n.sourceRef.sourceId === 'S')?.lifecycle).toBe('ACTIVE')
      expect((await f.traverse(c, 'outgoing', { mode: 'ALL_REGISTERED' })).nodes.find(n => n.sourceRef.sourceId === 'S')?.lifecycle).toBe('RETIRED')
    } finally { f.store.close() }
  })
  it('does not turn disappeared or stale source branches into complete impact', async () => {
    const f = syntheticOperating()
    try {
      const c = await f.estate('Service', 'C'), d = await f.estate('ExternalDependency', 'D')
      await f.edge(c, d)
      f.sourceRows.delete(refKey(d))
      expect(await f.traverse(c, 'outgoing')).toMatchObject({ complete: false })
      const registered = await f.traverse(c, 'outgoing', { mode: 'ALL_REGISTERED' })
      expect(registered.complete).toBe(false)
      expect(registered.nodes.find(n => n.sourceRef.sourceId === 'D')).toMatchObject({ sourceStatus: 'UNAVAILABLE' })
      f.sourceRows.set(refKey(d), { ref: d, value: { title: 'D', status: 'active', owner: null, evidenceRefs: [], affectedRefs: [], rootCause: 'UNKNOWN' },
        status: 'OBSERVED', complete: true, observedAt: '2026-10-12T19:00:00.000Z', watermark: 'old',
        freshness: { policyRef: 'fictional-v1', maxAgeMs: 1000 }, error: null })
      expect(await f.traverse(c, 'outgoing')).toMatchObject({ complete: false })
    } finally { f.store.close() }
  })
})
