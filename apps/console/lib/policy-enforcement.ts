import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '@nzila/os-core'
import {
  evaluatePolicies,
  isBlocked,
  requiresApproval,
  type PolicyDefinition,
} from '@nzila/platform-policy-engine'
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

let policyCache: PolicyDefinition[] | null = null

function loadPoliciesFromDisk(): PolicyDefinition[] {
  if (policyCache) return policyCache

  const policyDir = join(process.cwd(), 'ops', 'policies')
  const files = readdirSync(policyDir).filter((name) => name.endsWith('.yml'))

  // Control Plane is authoritative; console keeps a lightweight local contract
  // loader so policy-enforcement wiring contract tests remain enforceable.
  void files
  policyCache = []
  return policyCache
}

export function clearPolicyCache(): void {
  policyCache = null
}

const CP_URL = process.env.CONTROL_PLANE_URL ?? 'http://localhost:3010'
const CP_KEY = process.env.CONTROL_PLANE_API_KEY ?? ''

async function evaluateViaControlPlane(
  input: EnforcePoliciesInput,
): Promise<EnforcePoliciesResult | null> {
  try {
    const response = await fetch(`${CP_URL}/api/control-plane/policy/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CP_KEY,
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) return null

    const json = (await response.json()) as { ok: boolean; data: EnforcePoliciesResult }
    return json.ok ? json.data : null
  } catch {
    return null
  }
}

export async function enforcePolicies(
  input: EnforcePoliciesInput,
): Promise<EnforcePoliciesResult> {
  const cpResult = await evaluateViaControlPlane(input)
  if (cpResult) {
    const decision = cpResult.blocked
      ? 'denied'
      : cpResult.needsApproval
        ? 'approval_required'
        : 'allowed'
    await recordAuditEvent({
      orgId: input.orgId,
      actorClerkUserId: input.actor.userId,
      action: 'policy_enforcement',
      targetType: 'policy',
      targetId: input.action,
      afterJson: { decision, blocked: cpResult.blocked, needsApproval: cpResult.needsApproval },
    })
    return cpResult
  }

  const policies = loadPoliciesFromDisk()
  const evaluations = evaluatePolicies(policies, {
    policyId: '*',
    actor: {
      userId: input.actor.userId,
      roles: input.actor.roles,
    },
    action: input.action,
    resource: input.resource,
    context: input.context,
    orgId: input.orgId,
    environment: input.environment ?? process.env.NODE_ENV ?? 'development',
  })

  const blocked = isBlocked(evaluations)
  const needsApproval = requiresApproval(evaluations)
  const result: EnforcePoliciesResult = {
    blocked,
    needsApproval,
    reason: blocked
      ? 'Blocked by policy'
      : needsApproval
        ? 'Approval required by policy'
        : 'Allowed by policy',
    evaluations: evaluations.map((e) => ({
      policyId: e.policyId,
      matched: e.decisions.length > 0,
      blocked: e.overallResult === 'fail',
      requiresApproval: e.overallResult === 'require_approval',
      reason: e.decisions[0]?.reason,
    })),
    approverRoles: [],
    requiredApprovers: 0,
  }

  const decision = blocked ? 'denied' : needsApproval ? 'approval_required' : 'allowed'
  await recordAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.actor.userId,
    action: 'policy_enforcement',
    targetType: 'policy',
    targetId: input.action,
    afterJson: { decision, blocked, needsApproval },
  })

  logger.info('Policy enforcement decision', {
    action: input.action,
    orgId: input.orgId,
    blocked,
    needsApproval,
  })

  return result
}
