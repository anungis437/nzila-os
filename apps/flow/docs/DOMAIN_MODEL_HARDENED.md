# Flow — Hardened Domain Model

## Overview

This is the hardened version of the Flow domain model with explicit invariants,
access control boundaries, and audit requirements. It extends the canonical
domain model with production-grade constraints.

## Invariant Enforcement

| Invariant | Rule | Enforced At |
|-----------|------|-------------|
| Order state transitions must be sequential | `created → confirmed → fulfilled → delivered` — no skipping | Domain service |
| Payments require a confirmed order | A payment cannot be attached to an order in `created` or `cancelled` state | Payment service |
| Quote expiry is immutable once sent | `expires_at` is set on send and cannot be extended | Quote aggregate |
| A fulfilled order must have all line items resolved | `line_items.every(li => li.status === 'resolved')` | Order aggregate |
| Cancelled orders cannot be reactivated | Terminal state — no outbound transitions | State machine guard |
| Production jobs require confirmed order reference | `job.order_id` must point to an order in `confirmed` status or later | Job factory |
| Customer must exist before quote creation | Foreign key + application-level check | Quote creation handler |

## Access Control Matrix

| Entity | Owner | Manager | Operator | Viewer |
|--------|-------|---------|----------|--------|
| Customer | CRUD | CRUD | R | R |
| Quote | CRUD | CRUD | RU | R |
| Order | CR | CRUD | RU | R |
| Payment | C | CRUD | R | R |
| Production Job | — | CRUD | RU | R |
| Product Catalog | — | CRUD | R | R |
| Fulfillment | — | CRU | RU | R |

- **Owner**: The customer-facing user who initiated the transaction.
- **Manager**: Internal staff with full domain access.
- **Operator**: Production floor / logistics staff.
- **Viewer**: Read-only audit or reporting role.

## Audit Requirements

- All state transitions must emit a domain event with `actor_id`, `timestamp`, and `previous_state`.
- Payment mutations must be logged to an append-only audit table.
- Quote acceptance/rejection must capture the accepting party's identity.
- Deletion is soft-delete only; hard deletes require a data-retention policy review.

## Related Docs

- [DOMAIN_MODEL.md](DOMAIN_MODEL.md) — Convenience pointer to canonical model
- [DOMAIN_EVENTS_MODEL.md](DOMAIN_EVENTS_MODEL.md) — Event catalog
- [WORKFLOW_MODEL.md](WORKFLOW_MODEL.md) — State machine definitions
