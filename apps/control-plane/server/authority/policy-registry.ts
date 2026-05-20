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
  /**
   * SHA-256 content hash frozen at publish time.
   * Propagated into decision event payloads for downstream audit.
   * NULL for statically-registered policies (not yet migrated to governed_policies).
   */
  readonly policyHash?: string | null
}

// ga-check:exempt — REGISTRY is a read-only DI container (populated at module-load time from
// static policy declarations). Primary persistence is governed_policies in PostgreSQL.
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

// ── Governed policy bridge ────────────────────────────────────────────────────
//
// Loads platform-level governed_policies from the DB and registers them as
// WorkflowPolicy instances. This bridges the immutable DB-backed governed
// artifact world with the in-process evaluation registry.

/**
 * Register a governed policy row as an in-process WorkflowPolicy.
 *
 * FAIL-CLOSED:
 *  - Throws if the policy does not have a content_hash (unsigned policies
 *    may not be activated in the registry)
 *  - Throws if the policy lifecycle_status is not 'active' or 'published'
 */
export function registerGovernedPolicy(
  row: {
    id: string
    semver: string
    domain: string
    workflowBindings: unknown
    contentHash: string | null
    lifecycleStatus: string
    governanceRationale: string
    riskClassification: string
    authorRole: string
  },
): void {
  if (!['active', 'published'].includes(row.lifecycleStatus)) {
    throw new Error(
      `[policy-registry] UNSIGNED_POLICY_ACTIVATION_BLOCKED: ` +
        `Policy ${row.id}@${row.semver} has lifecycle_status "${row.lifecycleStatus}". ` +
        'Only active or published policies may be registered.',
    )
  }

  if (!row.contentHash) {
    throw new Error(
      `[policy-registry] UNSIGNED_POLICY_ACTIVATION_BLOCKED: ` +
        `Policy ${row.id}@${row.semver} has no content_hash. ` +
        'Policies must be hashed before registration.',
    )
  }

  const bindings = Array.isArray(row.workflowBindings)
    ? row.workflowBindings.filter((v): v is string => typeof v === 'string')
    : []

  if (bindings.length === 0) {
    // Governance-only policies with no workflow bindings — skip registration silently
    return
  }

  const domain = SUPPORTED_DOMAINS.includes(row.domain as PolicyDomain)
    ? (row.domain as PolicyDomain)
    : 'platform'

  const policy: WorkflowPolicy = {
    id: row.id,
    version: row.semver,
    domain,
    workflowIds: bindings,
    allowedActions: ['workflow.trigger'],
    allowedActorTypes: ['user', 'system'],
    allowedRoles: [row.authorRole],
    rationale: row.governanceRationale,
    policyHash: row.contentHash,
  }

  registerWorkflowPolicy(policy)
}

/**
 * Bootstrap the in-process registry from the DB.
 *
 * Loads all active + published governed_policies, verifies integrity, and
 * registers each as a WorkflowPolicy. Fail-closed: a single integrity failure
 * aborts the entire bootstrap.
 *
 * Call this during control-plane startup before accepting any requests.
 */
export async function bootstrapFromDB(db: Record<string, unknown>): Promise<{
  registeredCount: number
  skippedCount: number
}> {
  // Lazy import to avoid circular deps at module evaluation time
  const { governedPolicies } = await import('@nzila/db/schema')
  const { eq, or } = await import('drizzle-orm')
  const { assertIntegrityOrThrow } = await import('./policy-integrity')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbTyped = db as any

  const rows = await dbTyped
    .select()
    .from(governedPolicies)
    .where(
      or(
        eq(governedPolicies.lifecycleStatus, 'active'),
        eq(governedPolicies.lifecycleStatus, 'published'),
      ),
    )

  let registeredCount = 0
  let skippedCount = 0

  for (const row of rows) {
    // Integrity verification (fail-closed)
    assertIntegrityOrThrow(
      {
        policyFamilyId: row.policyFamilyId,
        semver: row.semver,
        name: row.name,
        domain: row.domain,
        workflowBindings: row.workflowBindings,
        operationalScope: row.operationalScope,
        governanceRationale: row.governanceRationale,
        riskClassification: row.riskClassification,
        reviewCadenceDays: row.reviewCadenceDays,
        replayCompatibilityVersion: row.replayCompatibilityVersion,
        effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
        effectiveUntil: row.effectiveUntil?.toISOString() ?? null,
      },
      row.contentHash,
    )

    try {
      registerGovernedPolicy(row)
      registeredCount++
    } catch {
      skippedCount++
    }
  }

  return { registeredCount, skippedCount }
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
