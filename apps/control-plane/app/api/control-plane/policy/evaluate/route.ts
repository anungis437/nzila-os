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
import {
  evaluateDomainPolicies,
  evaluatePoliciesWithResolution,
  resolvePolicyDecisions,
  toPolicyContext,
  type DomainName,
  type PolicyDecision,
  type PolicyDecisionLevel,
} from '@nzila/policies'
import { recordAuditEvent } from '@/lib/audit-db'
import { createLogger } from '@nzila/os-core'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { ingestOperatingEvidenceEvent } from '@/server/operating-evidence-data'
import { recordAuditEvent as recordGovernanceTimelineEvent } from '@nzila/platform-governance'

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
  actorRole: z.string().default('ops'),
  domain: z.enum(['labour', 'legal', 'commerce', 'media-rights']).default('commerce'),
  jurisdiction: z.string().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
  orgId: z.string().min(1),
  environment: z.string().optional(),
  overrideReason: z.string().optional(),
  ticketRef: z.string().optional(),
  /** Whether to record an audit event (defaults to true) */
  audit: z.boolean().default(true),
})

function maxAuditSeverity(
  levels: Array<'low' | 'medium' | 'high' | 'critical'>,
): 'low' | 'medium' | 'high' | 'critical' {
  const order = { low: 0, medium: 1, high: 2, critical: 3 } as const
  return levels.reduce((current, next) => (order[next] > order[current] ? next : current), 'low')
}

function mapLegacyEvaluationsToDecisions(evaluations: ReturnType<typeof evaluatePolicies>): PolicyDecision[] {
  const decisions: PolicyDecision[] = []
  const policyVersion = process.env.NZILA_POLICY_VERSION ?? 'v1'
  for (const evaluation of evaluations) {
    for (const decision of evaluation.decisions) {
      if (decision.result === 'fail') {
        decisions.push({
          level: 'BLOCK',
          reason: decision.reason,
          policyId: evaluation.policyId,
          policyVersion,
          auditSeverity: 'high',
        })
      } else if (decision.result === 'require_approval') {
        decisions.push({
          level: 'CHALLENGE',
          reason: decision.reason,
          policyId: evaluation.policyId,
          policyVersion,
          auditSeverity: 'medium',
          requiresApproval: true,
          requiresJustification: true,
        })
      }
    }
  }
  return decisions
}

function buildEnforcementRequirements(level: PolicyDecisionLevel) {
  if (level === 'BLOCK') {
    return {
      requiresConfirmationText: false,
      requiresJustification: false,
      requiresApproval: false,
      explicitOverrideHeader: 'x-policy-override-explicit',
      explicitOverrideAcceptedValue: 'true',
    }
  }
  if (level === 'CHALLENGE') {
    return {
      requiresConfirmationText: true,
      requiresJustification: true,
      requiresApproval: true,
      explicitOverrideHeader: null,
      explicitOverrideAcceptedValue: null,
    }
  }
  return {
    requiresConfirmationText: false,
    requiresJustification: false,
    requiresApproval: false,
    explicitOverrideHeader: null,
    explicitOverrideAcceptedValue: null,
  }
}

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
    const domainEvaluation = evaluateDomainPolicies({
      orgId: req.orgId,
      actorId: req.actor.userId,
      actorRole: req.actorRole,
      domain: req.domain as DomainName,
      action: req.action,
      resource: req.resource,
      payload: req.context,
      environment: (req.environment ?? process.env.NODE_ENV ?? 'production') as 'dev' | 'staging' | 'production',
      overrideReason: req.overrideReason,
      ticketRef: req.ticketRef,
    })
    const contextual = evaluatePoliciesWithResolution(
      toPolicyContext({
        orgId: req.orgId,
        actorId: req.actor.userId,
        actorRole: req.actorRole,
        domain: req.domain,
        action: req.action,
        resource: req.resource,
        payload: {
          ...req.context,
          sensitivity: String(req.context['sensitivity'] ?? 'medium'),
          app: 'control-plane',
          anomalyScore: req.context['anomalyScore'],
          previousActions: req.context['previousActions'],
          overrideHistory: req.context['overrideHistory'],
          sessionId: req.context['sessionId'],
        },
        environment: (req.environment ?? process.env.NODE_ENV ?? 'production') as 'dev' | 'staging' | 'production',
        policyVersion: String(req.context['policyVersion'] ?? process.env.NZILA_POLICY_VERSION ?? 'v1'),
        overrideReason: req.overrideReason,
        ticketRef: req.ticketRef,
      }),
    )
    const legacyMappedDecisions = mapLegacyEvaluationsToDecisions(evaluations)
    const combinedDecisions = [...contextual.decisions, ...legacyMappedDecisions]
    const resolved = resolvePolicyDecisions(combinedDecisions)

    const blocked = isBlocked(evaluations)
    const needsApproval = !blocked && requiresApproval(evaluations)
    const isDomainBlocked = domainEvaluation.blocked
    const requiresDomainOverride = !isDomainBlocked && domainEvaluation.requiresOverride
    const finalBlocked = blocked || isDomainBlocked || resolved.finalDecision.level === 'BLOCK'
    const finalNeedsApproval =
      !finalBlocked &&
      (needsApproval || requiresDomainOverride || resolved.finalDecision.level === 'CHALLENGE')

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

    let reason = resolved.finalDecision.reason || 'allowed'
    if (finalBlocked) {
      const blockReasons = evaluations
        .flatMap((e) => e.decisions)
        .filter((d) => d.result === 'fail')
        .map((d) => d.reason)
      const domainReasons = domainEvaluation.findings.filter((f) => !f.passed).map((f) => f.reason)
      reason = `Policy denied: ${[...blockReasons, ...domainReasons, resolved.finalDecision.reason].filter(Boolean).join('; ')}`
    } else if (finalNeedsApproval) {
      reason = `Requires approval from: ${[...approverRoles].join(', ')}`
    }

    const finalLevel: PolicyDecisionLevel = finalBlocked
      ? 'BLOCK'
      : finalNeedsApproval
        ? 'CHALLENGE'
        : resolved.finalDecision.level
    const enforcementRequirements = buildEnforcementRequirements(finalLevel)
    const stackSeverity = maxAuditSeverity(combinedDecisions.map((decision) => decision.auditSeverity))

    // Emit audit event for every policy evaluation
    if (req.audit) {
      await recordAuditEvent({
        orgId: req.orgId,
        targetType: 'policy_enforcement',
        targetId: req.resource,
        action: `policy.${finalBlocked ? 'denied' : finalNeedsApproval ? 'approval_required' : 'allowed'}`,
        actorClerkUserId: req.actor.userId,
        afterJson: {
          enforcedAction: req.action,
          resource: req.resource,
          finalDecision: finalLevel,
          blocked: finalBlocked,
          needsApproval: finalNeedsApproval,
          reason,
          evaluationCount: evaluations.length,
          policyIds: evaluations.map((e) => e.policyId),
          domainEvaluation,
          decisionStack: combinedDecisions,
          trace: resolved.explanationTrace,
          enforcementRequirements,
          source: 'control-plane',
        },
      }).catch((err) => logger.warn('Audit event failed — non-blocking', { error: err }))
    }

    await ingestOperatingEvidenceEvent({
      app: 'control-plane',
      domain: req.domain,
      type: finalLevel === 'BLOCK' ? 'policy_violation' : finalLevel === 'CHALLENGE' ? 'override' : 'request',
      severity: stackSeverity,
      correctedByHuman: finalLevel === 'CHALLENGE',
      overrideReason: req.overrideReason,
      payload: {
        action: req.action,
        resource: req.resource,
        orgId: req.orgId,
        actorId: req.actor.userId,
        finalDecision: finalLevel,
        policyVersion: resolved.finalDecision.policyVersion,
        decisionCount: combinedDecisions.length,
        trace: resolved.explanationTrace,
      },
    }).catch((err) => logger.warn('Operating-evidence emit failed — non-blocking', { error: err }))

    recordGovernanceTimelineEvent({
      eventType: 'policy_evaluated',
      actor: req.actor.userId,
      orgId: req.orgId,
      app: 'control-plane',
      policyResult: finalLevel === 'BLOCK' ? 'fail' : finalLevel === 'WARN' ? 'warn' : 'pass',
      commitHash: process.env.GIT_SHA ?? 'unknown',
      details: {
        action: req.action,
        resource: req.resource,
        finalDecision: finalLevel,
        policyVersion: resolved.finalDecision.policyVersion,
        policyIds: combinedDecisions.map((decision) => decision.policyId),
      },
    })

    for (const signal of contextual.signals.anomalySignals) {
      await ingestOperatingEvidenceEvent({
        app: 'control-plane',
        domain: req.domain,
        type: signal.signal === 'SUSPICIOUS_OVERRIDE_PATTERN' ? 'policy_violation' : 'override',
        severity: signal.severity,
        overrideReason: signal.reason,
        payload: {
          signal: signal.signal,
          policyId: signal.policyId,
          policyVersion: resolved.finalDecision.policyVersion,
          reason: signal.reason,
          actorId: signal.actorId,
          orgId: signal.orgId,
          metadata: signal.metadata,
        },
      }).catch(() => undefined)

      recordGovernanceTimelineEvent({
        eventType: 'drift_detected',
        actor: req.actor.userId,
        orgId: req.orgId,
        app: 'control-plane',
        policyResult: signal.signal === 'SUSPICIOUS_OVERRIDE_PATTERN' ? 'fail' : 'warn',
        commitHash: process.env.GIT_SHA ?? 'unknown',
        details: {
          signal: signal.signal,
          policyId: signal.policyId,
          policyVersion: resolved.finalDecision.policyVersion,
          reason: signal.reason,
          metadata: signal.metadata,
        },
      })
    }

    logger.info('Policy evaluated', {
      action: req.action,
      orgId: req.orgId,
      blocked: finalBlocked,
      needsApproval: finalNeedsApproval,
      policyCount: evaluations.length,
    })

    return NextResponse.json({
      ok: true,
      data: {
        blocked,
        needsApproval,
        reason,
        evaluations,
        domainEvaluation,
        finalBlocked,
        finalNeedsApproval,
        finalDecision: finalLevel,
        fullDecisionStack: combinedDecisions,
        trace: resolved.explanationTrace,
        enforcementRequirements,
        policyVersion: resolved.finalDecision.policyVersion,
        overrideSignals: contextual.signals,
        approverRoles: [...approverRoles],
        requiredApprovers: maxApprovers,
      },
    })
  } catch (error) {
    logger.error('Policy evaluation API error', { error })
    return handleAuthError(error)
  }
}
