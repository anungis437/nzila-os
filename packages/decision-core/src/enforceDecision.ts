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

/**
 * Policy version must be a recognizable semver-shaped identifier:
 *   - `MAJOR.MINOR.PATCH` (e.g. `1.2.3`)
 *   - optional pre-release / build metadata (e.g. `1.2.3-rc.1+sha.abc`)
 *   - or a date-stamped policy id (`YYYY-MM-DD` or `YYYY-MM-DD.N`)
 * A blank, whitespace, or free-form string is rejected to prevent silent
 * acceptance of malformed policy references at the enforcement boundary.
 */
const POLICY_VERSION_RE = /^(?:\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*|\d{4}-\d{2}-\d{2}(?:\.\d+)?)$/
function isValidPolicyVersion(version: string): boolean {
  return POLICY_VERSION_RE.test(version.trim())
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
  const policyIdMatches = request.policy.id === entry.requiredPolicy
  const policyVersionShapeOk = isValidPolicyVersion(request.policy.version)
  const policyVersionAllowed =
    entry.allowedPolicyVersions === undefined
    || entry.allowedPolicyVersions.includes(request.policy.version)
  const policyValid = policyIdMatches && policyVersionShapeOk && policyVersionAllowed
  const enforcementLevel: DecisionEnforcementLevel = entry.enforcementLevel ?? 'block'

  const failedReasonCode = !authority.valid
    ? 'AUTHORITY_SCOPE_MISSING'
    : !policyValid
      ? (!policyIdMatches || !policyVersionShapeOk
          ? 'POLICY_REFERENCE_INVALID'
          : 'POLICY_VERSION_NOT_ALLOWED')
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
          !policyIdMatches
            ? `Expected policy ${entry.requiredPolicy}.`
            : !policyVersionShapeOk
              ? `Policy version ${JSON.stringify(request.policy.version)} is not a valid semver or ISO-date identifier.`
              : !policyVersionAllowed
                ? `Policy version ${request.policy.version} is not in the allow-list [${(entry.allowedPolicyVersions ?? []).join(', ')}].`
                : `Policy ${request.policy.id}@${request.policy.version} validated.`,
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