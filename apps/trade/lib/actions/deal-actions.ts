/**
 * Trade Server Actions — Deals.
 *
 * Deal creation and FSM-based stage transitions.
 * Transitions MUST go through `attemptDealTransition()` — no direct stage mutation.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createDealSchema,
  transitionDealSchema,
  buildActionAuditEntry,
  buildTransitionAuditEntry,
  type TradeServiceResult,
  type TradeDeal,
  type TradeAuditEntry,
  TradeDealStage,
} from '@nzila/trade-core'
import {
  attemptDealTransition,
  getAvailableDealTransitions,
  type TradeTransitionContext,
} from '@nzila/trade-core/machines'
import { tradeDealMachine } from '@nzila/trade-core/machines'

export async function createDeal(
  data: unknown,
): Promise<TradeServiceResult<{ dealId: string; refNumber: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createDealSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()
  const refNumber = `TRD-${Date.now().toString(36).toUpperCase()}`

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_deal',
    targetEntityId: id,
    action: 'deal.created',
    label: `Created deal ${refNumber}`,
    metadata: {
      sellerPartyId: parsed.data.sellerPartyId,
      buyerPartyId: parsed.data.buyerPartyId,
      totalValue: parsed.data.totalValue,
      currency: parsed.data.currency,
    },
  })

  // TODO: persist deal + audit entry via trade-db repository
  // const repo = createTradeDealRepository(scopedDb)
  // await repo.create({
  //   ...parsed.data,
  //   id,
  //   entityId: ctx.entityId,
  //   refNumber,
  //   stage: TradeDealStage.LEAD,
  // })

  revalidatePath('/trade/deals')

  return {
    ok: true,
    data: { dealId: id, refNumber },
    error: null,
    auditEntries: [entry],
  }
}

export async function transitionDeal(
  data: unknown,
): Promise<TradeServiceResult<{ dealId: string; newStage: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = transitionDealSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  // TODO: fetch current deal stage from DB
  // const repo = createTradeDealRepository(scopedDb)
  // const deal = await repo.findById(parsed.data.dealId, ctx.entityId)
  // if (!deal) return { ok: false, data: null, error: 'Deal not found', auditEntries: [] }
  // const currentStage = deal.stage

  // For now, use placeholder — real impl reads from DB
  const currentStage = TradeDealStage.LEAD

  const transitionCtx: TradeTransitionContext = {
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    meta: parsed.data.metadata ?? {},
  }

  const result = attemptDealTransition(
    tradeDealMachine,
    transitionCtx,
    { entityId: ctx.entityId, stage: currentStage },
    parsed.data.toStage,
  )

  if (!result.ok) {
    return {
      ok: false,
      data: null,
      error: `Transition blocked: ${result.reason}`,
      auditEntries: [],
    }
  }

  const auditEntry = buildTransitionAuditEntry(result, {
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_deal',
    targetEntityId: parsed.data.dealId,
  })

  // TODO: persist stage update + audit entry + emit events
  // await repo.updateStage(parsed.data.dealId, ctx.entityId, parsed.data.toStage)
  // for (const event of result.eventsToEmit) { await eventBus.emit(event) }
  // for (const action of result.actionsToSchedule) { await sagaRunner.schedule(action) }

  revalidatePath('/trade/deals')
  revalidatePath(`/trade/deals/${parsed.data.dealId}`)

  return {
    ok: true,
    data: { dealId: parsed.data.dealId, newStage: parsed.data.toStage },
    error: null,
    auditEntries: [auditEntry],
  }
}

export async function getDealTransitions(
  dealId: string,
): Promise<TradeServiceResult<{ transitions: string[] }>> {
  const ctx = await resolveOrgContext()

  // TODO: fetch current deal stage from DB
  const currentStage = TradeDealStage.LEAD

  const available = getAvailableDealTransitions(tradeDealMachine, {
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    meta: {},
  }, { entityId: ctx.entityId, stage: currentStage })

  return {
    ok: true,
    data: { transitions: available.map((t) => t.label) },
    error: null,
    auditEntries: [],
  }
}

export async function listDeals(opts?: {
  page?: number
  pageSize?: number
  stage?: string
}): Promise<TradeServiceResult<{ deals: TradeDeal[]; total: number }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId

  return {
    ok: true,
    data: { deals: [], total: 0 },
    error: null,
    auditEntries: [],
  }
}

export async function getDeal(
  dealId: string,
): Promise<TradeServiceResult<TradeDeal | null>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId
  // const repo = createTradeDealRepository(readonlyDb)
  // const deal = await repo.findById(dealId, ctx.entityId)

  return {
    ok: true,
    data: null,
    error: null,
    auditEntries: [],
  }
}
