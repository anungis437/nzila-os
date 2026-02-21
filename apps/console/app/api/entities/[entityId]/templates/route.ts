// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Governance Templates (replicability)
 * GET  /api/entities/[entityId]/templates   → list available templates
 * POST /api/entities/[entityId]/templates   → clone a template for this entity
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireEntityAccess } from '@/lib/api-guards'
import { z } from 'zod'
import {
  templateRegistry,
  initializeStandardTemplates,
  STANDARD_WORKFLOW_TEMPLATES,
  type TemplateRegistryEntry,
  ReplicableType,
} from '@/lib/governance'
import { listAvailableTemplates, getResolutionTemplate } from '@nzila/os-core'

// Ensure standard templates are loaded on first access
let initialised = false
function ensureInit() {
  if (!initialised) {
    initializeStandardTemplates('system')
    initialised = true
  }
}

const CloneTemplateSchema = z.object({
  templateId: z.string().uuid(),
  modifications: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  ensureInit()

  // Combine replicability templates with resolution Markdown templates
  const workflowTemplates = templateRegistry.getActive().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    type: t.type,
    category: t.category,
    version: t.version,
    cloneCount: t.replicability.cloneCount,
  }))

  const resolutionTemplateNames = listAvailableTemplates()

  return NextResponse.json({
    workflowTemplates,
    resolutionTemplates: resolutionTemplateNames,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!guard.ok) return guard.response
  const { userId } = guard.context

  ensureInit()

  const body = await req.json()
  const parsed = CloneTemplateSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = templateRegistry.clone(
    parsed.data.templateId,
    entityId,
    userId,
    parsed.data.modifications,
  )

  if (!result) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      content: result.content,
      replicability: {
        replicationId: result.replicability.replicationId,
        sourceId: result.replicability.sourceId,
        sourceVersion: result.replicability.sourceVersion,
        relation: result.replicability.relation,
        templateName: result.replicability.templateName,
        version: result.replicability.version,
      },
    },
    { status: 201 },
  )
}
