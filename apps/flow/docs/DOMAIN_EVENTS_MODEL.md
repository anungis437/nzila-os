# Flow — Domain Events Model

## Overview

Every critical state change in Flow emits a **domain event** — an immutable, persisted record of what happened and why. Domain events are the audit trail, the trigger for side effects, and the source of truth for timeline views.

## Event Types

Events are defined in `lib/events/event-types.ts` as a Zod enum (`FlowEventType`).

### Quote Events (7)
`quote_created`, `quote_line_added`, `quote_sent`, `quote_accepted`, `quote_revised`, `quote_rejected`, `quote_expired`

### Order Events (11)  
`order_created`, `order_confirmed`, `order_updated`, `order_cancelled`, `order_needs_attention`, `order_locked`, `order_payment_blocked`, `order_payment_cleared`, `fulfillment_started`, `order_shipped`, `order_delivered`

### Payment Events (5)  
`payment_required`, `payment_recorded`, `payment_confirmed`, `payment_failed`, `payment_refunded`

### Purchase Order Events (9)  
`po_draft_created`, `po_sent_to_vendor`, `po_vendor_acknowledged`, `po_partially_received`, `po_fully_received`, `po_revision_requested`, `po_overdue`, `po_cancelled`, `po_line_added`

### Production Events (9)  
`production_job_created`, `proof_sent`, `proof_approved`, `production_started`, `production_completed`, `production_quality_check`, `production_blocked`, `production_unblocked`, `production_delayed`

### Invoice/Fulfillment/Shipment/System (10+)  
`invoice_generated`, `invoice_sent`, `invoice_paid`, `fulfillment_started`, `shipment_created`, `shipment_shipped`, `shipment_delivered`, `workflow_guard_blocked`, `workflow_guard_cleared`, `system_health_check`

## Emission

Events are emitted via `lib/events/emitter.ts`:

```typescript
import { emitEvent } from '@/lib/events/emitter'

// Inside a command handler:
await emitEvent({
  type: 'order_confirmed',
  entity_type: 'order',
  entity_id: orderId,
  org_id: context.org_id,
  actor_id: context.actor_id,
  payload: { orderId, status: 'confirmed' },
  correlation_id: context.correlation_id,
})
```

The `CommandResult.emitted_event_ids` array collects all event IDs emitted during a command execution.

## Persistence

`lib/events/persist.ts` registers a listener that writes events to the `flow_domain_events` table. The `DB_EVENT_TYPES` set controls which event types are persisted (~30 types covering all critical entities).

Events NOT in `DB_EVENT_TYPES` are still fired to in-process listeners but are not written to the DB.

## Event Emission Guardrail

The command bus (`lib/control/command-bus.ts`) enforces that all 15 CRITICAL_COMMANDS emit at least one event on success:

```
send_quote, accept_quote, convert_quote_to_order, confirm_order,
require_deposit, record_payment, confirm_payment, create_purchase_order,
send_purchase_order, confirm_purchase_order, start_production,
complete_production, create_shipment, mark_shipment_shipped, mark_shipment_delivered
```

If a critical command succeeds with zero emitted events, `event_emission_gap_count` is incremented in governance telemetry and an error is logged.

## Adding a New Event Type

1. Add to `FlowEventTypeSchema` enum in `lib/events/event-types.ts`
2. Add to `DB_EVENT_TYPES` set in `lib/events/persist.ts`
3. Emit from the relevant command handler using `emitEvent()`
4. Add the command type to `CRITICAL_COMMANDS` in `command-bus.ts` if it is lifecycle-critical

## Querying Events

Events can be queried using `lib/events/event-queries.ts` for timeline views, audit exports, and evidence packages.
