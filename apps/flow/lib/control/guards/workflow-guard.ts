/**
 * Flow — Workflow Guard
 *
 * Enforces all lifecycle transitions through canonical state machines.
 * No handler/route may bypass this guard for status mutations.
 */
import type { WorkflowCheckResult } from '@/lib/control/types'
import {
  attemptQuoteTransition,
  getAvailableQuoteTransitions,
} from '@/lib/workflows/quote-state-machine'
import {
  attemptOrderTransition,
  getAvailableOrderTransitions,
} from '@/lib/workflows/order-workflow'
import {
  attemptPOTransition,
  getAvailablePOTransitions,
} from '@/lib/workflows/po-workflow'
import {
  attemptProductionTransition,
  getAvailableProductionTransitions,
} from '@/lib/workflows/production-workflow'
import {
  attemptShipmentTransition,
  getAvailableShipmentTransitions,
} from '@/lib/workflows/shipment-state-machine'
import type { QuoteWorkflowStatus } from '@/lib/schemas/workflow-schemas'

type WorkflowType = 'quote' | 'order' | 'purchase_order' | 'production' | 'shipment'

export function validateTransition(
  workflow: WorkflowType,
  from: string,
  to: string,
): WorkflowCheckResult {
  switch (workflow) {
    case 'quote': {
      const result = attemptQuoteTransition(from as QuoteWorkflowStatus, to as QuoteWorkflowStatus)
      return {
        allowed: result.ok,
        from: result.from,
        to: result.to,
        reason: result.reason,
      }
    }
    case 'order': {
      const result = attemptOrderTransition(from as never, to as never)
      return {
        allowed: result.ok,
        from: result.from,
        to: result.to,
        reason: result.reason,
      }
    }
    case 'purchase_order': {
      const result = attemptPOTransition(from as never, to as never)
      return {
        allowed: result.ok,
        from: result.from,
        to: result.to,
        reason: result.reason,
      }
    }
    case 'production': {
      const result = attemptProductionTransition(from as never, to as never)
      return {
        allowed: result.ok,
        from: result.from,
        to: result.to,
        reason: result.reason,
      }
    }
    case 'shipment': {
      const result = attemptShipmentTransition(from as never, to as never)
      return {
        allowed: result.ok,
        from: result.from,
        to: result.to,
        reason: result.reason,
      }
    }
  }
}

export function getAvailableTransitions(
  workflow: WorkflowType,
  currentStatus: string,
): string[] {
  switch (workflow) {
    case 'quote':
      return getAvailableQuoteTransitions(currentStatus as QuoteWorkflowStatus).map(t => t.to)
    case 'order':
      return getAvailableOrderTransitions(currentStatus as never).map(t => t.to)
    case 'purchase_order':
      return getAvailablePOTransitions(currentStatus as never).map(t => t.to)
    case 'production':
      return getAvailableProductionTransitions(currentStatus as never).map(t => t.to)
    case 'shipment':
      return getAvailableShipmentTransitions(currentStatus as never).map(t => t.to)
  }
}
