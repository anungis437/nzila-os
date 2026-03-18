/**
 * Flow — Shipment Service
 *
 * Manages shipment creation, tracking, and lifecycle transitions.
 * Uses flow_shipments table for persistent shipment data.
 */
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { attemptShipmentTransition } from '@/lib/workflows/shipment-state-machine'
import { InvalidWorkflowTransitionError } from '@/lib/workflows/errors'
import type { ShipmentStatus } from '@/domain/entities'
import { logger } from '@/lib/logger'
import { db, flowShipments } from '@nzila/db'
import { eq, and } from 'drizzle-orm'

interface ShipmentResult {
  ok: boolean
  shipmentId?: string
  error?: string
}

interface TrackingInfo {
  carrier: string
  trackingNumber: string
}

/**
 * Create a new shipment for an order.
 */
export async function createShipment(
  orderId: string,
  orgId: string,
  opts: {
    productionJobId?: string
    shippingAddress?: Record<string, unknown>
  } = {},
): Promise<ShipmentResult> {
  const [row] = await db
    .insert(flowShipments)
    .values({
      orgId,
      orderId,
      productionJobId: opts.productionJobId ?? null,
      status: 'pending',
      shippingAddressJson: opts.shippingAddress ?? null,
    })
    .returning()

  logger.info('Shipment created', { shipmentId: row!.id, orderId })
  return { ok: true, shipmentId: row!.id }
}

/**
 * Add tracking information and mark shipment as shipped.
 */
export async function addTracking(
  shipmentId: string,
  orgId: string,
  tracking: TrackingInfo,
  userId: string,
): Promise<ShipmentResult> {
  // Load current state for workflow validation
  const [existing] = await db
    .select()
    .from(flowShipments)
    .where(and(eq(flowShipments.id, shipmentId), eq(flowShipments.orgId, orgId)))
    .limit(1)

  if (!existing) return { ok: false, error: 'Shipment not found' }

  const current = existing.status.toUpperCase() as ShipmentStatus
  const result = attemptShipmentTransition(current, 'SHIPPED')
  if (!result.ok) {
    throw new InvalidWorkflowTransitionError('shipment', current, 'SHIPPED')
  }

  const [row] = await db
    .update(flowShipments)
    .set({
      carrier: tracking.carrier,
      trackingNumber: tracking.trackingNumber,
      status: 'shipped',
      shippedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(flowShipments.id, shipmentId), eq(flowShipments.orgId, orgId)))
    .returning()

  if (!row) return { ok: false, error: 'Shipment not found' }

  emitWorkflowAuditEvent({
    event: 'order_shipped',
    quoteId: row.orderId,
    orgId,
    userId,
    metadata: { shipmentId, carrier: tracking.carrier, trackingNumber: tracking.trackingNumber },
  })

  logger.info('Shipment tracking added', { shipmentId, carrier: tracking.carrier })
  return { ok: true, shipmentId }
}

/**
 * Mark shipment as delivered.
 */
export async function markDelivered(
  shipmentId: string,
  orgId: string,
  userId: string,
): Promise<ShipmentResult> {
  // Load current state for workflow validation
  const [existing] = await db
    .select()
    .from(flowShipments)
    .where(and(eq(flowShipments.id, shipmentId), eq(flowShipments.orgId, orgId)))
    .limit(1)

  if (!existing) return { ok: false, error: 'Shipment not found' }

  const current = existing.status.toUpperCase() as ShipmentStatus
  const result = attemptShipmentTransition(current, 'DELIVERED')
  if (!result.ok) {
    throw new InvalidWorkflowTransitionError('shipment', current, 'DELIVERED')
  }

  const [row] = await db
    .update(flowShipments)
    .set({
      status: 'delivered',
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(flowShipments.id, shipmentId), eq(flowShipments.orgId, orgId)))
    .returning()

  if (!row) return { ok: false, error: 'Shipment not found' }

  emitWorkflowAuditEvent({
    event: 'order_delivered',
    quoteId: row.orderId,
    orgId,
    userId,
    metadata: { shipmentId },
  })

  logger.info('Shipment delivered', { shipmentId })
  return { ok: true, shipmentId }
}

/**
 * Find all shipments for an order.
 */
export async function findShipmentsByOrder(orderId: string, orgId: string) {
  return db
    .select()
    .from(flowShipments)
    .where(and(eq(flowShipments.orderId, orderId), eq(flowShipments.orgId, orgId)))
}
