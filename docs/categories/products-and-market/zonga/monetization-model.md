# Zonga Monetization Model

> Canonical reference for how Zonga generates revenue.

---

## Revenue Streams

| Stream | Description | Platform Fee |
|--------|-------------|--------------|
| **Streaming** | Per-play royalty from music/podcast streams | 30% |
| **Event Tickets** | Ticket sales for live/virtual events | 10% |
| **Fan Payments** | Direct fan-to-creator tips and donations | 5% |
| **Merchandise** | Physical/digital merchandise sales | 15% |
| **Licensing** | Sync licensing, broadcast rights | 20% |
| **Subscriptions** | Creator subscription tiers (fan clubs) | 25% |

---

## Canonical Schema

The `@nzila/zonga-monetization` package defines:

```
RevenueRecord {
  id:                 UUID
  orgId:              UUID      — org-scoped
  creatorId:          UUID      — the earning creator
  revenueStreamType:  enum      — streaming | event_ticket | fan_payment | merchandise | licensing | subscription
  grossAmount:        number    — total before fees
  platformFee:        number    — Zonga platform cut
  netAmount:          number    — creator payout amount
  currency:           string(3) — ISO currency code
  eventId:            UUID?     — optional link to event
  recordedAt:         datetime  — when revenue accrued
}
```

---

## Architecture

```
┌─────────────────────────────┐
│ Zonga App (Next.js + Django)│
│  ├─ Streaming service       │
│  ├─ Event ticketing         │
│  └─ Fan payments            │
└──────────┬──────────────────┘
           │ revenue events
           ▼
┌─────────────────────────────┐
│ @nzila/zonga-monetization   │
│  ├─ Revenue Tracker         │ → calculatePlatformFee, buildRevenueRecord
│  ├─ Payout Engine           │ → generateCreatorPayouts
│  └─ Analytics               │ → revenuePerCreator, revenuePerEvent, platformTakeRate
└──────────┬──────────────────┘
           │ delegates to
           ▼
┌─────────────────────────────┐
│ @nzila/zonga-economics      │ → double-entry ledger, fee rules, split calculations
│ @nzila/zonga-payments       │ → payment intents, mobile money, Stripe
│ @nzila/zonga-analytics      │ → engagement metrics, DAU/MAU
└─────────────────────────────┘
           │ emits
           ▼
┌─────────────────────────────┐
│ @nzila/platform-revenue     │ → cross-app revenue events (CFO, Flow)
└─────────────────────────────┘
```

---

## Integration Points

### Zonga Backend → Monetization

- Every streaming play, ticket sale, and fan payment generates a `RevenueRecord`
- Django signals emit events that TypeScript processes via the monetization package

### Monetization → Payouts

- `generateCreatorPayouts()` batches pending revenue into payout instructions
- Delegates to `@nzila/zonga-payments` for mobile-money / Stripe disbursement

### Monetization → Platform Revenue

- Revenue events are forwarded to `@nzila/platform-revenue` for CFO visibility
- CFO app ingests platform-wide revenue data for financial reporting

---

## Analytics Hooks

| Hook | Description | Consumer |
|------|-------------|----------|
| `revenuePerCreator()` | Revenue breakdown by creator over a period | Zonga creator dashboard |
| `revenuePerEvent()` | Revenue breakdown for a specific event | Zonga event analytics |
| `platformTakeRate()` | Platform fee % over a period | CFO app, governance reports |
| `aggregateByStreamType()` | Revenue totals by stream category | Zonga admin dashboard |

---

## Key Decisions

1. **Platform fees are configurable** — `PlatformFeeConfig` allows per-org overrides
2. **Minimum payout threshold** — Defaults to $10 to avoid micro-transaction costs
3. **All amounts in cents** are avoided — we use floating point with 2-decimal rounding
4. **Org-scoped** — All records belong to an org, enforcing multi-tenancy
