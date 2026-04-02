/**
 * Console — AI Actions Audit & Kill-Switch API
 * iSSDLC W1-8: AI action kill-switch + audit dashboard
 *
 * GET  /api/admin/ai-actions — List kill-switch status for all action types
 * POST /api/admin/ai-actions — Toggle kill-switch for a specific action type
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import {
  checkKillSwitch,
  setKillSwitchOverride,
  getKillSwitchDashboard,
} from '@nzila/ai-core'
import { ACTION_TYPES } from '@nzila/ai-core/schemas'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('admin:ai-actions')

// ── GET: Dashboard status ────────────────────────────────────────────────

export async function GET() {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || orgRole !== 'org:platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dashboard = getKillSwitchDashboard()

  // Also include all known action types even if not cached
  const allTypes = Object.values(ACTION_TYPES) as string[]
  const full: Record<string, ReturnType<typeof checkKillSwitch>> = {}
  for (const actionType of allTypes) {
    full[actionType] = dashboard[actionType] ?? checkKillSwitch(actionType)
  }

  logger.info('ai-actions dashboard viewed', { userId, orgId })

  return NextResponse.json({
    globalKillSwitch: process.env.AI_KILL_SWITCH === 'true',
    actionTypes: full,
    timestamp: new Date().toISOString(),
  })
}

// ── POST: Toggle kill-switch ─────────────────────────────────────────────

const ToggleSchema = z.object({
  actionType: z.string().min(1),
  killed: z.boolean(),
  reason: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || orgRole !== 'org:platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = ToggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing required fields: actionType, killed, reason' },
      { status: 400 },
    )
  }

  const { actionType, killed, reason } = parsed.data

  const validTypes = Object.values(ACTION_TYPES) as string[]
  if (!validTypes.includes(actionType)) {
    return NextResponse.json(
      { error: `Invalid actionType. Valid: ${validTypes.join(', ')}` },
      { status: 400 },
    )
  }

  await setKillSwitchOverride({
    actionType,
    killed,
    reason,
    actor: userId,
  })

  logger.info('ai-actions kill-switch toggled', { userId, orgId, actionType, killed })

  return NextResponse.json({
    success: true,
    actionType,
    killed,
    reason,
    toggledBy: userId,
    timestamp: new Date().toISOString(),
  })
}
