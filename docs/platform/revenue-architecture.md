# Platform Revenue Architecture

> How Nzila OS tracks, aggregates, and reports revenue across all apps.

---

## Overview

`@nzila/platform-revenue` is the unified commercial layer for Nzila OS. It provides:

- **Subscription models** — tier-based pricing (Free → Enterprise)
- **Usage metrics** — API calls, storage, AI requests, transactions
- **Revenue events** — subscription, overage, one-time, Zonga, commerce
- **Billing hooks** — event-driven integration points for payment processors

---

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Zonga App  │  │   Flow App   │  │   CFO App    │  │ Commerce/Trade│
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                  │
       │  revenue events │  workflow fees  │  queries         │  txn fees
       ▼                 ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    @nzila/platform-revenue                          │
│  ├─ RevenueService     — record events, register hooks, summarize  │
│  ├─ SubscriptionSchema — tier, cycle, pricing, active apps         │
│  ├─ UsageMetrics       — API calls, storage, AI, transactions      │
│  └─ BillingHooks       — event-driven payment integration          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
  @nzila/platform-billing  @nzila/payments-stripe  @nzila/platform-cost
  (subscriptions)          (Stripe integration)    (budgets/cost control)
```

---

## Subscription Tiers

| Tier | Apps Included | Monthly Price | Key Features |
|------|---------------|---------------|--------------|
| **Free** | Web only | $0 | Public access, limited API |
| **Starter** | Web + 1 app | $49/mo | Basic org, 5 users |
| **Professional** | All standard apps | $199/mo | Full platform, 25 users |
| **Enterprise** | All apps + custom | Custom | Unlimited, SLA, support |

---

## Revenue Event Types

| Event | Source | Description |
|-------|--------|-------------|
| `subscription_started` | Platform | New org subscription |
| `subscription_renewed` | Platform | Monthly/annual renewal |
| `subscription_upgraded` | Platform | Tier upgrade |
| `subscription_cancelled` | Platform | Cancellation |
| `usage_overage_billed` | Platform | Over-limit usage charges |
| `one_time_payment` | Any app | Ad-hoc payment |
| `zonga_revenue` | Zonga | Streaming/event/fan revenue |
| `commerce_revenue` | Flow/Trade | Transaction fees |

---

## Integration: CFO App

The CFO app consumes platform revenue data through:

```typescript
import { createInMemoryRevenueService, computeAppRevenueBreakdown } from '@nzila/platform-revenue'

// Get revenue summary for org
const summary = service.summarize(orgId, '2026-Q1')

// Revenue breakdown by app
const breakdown = computeAppRevenueBreakdown(events)
```

---

## Integration: Flow App

Flow can trigger revenue-based workflows:

```typescript
// Register a billing hook for subscription upgrades
service.registerHook({
  event: 'subscription_upgraded',
  handler: async (event) => {
    await triggerWorkflow('onboarding-premium', { orgId: event.orgId })
  },
})
```

---

## Usage Metrics

| Metric | Unit | Measured By |
|--------|------|-------------|
| `api_calls` | count | API gateway |
| `storage_gb` | GB | Blob storage |
| `ai_requests` | count | AI gateway |
| `active_users` | count | Auth sessions |
| `transactions` | count | Commerce engine |
