/**
 * Pondu Server Actions — Shipments.
 *
 * Create shipment plans and record milestones.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createShipmentSchema,
  buildActionAuditEntry,
  type AgriServiceResult,
} from '@nzila/agri-core'

export async function createShipment(
  data: unknown,
): Promise<AgriServiceResult<{ shipmentId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createShipmentSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'shipment',
    targetEntityId: id,
    action: 'shipment.created',
    label: `Created shipment for batch ${parsed.data.batchId} → ${parsed.data.destination.country}`,
    metadata: {
      batchId: parsed.data.batchId,
      destination: parsed.data.destination.country,
    },
  })

  // TODO: persist via agri-db ShipmentRepository

  revalidatePath('/pondu/shipments')

  return { ok: true, data: { shipmentId: id }, error: null, auditEntries: [entry] }
}

export async function recordMilestone(
  shipmentId: string,
  milestone: { event: string; location?: string },
): Promise<AgriServiceResult<{ ok: boolean }>> {
  const ctx = await resolveOrgContext()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'shipment',
    targetEntityId: shipmentId,
    action: 'shipment.milestone',
    label: `Milestone: ${milestone.event}`,
    metadata: milestone,
  })

  // TODO: persist milestone + transition ShipmentFSM

  revalidatePath('/pondu/shipments')

  return { ok: true, data: { ok: true }, error: null, auditEntries: [entry] }
}

export async function listShipments(): Promise<
  AgriServiceResult<{ shipments: unknown[] }>
> {
  const ctx = await resolveOrgContext()

  // TODO: read via agri-db ShipmentRepository scoped to ctx.orgId

  return { ok: true, data: { shipments: [] }, error: null, auditEntries: [] }
}
