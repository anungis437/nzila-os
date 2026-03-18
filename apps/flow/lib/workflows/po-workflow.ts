/**
 * Flow — Purchase Order Workflow State Machine
 *
 * Governs the vendor procurement lifecycle.
 */
import type { PurchaseOrderStatus } from '@/domain/entities'
import type { Transition, TransitionResult } from './types'
import { InvalidTransitionError } from './types'
import { logger } from '@/lib/logger'

const TRANSITIONS: readonly Transition<PurchaseOrderStatus>[] = [
  { from: 'DRAFT', to: 'SENT', label: 'Send to vendor', auditEvent: 'po_sent' },
  { from: 'DRAFT', to: 'CANCELLED', label: 'Cancel PO', auditEvent: null },
  { from: 'SENT', to: 'CONFIRMED', label: 'Vendor confirmed', auditEvent: 'po_confirmed' },
  { from: 'SENT', to: 'DRAFT', label: 'Return to draft', auditEvent: null },
  { from: 'SENT', to: 'CANCELLED', label: 'Cancel PO', auditEvent: null },
  { from: 'CONFIRMED', to: 'IN_PRODUCTION', label: 'Production started', auditEvent: 'po_in_production' },
  { from: 'CONFIRMED', to: 'CANCELLED', label: 'Cancel PO', auditEvent: null },
  { from: 'IN_PRODUCTION', to: 'SHIPPED', label: 'Vendor shipped', auditEvent: 'po_shipped' },
  { from: 'IN_PRODUCTION', to: 'CANCELLED', label: 'Cancel PO', auditEvent: null },
  { from: 'SHIPPED', to: 'RECEIVED', label: 'Goods received', auditEvent: 'po_received' },
] as const

export function validatePOTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to)
}

export function attemptPOTransition(
  current: PurchaseOrderStatus,
  target: PurchaseOrderStatus,
): TransitionResult<PurchaseOrderStatus> {
  const transition = TRANSITIONS.find(
    (t) => t.from === current && t.to === target,
  )

  if (!transition) {
    logger.warn('Invalid PO transition attempted', { from: current, to: target })
    return {
      ok: false,
      from: current,
      to: target,
      label: '',
      auditEvent: null,
      reason: `PO transition from ${current} to ${target} is not allowed`,
    }
  }

  logger.info('PO transition executed', {
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

export function applyPOTransition(
  current: PurchaseOrderStatus,
  target: PurchaseOrderStatus,
): PurchaseOrderStatus {
  if (!validatePOTransition(current, target)) {
    throw new InvalidTransitionError('purchase-order', current, target)
  }
  return target
}

export function getAvailablePOTransitions(
  current: PurchaseOrderStatus,
): readonly Transition<PurchaseOrderStatus>[] {
  return TRANSITIONS.filter((t) => t.from === current)
}
