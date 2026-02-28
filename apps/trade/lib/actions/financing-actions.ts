/**
 * Trade Server Actions — Financing.
 *
 * Attach financing terms to a deal.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createFinancingSchema,
  buildActionAuditEntry,
  type TradeServiceResult,
  type TradeFinancingTerms,
} from '@nzila/trade-core'

export async function attachFinancing(
  data: unknown,
): Promise<TradeServiceResult<{ financingId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createFinancingSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_financing',
    targetEntityId: id,
    action: 'financing.attached',
    label: `Attached financing to deal ${parsed.data.dealId}`,
    metadata: {
      dealId: parsed.data.dealId,
      provider: parsed.data.provider,
    },
  })

  // TODO: persist financing terms + audit entry via trade-db repository

  revalidatePath('/trade/deals')

  return { ok: true, data: { financingId: id }, error: null, auditEntries: [entry] }
}

export async function getFinancingForDeal(
  dealId: string,
): Promise<TradeServiceResult<{ financing: TradeFinancingTerms | null }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId

  return {
    ok: true,
    data: { financing: null },
    error: null,
    auditEntries: [],
  }
}
