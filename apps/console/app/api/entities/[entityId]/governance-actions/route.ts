// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Governance Actions
 * GET  /api/entities/[entityId]/governance-actions   → list
 * POST /api/entities/[entityId]/governance-actions   → create + policy eval
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { governanceActions, entities } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'
import {
  evaluateGovernanceRequirements,
  GovernanceActionType,
  PolicyConfigSchema,
} from '@nzila/os-core'
import { createWorkflow, type ApprovalWorkflow } from '@/lib/governance'
import { WorkflowType } from '@/lib/equity/models'

const CreateActionSchema = z.object({
  actionType: GovernanceActionType,
  payload: z.record(z.unknown()).default({}),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const rows = await platformDb
    .select()
    .from(governanceActions)
    .where(eq(governanceActions.entityId, entityId))
    .orderBy(desc(governanceActions.createdAt))

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!guard.ok) return guard.response
  const { userId } = guard.context

  const body = await req.json()
  const parsed = CreateActionSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Load entity policy config
  const [entity] = await platformDb
    .select({ policyConfig: entities.policyConfig })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1)

  const policyConfig = PolicyConfigSchema.safeParse(entity?.policyConfig ?? {})
  const evaluation = evaluateGovernanceRequirements(
    parsed.data.actionType,
    parsed.data.payload as Record<string, number | boolean | undefined>,
    policyConfig.success ? policyConfig.data : {},
  )

  const [action] = await platformDb
    .insert(governanceActions)
    .values({
      entityId,
      actionType: parsed.data.actionType,
      payload: parsed.data.payload,
      requirements: evaluation,
      createdBy: userId,
      status: evaluation.allowed ? 'pending_approval' : 'draft',
    })
    .returning()

  // Auto-create an approval workflow when the action requires approval
  let workflow: ApprovalWorkflow | null = null
  if (evaluation.allowed && evaluation.workflowSpec) {
    workflow = createWorkflow(
      WorkflowType.SHARE_ISSUANCE,
      userId,
      'system',
      parsed.data.actionType,
      parsed.data.payload as Record<string, unknown>,
      `Auto-generated workflow for ${parsed.data.actionType}`,
      evaluation.workflowSpec,
    )
  }

  return NextResponse.json({ action, evaluation, workflow }, { status: 201 })
}
