/**
 * Agrimo Server Actions — Harvests.
 *
 * Record harvest entries linked to producers and crops.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  recordHarvestSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'
import { harvestRepo } from '@nzila/agri-db'

export async function recordHarvest(
  data: unknown,
): Promise<AgriServiceResult<{ harvestId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = recordHarvestSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  const harvest = await harvestRepo.recordHarvest(dbCtx, parsed.data)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'harvest',
    targetEntityId: harvest.id,
    action: 'harvest.recorded',
    label: `Recorded harvest for producer ${parsed.data.producerId}`,
    metadata: {
      producerId: parsed.data.producerId,
      cropId: parsed.data.cropId,
      quantity: parsed.data.quantity,
    },
  })

  revalidatePath('/agrimo/harvests')

  return { ok: true, data: { harvestId: harvest.id }, error: null, auditEntries: [entry] }
}

export async function listHarvests(): Promise<
  AgriServiceResult<{ harvests: unknown[] }>
> {
  const ctx = await resolveOrgContext()
  const result = await harvestRepo.listHarvests({ orgId: ctx.orgId })

  return { ok: true, data: { harvests: result.rows }, error: null, auditEntries: [] }
}
