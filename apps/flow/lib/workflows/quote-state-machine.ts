/**
 * ShopMoiCa Quote State Machine
 *
 * Defines the canonical quote lifecycle transitions for ShopMoiCa.ca.
 * Enforces allowed transitions only — no direct invalid state jumps.
 *
 * This is the app-level state machine. The platform-level machine from
 * @nzila/commerce-state handles the abstract commerce lifecycle.
 * This module adds ShopMoiCa-specific statuses (deposit, production, shipping).
 */
import type {
  QuoteWorkflowStatus,
  WorkflowAuditEvent,
} from '@/lib/schemas/workflow-schemas'
import { logger } from '@/lib/logger'

// ── Transition Definition ──────────────────────────────────────────────────

interface Transition {
  from: QuoteWorkflowStatus
  to: QuoteWorkflowStatus
  label: string
  auditEvent: WorkflowAuditEvent | null
}

const TRANSITIONS: readonly Transition[] = [
  // Draft phase
  { from: 'DRAFT', to: 'INTERNAL_REVIEW', label: 'Submit for review', auditEvent: null },
  { from: 'DRAFT', to: 'CANCELLED', label: 'Cancel quote', auditEvent: null },

  // Review phase
  { from: 'INTERNAL_REVIEW', to: 'SENT_TO_CLIENT', label: 'Send to client', auditEvent: 'quote_sent_to_client' },
  { from: 'INTERNAL_REVIEW', to: 'DRAFT', label: 'Return to draft', auditEvent: null },

  // Client response phase
  { from: 'SENT_TO_CLIENT', to: 'ACCEPTED', label: 'Client accepted', auditEvent: 'quote_accepted_by_client' },
  { from: 'SENT_TO_CLIENT', to: 'REVISION_REQUESTED', label: 'Revision requested', auditEvent: 'quote_revision_requested' },
  { from: 'SENT_TO_CLIENT', to: 'EXPIRED', label: 'Quote expired', auditEvent: null },
  { from: 'SENT_TO_CLIENT', to: 'CANCELLED', label: 'Cancel quote', auditEvent: null },

  // Revision phase
  { from: 'REVISION_REQUESTED', to: 'DRAFT', label: 'Re-edit quote', auditEvent: null },
  { from: 'REVISION_REQUESTED', to: 'SENT_TO_CLIENT', label: 'Re-send to client', auditEvent: 'quote_sent_to_client' },

  // Acceptance → payment / PO gate
  { from: 'ACCEPTED', to: 'DEPOSIT_REQUIRED', label: 'Deposit required', auditEvent: 'deposit_required_set' },
  { from: 'ACCEPTED', to: 'READY_FOR_PO', label: 'Ready for PO (no deposit)', auditEvent: 'quote_unblocked_for_po' },

  // Deposit → PO
  { from: 'DEPOSIT_REQUIRED', to: 'READY_FOR_PO', label: 'Deposit received', auditEvent: 'quote_unblocked_for_po' },

  // PO → Production → Shipping
  { from: 'READY_FOR_PO', to: 'IN_PRODUCTION', label: 'Production started', auditEvent: 'production_started' },
  { from: 'IN_PRODUCTION', to: 'SHIPPED', label: 'Order shipped', auditEvent: 'order_shipped' },
  { from: 'SHIPPED', to: 'DELIVERED', label: 'Order delivered', auditEvent: 'order_delivered' },
  { from: 'DELIVERED', to: 'CLOSED', label: 'Close out', auditEvent: 'quote_closed' },
] as const

// ── Public API ─────────────────────────────────────────────────────────────

export interface TransitionResult {
  ok: boolean
  from: QuoteWorkflowStatus
  to: QuoteWorkflowStatus
  label: string
  auditEvent: WorkflowAuditEvent | null
  reason?: string
}

/**
 * Attempt a quote status transition.
 * Returns a discriminated result — ok: true if transition is valid.
 */
export function attemptQuoteTransition(
  current: QuoteWorkflowStatus,
  target: QuoteWorkflowStatus,
): TransitionResult {
  const transition = TRANSITIONS.find(
    (t) => t.from === current && t.to === target,
  )

  if (!transition) {
    logger.warn('Invalid quote transition attempted', {
      from: current,
      to: target,
    })
    return {
      ok: false,
      from: current,
      to: target,
      label: '',
      auditEvent: null,
      reason: `Transition from ${current} to ${target} is not allowed`,
    }
  }

  logger.info('Quote transition executed', {
    from: current,
    to: target,
    label: transition.label,
  })

  return {
    ok: true,
    from: transition.from,
    to: transition.to,
    label: transition.label,
    auditEvent: transition.auditEvent,
  }
}

/**
 * Get all valid target statuses from a given status.
 */
export function getAvailableQuoteTransitions(
  current: QuoteWorkflowStatus,
): readonly Transition[] {
  return TRANSITIONS.filter((t) => t.from === current)
}

/**
 * Check if a specific transition is allowed.
 */
export function isQuoteTransitionAllowed(
  current: QuoteWorkflowStatus,
  target: QuoteWorkflowStatus,
): boolean {
  return TRANSITIONS.some((t) => t.from === current && t.to === target)
}

/**
 * Get all defined statuses that appear in the state machine.
 */
export function getAllQuoteStatuses(): readonly QuoteWorkflowStatus[] {
  const statuses = new Set<QuoteWorkflowStatus>()
  for (const t of TRANSITIONS) {
    statuses.add(t.from)
    statuses.add(t.to)
  }
  return [...statuses]
}

/**
 * Get the transition definition for a from→to pair, if valid.
 */
export function getTransitionDefinition(
  from: QuoteWorkflowStatus,
  to: QuoteWorkflowStatus,
): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to)
}
