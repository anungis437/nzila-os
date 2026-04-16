/**
 * Control Plane API — Governance Actions
 *
 * POST /api/control-plane/governance/actions        → create draft action
 * GET  /api/control-plane/governance/actions?orgId= → list actions for org
 * POST /api/control-plane/governance/actions/submit → submit for approval
 * POST /api/control-plane/governance/actions/decide → decide on approval
 * POST /api/control-plane/governance/actions/execute → execute approved action
 *
 * All governance mutations across the platform must flow through these endpoints.
 * Only the Control Plane evaluates policy and advances governance state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import {
  createGovernanceAction,
  submitGovernanceAction,
  decideApproval,
  executeGovernanceAction,
} from '@/server/governance/state-machine'
import { platformDb } from '@nzila/db/platform'
import { governanceActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('control-plane:api:governance:actions')

// ── Request schemas ──────────────────────────────────────────────────────────

const CreateActionSchema = z.object({
  operation: z.literal('create'),
  orgId: z.string().uuid(),
  actionType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdBy: z.string().min(1),
})

const SubmitActionSchema = z.object({
  operation: z.literal('submit'),
  actionId: z.string().uuid(),
  orgId: z.string().uuid(),
  submittedBy: z.string().min(1),
  context: z
    .object({
      totalSharesOutstanding: z.number().optional(),
      quantity: z.number().optional(),
      amount: z.number().optional(),
      transferRestricted: z.boolean().optional(),
      rofrApplies: z.boolean().optional(),
    })
    .optional(),
})

const DecideApprovalSchema = z.object({
  operation: z.literal('decide'),
  actionId: z.string().uuid(),
  orgId: z.string().uuid(),
  approvalId: z.string().uuid(),
  decidedBy: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
})

const ExecuteActionSchema = z.object({
  operation: z.literal('execute'),
  actionId: z.string().uuid(),
  orgId: z.string().uuid(),
  executedBy: z.string().min(1),
})

const GovernanceActionRequestSchema = z.discriminatedUnion('operation', [
  CreateActionSchema,
  SubmitActionSchema,
  DecideApprovalSchema,
  ExecuteActionSchema,
])

// ── POST — advance governance state machine ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)

    const body = await request.json().catch(() => ({}))
    const parsed = GovernanceActionRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const req = parsed.data

    switch (req.operation) {
      case 'create': {
        const result = await createGovernanceAction({
          orgId: req.orgId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          actionType: req.actionType as any,
          payload: req.payload,
          createdBy: req.createdBy,
        })
        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
        }
        return NextResponse.json({ ok: true, data: result.data }, { status: 201 })
      }

      case 'submit': {
        const result = await submitGovernanceAction({
          actionId: req.actionId,
          orgId: req.orgId,
          submittedBy: req.submittedBy,
          context: req.context,
        })
        if (!result.ok) {
          const status = result.error.code === 'POLICY_BLOCKED' ? 422 : result.error.code === 'NOT_FOUND' ? 404 : 409
          return NextResponse.json({ ok: false, error: result.error }, { status })
        }
        return NextResponse.json({ ok: true, data: result.data })
      }

      case 'decide': {
        const result = await decideApproval({
          actionId: req.actionId,
          orgId: req.orgId,
          approvalId: req.approvalId,
          decidedBy: req.decidedBy,
          decision: req.decision,
          notes: req.notes,
        })
        if (!result.ok) {
          const status = result.error.code === 'NOT_FOUND' ? 404 : 409
          return NextResponse.json({ ok: false, error: result.error }, { status })
        }
        return NextResponse.json({ ok: true, data: result.data })
      }

      case 'execute': {
        const result = await executeGovernanceAction({
          actionId: req.actionId,
          orgId: req.orgId,
          executedBy: req.executedBy,
        })
        if (!result.ok) {
          const status =
            result.error.code === 'NOT_FOUND' ? 404
            : result.error.code === 'INVALID_STATE' ? 409
            : result.error.code === 'APPROVALS_INCOMPLETE' ? 422
            : 500
          return NextResponse.json({ ok: false, error: result.error }, { status })
        }
        return NextResponse.json({ ok: true, data: result.data })
      }

      default: {
        return NextResponse.json({ ok: false, error: 'Unknown operation' }, { status: 400 })
      }
    }
  } catch (error) {
    logger.error('Governance action API error', { error })
    return handleAuthError(error)
  }
}

// ── GET — list governance actions for an org ─────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)

    const orgId = request.nextUrl.searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'orgId query param required' }, { status: 400 })
    }

    const actions = await platformDb
      .select()
      .from(governanceActions)
      .where(eq(governanceActions.orgId, orgId))
      .orderBy(governanceActions.createdAt)

    return NextResponse.json({ ok: true, data: actions })
  } catch (error) {
    return handleAuthError(error)
  }
}
