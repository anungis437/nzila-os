import { describe, expect, it } from 'vitest'
import { syntheticOperating } from './synthetic.fixture'
import { benefitStoredSchema } from './value'
import { fictionalScope, fictionalStart } from '../foundation/synthetic.fixture'
import { refKey } from './estate'

export function benefitFixture(f: ReturnType<typeof syntheticOperating>) {
  const evidence = f.source('Evidence', 'measurement'), baseline = f.source('Evidence', 'baseline')
  const input = {
    title: 'Fictional V', outcomeDefinition: 'Observed capability improvement', owner: 'fictional-H1', type: 'SERVICE',
    baselineRef: baseline, metric: 'fictional verified score', unit: 'points', methodVersion: 'fictional-measurement-v1',
    windowStart: fictionalStart, windowEnd: '2026-10-12T20:30:00.000Z', attributionMethod: 'bounded scenario; confounders explicit',
    forecast: { value: null, basisRef: null, uncertainty: 'No live estimate' },
    criteria: { version: 'fictional-criteria-v1', kind: 'NUMERIC_AT_LEAST', threshold: 10, description: 'Observed score >= 10' },
    missionRefs: [], decisionRefs: [], changeRefs: [], estateRefs: [],
  }
  const observe = { sourceRefs: [evidence], evidenceRefs: [evidence], uncertainty: 'Fictional measurements', confounders: [] }
  return { evidence, baseline, input, observe }
}
describe('CP4 Gate D evidence-backed benefit lifecycle', () => {
  it('separates FORECAST, OBSERVED, REALIZED and requires independent internal acceptance', async () => {
    const f = syntheticOperating(), b = benefitFixture(f)
    try {
      const forecast = await f.record('fictional-H1', 'benefit.create', 'Benefit', 'V', b.input)
      expect(benefitStoredSchema.parse(forecast.data).status).toBe('FORECAST')
      const observed = await f.record('fictional-agent', 'benefit.observe', 'Benefit', 'V', b.observe, 1)
      const observationRef = benefitStoredSchema.parse(observed.data).observationRefs[0]!
      expect(benefitStoredSchema.parse(observed.data).status).toBe('OBSERVED')
      expect(() => f.execute('fictional-agent', 'benefit.accept', 'Benefit', 'V', { observationRef, reason: 'self' }, 2)).toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      expect(() => f.execute('fictional-specialist', 'benefit.accept', 'Benefit', 'V', { observationRef, reason: 'self' }, 2)).toThrow('ASSIGNED_INTERNAL_HUMAN_REQUIRED')
      const realized = await f.record('fictional-H2', 'benefit.accept', 'Benefit', 'V', { observationRef, reason: 'Criteria and evidence accepted' }, 2)
      expect(benefitStoredSchema.parse(realized.data).status).toBe('REALIZED')
      expect(() => f.store.transaction(() => f.store.append(observationRef.scope, observationRef.kind,
        observationRef.sourceId, 1, {}))).toThrow('IMMUTABLE_RECORD_USE_NEW_RECEIPT')
      f.hidden.add('measurement')
      const restricted = await f.readCommand('value-status')
      expect(restricted.items[0]?.value?.[0]?.benefit?.observed).toBeNull()
      expect(restricted.complete).toBe(false)
      f.hidden.clear()
      const measuredSource = f.sourceRows.get(refKey(b.evidence))!
      f.sourceRows.delete(refKey(b.evidence))
      expect(await f.readCommand('value-status')).toMatchObject({ status: 'UNAVAILABLE', complete: false })
      expect(benefitStoredSchema.parse(f.store.get(fictionalScope, 'Benefit', 'V')!.data).status).toBe('REALIZED')
      f.sourceRows.set(refKey(b.evidence), measuredSource)
      await f.record('fictional-H2', 'benefit.disposition', 'Benefit', 'V',
        { next: 'UNPROVEN', reason: 'New contrary evidence', evidenceRefs: [b.evidence] }, 3)
      expect(benefitStoredSchema.parse(f.store.get(fictionalScope, 'Benefit', 'V', 3)!.data).status).toBe('REALIZED')
      expect(f.store.list(fictionalScope, 'BenefitAcceptance')).toHaveLength(2)
    } finally { f.store.close() }
  })
  it('keeps missing baseline/evidence UNPROVEN, and preserves rejection history', async () => {
    const f = syntheticOperating(), b = benefitFixture(f)
    try {
      await f.record('fictional-H1', 'benefit.create', 'Benefit', 'V', { ...b.input, baselineRef: null })
      const unproven = await f.record('fictional-H1', 'benefit.observe', 'Benefit', 'V', { ...b.observe, evidenceRefs: [] }, 1)
      const observationRef = benefitStoredSchema.parse(unproven.data).observationRefs[0]!
      expect(benefitStoredSchema.parse(unproven.data).status).toBe('UNPROVEN')
      expect(() => f.execute('fictional-H2', 'benefit.accept', 'Benefit', 'V', { observationRef, reason: 'skip' }, 2)).toThrow('BENEFIT_NOT_OBSERVED')
      const rejected = await f.record('fictional-H2', 'benefit.disposition', 'Benefit', 'V',
        { next: 'REJECTED', reason: 'Unsupported hypothesis', evidenceRefs: [b.evidence] }, 2)
      expect(benefitStoredSchema.parse(rejected.data).status).toBe('REJECTED')
      await expect(f.record('fictional-H1', 'benefit.observe', 'Benefit', 'V', b.observe, 3)).rejects.toThrow('BENEFIT_REASSESSMENT_REQUIRED')
    } finally { f.store.close() }
  })
  it('denies producer self-acceptance, criteria failure, source drift and pending audit finality', async () => {
    const f = syntheticOperating(), b = benefitFixture(f)
    try {
      await f.record('fictional-H1', 'benefit.create', 'Benefit', 'V', b.input)
      f.measurement.value = 3
      const row = await f.record('fictional-H1', 'benefit.observe', 'Benefit', 'V', b.observe, 1)
      const observationRef = benefitStoredSchema.parse(row.data).observationRefs[0]!
      expect(() => f.execute('fictional-H1', 'benefit.accept', 'Benefit', 'V', { observationRef, reason: 'self' }, 2)).toThrow('INDEPENDENT_ACCEPTOR_REQUIRED')
      expect(() => f.execute('fictional-H2', 'benefit.accept', 'Benefit', 'V', { observationRef, reason: 'skip' }, 2)).toThrow('MEASUREMENT_CRITERIA_NOT_SATISFIED')
      f.measurement.value = 12
      expect(() => f.execute('fictional-H2', 'benefit.accept', 'Benefit', 'V', { observationRef, reason: 'changed' }, 2)).toThrow('MEASUREMENT_SOURCE_CHANGED')
      const pending = f.execute('fictional-H1', 'benefit.observe', 'Benefit', 'V', b.observe, 2)
      expect(pending.auditDelivery).toBe('PENDING')
      expect(() => f.execute('fictional-H2', 'benefit.accept', 'Benefit', 'V',
        { observationRef: benefitStoredSchema.parse(pending.data).observationRefs.at(-1), reason: 'pending' }, 3)).toThrow('AUDIT_PROOF_PENDING')
    } finally { f.store.close() }
  })
  it('Mission completion and deployment success do not realize forecast value', async () => {
    const f = syntheticOperating(), b = benefitFixture(f)
    try {
      const m = await f.baseRecord('fictional-H1', 'mission.create', 'Mission', 'M', {
        title: 'M', desiredOutcome: 'B', acceptanceCriteria: ['reviewed'], accountableOwner: 'fictional-H1', executionOwner: 'fictional-H1',
      })
      const p = f.source('DeploymentChange', 'P', 'succeeded')
      await f.record('fictional-H1', 'benefit.create', 'Benefit', 'V', { ...b.input, missionRefs: [f.ref(m)], changeRefs: [p] })
      await f.baseRecord('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 1)
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 2)
      // Foundation completion evidence remains a governed local source, not a value observation.
      const e = await f.baseRecord('fictional-H1', 'mission.create', 'Mission', 'evidence', {
        title: 'Evidence fixture', desiredOutcome: 'Proof', acceptanceCriteria: ['proof'], accountableOwner: 'fictional-H1', executionOwner: 'fictional-H1',
      })
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'completed', evidenceRefs: [f.ref(e)] }, 3)
      expect(benefitStoredSchema.parse(f.store.get(fictionalScope, 'Benefit', 'V')!.data).status).toBe('FORECAST')
      expect(() => f.execute('fictional-H2', 'benefit.accept', 'Benefit', 'V', { observationRef: p, reason: 'deployment succeeded' }, 1)).toThrow('BENEFIT_NOT_OBSERVED')
    } finally { f.store.close() }
  })
})
