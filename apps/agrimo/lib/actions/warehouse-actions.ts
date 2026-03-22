/**
 * Agrimo Server Actions — Warehouse & Batches.
 *
 * Manage warehouses and inventory batches.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createBatchSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'
import { batchRepo, lotRepo } from '@nzila/agri-db'

export async function createBatch(
  data: unknown,
): Promise<AgriServiceResult<{ batchId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createBatchSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  const readCtx = { orgId: ctx.orgId }
  const lots = await Promise.all(
    parsed.data.lotIds.map((id) => lotRepo.getLotById(readCtx, id)),
  )
  const lotWeights = lots
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .map((l) => ({ lotId: l.id, weight: l.totalWeight }))
  const batch = await batchRepo.createBatch(dbCtx, parsed.data, lotWeights)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'batch',
    targetEntityId: batch.id,
    action: 'batch.created',
    label: `Created batch in warehouse ${parsed.data.warehouseId}`,
    metadata: {
      warehouseId: parsed.data.warehouseId,
      lotIds: parsed.data.lotIds,
    },
  })

  revalidatePath('/agrimo/warehouse')

  return { ok: true, data: { batchId: batch.id }, error: null, auditEntries: [entry] }
}

export async function listBatches(): Promise<
  AgriServiceResult<{ batches: unknown[] }>
> {
  const ctx = await resolveOrgContext()
  const result = await batchRepo.listBatches({ orgId: ctx.orgId })

  return { ok: true, data: { batches: result.rows }, error: null, auditEntries: [] }
}
