import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest'
import type { OrgContext } from '@nzila/org/context'
import type { PolicyEvaluationOutput } from '@nzila/platform-policy-engine'
import type { CoraEvidenceRecordDraft } from './contracts'
import {
  CORA_EVIDENCE_WRITE_PERMISSION,
  CoraEvidenceAuthorizationError,
  createCoraEvidenceService,
  type CoraEvidencePersistencePort,
  type CoraEvidenceServicePorts,
} from './service'

const hash = 'a'.repeat(64)
const context: OrgContext = {
  orgId: '00000000-0000-0000-0000-000000000001',
  actorId: 'actor-1',
  role: 'analyst',
  permissions: [CORA_EVIDENCE_WRITE_PERMISSION],
  requestId: 'request-1',
}

const evidenceDraft: CoraEvidenceRecordDraft = {
  evidenceType: 'market-observation',
  purpose: 'market-analysis',
  consentRef: 'consent-1',
  source: { system: 'market-feed', recordId: 'quote-1' },
  temporalScope: { observedAt: '2026-09-01T12:00:00.000Z' },
  methodology: {
    id: '00000000-0000-0000-0000-000000000002',
    authorityId: 'market-authority',
    methodologyId: 'market-method',
    version: '2',
    definitionSha256: hash,
  },
  provenanceRef: 'prov-1',
  payloadSha256: hash,
  confidence: { level: 'medium', basis: 'Single-source observation' },
  dataQuality: {
    completeness: 'partial',
    freshness: 'current',
    traceability: 'direct',
    limitations: ['One market source'],
  },
}

const policyOutput: PolicyEvaluationOutput = {
  evaluationId: 'evaluation-1',
  policyId: 'cora-evidence-use',
  input: {
    policyId: 'cora-evidence-use',
    actor: { userId: context.actorId, roles: [context.role], orgRole: context.role },
    action: 'evidence.record',
    resource: 'cora:evidence',
    context: {
      purpose: evidenceDraft.purpose,
      consentRef: evidenceDraft.consentRef,
      recipient: 'cora',
      requestId: context.requestId,
    },
    orgId: context.orgId,
    environment: 'test',
  },
  decisions: [],
  overallResult: 'pass',
  evaluatedAt: '2026-09-01T12:00:00.000Z',
  durationMs: 1,
}

describe('Cora evidence service boundary', () => {
  let persistence: CoraEvidencePersistencePort
  let authorizeConsentUse: MockedFunction<CoraEvidenceServicePorts['authorizeConsentUse']>
  let evaluateAndAuditPolicy: MockedFunction<CoraEvidenceServicePorts['evaluateAndAuditPolicy']>
  let service: ReturnType<typeof createCoraEvidenceService>

  beforeEach(() => {
    persistence = {
      appendEvidence: vi.fn(async (_ctx, record) => record),
      appendConclusion: vi.fn(async (_ctx, conclusion) => conclusion),
    }
    authorizeConsentUse = vi.fn(async (request) => ({
      status: 'granted' as const,
      consentRef: request.consentRef,
      evaluatedAt: '2026-09-01T12:00:00.000Z',
    }))
    evaluateAndAuditPolicy = vi.fn(async (input) => [
      {
        ...policyOutput,
        input,
        policyId: input.policyId,
      },
    ])
    service = createCoraEvidenceService({
      persistence,
      authorizeConsentUse,
      evaluateAndAuditPolicy,
      environment: 'test',
    })
  })

  it('requires the explicit Cora write permission before authorization or persistence', async () => {
    await expect(
      service.recordEvidence({ ...context, permissions: ['agri:read'] }, evidenceDraft),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    expect(authorizeConsentUse).not.toHaveBeenCalled()
    expect(persistence.appendEvidence).not.toHaveBeenCalled()
  })

  it('uses explicit consent and passing canonical policy before persistence', async () => {
    const result = await service.recordEvidence(context, evidenceDraft)
    expect(result.orgId).toBe(context.orgId)
    expect(authorizeConsentUse).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: evidenceDraft.purpose,
        recipient: 'cora',
        consentRef: evidenceDraft.consentRef,
      }),
    )
    expect(evaluateAndAuditPolicy).toHaveBeenCalledOnce()
    expect(persistence.appendEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: context.orgId, actorId: context.actorId }),
      expect.objectContaining({ orgId: context.orgId }),
      expect.objectContaining({
        action: 'evidence.record',
        orgId: context.orgId,
        actorId: context.actorId,
        requestId: context.requestId,
        authorization: expect.objectContaining({ consentRef: evidenceDraft.consentRef }),
      }),
    )
  })

  it.each([
    { status: 'denied', consentRef: 'consent-1', evaluatedAt: '2026-09-01T12:00:00.000Z' },
    { status: 'unknown', consentRef: 'consent-1', evaluatedAt: '2026-09-01T12:00:00.000Z' },
    { status: 'granted', consentRef: 'other-consent', evaluatedAt: '2026-09-01T12:00:00.000Z' },
  ] as const)('fails closed when consent is $status or mismatched', async (decision) => {
    authorizeConsentUse.mockResolvedValue(decision)
    await expect(service.recordEvidence(context, evidenceDraft)).rejects.toBeInstanceOf(
      CoraEvidenceAuthorizationError,
    )
    expect(evaluateAndAuditPolicy).not.toHaveBeenCalled()
    expect(persistence.appendEvidence).not.toHaveBeenCalled()
  })

  it('fails closed when no applicable policy is returned', async () => {
    evaluateAndAuditPolicy.mockResolvedValue([])
    await expect(service.recordEvidence(context, evidenceDraft)).rejects.toBeInstanceOf(
      CoraEvidenceAuthorizationError,
    )
    expect(persistence.appendEvidence).not.toHaveBeenCalled()
  })

  it('fails closed for policy denial, approval, or mismatched tenant/actor scope', async () => {
    for (const altered of [
      { ...policyOutput, overallResult: 'fail' as const },
      { ...policyOutput, overallResult: 'require_approval' as const },
      { ...policyOutput, input: { ...policyOutput.input, orgId: 'other-org' } },
      {
        ...policyOutput,
        input: { ...policyOutput.input, actor: { userId: 'other-actor', roles: [] } },
      },
    ]) {
      evaluateAndAuditPolicy.mockResolvedValue([altered])
      await expect(service.recordEvidence(context, evidenceDraft)).rejects.toBeInstanceOf(
        CoraEvidenceAuthorizationError,
      )
    }
    expect(persistence.appendEvidence).not.toHaveBeenCalled()
  })

  it('rejects invalid temporal/data-quality contracts before authorization', async () => {
    await expect(
      service.recordEvidence(context, {
        ...evidenceDraft,
        temporalScope: {
          observedAt: '2026-09-01T12:00:00.000Z',
          validFrom: '2026-09-03T00:00:00.000Z',
          validTo: '2026-09-02T00:00:00.000Z',
        },
      }),
    ).rejects.toThrow()
    expect(authorizeConsentUse).not.toHaveBeenCalled()
    expect(persistence.appendEvidence).not.toHaveBeenCalled()
  })

  it('passes persistence failures back to the caller without a success-shaped fallback', async () => {
    vi.mocked(persistence.appendEvidence).mockRejectedValue(new Error('store unavailable'))
    await expect(service.recordEvidence(context, evidenceDraft)).rejects.toThrow(
      'store unavailable',
    )
  })

  it('does not silently infer an environment for policy evaluation', () => {
    expect(() =>
      createCoraEvidenceService({
        persistence,
        authorizeConsentUse,
        evaluateAndAuditPolicy,
        environment: ' ',
      }),
    ).toThrow('environment must be explicitly configured')
  })
})
