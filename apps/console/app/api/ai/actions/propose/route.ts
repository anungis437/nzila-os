import { proposeAiAction } from '@/lib/services/ai-proposal-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Actions: Propose
 * POST /api/ai/actions/propose
 *
 * Phase C: Validates proposal against Zod schema by actionType,
 * runs deterministic policy check, auto-approves low-risk if policy allows.
 * No LLM involved in the propose flow for typed actions.
 */
import { NextRequest, NextResponse } from 'next/server'

import { createLogger } from '@nzila/os-core'

import { requireOrgAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'
import { z } from 'zod'

const logger = createLogger('ai:actions:propose')

const ProposeBodySchema = z.object({
  orgId: z.guid(),
  appKey: z.string().min(1).max(60),
  profileKey: z.string().min(1).max(120),
  actionType: z.string().min(1).max(120),
  proposalJson: z.record(z.string(), z.unknown()),
  relatedDomainType: z.string().max(60).optional(),
  relatedDomainId: z.guid().optional(),
  evidencePackEligible: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ProposeBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { orgId } = parsed.data

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    const result = await proposeAiAction(parsed.data, access.context.userId)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    logger.error('[AI Action Propose Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error', code: 'unknown' }, { status: 500 })
  }
}
