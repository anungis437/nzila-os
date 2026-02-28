/**
 * Pondu Server Actions — Lots.
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

export async function createLot(
  data: unknown,
): Promise<AgriServiceResult<{ lotId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createLotSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'lot',
    targetEntityId: id,
    action: 'lot.created',
    label: `Created lot for crop ${parsed.data.cropId}`,
    metadata: {
      cropId: parsed.data.cropId,
      season: parsed.data.season,
    },
  })

  // TODO: persist via agri-db LotRepository

  revalidatePath('/pondu/lots')

  return { ok: true, data: { lotId: id }, error: null, auditEntries: [entry] }
}

export async function listLots(): Promise<
  AgriServiceResult<{ lots: unknown[] }>
> {
  const ctx = await resolveOrgContext()

  // TODO: read via agri-db LotRepository scoped to ctx.orgId

  return { ok: true, data: { lots: [] }, error: null, auditEntries: [] }
}
