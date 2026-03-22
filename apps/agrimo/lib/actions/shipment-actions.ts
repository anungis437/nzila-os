/**
 * Agrimo Server Actions — Shipments.
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
import { shipmentRepo } from '@nzila/agri-db'

export async function createShipment(
  data: unknown,
): Promise<AgriServiceResult<{ shipmentId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createShipmentSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  const shipment = await shipmentRepo.createShipment(dbCtx, parsed.data)

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'shipment',
    targetEntityId: shipment.id,
    action: 'shipment.created',
    label: `Created shipment for batch ${parsed.data.batchId} → ${parsed.data.destination.country}`,
    metadata: {
      batchId: parsed.data.batchId,
      destination: parsed.data.destination.country,
    },
  })

  revalidatePath('/agrimo/shipments')

  return { ok: true, data: { shipmentId: shipment.id }, error: null, auditEntries: [entry] }
}

export async function recordMilestone(
  shipmentId: string,
  milestone: { event: string; location?: string },
): Promise<AgriServiceResult<{ ok: boolean }>> {
  const ctx = await resolveOrgContext()

  const dbCtx = { orgId: ctx.orgId, actorId: ctx.actorId }
  await shipmentRepo.addMilestone(dbCtx, {
    shipmentId,
    milestone: milestone.event,
    notes: milestone.location ?? null,
  })

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

  revalidatePath('/agrimo/shipments')

  return { ok: true, data: { ok: true }, error: null, auditEntries: [entry] }
}

export async function listShipments(): Promise<
  AgriServiceResult<{ shipments: unknown[] }>
> {
  const ctx = await resolveOrgContext()
  const result = await shipmentRepo.listShipments({ orgId: ctx.orgId })

  return { ok: true, data: { shipments: result.rows }, error: null, auditEntries: [] }
}
