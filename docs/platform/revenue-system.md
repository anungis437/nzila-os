# Platform Revenue System

> Unified revenue awareness for Nzila OS

## Overview

`@nzila/platform-revenue` provides a single, cross-app revenue model that every app in the platform can emit to and consume from. It ensures that all financial activity — subscriptions, transactions, marketplace payouts, and one-time events — flows through a unified schema.

## Unified Revenue Record

Every revenue-generating event across the platform is normalised into a `UnifiedRevenueRecord`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique record identifier |
| `entityId` | UUID | User, org, or creator that generated the revenue |
| `appSource` | string | Originating app (e.g. `zonga`, `cfo`, `flow`) |
| `revenueType` | enum | `subscription` · `transaction` · `event` · `payout` |
| `grossAmount` | number | Total amount before platform fees |
| `platformFee` | number | Platform's take (≥ 0) |
| `netAmount` | number | Amount after platform fee |
| `currency` | string(3) | ISO 4217 currency code |
| `timestamp` | datetime | When the event occurred |
| `status` | enum | `pending` · `settled` · `failed` · `refunded` |
| `metadata` | object? | App-specific extra data |

## Integration Pattern

### Emitting Revenue

Apps call `emitRevenueEvent()` to push revenue into the platform ledger:

```typescript
import { emitRevenueEvent, createInMemoryRevenueService } from '@nzila/platform-revenue'

const service = createInMemoryRevenueService()

emitRevenueEvent(service, {
  id: crypto.randomUUID(),
  entityId: orgId,
  appSource: 'zonga',
  revenueType: 'transaction',
  grossAmount: 150.00,
  platformFee: 15.00,
  netAmount: 135.00,
  currency: 'USD',
  timestamp: new Date().toISOString(),
  status: 'settled',
})
```

### Consuming Revenue

The control-plane aggregates all revenue data for dashboards:

```typescript
import { computeAppRevenueBreakdown } from '@nzila/platform-revenue'

const events = service.getEvents(orgId)
const breakdown = computeAppRevenueBreakdown(events)
// => { zonga: { total: 135, count: 1 }, cfo: { total: 500, count: 3 } }
```

## App Integration Map

| App | Role | Revenue Types |
|-----|------|---------------|
| **Zonga** | Creator marketplace | `transaction`, `payout` |
| **CFO** | Financial oversight | Consumes all (read-only) |
| **Flow** | Workflow billing | `subscription`, `event` |
| **Control Plane** | System brain | Aggregates all for dashboards |

## Billing Hooks

Apps can register hooks for real-time reactions to revenue events:

```typescript
service.registerHook({
  event: 'subscription_started',
  handler: async (event) => {
    await provisionResources(event.orgId)
  },
})
```

## See Also

- [Revenue Architecture](./revenue-architecture.md) — system architecture and diagrams
- [Zonga Monetization](../zonga/monetization-model.md) — marketplace-specific model
