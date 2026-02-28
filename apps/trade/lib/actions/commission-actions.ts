/**
 * Trade Server Actions — Commissions.
 *
 * Commission preview and finalization on deals.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createCommissionSchema,
  finalizeCommissionSchema,
  buildActionAuditEntry,
  type TradeServiceResult,
  type TradeCommission,
} from '@nzila/trade-core'

export async function createCommission(
  data: unknown,
): Promise<TradeServiceResult<{ commissionId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createCommissionSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_commission',
    targetEntityId: id,
    action: 'commission.created',
    label: `Created commission for deal ${parsed.data.dealId} / party ${parsed.data.partyId}`,
    metadata: {
      dealId: parsed.data.dealId,
      partyId: parsed.data.partyId,
      currency: parsed.data.currency,
    },
  })

  // TODO: persist commission + audit entry via trade-db repository

  revalidatePath('/trade/commissions')

  return { ok: true, data: { commissionId: id }, error: null, auditEntries: [entry] }
}

export async function finalizeCommission(
  data: unknown,
): Promise<TradeServiceResult<{ commissionId: string; finalizedAmount: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = finalizeCommissionSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_commission',
    targetEntityId: parsed.data.commissionId,
    action: 'commission.finalized',
    label: `Finalized commission ${parsed.data.commissionId} at ${parsed.data.calculatedAmount}`,
    metadata: {
      calculatedAmount: parsed.data.calculatedAmount,
    },
  })

  // TODO: persist finalization + audit entry
  // Generate evidence pack (EPIC 7)

  revalidatePath('/trade/commissions')

  return {
    ok: true,
    data: {
      commissionId: parsed.data.commissionId,
      finalizedAmount: parsed.data.calculatedAmount,
    },
    error: null,
    auditEntries: [entry],
  }
}

export async function listCommissions(opts?: {
  page?: number
  pageSize?: number
  status?: string
  dealId?: string
}): Promise<TradeServiceResult<{ commissions: TradeCommission[]; total: number }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId

  return {
    ok: true,
    data: { commissions: [], total: 0 },
    error: null,
    auditEntries: [],
  }
}
