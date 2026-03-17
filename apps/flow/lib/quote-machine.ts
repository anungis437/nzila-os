/**
 * Quote state machine — Flow app.
 *
 * Wires @nzila/commerce-state for deterministic quote lifecycle transitions.
 * The quoteMachine enforces: draft → submitted → approved → accepted → expired
 * with governance guards evaluated at each transition.
 */
import {
  quoteMachine,
  attemptTransition,
  getAvailableTransitions,
  type TransitionContext,
  type TransitionResult,
  type EmittedEvent,
} from '@nzila/commerce-state'

export {
  quoteMachine,
  attemptTransition,
  getAvailableTransitions,
}
export type { TransitionContext, TransitionResult, EmittedEvent }

import type { QuoteStatus } from '@nzila/commerce-core'
import type { OrgRole } from '@nzila/commerce-core/enums'

/**
 * Attempt a quote status transition with audit context.
 * Returns a discriminated union: { ok: true, state, events } | { ok: false, reason }.
 */
export function transitionQuote(
  currentStatus: QuoteStatus,
  action: string,
  ctx: TransitionContext,
  resourceEntityId: string,
  entity: unknown = {},
): TransitionResult<QuoteStatus> {
  return attemptTransition(quoteMachine, currentStatus, action as QuoteStatus, ctx as TransitionContext<OrgRole>, resourceEntityId, entity)
}

/**
 * List valid next actions from a given quote status.
 */
export function availableQuoteActions(
  currentStatus: QuoteStatus,
  ctx: TransitionContext,
  resourceEntityId: string,
  entity: unknown = {},
): readonly unknown[] {
  return getAvailableTransitions(quoteMachine, currentStatus, ctx as TransitionContext<OrgRole>, resourceEntityId, entity)
}
