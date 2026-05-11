# Agri Stack — Events and Integrations

## Event Architecture

All operational events follow the **transactional outbox pattern**:

1. Service performs mutation + writes outbox record in same transaction
2. Outbox processor reads pending records and dispatches via `integrations-runtime`
3. Dispatch results are logged with delivery status and retry metadata

### Domain Events

| Event Type | Emitter | Trigger |
|-----------|---------|---------|
| `agri.lot.created` | Agrimo | Lot assembled from harvests |
| `agri.lot.inspected` | Agrimo | Quality inspection recorded |
| `agri.lot.graded` | Agrimo | Grade assigned to lot |
| `agri.lot.certified` | Agrimo | Lot certified (evidence pack generated) |
| `agri.lot.rejected` | Agrimo | Lot failed quality checks |
| `agri.batch.created` | Agrimo | Batch created from certified lots |
| `agri.batch.allocated` | Agrimo | Batch allocated to shipment |
| `agri.shipment.planned` | Agrimo | Shipment plan created |
| `agri.shipment.milestone` | Agrimo | Shipment milestone recorded |
| `agri.shipment.closed` | Agrimo | Shipment arrived and finalized |
| `agri.payment.plan.created` | Agrimo | Payment plan generated |
| `agri.payment.executed` | Agrimo | Individual payment executed |
| `agri.certification.issued` | Agrimo | Certification artifact issued |

### Event Schema

```typescript
interface AgriDomainEvent<TPayload> {
  id: string                    // UUID
  type: AgriEventType           // dot-namespaced
  payload: Readonly<TPayload>
  metadata: {
    orgId: string               // org isolation
    actorId: string             // who triggered
    correlationId: string       // request tracing
    causationId: string | null  // parent event
    source: string              // '@nzila/agrimo' | '@nzila/cora'
  }
  createdAt: string             // ISO 8601
}
```

## Integration Routing

All integrations are dispatched via `@nzila/integrations-runtime` dispatcher. No direct SDK calls.

| Event | Channel | Template | Recipient |
|-------|---------|----------|-----------|
| `agri.lot.certified` | Email | `agri-lot-certified` | Producer(s) in lot |
| `agri.lot.certified` | SMS | `agri-lot-certified-sms` | Producer(s) phone |
| `agri.shipment.milestone` | Slack | `agri-shipment-update` | Ops channel |
| `agri.shipment.milestone` | Teams | `agri-shipment-update` | Ops channel |
| `agri.payment.executed` | Email | `agri-payment-receipt` | Producer |
| `agri.payment.executed` | SMS | `agri-payment-receipt-sms` | Producer phone |
| `agri.batch.created` | Webhook | `agri.batch.created` | Org webhook URL |
| `agri.shipment.planned` | HubSpot | `agri-shipment-deal` | Coop CRM contact |

## Retry + DLQ

- Default retry: 3 attempts with exponential backoff
- Failed dispatches moved to dead letter queue
- All delivery attempts audited with timestamps
- DLQ items can be replayed via ops console

## Cora Event Consumption

Cora does not directly subscribe to Agrimo events. Instead:

1. Cora reads operational data from `agri-db` (read-only scoped queries)
2. Cora computes metrics via `agri-intelligence`
3. Cora writes results to intelligence tables (`agri_forecasts`, `agri_price_signals`, `agri_risk_scores`)

This keeps Cora fully decoupled from Agrimo's write path.
