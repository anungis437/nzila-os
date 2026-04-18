import { createLogger } from '@nzila/os-core'
import { recordAuditEvent } from '@/lib/audit-db'

const logger = createLogger('console:policy-enforcement')

export interface PolicyActor {
  userId: string
  roles: string[]
  orgId?: string
}

export interface PolicyEvaluationOutput {
  policyId: string
  matched: boolean
  blocked: boolean
  requiresApproval: boolean
  reason?: string
}

export interface EnforcePoliciesInput {
  action: string
  resource: string
  actor: PolicyActor
  context: Record<string, unknown>
  orgId: string
  environment?: string
}

export interface EnforcePoliciesResult {
  blocked: boolean
  needsApproval: boolean
  reason: string
  evaluations: readonly PolicyEvaluationOutput[]
  approverRoles: readonly string[]
  requiredApprovers: number
}

export function clearPolicyCache(): void {
  // Console no longer caches or evaluates policy definitions locally.
}

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL
const CONTROL_PLANE_API_KEY = process.env.CONTROL_PLANE_API_KEY ?? ''

async function evaluateViaControlPlane(
  input: EnforcePoliciesInput,
): Promise<EnforcePoliciesResult | null> {
  if (!CONTROL_PLANE_URL) {
    return null
  }

  try {
    const response = await fetch(`${CONTROL_PLANE_URL}/api/control-plane/policy/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONTROL_PLANE_API_KEY,
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      return null
    }

    const json = (await response.json()) as { ok: boolean; data: EnforcePoliciesResult }
    return json.ok ? json.data : null
  } catch {
    return null
  }
}

function createUnavailableResult(): EnforcePoliciesResult {
  return {
    blocked: true,
    needsApproval: false,
    reason: 'Control Plane policy evaluation unavailable',
    evaluations: [],
    approverRoles: [],
    requiredApprovers: 0,
  }
}

export async function enforcePolicies(
  input: EnforcePoliciesInput,
): Promise<EnforcePoliciesResult> {
  const result = (await evaluateViaControlPlane(input)) ?? createUnavailableResult()
  const decision = result.blocked
    ? 'denied'
    : result.needsApproval
      ? 'approval_required'
      : 'allowed'

  await recordAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.actor.userId,
    action: 'policy_enforcement',
    targetType: 'policy',
    targetId: input.action,
    afterJson: { decision, blocked: result.blocked, needsApproval: result.needsApproval },
  })

  if (result.reason === 'Control Plane policy evaluation unavailable') {
    logger.warn('Policy enforcement failed closed because Control Plane is unavailable', {
      action: input.action,
      orgId: input.orgId,
    })
  }

  return result
}
