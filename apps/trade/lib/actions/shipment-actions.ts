/**
 * Trade Server Actions — Shipments.
 *
 * Shipment creation and milestone updates.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createShipmentSchema,
  updateShipmentMilestoneSchema,
  buildActionAuditEntry,
  type TradeServiceResult,
  type TradeShipment,
} from '@nzila/trade-core'

export async function createShipment(
  data: unknown,
): Promise<TradeServiceResult<{ shipmentId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createShipmentSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_shipment',
    targetEntityId: id,
    action: 'shipment.created',
    label: `Created shipment ${parsed.data.originCountry} → ${parsed.data.destinationCountry}`,
    metadata: {
      dealId: parsed.data.dealId,
      originCountry: parsed.data.originCountry,
      destinationCountry: parsed.data.destinationCountry,
      carrier: parsed.data.carrier,
    },
  })

  // TODO: persist shipment + audit entry via trade-db repository

  revalidatePath('/trade/shipments')

  return { ok: true, data: { shipmentId: id }, error: null, auditEntries: [entry] }
}

export async function updateShipmentMilestone(
  data: unknown,
): Promise<TradeServiceResult<{ shipmentId: string; milestone: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = updateShipmentMilestoneSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_shipment',
    targetEntityId: parsed.data.shipmentId,
    action: 'shipment.milestone_updated',
    label: `Milestone "${parsed.data.milestoneName}" on shipment ${parsed.data.shipmentId}`,
    metadata: {
      milestoneName: parsed.data.milestoneName,
      completedAt: parsed.data.completedAt,
    },
  })

  // TODO: persist milestone update + audit entry
  // If all milestones complete, consider auto-transitioning deal stage

  revalidatePath('/trade/shipments')

  return {
    ok: true,
    data: { shipmentId: parsed.data.shipmentId, milestone: parsed.data.milestoneName },
    error: null,
    auditEntries: [entry],
  }
}

export async function listShipments(opts?: {
  page?: number
  pageSize?: number
  status?: string
  dealId?: string
}): Promise<TradeServiceResult<{ shipments: TradeShipment[]; total: number }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId

  return {
    ok: true,
    data: { shipments: [], total: 0 },
    error: null,
    auditEntries: [],
  }
}
