/**
 * Agrimo Server Actions — Lots.
 *
 * Create aggregation lots and manage producer contributions.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createLotSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'
import { lotRepo, harvestRepo } from '@nzila/agri-db'

export async function createLot(
  data: unknown,
): Promise<AgriServiceResult<{ lotId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createLotSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  const readCtx = { orgId: ctx.orgId }
  const harvests = await harvestRepo.getHarvestsByIds(readCtx, parsed.data.harvestIds)
  const contributions = harvests.map((h) => ({ harvestId: h.id, weight: h.quantity }))
  const lot = await lotRepo.createLot(dbCtx, parsed.data, contributions)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'lot',
    targetEntityId: lot.id,
    action: 'lot.created',
    label: `Created lot for crop ${parsed.data.cropId}`,
    metadata: {
      cropId: parsed.data.cropId,
      season: parsed.data.season,
    },
  })

  revalidatePath('/agrimo/lots')

  return { ok: true, data: { lotId: lot.id }, error: null, auditEntries: [entry] }
}

export async function listLots(): Promise<
  AgriServiceResult<{ lots: unknown[] }>
> {
  const ctx = await resolveOrgContext()
  const result = await lotRepo.listLots({ orgId: ctx.orgId })

  return { ok: true, data: { lots: result.rows }, error: null, auditEntries: [] }
}
