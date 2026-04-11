/**
 * @nzila/commerce-state — Barrel Export
 *
 * @module @nzila/commerce-state
 */
export {
  attemptTransition,
  getAvailableTransitions,
  validateMachine,
} from './engine'

export type {
  TransitionContext,
  Guard,
  EmittedEvent,
  ScheduledAction,
  TransitionDef,
  MachineDefinition,
  TransitionSuccess,
  TransitionFailure,
  TransitionResult,
} from './engine'

export { quoteMachine } from './machines/quote'
export { orderMachine } from './machines/order'
export { invoiceMachine } from './machines/invoice'
export { fulfillmentMachine } from './machines/fulfillment'

export { toFsmCoreMachine } from './compat'
