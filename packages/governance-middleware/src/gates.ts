/**
 * @nzila/governance-middleware — Gates
 *
 * Framework-agnostic policy and AI capability gates. The Next.js
 * adapter in ./next.ts wraps these for Route Handlers.
 *
 * @module @nzila/governance-middleware/gates
 */
import { emit } from './emitter'
import type {
  GovernanceDoctrineCitation,
  GovernanceScope,
  GovernanceSubject,
} from './types'

export type PolicyEffect =
  | 'allow'
  | 'deny'
  | 'require_approval'
  | 'require_review'

export interface PolicyEvaluationLike {
  readonly policyId: string
  readonly policyVersion: string
  readonly decision: PolicyEffect
  readonly reason: string
  readonly doctrineCitations: readonly GovernanceDoctrineCitation[]
  readonly severity: 'info' | 'warning' | 'critical'
}

export interface PolicyGateInput {
  readonly evaluation: PolicyEvaluationLike
  readonly subject: GovernanceSubject
  readonly scope: GovernanceScope
  readonly releaseId: string
  readonly correlationKey?: string
}

export interface PolicyGateOutcome {
  readonly allowed: boolean
  readonly httpStatus: 200 | 403 | 409
  readonly evaluation: PolicyEvaluationLike
}

/**
 * Apply the policy decision: emit the governance event, return an
 * outcome describing whether to proceed.
 */
export async function applyPolicyDecision(
  input: PolicyGateInput,
): Promise<PolicyGateOutcome> {
  const { evaluation } = input

  await emit({
    type: 'doctrine_enforcement_event',
    severity: evaluation.severity,
    scope: input.scope,
    subject: input.subject,
    doctrineCitations: evaluation.doctrineCitations,
    decision: evaluation.decision,
    releaseId: input.releaseId,
    payload: {
      policyId: evaluation.policyId,
      policyVersion: evaluation.policyVersion,
      reason: evaluation.reason,
    },
    correlationKey: input.correlationKey,
  })

  if (evaluation.decision === 'allow') {
    return { allowed: true, httpStatus: 200, evaluation }
  }
  if (evaluation.decision === 'deny') {
    return { allowed: false, httpStatus: 403, evaluation }
  }
  // require_approval / require_review
  return { allowed: false, httpStatus: 409, evaluation }
}

export interface AICapabilityCheckInput {
  readonly capabilityId: string
  readonly version: string
  readonly isRegistered: (id: string, version: string) => boolean
  readonly subject: GovernanceSubject
  readonly scope: GovernanceScope
  readonly releaseId: string
  readonly correlationKey?: string
}

export class UnregisteredAICapabilityError extends Error {
  constructor(capabilityId: string, version: string) {
    super(
      `unregistered_ai_capability: "${capabilityId}@${version}" is not registered; refused at the governance boundary`,
    )
    this.name = 'UnregisteredAICapabilityError'
  }
}

/**
 * Refuse unregistered AI capabilities at the boundary. Emits an
 * `ai_governance_event` regardless of decision.
 */
export async function requireRegisteredAICapability(
  input: AICapabilityCheckInput,
): Promise<void> {
  const registered = input.isRegistered(input.capabilityId, input.version)

  await emit({
    type: registered ? 'ai_governance_event' : 'ai_governance_event',
    severity: registered ? 'info' : 'critical',
    scope: input.scope,
    subject: input.subject,
    doctrineCitations: [
      {
        document:
          'docs/nzila-runtime-governance/governance-safe-ai-runtime-validation.md',
      },
    ],
    decision: registered ? 'allow' : 'deny',
    releaseId: input.releaseId,
    payload: {
      capabilityId: input.capabilityId,
      capabilityVersion: input.version,
      registered,
    },
    correlationKey: input.correlationKey,
  })

  if (!registered) {
    throw new UnregisteredAICapabilityError(input.capabilityId, input.version)
  }
}
