/**
 * Trade Server Actions — Quotes.
 *
 * Quote generation, acceptance, and lifecycle management.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createQuoteSchema,
  transitionQuoteSchema,
  buildActionAuditEntry,
  type TradeServiceResult,
  type TradeQuote,
} from '@nzila/trade-core'

export async function createQuote(
  data: unknown,
): Promise<TradeServiceResult<{ quoteId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createQuoteSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()
  const total = (
    parseFloat(parsed.data.unitPrice) * parsed.data.quantity
  ).toFixed(2)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_quote',
    targetEntityId: id,
    action: 'quote.created',
    label: `Created quote for deal ${parsed.data.dealId}`,
    metadata: {
      dealId: parsed.data.dealId,
      unitPrice: parsed.data.unitPrice,
      quantity: parsed.data.quantity,
      total,
      currency: parsed.data.currency,
    },
  })

  // TODO: persist quote + audit entry via trade-db repository
  // const repo = createTradeQuoteRepository(scopedDb)
  // await repo.create({
  //   ...parsed.data,
  //   id,
  //   entityId: ctx.entityId,
  //   total,
  //   status: TradeQuoteStatus.DRAFT,
  // })

  revalidatePath('/trade/deals')

  return { ok: true, data: { quoteId: id }, error: null, auditEntries: [entry] }
}

export async function transitionQuote(
  data: unknown,
): Promise<TradeServiceResult<{ quoteId: string; newStatus: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = transitionQuoteSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_quote',
    targetEntityId: parsed.data.quoteId,
    action: `quote.${parsed.data.toStatus}`,
    label: `Quote ${parsed.data.quoteId} → ${parsed.data.toStatus}`,
    metadata: parsed.data.metadata ?? {},
  })

  // TODO: persist status change + audit entry
  // If toStatus === 'accepted', generate evidence pack (EPIC 7)

  revalidatePath('/trade/deals')

  return {
    ok: true,
    data: { quoteId: parsed.data.quoteId, newStatus: parsed.data.toStatus },
    error: null,
    auditEntries: [entry],
  }
}

export async function listQuotesForDeal(
  dealId: string,
): Promise<TradeServiceResult<{ quotes: TradeQuote[] }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId

  return {
    ok: true,
    data: { quotes: [] },
    error: null,
    auditEntries: [],
  }
}
