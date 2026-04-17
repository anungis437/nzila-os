// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Actions: Execute
 * POST /api/ai/actions/execute
 *
 * Executes an approved action. RBAC: finance_preparer or ai_admin or org_admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { aiActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { executeAction } from '@nzila/ai-core'
import { requireOrgAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'
import { z } from 'zod'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ai:actions:execute')

const ExecuteBodySchema = z.object({
  orgId: z.string().uuid(),
  actionId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries())

    const parsed = ExecuteBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { orgId, actionId } = parsed.data

    // Load action to check type
    const [action] = await platformDb
      .select()
      .from(aiActions)
      .where(eq(aiActions.id, actionId))
      .limit(1)

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    if (action.orgId !== orgId) {
      return NextResponse.json({ error: 'Entity mismatch' }, { status: 403 })
    }

    // RBAC: org_admin for any, or org_secretary for low-risk
    const access = await requireOrgAccess(orgId, {
      minRole: action.riskTier === 'low' ? 'org_secretary' : 'org_admin',
    })
    if (!access.ok) return access.response

    const result = await executeAction(actionId, access.context.userId)

    return NextResponse.json(result, {
      status: result.status === 'success' ? 200 : 500,
    })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    logger.error('[AI Action Execute Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
