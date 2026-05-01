import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@nzila/platform-auth/entra/server'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('control-plane:api:policies:replay')
import { evaluatePoliciesWithResolution, toPolicyContext, type PolicyDecisionLevel } from '@nzila/policies'

const HistoricalDecisionSchema = z.object({
  orgId: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: z.string().min(1),
  domain: z.enum(['labour', 'legal', 'commerce', 'media-rights']),
  action: z.string().min(1),
  resource: z.string().min(1),
  environment: z.enum(['dev', 'staging', 'production']).default('production'),
  payload: z.record(z.string(), z.unknown()).default({}),
  previousDecision: z.object({
    level: z.enum(['ALLOW', 'WARN', 'CHALLENGE', 'BLOCK']),
    reason: z.string().min(1),
    policyVersion: z.string().min(1),
  }),
})

const ReplayRequestSchema = z.object({
  historicalDecision: HistoricalDecisionSchema,
  newPolicyVersion: z.string().min(1),
})

function riskFromTransition(oldLevel: PolicyDecisionLevel, newLevel: PolicyDecisionLevel): 'low' | 'medium' | 'high' {
  const order: Record<PolicyDecisionLevel, number> = { ALLOW: 0, WARN: 1, CHALLENGE: 2, BLOCK: 3 }
  const delta = order[newLevel] - order[oldLevel]
  if (Math.abs(delta) >= 2) return 'high'
  if (Math.abs(delta) === 1) return 'medium'
  return 'low'
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const parsed = ReplayRequestSchema.safeParse(await request.json().catch(() => ({})))

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid replay request', details: parsed.error.flatten() }, { status: 400 })
    }

    const { historicalDecision, newPolicyVersion } = parsed.data
    const replayContext = toPolicyContext({
      orgId: historicalDecision.orgId,
      actorId: historicalDecision.actorId,
      actorRole: historicalDecision.actorRole,
      domain: historicalDecision.domain,
      action: historicalDecision.action,
      resource: historicalDecision.resource,
      payload: historicalDecision.payload,
      environment: historicalDecision.environment,
      policyVersion: newPolicyVersion,
    })

    const next = evaluatePoliciesWithResolution(replayContext)
    const oldDecision = historicalDecision.previousDecision
    const newDecision = next.resolution.finalDecision
    const changed = oldDecision.level !== newDecision.level || oldDecision.reason !== newDecision.reason

    const diff = {
      changed,
      levelChanged: oldDecision.level !== newDecision.level,
      reasonChanged: oldDecision.reason !== newDecision.reason,
      old: {
        level: oldDecision.level,
        reason: oldDecision.reason,
        policyVersion: oldDecision.policyVersion,
      },
      new: {
        level: newDecision.level,
        reason: newDecision.reason,
        policyVersion: newDecision.policyVersion,
      },
    }

    const riskFlag = changed ? riskFromTransition(oldDecision.level, newDecision.level) : 'low'

    return NextResponse.json({
      ok: true,
      data: {
        oldDecision,
        newDecision,
        diff,
        riskFlag,
        trace: next.resolution.explanationTrace,
      },
    })
  } catch (error) {
    logger.error('[replay] Unexpected error', { error })
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
