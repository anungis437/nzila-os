import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { verifyFullChain, type NarRecord } from '@nzila/nar'
import { syntheticOperating } from './synthetic.fixture'
import { fictionalScope, fictionalStart } from '../foundation/synthetic.fixture'
import { refKey } from './estate'
import { benefitStoredSchema } from './value'
import { commandContracts, type CommandItem } from './command'

describe('CP4 Gate F fictional institution I / governance org GI operating proof', () => {
  it('executes all 19 operating steps, preserves source authority, restarts durable metadata and verifies NAR', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nzila-cp4-operating-'))
    const filename = join(directory, 'fictional.sqlite')
    let f = syntheticOperating(filename)
    const steps: number[] = []
    try {
      const a = await f.estate('InstitutionalProduct', 'A'), b = await f.estate('Capability', 'B')
      const c = await f.estate('Service', 'C'), d = await f.estate('ExternalDependency', 'D')
      await f.edge(a, b); steps.push(1)
      await f.edge(b, c); steps.push(2)
      await f.edge(c, d); steps.push(3)
      const m = await f.baseRecord('fictional-H1', 'mission.create', 'Mission', 'M', {
        title: 'Improve B', desiredOutcome: 'Verified improvement in B', acceptanceCriteria: ['Recommendation reviewed'],
        accountableOwner: 'fictional-H1', executionOwner: 'fictional-H1',
      })
      await f.record('fictional-H1', 'relationship.record', 'InstitutionalRelationship', 'M-B', {
        from: f.ref(m), to: b, relation: 'IMPLEMENTS', purpose: 'Fictional intended improvement', binding: false, status: 'CURRENT',
      })
      steps.push(4)
      await f.baseRecord('fictional-H1', 'engagement.create', 'SpecialistEngagement', 'E', {
        sponsor: 'fictional-H1', counterpart: 'fictional-H2', specialist: 'fictional-specialist',
        effectiveAt: fictionalStart, expiresAt: '2026-10-12T23:00:00.000Z',
      })
      await f.baseRecord('fictional-H2', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1)
      const e = await f.baseRecord('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'ACTIVE' }, 2)
      await f.record('fictional-H1', 'engagement.terms', 'EngagementTerms', 'E-terms', {
        engagementRef: f.ref(e), authorizedOutputs: ['Recommendation'],
        obligations: [{ id: 'review', criteria: 'Recommendation reviewed', status: 'OPEN', evidenceRef: null, producer: 'fictional-specialist' }],
      })
      const recommendation = await f.baseRecord('fictional-specialist', 'recommendation.submit', 'Recommendation', 'recommendation',
        { engagementRef: f.ref(e), content: 'Synthetic capability improvement recommendation' })
      const accepted = await f.baseRecord('fictional-H2', 'output.accept', 'OutputAcceptance', 'acceptance',
        { outputRef: f.ref(recommendation), criteria: 'Recommendation reviewed' })
      steps.push(5)
      const analysis = await f.baseRecord('fictional-H1', 'analysis.create', 'DecisionAnalysis', randomUUID(), {
        recommendationRef: f.ref(recommendation), title: 'Improve capability B', objective: 'Institutional improvement',
        recommendation: 'Pursue bounded Mission', uncertainty: 'Synthetic-only proof',
      })
      const x = await f.baseRecord('fictional-H1', 'rationale.record', 'GovernanceRationale', randomUUID(), {
        analysisRef: f.ref(analysis), outcome: 'Proceed with M', rationale: 'Evidence and human rationale',
        uncertaintyStatement: 'No deployment authority or actual value claim',
      })
      const originalX = JSON.stringify(x)
      steps.push(6)
      const o = f.source('OperationalChange', 'O', 'approved'), p = f.source('DeploymentChange', 'P', 'approved')
      const j = f.source('Incident', 'J', 'in_progress')
      const originalP = JSON.stringify(f.sourceRows.get(refKey(p)))
      const operationInput = { missionRef: f.ref(m), incidentRefs: [j], problemRefs: [],
        operationalChangeRefs: [o], deploymentChangeRefs: [p], estateRefs: [b, c, d], decisionRefs: [f.ref(x)] }
      let operation = await f.record('fictional-H1', 'operations.link', 'OperationalLink', 'operating-state', operationInput)
      steps.push(7)
      expect(f.store.list(fictionalScope, 'DeploymentChange')).toHaveLength(0)
      expect(f.sourceRows.get(refKey(p))?.value?.status).toBe('approved')
      steps.push(8)
      f.sourceRows.get(refKey(j))!.value!.affectedRefs = [c]
      await f.record('fictional-H1', 'relationship.record', 'InstitutionalRelationship', 'J-C', {
        from: j, to: c, relation: 'AFFECTS', purpose: 'Source-asserted affected service', binding: false, status: 'CURRENT',
      })
      steps.push(9)
      const impact = await f.traverse(c)
      expect(impact.nodes.map(n => n.sourceRef.sourceId).sort()).toEqual(['A', 'B', 'C'])
      expect(impact.causalMeaning).toBe('DEPENDENCY_IMPACT_NOT_CONFIRMED_CAUSATION')
      steps.push(10)
      expect((await f.traverse(c, 'outgoing')).nodes.find(n => n.sourceRef.sourceId === 'D')?.sourceRef.kind).toBe('ExternalDependency')
      steps.push(11)
      const riskInput = {
        category: 'RISK', title: 'R1', description: 'Evidence-backed institutional risk', owner: 'fictional-H1',
        triggerRef: j, sourceScale: 'fictional qualitative', priority: 'HIGH', normalizationRule: 'fictional-v1',
        evidenceRefs: [f.ref(recommendation)], missionRefs: [f.ref(m)], changeRefs: [o],
        decisionRefs: [f.ref(x)], estateRefs: [b, c], technicalDebt: false, blockingRuleRef: 'fictional-required-remediation', dependency: null,
      }
      await f.record('fictional-H1', 'raid.create', 'Raid', 'R1', riskInput)
      await f.record('fictional-H1', 'raid.create', 'Raid', 'D1', { ...riskInput, category: 'DEPENDENCY', title: 'D1',
        dependency: { dependent: f.ref(m), prerequisite: c, requiredCondition: 'active',
          evaluatorVersion: 'fictional-exact-status-v1', neededBy: '2026-10-12T23:00:00.000Z' } })
      const transition = (id: string, next: string, version: number, actor = 'fictional-H1') =>
        f.record(actor, 'raid.transition', 'Raid', id, { next, resolution: 'Reviewed restoration evidence',
          evidenceRefs: [f.ref(accepted)], expiresAt: null }, version)
      await transition('D1', 'confirmed', 1); await transition('D1', 'unmet', 2)
      steps.push(12)
      await f.baseRecord('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 1)
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'blocked' }, 2)
      expect(() => f.foundation.execute('fictional-H1', 'mission.transition',
        f.command('Mission', 'M', { next: 'active' }, 3))).toThrow('MISSION_REQUIRED_RAID_UNRESOLVED')
      steps.push(13)
      const j2 = { ...j, revision: 2 }
      const restoration = f.source('Evidence', 'restoration')
      f.sourceRows.set(refKey(j2), { ...f.sourceRows.get(refKey(j))!, ref: j2,
        value: { ...f.sourceRows.get(refKey(j))!.value!, status: 'resolved', evidenceRefs: [restoration] }, watermark: 'incident-v2' })
      operation = await f.record('fictional-H1', 'operations.link', 'OperationalLink', 'operating-state', { ...operationInput, incidentRefs: [j2] }, 1)
      await transition('R1', 'assessed', 1); await transition('R1', 'mitigating', 2)
      await transition('R1', 'resolved', 3); await transition('R1', 'closed', 4, 'fictional-H2')
      await transition('D1', 'satisfied', 3); await transition('D1', 'closed', 4, 'fictional-H2')
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 3)
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'active' }, 4)
      expect(f.runtime.operations('fictional-H1', f.command('OperationsRead', 'q', { ref: f.ref(operation) })).blockers).toEqual([])
      steps.push(14)
      const baseline = f.source('Evidence', 'baseline'), measurement = f.source('Evidence', 'measurement')
      const benefit = await f.record('fictional-H1', 'benefit.create', 'Benefit', 'V', {
        title: 'V', outcomeDefinition: 'Measured improvement to B', owner: 'fictional-H1', type: 'SERVICE',
        baselineRef: baseline, metric: 'verified improvement', unit: 'points', methodVersion: 'fictional-measurement-v1',
        windowStart: fictionalStart, windowEnd: '2026-10-12T20:30:00.000Z', attributionMethod: 'Synthetic window; no causal generalization',
        forecast: { value: null, basisRef: null, uncertainty: 'No fabricated estimate' },
        criteria: { version: 'fictional-v1', kind: 'NUMERIC_AT_LEAST', threshold: 10, description: 'Score >= 10 with evidence' },
        missionRefs: [f.ref(m)], decisionRefs: [f.ref(x)], changeRefs: [o, p], estateRefs: [b],
      })
      expect(benefitStoredSchema.parse(benefit.data).status).toBe('FORECAST')
      await f.baseRecord('fictional-H1', 'mission.transition', 'Mission', 'M', { next: 'completed', evidenceRefs: [f.ref(recommendation)] }, 5)
      expect(benefitStoredSchema.parse(f.store.get(fictionalScope, 'Benefit', 'V')!.data).status).toBe('FORECAST')
      steps.push(15)
      const observed = await f.record('fictional-H1', 'benefit.observe', 'Benefit', 'V', {
        sourceRefs: [measurement], evidenceRefs: [measurement], uncertainty: 'Fictional measured observation', confounders: ['J restoration is correlated'],
      }, 1)
      expect(benefitStoredSchema.parse(observed.data).status).toBe('OBSERVED')
      steps.push(16)
      const observationRef = benefitStoredSchema.parse(observed.data).observationRefs[0]!
      const realized = await f.record('fictional-H2', 'benefit.accept', 'Benefit', 'V',
        { observationRef, reason: 'Independent internal human verifies window, method, criteria and evidence' }, 2)
      steps.push(17)
      expect(benefitStoredSchema.parse(realized.data).status).toBe('REALIZED')
      steps.push(18)
      for (const item of ['blocked-changes', 'open-incidents', 'human-approvals', 'failed-controls', 'health',
        'active-changes', 'platform-health', 'evidence-status'] satisfies CommandItem[]) f.commandSources.set(item, {
        reads: [], status: 'ILLUSTRATIVE', complete: true, observedAt: f.controls.now, watermark: 'fixture-v1',
        freshness: { policyRef: 'fictional-v1', maxAgeMs: 3600000 }, error: null,
      })
      f.commandSources.get('active-changes')!.reads = [f.sourceRows.get(refKey(o))!, f.sourceRows.get(refKey(p))!]
      f.commandSources.get('open-incidents')!.reads = [f.sourceRows.get(refKey(j2))!]
      const command = await f.readCommand()
      expect(command.items).toHaveLength(22)
      expect(command.errors).toEqual([])
      expect(command.items.find(i => i.kind === 'value-status')?.value?.[0]?.state).toBe('REALIZED')
      expect(command.items.find(i => i.kind === 'pending-decisions')?.value).toEqual([])
      expect(command.items.find(i => i.kind === 'active-missions')?.value?.[0]?.state).toBe('completed')
      expect(command.items.find(i => i.kind === 'external-dependencies')?.value?.[0]?.estate?.classification).toBe('ExternalDependency')
      expect(JSON.stringify(f.sourceRows.get(refKey(p)))).toBe(originalP)
      expect(JSON.stringify(f.store.get(fictionalScope, 'GovernanceRationale', x.id))).toBe(originalX)
      steps.push(19)
      expect(steps).toEqual(Array.from({ length: 19 }, (_, i) => i + 1))
      const sources = [...f.sourceRows], commandSources = [...f.commandSources]
      f.store.close()
      f = syntheticOperating(filename, false)
      for (const [key, value] of sources) f.sourceRows.set(key, value)
      for (const [key, value] of commandSources) f.commandSources.set(key, value)
      const restarted = await f.readCommand()
      expect(restarted.items.map(i => i.kind)).toEqual(commandContracts.map(c => c.item))
      expect(restarted.items.find(i => i.kind === 'value-status')?.value?.[0]?.state).toBe('REALIZED')
      expect((await f.traverse(c)).nodes.map(n => n.sourceRef.sourceId).sort()).toEqual(['A', 'B', 'C'])
      expect(f.store.revisions(fictionalScope, 'Benefit').filter(r => r.id === 'V')).toHaveLength(3)
      const proofs = f.store.list(fictionalScope, 'NarRecord').map(row => row.data as NarRecord), ordered: NarRecord[] = []
      let previous: string | undefined
      while (ordered.length < proofs.length) {
        const next = proofs.find(proof => proof.seal.previousHash === previous)
        if (!next) throw new Error('FIXTURE_NAR_CHAIN_BROKEN')
        ordered.push(next); previous = next.seal.hash
      }
      expect((await verifyFullChain({ organizationId: f.institutionBinding.governanceOrgId, records: ordered,
        signingSecret: 'fictional-local-proof-key-not-production' })).valid).toBe(true)
    } finally {
      f.store.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
