import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { requireControlCenterAccess } from '@/lib/ops-rbac'
import { ingestOperatingEvidenceEvent } from '@/server/operating-evidence-data'

const DESTRUCTIVE_ACTIONS = new Set(['restart_service', 'simulate_failure'])
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const requestWindow = new Map<string, number[]>()

const actionMeta: Record<string, { severity: 'medium' | 'high' | 'critical'; blastRadius: string }> = {
  restart_service: {
    severity: 'high',
    blastRadius: 'Service restart may interrupt active traffic for the selected service and upstream dependencies.',
  },
  trigger_reprocessing: {
    severity: 'medium',
    blastRadius: 'Reprocessing will re-run all queued events and alter downstream reporting windows.',
  },
  simulate_failure: {
    severity: 'critical',
    blastRadius: 'Failure simulation will disrupt all connected flows in the target service and trigger alert storms.',
  },
}

const ActionSchema = z.object({
  action: z.enum(['restart_service', 'trigger_reprocessing', 'simulate_failure']),
  service: z.string().min(1),
  reason: z.string().min(5),
  dryRun: z.boolean().default(false),
  confirmationText: z.string().optional(),
  acknowledgeBlastRadius: z.boolean().default(false),
})

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
    requireControlCenterAccess(request)
    return NextResponse.json({
      ok: true,
      data: {
        actions: ['restart_service', 'trigger_reprocessing', 'simulate_failure'].map((action) => ({
          action,
          ...actionMeta[action],
          destructive: DESTRUCTIVE_ACTIONS.has(action),
        })),
        destructiveActionHint: 'Type CONFIRM <action> <service>',
        note: 'Control center supports audited operations only. Non-audited execution is blocked.',
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)
    const principal = requireControlCenterAccess(request)
    const actorKey = `${principal.id}:${request.headers.get('x-forwarded-for') ?? 'local'}`
    const now = Date.now()
    const timestamps = (requestWindow.get(actorKey) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded for control-center actions. Retry in 60 seconds.',
        },
        { status: 429 },
      )
    }
    timestamps.push(now)
    requestWindow.set(actorKey, timestamps)

    const payload = ActionSchema.parse(await request.json())
    const meta = actionMeta[payload.action]

    const expectedConfirmation = `CONFIRM ${payload.action} ${payload.service}`
    if (DESTRUCTIVE_ACTIONS.has(payload.action)) {
      if (!payload.acknowledgeBlastRadius) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Blast radius must be acknowledged for destructive actions.',
            required: { acknowledgeBlastRadius: true },
            blastRadius: meta.blastRadius,
          },
          { status: 409 },
        )
      }

      if ((payload.confirmationText ?? '').trim() !== expectedConfirmation) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Confirmation text mismatch for destructive action.',
            required: { confirmationText: expectedConfirmation },
            blastRadius: meta.blastRadius,
          },
          { status: 409 },
        )
      }
    }

    await ingestOperatingEvidenceEvent({
      app: 'control-plane',
      domain: 'platform',
      type: 'admin_action',
      severity: meta.severity,
      payload: {
        action: payload.action,
        service: payload.service,
        reason: payload.reason,
        dryRun: payload.dryRun,
        actorId: principal.id,
        actorRole: principal.role,
        auditSeverity: meta.severity,
        blastRadius: meta.blastRadius,
      },
      correctedByHuman: true,
      overrideReason: payload.reason,
    })

    return NextResponse.json({
      ok: true,
      data: {
        executed: true,
        action: payload.action,
        service: payload.service,
        dryRun: payload.dryRun,
        actor: principal,
        severity: meta.severity,
        blastRadius: meta.blastRadius,
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
