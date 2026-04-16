/**
 * Control Plane API — Policy Evaluation
 *
 * POST /api/control-plane/policy/evaluate
 *
 * The SINGLE canonical endpoint for policy evaluation across the platform.
 * All apps (Console, Platform Admin, product apps) must call this endpoint
 * to determine whether an action is allowed.
 *
 * No app may import or run `@nzila/platform-policy-engine` directly.
 * Policy authority lives exclusively in the Control Plane.
 *
 * Request body: EnforcePoliciesRequest
 * Response: EnforcePoliciesResponse
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import {
  evaluatePolicies,
  isBlocked,
  requiresApproval,
  type PolicyDefinition,
  type PolicyEvaluationInput,
} from '@nzila/platform-policy-engine'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'
import { createLogger } from '@nzila/os-core'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

export const dynamic = 'force-dynamic'

const logger = createLogger('control-plane:api:policy:evaluate')

// ── Policy cache ─────────────────────────────────────────────────────────────

let _cachedPolicies: PolicyDefinition[] | null = null

function loadAllPolicies(): PolicyDefinition[] {
  if (_cachedPolicies) return _cachedPolicies

  // Control Plane reads policies from the monorepo's ops/policies directory
  const policiesDir = join(process.cwd(), '..', '..', 'ops', 'policies')
  const allPolicies: PolicyDefinition[] = []

  try {
    const files = readdirSync(policiesDir).filter((f) => f.endsWith('.yml'))
    for (const file of files) {
      try {
        const raw = readFileSync(join(policiesDir, file), 'utf-8')
        const parsed = parseYaml(raw) as { policies?: PolicyDefinition[] }
        if (parsed?.policies) {
          for (const policy of parsed.policies) {
            if (policy.enabled) {
              allPolicies.push(policy)
            }
          }
        }
      } catch (err) {
        logger.error('Failed to load policy file', { file, error: err })
      }
    }
  } catch {
    logger.warn('Policy directory not found — enforcement disabled', { policiesDir })
    return []
  }

  _cachedPolicies = allPolicies
  logger.info('Policies loaded', { count: allPolicies.length })
  return allPolicies
}

/** Clear policy cache — call on hot reload or policy update */
export function clearPolicyCache(): void {
  _cachedPolicies = null
}

// ── Request/response schemas ─────────────────────────────────────────────────

const PolicyActorSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.string()),
})

const EvaluatePoliciesRequestSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  actor: PolicyActorSchema,
  context: z.record(z.string(), z.unknown()).default({}),
  orgId: z.string().min(1),
  environment: z.string().optional(),
  /** Whether to record an audit event (defaults to true) */
  audit: z.boolean().default(true),
})

// ── POST — evaluate policies ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)

    const body = await request.json().catch(() => ({}))
    const parsed = EvaluatePoliciesRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const req = parsed.data
    const policies = loadAllPolicies()

    const evalInput: PolicyEvaluationInput = {
      policyId: '*',
      actor: req.actor,
      action: req.action,
      resource: req.resource,
      context: req.context,
      orgId: req.orgId,
      environment: req.environment ?? process.env.NODE_ENV ?? 'production',
    }

    const evaluations = evaluatePolicies(policies, evalInput)
    const blocked = isBlocked(evaluations)
    const needsApproval = !blocked && requiresApproval(evaluations)

    const approverRoles = new Set<string>()
    let maxApprovers = 0
    for (const e of evaluations) {
      for (const d of e.decisions) {
        if (d.result === 'require_approval') {
          d.approverRoles?.forEach((r) => approverRoles.add(r))
          if (d.requireApprovers && d.requireApprovers > maxApprovers) {
            maxApprovers = d.requireApprovers
          }
        }
      }
    }

    let reason = 'allowed'
    if (blocked) {
      const blockReasons = evaluations
        .flatMap((e) => e.decisions)
        .filter((d) => d.result === 'fail')
        .map((d) => d.reason)
      reason = `Policy denied: ${blockReasons.join('; ')}`
    } else if (needsApproval) {
      reason = `Requires approval from: ${[...approverRoles].join(', ')}`
    }

    // Emit audit event for every policy evaluation
    if (req.audit) {
      await recordAuditEvent({
        orgId: req.orgId,
        targetType: 'policy_enforcement',
        targetId: req.resource,
        action: `policy.${blocked ? 'denied' : needsApproval ? 'approval_required' : 'allowed'}`,
        actorClerkUserId: req.actor.userId,
        afterJson: {
          enforcedAction: req.action,
          resource: req.resource,
          blocked,
          needsApproval,
          reason,
          evaluationCount: evaluations.length,
          policyIds: evaluations.map((e) => e.policyId),
          source: 'control-plane',
        },
      }).catch((err) => logger.warn('Audit event failed — non-blocking', { error: err }))
    }

    logger.info('Policy evaluated', {
      action: req.action,
      orgId: req.orgId,
      blocked,
      needsApproval,
      policyCount: evaluations.length,
    })

    return NextResponse.json({
      ok: true,
      data: {
        blocked,
        needsApproval,
        reason,
        evaluations,
        approverRoles: [...approverRoles],
        requiredApprovers: maxApprovers,
      },
    })
  } catch (error) {
    logger.error('Policy evaluation API error', { error })
    return handleAuthError(error)
  }
}
