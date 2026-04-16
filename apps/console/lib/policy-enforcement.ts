/**
 * Policy Enforcement Proxy — Console
 *
 * The Console no longer evaluates policies directly.
 * All policy decisions are delegated to the Control Plane via HTTP.
 *
 * Authority: apps/control-plane/app/api/control-plane/policy/evaluate/route.ts
 *
 * Usage:
 *   const result = await enforcePolicies({
 *     action: 'break_glass.activate',
 *     resource: '/api/admin/break-glass',
 *     actor: { userId, roles: ['platform_admin'] },
 *     context: { environment: 'production' },
 *     orgId,
 *   })
 *   if (result.blocked) return NextResponse.json({ error: result.reason }, { status: 403 })
 */
import { createLogger } from '@nzila/os-core'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('console:policy-enforcement')

// ── Types ─────────────────────────────────────────────────────────────────

/** Actor performing the action (mirrors PolicyActor from platform-policy-engine) */
export interface PolicyActor {
  userId: string
  roles: string[]
  orgId?: string
}

/** Single evaluation result (mirrors PolicyEvaluationOutput from platform-policy-engine) */
export interface PolicyEvaluationOutput {
  policyId: string
  matched: boolean
  blocked: boolean
  requiresApproval: boolean
  reason?: string
}

export interface EnforcePoliciesInput {
  /** The action being performed (e.g., 'break_glass.activate') */
  action: string
  /** The resource path (e.g., '/api/admin/break-glass') */
  resource: string
  /** The actor performing the action */
  actor: PolicyActor
  /** Additional context for policy evaluation */
  context: Record<string, unknown>
  /** Organization ID */
  orgId: string
  /** Environment (defaults to NODE_ENV) */
  environment?: string
}

export interface EnforcePoliciesResult {
  /** Whether the action is blocked by policy */
  blocked: boolean
  /** Whether the action requires approval */
  needsApproval: boolean
  /** Human-readable reason for block/approval */
  reason: string
  /** All evaluation outputs for audit trail */
  evaluations: readonly PolicyEvaluationOutput[]
  /** Approver roles required (if needsApproval) */
  approverRoles: readonly string[]
  /** Number of approvers required */
  requiredApprovers: number
}

// ── Control Plane delegation ──────────────────────────────────────────────

const CP_URL = process.env.CONTROL_PLANE_URL ?? 'http://localhost:3010'
const CP_KEY = process.env.CONTROL_PLANE_API_KEY ?? ''

// ── Enforcement ───────────────────────────────────────────────────────────

/**
 * Delegates policy evaluation to the Control Plane.
 * The Console is an OPERATOR interface — it never evaluates policies locally.
 * All policy authority lives in apps/control-plane.
 */
export async function enforcePolicies(
  input: EnforcePoliciesInput,
): Promise<EnforcePoliciesResult> {
  const response = await fetch(
    `${CP_URL}/api/control-plane/policy/evaluate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CP_KEY,
      },
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '(no body)')
    logger.error('Control Plane policy evaluation failed', {
      status: response.status,
      body: text,
      action: input.action,
      orgId: input.orgId,
    })
    throw new Error(
      `Policy evaluation failed (HTTP ${response.status}) — check Control Plane connectivity`,
    )
  }

  const json = (await response.json()) as { ok: boolean; data: EnforcePoliciesResult }
  return json.data
}
