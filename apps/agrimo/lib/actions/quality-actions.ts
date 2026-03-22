/**
 * Agrimo Server Actions — Quality Inspections.
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
import { qualityRepo } from '@nzila/agri-db'

export async function recordInspection(
  data: unknown,
): Promise<AgriServiceResult<{ inspectionId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = gradeLotSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  await qualityRepo.updateInspectionGrade(
    dbCtx,
    parsed.data.inspectionId,
    parsed.data.grade,
    parsed.data.score,
  )

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'quality_inspection',
    targetEntityId: parsed.data.inspectionId,
    action: 'quality.inspected',
    label: `Quality inspection for lot ${parsed.data.lotId} — grade ${parsed.data.grade}`,
    metadata: {
      lotId: parsed.data.lotId,
      grade: parsed.data.grade,
      score: parsed.data.score,
    },
  })

  revalidatePath('/agrimo/quality')
  revalidatePath('/agrimo/lots')

  return { ok: true, data: { inspectionId: parsed.data.inspectionId }, error: null, auditEntries: [entry] }
}

export async function listInspections(
  lotId: string,
): Promise<AgriServiceResult<{ inspections: unknown[] }>> {
  const ctx = await resolveOrgContext()
  const inspections = await qualityRepo.listInspections({ orgId: ctx.orgId }, lotId)

  return { ok: true, data: { inspections }, error: null, auditEntries: [] }
}
