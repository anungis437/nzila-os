# Decision Intelligence Revenue Layer

Phase 4 turns NzilaOS from immutable decision infrastructure into monetizable decision intelligence.

## Product Principle

Every decision improves the system.
Every improvement increases switching cost.
Every increase in switching cost increases valuation.

## Revenue Axes

- Decision volume: billed per 1,000 decisions processed.
- Audit storage: billed per retained immutable record.
- Intelligence access: billed by feature tier.
- API usage: billed per intelligence request.

## Commercial Tiers

| Tier | What customer gets |
|------|--------------------|
| Core | Decision execution + audit retention + raw export |
| Pro | Core + analytics + policy effectiveness + drift insights |
| Enterprise | Pro + anonymized benchmarks + recommendations + premium API usage |

## Lock-In Boundary

- Raw decisions and proofs are exportable.
- Aggregated intelligence, benchmark position, and recommendation logic remain inside Nzila.
- Leaving Nzila means losing the operating model learned from the customer’s own decisions.

## API Surface

- `/api/intelligence/metrics`
- `/api/intelligence/policy-insights`
- `/api/intelligence/benchmarks`

## Governance

- Benchmark outputs must be anonymized and aggregated only.
- No route may expose cross-org identifiers.
- Intelligence tier checks must remain blocking at the API layer.