import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import type { InstitutionalReference } from '@nzila/platform-contracts'
import { syntheticFoundation, fictionalScope, fictionalStart } from './synthetic.fixture'
import { InstitutionalFoundationRuntime, type FoundationAction } from './runtime'
import type { StoredInstitutionalRecord } from './local-store'
import { verifyFullChain, type NarRecord } from '@nzila/nar'

describe('Checkpoint 3 Gate E synthetic foundation chain', () => {
  it('enrolls, assigns, creates M/E/R/analysis/X, separately authorizes M and supersedes X across durable local restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nzila-cp3-scenario-'))
    const file = join(dir, 'fictional.sqlite')
    let f = syntheticFoundation(file, false)
    f.assigned.delete('fictional-H1')
    const runtime = new InstitutionalFoundationRuntime(f.boundary)
    const ref = (row: StoredInstitutionalRecord): InstitutionalReference => ({
      scope: row.scope, kind: row.kind, namespace: 'fictional-local', sourceId: row.id, revision: row.version,
    })
    const event = (row: StoredInstitutionalRecord) => z.object({ auditEventId: z.string().uuid() }).parse(row.data).auditEventId
    const command = (kind: string, id: string, payload: unknown, version = 0) =>
      f.command(f.target(kind, id, Math.max(1, version)), payload, version)
    async function recorded(actor: string, action: FoundationAction, kind: string, id: string, payload: unknown, version = 0) {
      const row = runtime.execute(actor, action, command(kind, id, payload, version))
      expect(row.auditDelivery).toBe('PENDING')
      await f.boundary.deliver(row.scope, event(row))
      return f.store.get(row.scope, row.kind, row.id, row.version)!
    }
    try {
      const enrollment = runtime.execute('fictional-H2', 'institution.enroll', command('InstitutionBinding', fictionalScope.id, {}))
      expect(() => f.bindings.institution(fictionalScope, f.controls.now)).toThrow('ENROLLMENT_PROOF_PENDING')
      await f.boundary.deliver(fictionalScope, event(enrollment))
      expect(f.bindings.institution(fictionalScope, f.controls.now).governanceOrgId).toBe(f.institutionBinding.governanceOrgId)
      const assignment = runtime.execute('fictional-H2', 'assignment.create', command('HumanAssignment', 'H1-assignment', {
        principalId: 'fictional-H1', effectiveAt: fictionalStart, expiresAt: '2026-10-13T00:00:00.000Z',
      }))
      expect(f.authority.ports.assignedInternalHuman('fictional-H1', fictionalScope)).toBe(false)
      await f.boundary.deliver(fictionalScope, event(assignment))
      expect(f.authority.ports.assignedInternalHuman('fictional-H1', fictionalScope)).toBe(true)
      const m = await recorded('fictional-H1', 'mission.create', 'Mission', 'M', {
        title: 'Fictional M', desiredOutcome: 'Review fictional capability recommendation',
        acceptanceCriteria: ['Recommendation reviewed'], accountableOwner: 'fictional-H1', executionOwner: 'fictional-agent',
      })
      expect(m.data).toMatchObject({ status: 'proposed', executionOwner: 'fictional-agent' })
      await recorded('fictional-H1', 'engagement.create', 'SpecialistEngagement', 'E', {
        sponsor: 'fictional-H1', counterpart: 'fictional-H2', specialist: 'fictional-specialist',
        effectiveAt: fictionalStart, expiresAt: '2026-10-12T23:00:00.000Z',
      })
      await recorded('fictional-H2', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'APPROVED' }, 1)
      const e = await recorded('fictional-H1', 'engagement.transition', 'SpecialistEngagement', 'E', { next: 'ACTIVE' }, 2)
      const r = await recorded('fictional-specialist', 'recommendation.submit', 'Recommendation', 'R', {
        engagementRef: ref(e), content: 'Fictional recommendation, no approval or authority.',
      })
      expect(r.data).toMatchObject({ status: 'SUBMITTED', producer: 'fictional-specialist' })
      await recorded('fictional-H2', 'output.accept', 'OutputAcceptance', 'R-disposition', {
        outputRef: ref(r), criteria: 'Recommendation reviewed',
      })
      const analysis = await recorded('fictional-H1', 'analysis.create', 'DecisionAnalysis', randomUUID(), {
        recommendationRef: ref(r), title: 'Evaluate R', objective: 'Compare bounded work options',
        recommendation: 'Consider an improvement', uncertainty: 'Synthetic only; no live measurements',
      })
      expect(analysis.data).toMatchObject({ analysis: { status: 'drafting', allApproversSignedOff: false } })
      const rationalePayload = {
        analysisRef: ref(analysis), outcome: 'Pursue bounded Mission', rationale: 'Named human choice after analysis',
        uncertaintyStatement: 'Not deployment authorization',
      }
      const pendingX = runtime.execute('fictional-H1', 'rationale.record',
        command('GovernanceRationale', randomUUID(), rationalePayload))
      f.controls.auditUnavailable = true
      await expect(f.boundary.deliver(fictionalScope, event(pendingX))).rejects.toThrow('FIXTURE_NAR_UNAVAILABLE')
      const xRead = command('GovernanceRationale', pendingX.id, {}, 1)
      expect(() => runtime.effectiveRationale('fictional-H1', xRead)).toThrow('AUDIT_PROOF_PENDING')
      expect(f.store.get(fictionalScope, 'Mission', 'M')?.data).toMatchObject({ status: 'proposed' })
      f.controls.auditUnavailable = false
      await f.boundary.deliver(fictionalScope, event(pendingX))
      const x = runtime.effectiveRationale('fictional-H1', xRead)
      const original = JSON.stringify(x)
      const authorized = await recorded('fictional-H2', 'mission.transition', 'Mission', 'M', { next: 'authorized' }, 1)
      expect(authorized.data).toMatchObject({ status: 'authorized' })
      await recorded('fictional-agent', 'mission.transition', 'Mission', 'M', { next: 'active' }, 2)
      for (const mode of ['deployment-substitute', 'mission-substitute', 'rationale-substitute']) {
        f.controls.decisionMode = mode
        expect(() => f.authority.resolve('fictional-H1', 'deployment.authorize',
          command('DeploymentChange', 'P', {}))).toThrow('INVALID_OR_STALE_AUTHORIZATION')
      }
      f.controls.decisionMode = 'valid'
      const x2 = await recorded('fictional-H1', 'rationale.supersede', 'GovernanceRationale', randomUUID(),
        { ...rationalePayload, predecessorRef: ref(x), outcome: 'Revised bounded choice' })
      expect(JSON.stringify(f.store.get(fictionalScope, 'GovernanceRationale', x.id))).toBe(original)
      expect(() => runtime.effectiveRationale('fictional-H1', xRead)).toThrow('RATIONALE_SUPERSEDED')
      f.store.close()
      f = syntheticFoundation(file, false)
      f.assigned.delete('fictional-H1')
      const restarted = new InstitutionalFoundationRuntime(f.boundary)
      expect(f.authority.ports.assignedInternalHuman('fictional-H1', fictionalScope)).toBe(true)
      expect(JSON.stringify(f.store.get(fictionalScope, 'GovernanceRationale', x.id))).toBe(original)
      expect(restarted.effectiveRationale('fictional-H1', command('GovernanceRationale', x2.id, {}, 1)).id).toBe(x2.id)
      expect(f.store.successor(fictionalScope, x.id)).toBe(x2.id)
      expect(f.store.list(fictionalScope, 'AuditIntent').length).toBeGreaterThan(10)
      const proofs = f.store.list(fictionalScope, 'NarRecord').map(row => row.data as NarRecord)
      const ordered: NarRecord[] = []
      let previousHash: string | undefined
      while (ordered.length < proofs.length) {
        const next = proofs.find(proof => proof.seal.previousHash === previousHash)
        if (!next) throw new Error('FIXTURE_NAR_CHAIN_BROKEN')
        ordered.push(next)
        previousHash = next.seal.hash
      }
      expect((await verifyFullChain({
        organizationId: f.institutionBinding.governanceOrgId, records: ordered,
        signingSecret: 'fictional-local-proof-key-not-production',
      })).valid).toBe(true)
    } finally {
      f.store.close()
      rmSync(dir, { recursive: true })
    }
  })

  it('rejects cross-scope recommendation/reference mutations without a source grant', () => {
    const f = syntheticFoundation()
    const runtime = new InstitutionalFoundationRuntime(f.boundary)
    try {
      const foreign: InstitutionalReference = {
        scope: { type: 'PLATFORM_INSTITUTION', id: 'fictional-other' },
        namespace: 'fictional-local', kind: 'Recommendation', sourceId: 'R', revision: 1,
      }
      expect(() => runtime.execute('fictional-H1', 'analysis.create',
        f.command(f.target('DecisionAnalysis', randomUUID()), {
          recommendationRef: foreign, title: 'x', objective: 'x', recommendation: 'x', uncertainty: 'x',
        }))).toThrow('CROSS_SCOPE_REFERENCE_DENIED')
      expect(f.store.list(fictionalScope, 'DecisionAnalysis')).toHaveLength(0)
    } finally { f.store.close() }
  })
})
