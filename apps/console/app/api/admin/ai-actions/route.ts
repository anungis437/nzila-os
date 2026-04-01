/**
 * Console — AI Actions Audit & Kill-Switch API
 * iSSDLC W1-8: AI action kill-switch + audit dashboard
 *
 * GET  /api/admin/ai-actions — List kill-switch status for all action types
 * POST /api/admin/ai-actions — Toggle kill-switch for a specific action type
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  checkKillSwitch,
  setKillSwitchOverride,
  getKillSwitchDashboard,
} from '@nzila/ai-core/policy/killSwitch'
import { ACTION_TYPES } from '@nzila/ai-core/schemas'

// ── GET: Dashboard status ────────────────────────────────────────────────

export async function GET() {
  const { userId, orgRole } = await auth()
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

  return NextResponse.json({
    globalKillSwitch: process.env.AI_KILL_SWITCH === 'true',
    actionTypes: full,
    timestamp: new Date().toISOString(),
  })
}

// ── POST: Toggle kill-switch ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId, orgRole } = await auth()
  if (!userId || orgRole !== 'org:platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { actionType, killed, reason } = body as {
    actionType: string
    killed: boolean
    reason: string
  }

  if (!actionType || typeof killed !== 'boolean' || !reason) {
    return NextResponse.json(
      { error: 'Missing required fields: actionType, killed, reason' },
      { status: 400 },
    )
  }

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

  return NextResponse.json({
    success: true,
    actionType,
    killed,
    reason,
    toggledBy: userId,
    timestamp: new Date().toISOString(),
  })
}
