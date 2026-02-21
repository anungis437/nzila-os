// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Actions: Execute
 * POST /api/ai/actions/execute
 *
 * Executes an approved action. RBAC: finance_preparer or ai_admin or entity_admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { aiActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { executeAction, ACTION_TYPES } from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'
import { z } from 'zod'

const ExecuteBodySchema = z.object({
  entityId: z.string().uuid(),
  actionId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ExecuteBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { entityId, actionId } = parsed.data

    // Load action to check type
    const [action] = await db
      .select()
      .from(aiActions)
      .where(eq(aiActions.id, actionId))
      .limit(1)

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    if (action.entityId !== entityId) {
      return NextResponse.json({ error: 'Entity mismatch' }, { status: 403 })
    }

    // RBAC: entity_admin for any, or entity_secretary for low-risk
    const access = await requireEntityAccess(entityId, {
      minRole: action.riskTier === 'low' ? 'entity_secretary' : 'entity_admin',
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
    console.error('[AI Action Execute Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
