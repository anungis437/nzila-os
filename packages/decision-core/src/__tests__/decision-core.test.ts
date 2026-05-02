import { describe, expect, it } from 'vitest'

import { enforceDecision, getDecisionType, listDecisionTypes } from '..'

describe('@nzila/decision-core', () => {
  it('registers default decision types across multiple domains', () => {
    const registryEntries = listDecisionTypes()
    const domains = new Set(registryEntries.map((entry) => entry.domain))

    expect(registryEntries.length).toBeGreaterThanOrEqual(5)
    expect(domains.size).toBeGreaterThanOrEqual(3)
    expect(getDecisionType('union.grievance.intake.submitted')?.requiredPolicy).toBe('labour.grievance.intake')
  })

  it('approves a valid decision with proof adapter and audit payload', async () => {
    const evaluation = await enforceDecision({
      decisionType: 'flow.quote.created',
      organizationId: 'org-123',
      resourceId: 'quote-123',
      actor: {
        id: 'user-1',
        type: 'user',
        role: 'sales_manager',
      },
      authorityScope: ['quote:create'],
      input: {
        title: 'Spring Produce Order',
        customerId: 'customer-42',
      },
      policy: {
        id: 'commerce.quote.approval',
        version: '1.0.0',
        domain: 'commerce',
      },
      actionType: 'quote:create',
      proofAdapter: {
        async createProof() {
          return {
            auditRecordId: 'audit-1',
            hash: 'a'.repeat(64),
            signature: 'b'.repeat(64),
            previousHash: 'c'.repeat(64),
            verified: true,
          }
        },
      },
      emitAuditPayload: true,
    })

    expect(evaluation.allowed).toBe(true)
    expect(evaluation.decision.outcome.status).toBe('approved')
    expect(evaluation.auditPayload?.narCompatible).toBe(true)
    expect(evaluation.auditPayload?.proof?.hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects a decision when authority or required fields are missing', async () => {
    const evaluation = await enforceDecision({
      decisionType: 'union.grievance.intake.submitted',
      organizationId: 'org-123',
      resourceId: 'claim-123',
      actor: {
        id: 'user-2',
        type: 'user',
      },
      authorityScope: [],
      input: {
        title: 'Missing fields',
      },
      policy: {
        id: 'labour.grievance.intake',
        version: '1.0.0',
        domain: 'labour',
      },
    })

    expect(evaluation.allowed).toBe(false)
    expect(evaluation.authority.valid).toBe(false)
    expect(evaluation.missingInputFields).toEqual(['memberId', 'caseType', 'incidentDate'])
    expect(evaluation.decision.outcome.reasonCode).toBe('AUTHORITY_SCOPE_MISSING')
  })

  it('blocks when proof is required but no adapter is provided', async () => {
    const evaluation = await enforceDecision({
      decisionType: 'platform.workflow.authorized',
      organizationId: 'org-123',
      resourceId: 'workflow-123',
      actor: {
        id: 'system-1',
        type: 'system',
      },
      authorityScope: ['workflow:authorize'],
      input: {
        workflowId: 'wf-1',
        requestId: 'req-1',
      },
      policy: {
        id: 'platform.workflow.authorization',
        version: '1.0.0',
        domain: 'platform',
      },
    })

    expect(evaluation.allowed).toBe(false)
    expect(evaluation.decision.outcome.reasonCode).toBe('PROOF_ADAPTER_REQUIRED')
  })

  it('warn-level decisions can proceed without proof adapter', async () => {
    const evaluation = await enforceDecision({
      decisionType: 'zonga.rights.validated',
      organizationId: 'org-123',
      resourceId: 'asset-1',
      actor: {
        id: 'user-2',
        type: 'user',
      },
      authorityScope: ['rights:validate'],
      input: {
        assetId: 'asset-1',
      },
      policy: {
        id: 'media.rights.validation',
        version: '1.0.0',
        domain: 'media',
      },
      emitAuditPayload: true,
    })

    expect(evaluation.allowed).toBe(true)
    expect(evaluation.decision.outcome.status).toBe('approved')
  })
})