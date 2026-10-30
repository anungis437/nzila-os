import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkflow, executeStep } from '../src/workflowRunner'
import { verifyOutcomeEvidence, isVerifiedOutcomeFor } from '../src/outcome-proof'
import { verifyOutcomePolicy } from '../src/policy-permit'
import { agentWorkflowSchema } from '../src/types'
import { generateRecommendations } from '../src/recommendations'
import * as packageExports from '../src/index'
import { getAuditTimeline, clearAuditTimeline } from '@nzila/platform-governance'

const COMMIT = 'a'.repeat(40)
const DIGEST = 'sha256:' + 'b'.repeat(64)

async function validProof(wf: ReturnType<typeof createWorkflow>, stepId: string) {
  const request = {
    workflowId: wf.id, stepId, app: wf.app, orgId: wf.orgId,
    executingAgentId: 'implementer-agent', commitSha: COMMIT,
    artifactDigest: DIGEST, evidenceRefs: ['ci://test/1'],
  }
  return verifyOutcomeEvidence(request, {
    verify: async r => ({
      verdict: 'PASS', verificationRef: 'ci://independent-verifier/1',
      verifierId: 'independent-checker', source: 'trusted-host',
      verifiedAt: '2026-10-30T12:00:00.000Z',
      checkedCommitSha: r.commitSha, checkedArtifactDigest: r.artifactDigest,
      checkedEvidenceRefs: r.evidenceRefs,
    }),
  })
}
async function validPolicy(wf: ReturnType<typeof createWorkflow>, stepId: string, policyId = 'p1') {
  const request = {
    workflowId: wf.id, stepId, app: wf.app, orgId: wf.orgId,
    policyId, executingAgentId: 'implementer-agent',
  }
  return verifyOutcomePolicy(request, {
    resolve: async r => ({
      verdict: 'ALLOW', decisionRef: 'policy://test/1', authoritySource: 'trusted-host-policy',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      boundWorkflowId: r.workflowId, boundStepId: r.stepId,
      boundApp: r.app, boundOrgId: r.orgId, boundPolicyId: r.policyId,
    }),
  })
}

const make = (app = 'cfo', steps = ['step-1']) => createWorkflow({
  name: 'test', triggerEvent: 'test', app, orgId: 'org-1',
  steps: steps.map(name => ({ name })),
})

describe('platform-agent-workflows P0 outcome controls', () => {
  beforeEach(() => clearAuditTimeline())

  it('starts with pending steps', () => {
    const wf = make()
    expect(wf.steps[0].status).toBe('pending')
    expect(wf.status).toBe('pending')
  })

  it('rejects completion with policy allow but without independent evidence', () => {
    const wf = make()
    const result = executeStep(wf, wf.steps[0].id, {
      policyCheck: { policyId: 'p1', result: 'allow' }, output: { done: true },
    })
    expect(result.status).toBe('blocked')
    expect(result.steps[0].status).toBe('blocked')
    expect(agentWorkflowSchema.safeParse({ ...result, status: 'completed' }).success).toBe(false)
    expect(getAuditTimeline({ eventType: 'workflow_step_executed' })[0].policyResult).toBe('fail')
  })

  it('a claimed policy ALLOW is not an authorization receipt', async () => {
    const wf = make()
    const proof = await validProof(wf, wf.steps[0].id)
    const spoof = { request: { workflowId: wf.id, stepId: wf.steps[0].id }, decision: { verdict: 'ALLOW' } }
    expect(executeStep(wf, wf.steps[0].id, {
      policyCheck: { policyId: 'p1', result: 'allow' },
      verifiedPolicy: spoof as never, verifiedOutcome: proof,
    }).status).toBe('blocked')
  })

  it('rejects completion without explicit policy allow', async () => {
    const wf = make()
    const proof = await validProof(wf, wf.steps[0].id)
    expect(executeStep(wf, wf.steps[0].id, { verifiedOutcome: proof }).status).toBe('blocked')
    expect(executeStep(wf, wf.steps[0].id, {
      policyCheck: { policyId: 'p', result: 'requires_approval' }, verifiedOutcome: proof,
    }).status).toBe('blocked')
    expect(executeStep(wf, wf.steps[0].id, {
      policyCheck: { policyId: 'p', result: 'deny' }, verifiedOutcome: proof,
    }).status).toBe('blocked')
  })

  it('accepts only minted, scope-bound independently verified proof', async () => {
    const wf = make()
    const proof = await validProof(wf, wf.steps[0].id)
    const permit = await validPolicy(wf, wf.steps[0].id)
    const result = executeStep(wf, wf.steps[0].id, {
      policyCheck: { policyId: 'p1', result: 'allow' },
      verifiedOutcome: proof,
      verifiedPolicy: permit,
      output: { done: true },
    })
    expect(result.status).toBe('completed')
    expect(result.steps[0].outcomeEvidence?.phase).toBe('VERIFIED')
    expect(agentWorkflowSchema.safeParse(result).success).toBe(true)
    const restored = JSON.parse(JSON.stringify(result))
    expect(isVerifiedOutcomeFor(restored.steps[0].outcomeEvidence, wf, wf.steps[0].id)).toBe(false)
    expect(getAuditTimeline({ eventType: 'workflow_step_executed' })[0].policyResult).toBe('pass')
    const forged = JSON.parse(JSON.stringify(proof))
    expect(isVerifiedOutcomeFor(forged, wf, wf.steps[0].id)).toBe(false)
    const forgedWorkflow = { ...wf, id: 'another-workflow', orgId: 'another-org' }
    expect(executeStep(forgedWorkflow, wf.steps[0].id, {
      policyCheck: { policyId: 'p1', result: 'allow' },
      verifiedOutcome: proof, verifiedPolicy: permit,
    }).status).toBe('blocked')
    expect(() => executeStep(result, result.steps[0].id, { verifiedOutcome: proof })).toThrow('immutable')
  })

  it('prevents proof replay across workflow/step/org and rejects mismatched evidence', async () => {
    const wf = make('web', ['one', 'two'])
    const proof = await validProof(wf, wf.steps[0].id)
    const result = executeStep(wf, wf.steps[1].id, {
      policyCheck: { policyId: 'p', result: 'allow' }, verifiedOutcome: proof,
    })
    expect(result.steps[1].status).toBe('blocked')
    await expect(verifyOutcomeEvidence({
      ...proof.request, executingAgentId: 'same-id',
    }, { verify: async r => ({
      verdict: 'PASS', verifierId: 'same-id', verificationRef: 'x', source: 'x',
      verifiedAt: '2026-10-30T12:00:00.000Z', checkedCommitSha: r.commitSha,
      checkedArtifactDigest: r.artifactDigest, checkedEvidenceRefs: r.evidenceRefs,
    }) })).rejects.toThrow('not established')
  })

  it('does not accept arbitrary serialized completed workflow without evidence', () => {
    const wf = make()
    const corrupted = { ...wf, status: 'completed', steps: [{ ...wf.steps[0], status: 'completed' }] }
    expect(agentWorkflowSchema.safeParse(corrupted).success).toBe(false)
  })

  it('remains compatible with recommendation handling for blocked steps', () => {
    const wf = make()
    const denied = executeStep(wf, wf.steps[0].id, {
      policyCheck: { policyId: 'p1', result: 'deny' },
    })
    const recs = generateRecommendations(denied)
    expect(recs).toHaveLength(1)
    expect(recs[0].humanReviewRequired).toBe(true)
  })

  it('exports outcome proof functionality but not any release-authorizing function', () => {
    expect(packageExports.verifyOutcomePolicy).toBeTypeOf('function')
    expect(packageExports.verifyOutcomeEvidence).toBeTypeOf('function')
    expect(packageExports.executeStep).toBeTypeOf('function')
    expect('authorizeRelease' in packageExports).toBe(false)
  })
})
