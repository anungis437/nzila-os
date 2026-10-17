import { randomUUID } from 'node:crypto'
import type { DbContext, OrgContext } from '@nzila/org/context'
import { assertSameOrg, requireOrgScope, requirePermission } from '@nzila/org/guards'
import { toDbContext } from '@nzila/org/context'
import type { PolicyEvaluationInput, PolicyEvaluationOutput } from '@nzila/platform-policy-engine'
import {
  coraConclusionDraftSchema,
  coraEvidenceRecordDraftSchema,
  type CoraConclusion,
  type CoraConclusionDraft,
  type CoraEvidenceRecord,
  type CoraEvidenceRecordDraft,
} from './contracts'

export const CORA_EVIDENCE_WRITE_PERMISSION = 'cora:evidence:write'

export interface ConsentUseRequest {
  readonly orgId: string
  readonly actorId: string
  readonly consentRef: string
  readonly purpose: string
  readonly recipient: 'cora'
  readonly source: CoraEvidenceRecordDraft['source']
}

export interface ConsentUseDecision {
  readonly status: 'granted' | 'denied' | 'unknown'
  readonly consentRef: string
  readonly evaluatedAt: string
}

export interface CoraEvidenceAuthorization {
  readonly consentRef?: string
  readonly consentEvaluatedAt?: string
  readonly policyEvaluationIds: readonly string[]
}

export interface CoraEvidenceAuditIntent {
  readonly action: 'evidence.record' | 'conclusion.record'
  readonly orgId: string
  readonly actorId: string
  readonly requestId: string
  readonly resourceId: string
  readonly authorization: CoraEvidenceAuthorization
}

export interface CoraEvidencePersistencePort {
  readonly appendEvidence: (
    context: DbContext,
    record: CoraEvidenceRecord,
    audit: CoraEvidenceAuditIntent,
  ) => Promise<CoraEvidenceRecord>
  readonly appendConclusion: (
    context: DbContext,
    conclusion: CoraConclusion,
    audit: CoraEvidenceAuditIntent,
  ) => Promise<CoraConclusion>
}

export interface CoraEvidenceServicePorts {
  readonly persistence: CoraEvidencePersistencePort
  readonly authorizeConsentUse: (request: ConsentUseRequest) => Promise<ConsentUseDecision>
  readonly evaluateAndAuditPolicy: (
    input: PolicyEvaluationInput,
  ) => Promise<readonly PolicyEvaluationOutput[]>
  readonly environment: string
}

export class CoraEvidenceAuthorizationError extends Error {
  readonly code = 'CORA_EVIDENCE_AUTHORIZATION_DENIED' as const

  constructor(message: string) {
    super(message)
    this.name = 'CoraEvidenceAuthorizationError'
  }
}

function requirePolicyAuthorization(
  outputs: readonly PolicyEvaluationOutput[],
  input: PolicyEvaluationInput,
): CoraEvidenceAuthorization['policyEvaluationIds'] {
  if (outputs.length === 0) {
    throw new CoraEvidenceAuthorizationError(
      'No applicable canonical policy authorized this operation',
    )
  }

  for (const output of outputs) {
    const evaluated = output.input
    if (
      evaluated.orgId !== input.orgId ||
      evaluated.actor.userId !== input.actor.userId ||
      evaluated.action !== input.action ||
      evaluated.resource !== input.resource ||
      evaluated.environment !== input.environment ||
      output.policyId !== evaluated.policyId ||
      output.overallResult !== 'pass'
    ) {
      throw new CoraEvidenceAuthorizationError('Canonical policy did not authorize this operation')
    }
  }

  return outputs.map((output) => output.evaluationId)
}

function policyInput(
  context: OrgContext,
  environment: string,
  action: CoraEvidenceAuditIntent['action'],
  purpose: string,
  consentRef?: string,
): PolicyEvaluationInput {
  return {
    policyId: 'cora-evidence-use',
    actor: {
      userId: context.actorId,
      roles: [context.role],
      orgRole: context.role,
    },
    action: `cora:${action.replace('.', ':')}`,
    resource: 'cora:evidence',
    context: {
      purpose,
      ...(consentRef ? { consentRef } : {}),
      recipient: 'cora',
      requestId: context.requestId,
    },
    orgId: context.orgId,
    environment,
  }
}

export function createCoraEvidenceService(ports: CoraEvidenceServicePorts) {
  if (!ports.environment.trim()) {
    throw new Error('Cora evidence environment must be explicitly configured')
  }

  async function authorizePolicy(
    context: OrgContext,
    action: CoraEvidenceAuditIntent['action'],
    purpose: string,
    consentRef?: string,
  ): Promise<CoraEvidenceAuthorization['policyEvaluationIds']> {
    requireOrgScope(context)
    requirePermission(context, CORA_EVIDENCE_WRITE_PERMISSION)
    const input = policyInput(context, ports.environment, action, purpose, consentRef)
    return requirePolicyAuthorization(await ports.evaluateAndAuditPolicy(input), input)
  }

  async function authorizeEvidenceUse(
    context: OrgContext,
    action: CoraEvidenceAuditIntent['action'],
    purpose: string,
    consentRef: string,
    source: CoraEvidenceRecordDraft['source'],
  ): Promise<CoraEvidenceAuthorization> {
    requireOrgScope(context)
    requirePermission(context, CORA_EVIDENCE_WRITE_PERMISSION)
    const consent = await ports.authorizeConsentUse({
      orgId: context.orgId,
      actorId: context.actorId,
      consentRef,
      purpose,
      recipient: 'cora',
      source,
    })
    if (consent.status !== 'granted' || consent.consentRef !== consentRef) {
      throw new CoraEvidenceAuthorizationError('Canonical consent did not authorize this use')
    }
    return {
      consentRef: consent.consentRef,
      consentEvaluatedAt: consent.evaluatedAt,
      policyEvaluationIds: await authorizePolicy(context, action, purpose, consentRef),
    }
  }

  function auditIntent(
    context: OrgContext,
    action: CoraEvidenceAuditIntent['action'],
    resourceId: string,
    authorization: CoraEvidenceAuthorization,
  ): CoraEvidenceAuditIntent {
    return {
      action,
      orgId: context.orgId,
      actorId: context.actorId,
      requestId: context.requestId,
      resourceId,
      authorization,
    }
  }

  return {
    async recordEvidence(
      context: OrgContext,
      input: CoraEvidenceRecordDraft,
    ): Promise<CoraEvidenceRecord> {
      requireOrgScope(context)
      requirePermission(context, CORA_EVIDENCE_WRITE_PERMISSION)
      const draft = coraEvidenceRecordDraftSchema.parse(input)
      const authorization = await authorizeEvidenceUse(
        context,
        'evidence.record',
        draft.purpose,
        draft.consentRef,
        draft.source,
      )
      const now = new Date().toISOString()
      const record: CoraEvidenceRecord = {
        ...draft,
        id: randomUUID(),
        orgId: context.orgId,
        createdBy: context.actorId,
        createdAt: now,
      }
      return ports.persistence.appendEvidence(
        toDbContext(context),
        record,
        auditIntent(context, 'evidence.record', record.id, authorization),
      )
    },

    async recordConclusion(
      context: OrgContext,
      input: CoraConclusionDraft,
    ): Promise<CoraConclusion> {
      requireOrgScope(context)
      requirePermission(context, CORA_EVIDENCE_WRITE_PERMISSION)
      const draft = coraConclusionDraftSchema.parse(input)
      const authorization = await authorizeEvidenceUse(
        context,
        'conclusion.record',
        draft.purpose,
        draft.consentRef,
        {
          system: 'cora-evidence',
          recordId: draft.evidence.map((item) => item.evidenceId).join(','),
        },
      )
      const now = new Date().toISOString()
      const record: CoraConclusion = {
        ...draft,
        id: randomUUID(),
        orgId: context.orgId,
        createdBy: context.actorId,
        generatedAt: now,
        createdAt: now,
      }
      assertSameOrg(context, record.orgId)
      return ports.persistence.appendConclusion(
        toDbContext(context),
        record,
        auditIntent(context, 'conclusion.record', record.id, authorization),
      )
    },
  }
}
