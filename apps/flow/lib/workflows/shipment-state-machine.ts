/**
 * Flow — Shipment Workflow State Machine
 *
 * Governs the shipment lifecycle from pending to delivered.
 */
import type { ShipmentStatus } from '@/domain/entities'
import type { Transition, TransitionResult } from './types'
import { InvalidTransitionError } from './types'
import { logger } from '@/lib/logger'

const TRANSITIONS: readonly Transition<ShipmentStatus>[] = [
  { from: 'PENDING', to: 'PACKED', label: 'Order packed', auditEvent: null },
  { from: 'PACKED', to: 'SHIPPED', label: 'Shipped out', auditEvent: 'shipment_created' },
  { from: 'SHIPPED', to: 'IN_TRANSIT', label: 'In transit', auditEvent: 'shipment_in_transit' },
  { from: 'IN_TRANSIT', to: 'DELIVERED', label: 'Delivered', auditEvent: 'order_delivered' },
  { from: 'IN_TRANSIT', to: 'FAILED', label: 'Delivery failed', auditEvent: 'shipment_failed' },
  { from: 'FAILED', to: 'PENDING', label: 'Retry shipment', auditEvent: null },
  { from: 'FAILED', to: 'RETURNED', label: 'Return to sender', auditEvent: null },
  // Direct ship shortcut (e.g. small parcels that skip packing)
  { from: 'PENDING', to: 'SHIPPED', label: 'Ship directly', auditEvent: 'shipment_created' },
] as const

export function validateShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to)
}

export function attemptShipmentTransition(
  current: ShipmentStatus,
  target: ShipmentStatus,
): TransitionResult<ShipmentStatus> {
  const transition = TRANSITIONS.find(
    (t) => t.from === current && t.to === target,
  )

  if (!transition) {
    logger.warn('Invalid shipment transition attempted', { from: current, to: target })
    return {
      ok: false,
      from: current,
      to: target,
      label: '',
      auditEvent: null,
      reason: `Shipment transition from ${current} to ${target} is not allowed`,
    }
  }

  logger.info('Shipment transition executed', {
    from: current,
    to: target,
    label: transition.label,
  })

  return {
    ok: true,
    from: current,
    to: target,
    label: transition.label,
    auditEvent: transition.auditEvent,
  }
}

export function applyShipmentTransition(
  current: ShipmentStatus,
  target: ShipmentStatus,
): ShipmentStatus {
  if (!validateShipmentTransition(current, target)) {
    throw new InvalidTransitionError('shipment', current, target)
  }
  return target
}

export function getAvailableShipmentTransitions(
  current: ShipmentStatus,
): readonly Transition<ShipmentStatus>[] {
  return TRANSITIONS.filter((t) => t.from === current)
}
