/**
 * Flow — Order Workflow State Machine (PRIMARY)
 *
 * The order is the primary entity in Flow. This machine governs the
 * full lifecycle: creation → payment → procurement → production → fulfillment.
 */
import type { OrderStatus } from '@/domain/entities'
import type { Transition, TransitionResult } from './types'
import { InvalidTransitionError } from './types'
import { logger } from '@/lib/logger'

const TRANSITIONS: readonly Transition<OrderStatus>[] = [
  // Creation
  { from: 'CREATED', to: 'CONFIRMED', label: 'Confirm order', auditEvent: 'order_confirmed' },
  { from: 'CREATED', to: 'CANCELLED', label: 'Cancel order', auditEvent: 'order_cancelled' },

  // Payment flow
  { from: 'CONFIRMED', to: 'DEPOSIT_REQUIRED', label: 'Deposit required', auditEvent: 'deposit_required' },
  { from: 'CONFIRMED', to: 'PAYMENT_COMPLETE', label: 'Full payment (no deposit)', auditEvent: 'payment_received' },
  { from: 'CONFIRMED', to: 'CANCELLED', label: 'Cancel order', auditEvent: 'order_cancelled' },

  { from: 'DEPOSIT_REQUIRED', to: 'PAYMENT_PARTIAL', label: 'Deposit received', auditEvent: 'payment_received' },
  { from: 'DEPOSIT_REQUIRED', to: 'CANCELLED', label: 'Cancel order', auditEvent: 'order_cancelled' },

  { from: 'PAYMENT_PARTIAL', to: 'PAYMENT_COMPLETE', label: 'Full payment received', auditEvent: 'payment_received' },

  // Procurement
  { from: 'PAYMENT_COMPLETE', to: 'READY_FOR_PROCUREMENT', label: 'Ready for procurement', auditEvent: 'order_ready_for_procurement' },

  // Production
  { from: 'READY_FOR_PROCUREMENT', to: 'IN_PRODUCTION', label: 'Production started', auditEvent: 'production_started' },

  // Shipping
  { from: 'IN_PRODUCTION', to: 'READY_TO_SHIP', label: 'Ready to ship', auditEvent: 'order_ready_to_ship' },
  { from: 'READY_TO_SHIP', to: 'SHIPPED', label: 'Order shipped', auditEvent: 'order_shipped' },

  // Delivery
  { from: 'SHIPPED', to: 'DELIVERED', label: 'Order delivered', auditEvent: 'order_delivered' },
  { from: 'DELIVERED', to: 'CLOSED', label: 'Close order', auditEvent: 'order_closed' },
] as const

export function validateOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to)
}

export function attemptOrderTransition(
  current: OrderStatus,
  target: OrderStatus,
): TransitionResult<OrderStatus> {
  const transition = TRANSITIONS.find(
    (t) => t.from === current && t.to === target,
  )

  if (!transition) {
    logger.warn('Invalid order transition attempted', { from: current, to: target })
    return {
      ok: false,
      from: current,
      to: target,
      label: '',
      auditEvent: null,
      reason: `Transition from ${current} to ${target} is not allowed`,
    }
  }

  logger.info('Order transition executed', {
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

export function applyOrderTransition(
  current: OrderStatus,
  target: OrderStatus,
): OrderStatus {
  if (!validateOrderTransition(current, target)) {
    throw new InvalidTransitionError('order', current, target)
  }
  return target
}

export function getAvailableOrderTransitions(
  current: OrderStatus,
): readonly Transition<OrderStatus>[] {
  return TRANSITIONS.filter((t) => t.from === current)
}

export function getAllOrderStatuses(): readonly OrderStatus[] {
  return [
    'CREATED', 'CONFIRMED', 'DEPOSIT_REQUIRED', 'PAYMENT_PARTIAL',
    'PAYMENT_COMPLETE', 'READY_FOR_PROCUREMENT', 'IN_PRODUCTION',
    'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CLOSED', 'CANCELLED',
  ]
}
