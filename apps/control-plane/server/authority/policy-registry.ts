/**
 * Authority Policy Registry — deny-by-default workflow authorization.
 *
 * Every workflow that the Control Plane is allowed to trigger MUST register a
 * `WorkflowPolicy` here. If a workflow trigger arrives for a workflowId that
 * is not registered (or the policy does not match the request domain/actor),
 * the authorizer fails closed with a `NO_POLICY_REGISTERED` (or stricter)
 * reason code.
 *
 * The registry intentionally avoids any "permit-by-default" or
 * "demo-friendly" branches. Policies are pure functions over the
 * `PolicyEvaluationContext`; their decisions are deterministic and
 * auditable.
 */
import type { ActorIdentity, WorkflowTriggerRequest } from '@nzila/platform-contracts/control-system'

/** Domains the platform currently supports for workflow authorization. */
export const SUPPORTED_DOMAINS = [
  'commerce',
  'finance',
  'governance',
  'operations',
  'union_eyes',
  'platform',
] as const
export type PolicyDomain = (typeof SUPPORTED_DOMAINS)[number]

export type ActorType = ActorIdentity['actorType']

export interface PolicyEvaluationContext {
  readonly workflowId: string
  readonly orgId: string
  readonly action: string
  readonly resourceType: string
  readonly resourceId?: string
  readonly actor: ActorIdentity
  readonly actorRole: string
  readonly payload: Record<string, unknown>
  readonly executionContext: WorkflowTriggerRequest['executionContext']
  readonly correlationId?: string
  readonly requestId?: string
}

export interface PolicyDecision {
  /** Machine decision. */
  readonly decision: 'allowed' | 'denied' | 'approval_required'
  /** Stable machine-readable reason code (UPPER_SNAKE). */
  readonly reasonCode: string
  /** Human-readable explanation that may be surfaced to operators. */
  readonly explanation: string
  /** When `approval_required`, the roles allowed to approve. */
  readonly approverRoles?: readonly string[]
}

export interface WorkflowPolicy {
  readonly id: string
  readonly version: string
  readonly domain: PolicyDomain
  /** Workflow IDs this policy governs. Exact match required. */
  readonly workflowIds: readonly string[]
  /** Actions this policy permits to be evaluated. */
  readonly allowedActions: readonly string[]
  /** Actor types allowed to invoke the workflow at all. */
  readonly allowedActorTypes: readonly ActorType[]
  /** Roles allowed to invoke without approval. */
  readonly allowedRoles: readonly string[]
  /** Roles that may invoke but require approval. */
  readonly approvalRequiredRoles?: readonly string[]
  /** Roles allowed to approve `approval_required` decisions. */
  readonly approverRoles?: readonly string[]
  /** Optional custom evaluator — runs after the built-in checks. */
  readonly evaluate?: (ctx: PolicyEvaluationContext) => PolicyDecision | undefined
  /** Free-form rationale persisted alongside every decision. */
  readonly rationale: string
}

/** Internal registry — keyed by workflowId. */
const REGISTRY = new Map<string, WorkflowPolicy>()

export function registerWorkflowPolicy(policy: WorkflowPolicy): void {
  if (!SUPPORTED_DOMAINS.includes(policy.domain)) {
    throw new Error(
      `[policy-registry] Refusing to register policy ${policy.id}: unsupported domain "${policy.domain}". ` +
        `Add it to SUPPORTED_DOMAINS first.`,
    )
  }
  if (policy.workflowIds.length === 0) {
    throw new Error(`[policy-registry] Policy ${policy.id} must declare at least one workflowId.`)
  }
  for (const workflowId of policy.workflowIds) {
    const existing = REGISTRY.get(workflowId)
    if (existing && existing.id !== policy.id) {
      throw new Error(
        `[policy-registry] Conflicting policies for workflowId "${workflowId}": ` +
          `${existing.id}@${existing.version} vs ${policy.id}@${policy.version}.`,
      )
    }
    REGISTRY.set(workflowId, policy)
  }
}

export function getPolicyForWorkflow(workflowId: string): WorkflowPolicy | undefined {
  return REGISTRY.get(workflowId)
}

export function listRegisteredPolicies(): readonly WorkflowPolicy[] {
  const seen = new Set<string>()
  const out: WorkflowPolicy[] = []
  for (const policy of REGISTRY.values()) {
    if (seen.has(policy.id)) continue
    seen.add(policy.id)
    out.push(policy)
  }
  return out
}

/** Test-only — never call from production code. */
export function __resetRegistryForTests(): void {
  REGISTRY.clear()
}

/**
 * Evaluate a workflow trigger against the registered policy.
 *
 * Returns a deterministic `PolicyDecision`. Never throws on policy mismatch;
 * always returns an explicit denial with a stable `reasonCode`. The caller
 * (workflow-authorizer) is responsible for persisting the decision.
 */
export function evaluateWorkflowPolicy(
  ctx: PolicyEvaluationContext,
): { policy: WorkflowPolicy | null; decision: PolicyDecision } {
  const policy = REGISTRY.get(ctx.workflowId)
  if (!policy) {
    return {
      policy: null,
      decision: {
        decision: 'denied',
        reasonCode: 'NO_POLICY_REGISTERED',
        explanation: `No authorization policy is registered for workflow "${ctx.workflowId}". ` +
          'Workflow triggers are deny-by-default.',
      },
    }
  }

  // Actor type gate
  if (!policy.allowedActorTypes.includes(ctx.actor.actorType)) {
    return {
      policy,
      decision: {
        decision: 'denied',
        reasonCode: 'ACTOR_TYPE_NOT_PERMITTED',
        explanation: `Actor type "${ctx.actor.actorType}" is not permitted by policy ${policy.id}@${policy.version}.`,
      },
    }
  }

  // Action gate
  if (!policy.allowedActions.includes(ctx.action)) {
    return {
      policy,
      decision: {
        decision: 'denied',
        reasonCode: 'ACTION_NOT_PERMITTED',
        explanation: `Action "${ctx.action}" is not declared in policy ${policy.id}@${policy.version}.`,
      },
    }
  }

  // Role gate — explicit allow first
  const roleAllowed = policy.allowedRoles.includes(ctx.actorRole)
  const roleNeedsApproval = policy.approvalRequiredRoles?.includes(ctx.actorRole) ?? false

  if (!roleAllowed && !roleNeedsApproval) {
    return {
      policy,
      decision: {
        decision: 'denied',
        reasonCode: 'ROLE_NOT_PERMITTED',
        explanation: `Role "${ctx.actorRole}" is not permitted by policy ${policy.id}@${policy.version}.`,
      },
    }
  }

  // Custom evaluator override (if provided)
  const custom = policy.evaluate?.(ctx)
  if (custom) return { policy, decision: custom }

  if (roleNeedsApproval) {
    return {
      policy,
      decision: {
        decision: 'approval_required',
        reasonCode: 'APPROVAL_REQUIRED_BY_ROLE',
        explanation: `Role "${ctx.actorRole}" may invoke this workflow but requires approval per policy ${policy.id}@${policy.version}.`,
        approverRoles: policy.approverRoles,
      },
    }
  }

  return {
    policy,
    decision: {
      decision: 'allowed',
      reasonCode: 'POLICY_PERMITTED',
      explanation: `Permitted by policy ${policy.id}@${policy.version}: ${policy.rationale}`,
    },
  }
}
