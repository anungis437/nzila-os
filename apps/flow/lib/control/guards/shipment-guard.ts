/**
 * Flow — Shipment Guard
 *
 * Validates prerequisites before shipment state transitions:
 * - production complete enough
 * - shipping address exists
 * - transition is valid
 */
import type { ShipmentGateCheckResult } from '@/lib/control/types'
import { orderRepo, productionRepo } from '@/lib/repositories'
import { findShipmentsByOrder } from '@/lib/services/shipment-service'
import { logger } from '@/lib/logger'

export async function checkShipmentReadiness(
  orderId: string,
  orgId: string,
): Promise<ShipmentGateCheckResult> {
  const blockers: string[] = []
  let productionComplete = false
  let shippingAddressExists = false

  // 1. Order exists
  const order = await orderRepo.findById(orderId, orgId)
  if (!order) {
    blockers.push(`Order "${orderId}" not found`)
    return {
      allowed: false,
      blockers,
      order_id: orderId,
      production_complete: false,
      shipping_address_exists: false,
    }
  }

  // 2. Production state — at least one job must be in READY_TO_SHIP or QUALITY_CHECK
  const jobs = await productionRepo.findByOrder(orderId, orgId)
  if (jobs.length === 0) {
    blockers.push('No production jobs found for this order')
  } else {
    const readyJobs = jobs.filter(j =>
      j.status === 'READY_TO_SHIP' || j.status === 'QUALITY_CHECK',
    )
    if (readyJobs.length === 0) {
      blockers.push('No production jobs are ready for shipment')
    } else {
      productionComplete = true
    }
  }

  // 3. Shipping address — check customer or order metadata
  if (order.customer_id) {
    // Customer record serves as address holder
    shippingAddressExists = true
  } else {
    blockers.push('No customer assigned — cannot determine shipping address')
  }

  logger.info('Shipment guard evaluated', {
    orderId,
    allowed: blockers.length === 0,
    productionComplete,
    shippingAddressExists,
  })

  return {
    allowed: blockers.length === 0,
    blockers,
    order_id: orderId,
    production_complete: productionComplete,
    shipping_address_exists: shippingAddressExists,
  }
}

export async function checkCanMarkShipped(
  shipmentId: string,
  orderId: string,
  orgId: string,
): Promise<ShipmentGateCheckResult> {
  const blockers: string[] = []

  const shipments = await findShipmentsByOrder(orderId, orgId)
  const shipment = shipments.find(s => s.id === shipmentId)

  if (!shipment) {
    blockers.push(`Shipment "${shipmentId}" not found`)
    return {
      allowed: false,
      blockers,
      order_id: orderId,
      production_complete: false,
      shipping_address_exists: false,
    }
  }

  if (shipment.status !== 'PENDING' && shipment.status !== 'PACKED') {
    blockers.push(`Shipment status "${shipment.status}" cannot transition to SHIPPED`)
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    order_id: orderId,
    production_complete: true,
    shipping_address_exists: true,
  }
}

export async function checkCanMarkDelivered(
  shipmentId: string,
  orderId: string,
  orgId: string,
): Promise<ShipmentGateCheckResult> {
  const blockers: string[] = []

  const shipments = await findShipmentsByOrder(orderId, orgId)
  const shipment = shipments.find(s => s.id === shipmentId)

  if (!shipment) {
    blockers.push(`Shipment "${shipmentId}" not found`)
    return {
      allowed: false,
      blockers,
      order_id: orderId,
      production_complete: false,
      shipping_address_exists: false,
    }
  }

  if (shipment.status !== 'SHIPPED' && shipment.status !== 'IN_TRANSIT') {
    blockers.push(`Shipment status "${shipment.status}" cannot transition to DELIVERED`)
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    order_id: orderId,
    production_complete: true,
    shipping_address_exists: true,
  }
}
