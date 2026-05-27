# Proof Scenario: Contract-Backed Event Flow

## Scenario Summary

Proves that inter-module events flow through `@nzila/events` with payload
validation against `@nzila/contracts`. The scenario demonstrates: event emission
with explicit contract version → schema validation → event bus delivery →
persistent storage → metadata correlation back to originating request.

## Entrypoint

```bash
pnpm exec tsx scripts/proof/run-proof.ts event-contract-flow
```

Or via the test runner:

```bash
npx vitest run tests/e2e/platform/event-contract-flow.test.ts
```

## Request Sample

The originating action is an order creation that emits two governed events:

```json
{
  "events": [
    {
      "type": "OrderCreated",
      "version": 1,
      "payload": {
        "orderId": "ord-demo-001",
        "customerId": "cust-001",
        "items": [{ "productId": "p-001", "quantity": 2, "unitPrice": 49.99 }],
        "totalAmount": 99.98,
        "currency": "USD"
      }
    },
    {
      "type": "PaymentProcessed",
      "version": 1,
      "payload": {
        "paymentId": "pay-demo-001",
        "orderId": "ord-demo-001",
        "amount": 99.98,
        "currency": "USD",
        "method": "card",
        "status": "completed"
      }
    }
  ]
}
```

## Expected Control Path

1. **Contract validation** — `ContractRegistry.validate()` checks each payload against its versioned Zod schema
2. **Event emission** — `EventEmitter.emitEvent()` dispatches through `EventBus`
3. **Handler delivery** — registered handlers receive typed events
4. **Persistent storage** — events stored in `EventStore`
5. **Metadata correlation** — `tenantId`, `actorId`, `traceId`, `correlationId` propagated

## Expected Artifact Files

```
proof-artifacts/event-contract-flow/
  summary.json          — normalized proof metadata
  event.json            — emitted events with contract versions
  trace.json            — trace context
  request.json          — originating action
  response.json         — emission results
```

## How to Run Locally

```bash
pnpm exec tsx scripts/proof/run-proof.ts event-contract-flow
```

## How to Validate in CI

Verified automatically by `pnpm exec tsx scripts/proof/verify-artifacts.ts`.

## What "Pass" Means

- Both events pass contract validation
- Events are delivered to registered handlers
- Events are persisted in the event store
- Each event has correct `version`, `type`, and `metadata`
- `correlationId` links events to the originating action
- All artifact files are written

## What Regression Would Look Like

- Validation failure → contract schema changed without version bump
- Event not delivered → bus handler registration broken
- Missing `correlationId` → metadata propagation broken
- Event not in store → persistence layer disconnected
