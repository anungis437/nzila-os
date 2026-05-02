import { randomUUID } from 'node:crypto'
import { getDecisionType } from './registry'
import type {
  DecisionAuthority,
  DecisionEnforcementLevel,
  DecisionEvaluationResult,
  DecisionOutcome,
  DecisionRecord,
  EnforceDecisionRequest,
} from './types'

function buildAuthority(required: readonly string[], granted: readonly string[]): DecisionAuthority {
  const missing = required.filter((scope) => !granted.includes(scope))
  return {
    required,
    granted,
    missing,
    valid: missing.length === 0,
  }
}

function findMissingInputFields(
  input: Record<string, unknown>,
  requiredFields: readonly string[] = [],
): readonly string[] {
  return requiredFields.filter((field) => {
    const value = input[field]
    return value === undefined || value === null || value === ''
  })
}

function toActionType(decisionType: string): string {
  return decisionType.replace(/\./g, ':')
}

function isBlocking(level: DecisionEnforcementLevel): boolean {
  return level === 'block'
}

export async function enforceDecision(request: EnforceDecisionRequest): Promise<DecisionEvaluationResult> {
  const entry = getDecisionType(request.decisionType)
  const now = request.now ?? new Date().toISOString()
  const granted = request.authorityScope ?? request.actor.authorityScope ?? []
  const unregisteredEnforcementLevel = request.unregisteredEnforcementLevel ?? 'block'

  const fallbackOutcome: DecisionOutcome = {
    status: 'rejected',
    reasonCode: 'UNREGISTERED_DECISION_TYPE',
    explanationTrace: [`Decision type ${request.decisionType} is not registered.`],
  }

  if (!entry) {
    const allowed = !isBlocking(unregisteredEnforcementLevel)
    const decision: DecisionRecord = {
      id: randomUUID(),
      organizationId: request.organizationId,
      domain: 'platform',
      resourceType: 'unknown',
      resourceId: request.resourceId,
      actor: {
        ...request.actor,
        authorityScope: granted,
      },
      input: request.input,
      policy: request.policy,
      outcome: fallbackOutcome,
      createdAt: now,
    }

    return {
      allowed,
      decisionType: request.decisionType,
      decision,
      authority: buildAuthority([], granted),
      policyValid: false,
      missingInputFields: [],
    }
  }

  const authority = buildAuthority(entry.requiredAuthority, granted)
  const missingInputFields = findMissingInputFields(request.input, entry.requiredInputFields)
  const policyValid = request.policy.id === entry.requiredPolicy && request.policy.version.trim().length > 0
  const enforcementLevel: DecisionEnforcementLevel = entry.enforcementLevel ?? 'block'

  const failedReasonCode = !authority.valid
    ? 'AUTHORITY_SCOPE_MISSING'
    : !policyValid
      ? 'POLICY_REFERENCE_INVALID'
      : 'DECISION_INPUT_INCOMPLETE'

  const outcome: DecisionOutcome = authority.valid && policyValid && missingInputFields.length === 0
    ? {
        status: 'approved',
        explanationTrace: [
          `Authority validated for ${entry.requiredAuthority.join(', ') || 'no scopes required'}.`,
          `Policy ${request.policy.id}@${request.policy.version} matched registry requirement.`,
          'Required input fields were present.',
        ],
      }
    : {
        status: isBlocking(enforcementLevel) ? 'rejected' : 'pending',
        reasonCode: failedReasonCode,
        explanationTrace: [
          !authority.valid ? `Missing authority: ${authority.missing.join(', ')}` : 'Authority validated.',
          !policyValid ? `Expected policy ${entry.requiredPolicy}.` : `Policy ${request.policy.id}@${request.policy.version} validated.`,
          missingInputFields.length > 0 ? `Missing input fields: ${missingInputFields.join(', ')}` : 'Required input fields were present.',
        ],
      }

  const decision: DecisionRecord = {
    id: randomUUID(),
    organizationId: request.organizationId,
    domain: entry.domain,
    resourceType: entry.resourceType,
    resourceId: request.resourceId,
    actor: {
      ...request.actor,
      authorityScope: granted,
    },
    input: request.input,
    policy: request.policy,
    outcome,
    createdAt: now,
  }

  if (entry.auditRequired) {
    const approvedOutcome = decision.outcome.status === 'approved'

    if (entry.proofRequired && approvedOutcome && !request.proofAdapter) {
      if (isBlocking(enforcementLevel)) {
        decision.outcome = {
          status: 'rejected',
          reasonCode: 'PROOF_ADAPTER_REQUIRED',
          explanationTrace: ['Decision requires proof emission but no proof adapter was provided.'],
        }
      }
    }

    if (request.proofAdapter) {
      const proof = await request.proofAdapter.createProof(decision, {
        decisionType: entry.type,
        actionType: request.actionType ?? toActionType(entry.type),
        entry,
      })
      decision.proof = proof
    } else if (!entry.proofRequired && approvedOutcome) {
      decision.proof = {
        auditRecordId: request.auditRecordId,
        hash: undefined,
        signature: request.signature,
        previousHash: request.previousHash,
        verified: false,
      }
    }
  }

  return {
    allowed: decision.outcome.status === 'approved' || (decision.outcome.status === 'pending' && !isBlocking(enforcementLevel)),
    decisionType: entry.type,
    decision,
    authority,
    policyValid,
    missingInputFields,
    auditPayload: request.emitAuditPayload && entry.auditRequired
      ? {
          narCompatible: entry.narCompatible !== false,
          decisionType: entry.type,
          organizationId: request.organizationId,
          resourceType: entry.resourceType,
          resourceId: request.resourceId,
          retentionClass: entry.retentionClass,
          proof: decision.proof,
          record: decision,
        }
      : undefined,
  }
}