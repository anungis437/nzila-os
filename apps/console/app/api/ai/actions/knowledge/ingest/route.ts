import { ingestKnowledgeAction } from '@/lib/services/ai-proposal-service'
import { AiIngestKnowledgeSourceProposalSchema } from '@nzila/ai-core'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Convenience: Ingest Knowledge Source (AI Action)
 * POST /api/ai/actions/knowledge/ingest
 *
 * Wraps propose + execute in one flow for auto-approved low-risk actions.
 */
import { NextRequest, NextResponse } from 'next/server'

import { createLogger } from '@nzila/os-core'

import { requireOrgAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'

const logger = createLogger('ai:actions:knowledge:ingest')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate proposal
    const parsed = AiIngestKnowledgeSourceProposalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const proposal = parsed.data
    const access = await requireOrgAccess(proposal.orgId, {
      minRole: 'org_secretary',
    })
    if (!access.ok) return access.response

    const result = await ingestKnowledgeAction(proposal, access.context.userId)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    logger.error('[Knowledge Ingest Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error', code: 'unknown' }, { status: 500 })
  }
}
