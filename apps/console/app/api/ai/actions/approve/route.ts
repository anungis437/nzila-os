/**
 * API — AI Actions: Approve / Reject
 * POST /api/ai/actions/approve
 *
 * RBAC: entity_admin only. Marks an action as approved or rejected.
 * No execution in v1.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { aiActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import {
  AiActionApproveRequestSchema,
  AiControlPlaneError,
  appendAiAuditEvent,
} from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiActionApproveRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { actionId, approved, notes } = parsed.data

    // 1. Find the action
    const [action] = await db
      .select()
      .from(aiActions)
      .where(eq(aiActions.id, actionId))
      .limit(1)

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    // 2. RBAC: entity_admin required
    const access = await requireEntityAccess(action.entityId, {
      minRole: 'entity_admin',
    })
    if (!access.ok) return access.response

    if (action.status !== 'proposed') {
      return NextResponse.json(
        { error: `Action is in "${action.status}" status, cannot approve/reject` },
        { status: 409 },
      )
    }

    // 3. Update status
    const newStatus = approved ? 'approved' : 'rejected'
    await db
      .update(aiActions)
      .set({
        status: newStatus,
        approvedBy: access.context.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, actionId))

    // 4. Audit event
    await appendAiAuditEvent({
      entityId: action.entityId,
      actorClerkUserId: access.context.userId,
      action: approved ? 'ai.action_approved' : 'ai.action_rejected',
      targetType: 'ai_action',
      targetId: actionId,
      afterJson: {
        actionType: action.actionType,
        status: newStatus,
        notes,
      },
    })

    return NextResponse.json({
      actionId,
      status: newStatus,
      approvedBy: access.context.userId,
    })
  } catch (err) {
    if (err instanceof AiControlPlaneError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      )
    }
    console.error('[AI Action Approve Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
