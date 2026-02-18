/**
 * API — Resolutions
 * GET  /api/entities/[entityId]/resolutions   → list resolutions
 * POST /api/entities/[entityId]/resolutions   → create resolution
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { resolutions } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'
import { getResolutionTemplate, listAvailableTemplates } from '@nzila/os-core'

const CreateResolutionSchema = z.object({
  kind: z.enum(['board', 'shareholder', 'special']),
  title: z.string().min(1),
  bodyMarkdown: z.string().optional(),
  /** If provided (e.g. 'issue_shares'), auto-generates bodyMarkdown from template */
  templateAction: z.string().optional(),
  /** Params to interpolate into the template */
  templateParams: z.record(z.string(), z.string()).optional(),
  meetingId: z.string().uuid().optional(),
  effectiveDate: z.string().optional(),
  requiresSpecialResolution: z.boolean().optional(),
  requiredApprovalThreshold: z.number().min(0).max(1).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const rows = await db
    .select()
    .from(resolutions)
    .where(eq(resolutions.entityId, entityId))
    .orderBy(desc(resolutions.createdAt))

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!guard.ok) return guard.response

  const body = await req.json()
  const parsed = CreateResolutionSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Auto-generate bodyMarkdown from template when not explicitly provided
  let bodyMarkdown = parsed.data.bodyMarkdown ?? null
  if (!bodyMarkdown && parsed.data.templateAction) {
    const tpl = getResolutionTemplate(
      parsed.data.templateAction as Parameters<typeof getResolutionTemplate>[0],
      { ...parsed.data.templateParams, effectiveDate: parsed.data.effectiveDate ?? '' },
    )
    if (tpl) bodyMarkdown = tpl.bodyMarkdown
  }

  const [resolution] = await db
    .insert(resolutions)
    .values({
      entityId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      bodyMarkdown,
      meetingId: parsed.data.meetingId ?? null,
      effectiveDate: parsed.data.effectiveDate ?? null,
      requiresSpecialResolution: parsed.data.requiresSpecialResolution ?? false,
      requiredApprovalThreshold: parsed.data.requiredApprovalThreshold?.toString() ?? null,
    })
    .returning()

  return NextResponse.json(resolution, { status: 201 })
}
