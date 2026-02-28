/**
 * Trade Server Actions — Parties.
 *
 * CRUD for trade parties (sellers, buyers, brokers, agents).
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createPartySchema,
  updatePartySchema,
  buildActionAuditEntry,
  hashAuditEntry,
  type TradeServiceResult,
  type TradeParty,
  type TradeAuditEntry,
} from '@nzila/trade-core'

export async function createParty(
  data: unknown,
): Promise<TradeServiceResult<{ partyId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createPartySchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_party',
    targetEntityId: id,
    action: 'party.created',
    label: `Created party ${parsed.data.name}`,
    metadata: { role: parsed.data.role, country: parsed.data.country },
  })

  // TODO: persist party + audit entry via trade-db repository
  // const repo = createTradePartyRepository(scopedDb)
  // await repo.create({ ...parsed.data, id, entityId: ctx.entityId })

  revalidatePath('/trade/parties')

  return { ok: true, data: { partyId: id }, error: null, auditEntries: [entry] }
}

export async function updateParty(
  data: unknown,
): Promise<TradeServiceResult<{ partyId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = updatePartySchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_party',
    targetEntityId: parsed.data.id,
    action: 'party.updated',
    label: `Updated party ${parsed.data.id}`,
    metadata: { fields: Object.keys(parsed.data).filter((k) => k !== 'id') },
  })

  // TODO: persist via trade-db repository
  // const repo = createTradePartyRepository(scopedDb)
  // await repo.update(parsed.data.id, { ...parsed.data, entityId: ctx.entityId })

  revalidatePath('/trade/parties')

  return { ok: true, data: { partyId: parsed.data.id }, error: null, auditEntries: [entry] }
}

export async function listParties(opts?: {
  page?: number
  pageSize?: number
  role?: string
}): Promise<TradeServiceResult<{ parties: TradeParty[]; total: number }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId
  // const repo = createTradePartyRepository(readonlyDb)
  // const result = await repo.findAll({ entityId: ctx.entityId, ...opts })

  return {
    ok: true,
    data: { parties: [], total: 0 },
    error: null,
    auditEntries: [],
  }
}
