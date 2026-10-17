import { buildSyntheticOrganicJourney } from '../../evidence-reuse/fixtures/synthetic-organic-journey'
import { assertionCandidateDigest } from '../../evidence-reuse/authority'
import { candidateFromAssertion } from '../../evidence-reuse/resolve-use'
import type { CoraAuthorizationContext } from '../../resolve-org'
import {
  WORKFLOW_PERMISSION,
  DISPOSITION_PERMISSION,
  WorkflowDenied,
  type WorkflowPorts,
  type RequirementDefinition,
  type EvidenceDefinition,
  type WorkflowRequest,
  type WorkflowFrictionEvent,
} from '../contracts'
import { createSyntheticWorkflowStorage } from '../ledger'
import { createInstitutionalWorkflowService } from '../service'

export function buildSyntheticWorkflowRuntime() {
  const journey = buildSyntheticOrganicJourney()
  let time = journey.attempt.at
  let context: CoraAuthorizationContext = {
    orgId: journey.capsule.orgId,
    actorId: 'synthetic-operator',
    appId: 'cora',
    identityBindingId: 'synthetic-binding',
    identityBindingState: 'active',
    membershipRoleSource: 'canonical',
    membershipId: 'synthetic-member',
    membershipState: 'active',
    identityProvider: 'synthetic',
    correlationId: 'synthetic-correlation',
    role: 'operator',
    permissions: [WORKFLOW_PERMISSION],
    requestId: 'synthetic-request',
    authorizationAudit: {
      event: 'application_authorization',
      decision: 'ALLOW',
      reason: 'SYNTHETIC_ONLY',
      identityProvider: 'synthetic',
      externalIdentityReference: 'synthetic-subject',
      applicationId: 'cora',
      occurredAt: time,
      correlationId: 'synthetic-correlation',
    },
  }
  const definitions = new Map<string, RequirementDefinition>()
  const evidence = new Map<string, EvidenceDefinition>()
  const recipientRights = new Map<string, typeof journey.assertion.support.rights>()
  for (const use of [journey.attempt.originating, journey.attempt.consuming]) {
    const { assertion: _assertion, supplementalAssertions: _supplement, ...definition } = use
    definitions.set(`${use.requirement.requirementRef}@${use.requirement.requirementVersion}`, {
      orgId: context.orgId,
      use: structuredClone(definition),
      superseded: false,
    })
    recipientRights.set(use.requirement.recipientId, structuredClone(use.requirement.rights))
  }
  evidence.set(`${journey.assertion.evidence.evidenceId}@${journey.assertion.evidence.version}`, {
    orgId: context.orgId,
    assertion: structuredClone(journey.assertion),
  })
  const sourceRights = structuredClone(journey.assertion.support.rights)
  const denials: string[] = []
  const actions = new Map<string, WorkflowFrictionEvent>()
  const storage = createSyntheticWorkflowStorage()
  const ports: WorkflowPorts = {
    storage,
    resolveContext: async () => structuredClone(context),
    now: () => time,
    recordDenial: async (_context, reason) => {
      denials.push(reason)
    },
    loadRequirement: async (orgId, ref) => {
      const found = definitions.get(`${ref.id}@${ref.version}`)
      if (!found || found.orgId !== orgId)
        throw new WorkflowDenied('Requirement tenant access denied')
      return structuredClone(found)
    },
    loadEvidence: async (orgId, ref) => {
      const found = evidence.get(`${ref.id}@${ref.version}`)
      if (!found || found.orgId !== orgId) throw new WorkflowDenied('Evidence tenant access denied')
      return structuredClone(found)
    },
    authorize: async (actor, use) => {
      if (actor.actorId !== 'synthetic-operator' && actor.actorId !== 'synthetic-recipient-agent')
        throw new WorkflowDenied('Actor not authorized')
      const rights = recipientRights.get(use.requirement.recipientId)
      if (!rights) throw new WorkflowDenied('Missing recipient authorization')
      return structuredClone(rights)
    },
    authorizeSource: async () => structuredClone(sourceRights),
    authority: {
      resolveBinding: (ref) => {
        for (const item of evidence.values()) {
          if (item.assertion.authorityBindingRef === ref)
            return {
              ...item.assertion.authorityBinding,
              candidateSha256: assertionCandidateDigest(candidateFromAssertion(item.assertion)),
            }
        }
        return undefined
      },
    },
    loadDisposition: async (actor, run, externalRef) => {
      if (actor.actorId !== 'synthetic-recipient-agent')
        throw new WorkflowDenied('Recipient decision authority required')
      return {
        recipientId: run.recipientId,
        decisionAuthorityRef: run.use.decisionAuthorityRef,
        externalDispositionRef: externalRef,
        provenanceRef: 'synthetic-external-provenance',
        auditRef: 'synthetic-external-recipient-audit',
        recordedAt: time,
      }
    },
    loadFrictionAction: async (_actor, _run, ref) => {
      const found = actions.get(ref)
      if (!found) throw new WorkflowDenied('Server action reference not found')
      return structuredClone(found)
    },
  }
  const service = createInstitutionalWorkflowService(ports)
  const requestFor = (index: 0 | 1, originatingRunId?: string): WorkflowRequest => {
    const use = index === 0 ? journey.attempt.originating : journey.attempt.consuming
    return {
      evidence: { id: use.assertion.evidence.evidenceId, version: use.assertion.evidence.version },
      requirement: {
        id: use.requirement.requirementRef,
        version: use.requirement.requirementVersion,
      },
      ...(originatingRunId ? { originatingRunId } : {}),
    }
  }
  return {
    journey,
    service,
    ports,
    storage,
    definitions,
    evidence,
    recipientRights,
    sourceRights,
    denials,
    actions,
    requestFor,
    setTime: (value: string) => {
      time = value
    },
    setContext: (value: Partial<CoraAuthorizationContext>) => {
      context = { ...context, ...value }
    },
    becomeRecipient: () => {
      context = {
        ...context,
        actorId: 'synthetic-recipient-agent',
        permissions: [DISPOSITION_PERMISSION],
      }
    },
    becomeOperator: () => {
      context = { ...context, actorId: 'synthetic-operator', permissions: [WORKFLOW_PERMISSION] }
    },
  }
}
