/**
 * Pondu Server Actions — Warehouse & Batches.
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

export async function createBatch(
  data: unknown,
): Promise<AgriServiceResult<{ batchId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createBatchSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'batch',
    targetEntityId: id,
    action: 'batch.created',
    label: `Created batch in warehouse ${parsed.data.warehouseId}`,
    metadata: {
      warehouseId: parsed.data.warehouseId,
      lotIds: parsed.data.lotIds,
    },
  })

  // TODO: persist via agri-db BatchRepository

  revalidatePath('/pondu/warehouse')

  return { ok: true, data: { batchId: id }, error: null, auditEntries: [entry] }
}

export async function listBatches(): Promise<
  AgriServiceResult<{ batches: unknown[] }>
> {
  const ctx = await resolveOrgContext()

  // TODO: read via agri-db BatchRepository scoped to ctx.orgId

  return { ok: true, data: { batches: [] }, error: null, auditEntries: [] }
}
