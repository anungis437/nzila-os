/**
 * Pondu Server Actions — Quality Inspections.
 *
 * Record quality inspections and transition lot quality FSM.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  gradeLotSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'

export async function recordInspection(
  data: unknown,
): Promise<AgriServiceResult<{ inspectionId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = gradeLotSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'quality_inspection',
    targetEntityId: id,
    action: 'quality.inspected',
    label: `Quality inspection for lot ${parsed.data.lotId} — grade ${parsed.data.grade}`,
    metadata: {
      lotId: parsed.data.lotId,
      grade: parsed.data.grade,
      score: parsed.data.score,
    },
  })

  // TODO: persist via agri-db QualityRepository + transition LotQualityFSM

  revalidatePath('/pondu/quality')
  revalidatePath('/pondu/lots')

  return { ok: true, data: { inspectionId: id }, error: null, auditEntries: [entry] }
}

export async function listInspections(): Promise<
  AgriServiceResult<{ inspections: unknown[] }>
> {
  const ctx = await resolveOrgContext()

  // TODO: read via agri-db QualityRepository scoped to ctx.orgId

  return { ok: true, data: { inspections: [] }, error: null, auditEntries: [] }
}
