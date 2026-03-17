/**
 * Events layer — domain events for Flow.
 *
 * All important actions emit structured audit events.
 */
export {
  FlowEventType,
  FlowEventSchema,
  EmitEventInput,
  type FlowEvent,
  type EmitEventInput as EmitEventInputType,
} from '../lib/events/event-types'

export {
  emitFlowEvent,
  emitQuoteEvent,
  emitOrderEvent,
  emitPaymentEvent,
  emitPOEvent,
  emitProductionEvent,
  onFlowEvent,
} from '../lib/events/emitter'
