/**
 * API — Break-Glass Emergency Access
 * POST /api/admin/break-glass — activate break-glass access
 *
 * Policy-enforced: requires platform_admin role (access-break-glass policy).
 * Emits audit event on every attempt (allow or deny).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'
import { enforcePolicies } from '@/lib/policy-enforcement'
import { createLogger } from '@nzila/os-core'
import { activateBreakGlass, revokeBreakGlass, PlaneError } from '@nzila/platform-restricted-data'

const logger = createLogger('api:admin:break-glass')

const BreakGlassSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  durationMinutes: z.number().int().min(5).max(240).default(60),
  scope: z.object({
    orgId: z.string().uuid(),
    appDomain: z.string().min(1),
    resource: z.string().min(1),
    action: z.enum(['read', 'write']),
    principalId: z.string().min(1).optional(),
  }).strict(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateUser()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const parsed = BreakGlassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // ── Policy enforcement gate ──────────────────────────────────────────
    const policyResult = await enforcePolicies({
      action: 'break_glass.activate',
      resource: '/api/admin/break-glass',
      actor: {
        userId: auth.userId,
        roles: [auth.platformRole],
      },
      context: {
        environment: process.env.NODE_ENV ?? 'development',
        scope: parsed.data.scope,
        durationMinutes: parsed.data.durationMinutes,
      },
      orgId: parsed.data.scope.orgId,
      environment: process.env.NODE_ENV ?? 'development',
    })

    if (policyResult.blocked) {
      logger.warn('Break-glass denied by policy', {
        userId: auth.userId,
        reason: policyResult.reason,
      })
      return NextResponse.json(
        {
          error: 'Access denied by policy',
          detail: policyResult.reason,
          policyEnforced: true,
        },
        { status: 403 },
      )
    }

    if (policyResult.needsApproval) {
      logger.info('Break-glass requires approval', {
        userId: auth.userId,
        approverRoles: policyResult.approverRoles,
      })
      return NextResponse.json(
        {
          status: 'approval_required',
          approverRoles: policyResult.approverRoles,
          requiredApprovers: policyResult.requiredApprovers,
          policyEnforced: true,
        },
        { status: 202 },
      )
    }

    // ── Break-glass activation ───────────────────────────────────────────
    let scoped
    try {
      scoped = activateBreakGlass({
        actorId: auth.userId,
        reason: parsed.data.reason,
        durationMinutes: parsed.data.durationMinutes,
        scope: parsed.data.scope,
      })
    } catch (error) {
      if (error instanceof PlaneError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
      }
      throw error
    }
    const activation = {
      ...scoped,
      activatedBy: scoped.actorId,
      policyEnforced: true,
    }

    try {
      await recordAuditEvent({
        orgId: parsed.data.scope.orgId,
        targetType: 'break_glass',
        targetId: activation.id,
        action: 'break_glass.activated',
        actorClerkUserId: auth.userId,
        afterJson: activation,
      })
    } catch (error) {
      // An activation without a durable audit receipt must not remain usable.
      revokeBreakGlass(scoped.id)
      throw error
    }

    logger.info('Break-glass activated', {
      userId: auth.userId,
      activationId: activation.id,
      scope: activation.scope,
    })

    return NextResponse.json(activation, { status: 201 })
  } catch (err) {
    logger.error('[Break-Glass Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
