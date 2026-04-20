# Flow — Workflow Model

## Overview

State machines governing the lifecycle of core Flow entities. Each machine
defines valid states, allowed transitions, guard conditions, and side effects.

## State Machines

### Quote Lifecycle

```
draft → sent → accepted
              → rejected
              → expired
```

| From | To | Guard | Trigger |
|------|----|-------|---------|
| draft | sent | All line items present, customer assigned | User action |
| sent | accepted | Before `expires_at` | Customer action |
| sent | rejected | — | Customer action |
| sent | expired | `now() > expires_at` | Scheduled job |

### Order Lifecycle

```
created → confirmed → fulfilled → delivered
                                → cancelled (from created or confirmed)
```

| From | To | Guard | Trigger |
|------|----|-------|---------|
| created | confirmed | Payment received or payment terms accepted | Payment webhook / user action |
| confirmed | fulfilled | All production jobs completed | Job completion event |
| fulfilled | delivered | Shipment confirmed | Logistics webhook |
| created | cancelled | — | User action |
| confirmed | cancelled | No production jobs in progress | User action |

### Production Job

```
queued → in_progress → completed
                     → failed
```

| From | To | Guard | Trigger |
|------|----|-------|---------|
| queued | in_progress | Operator assigned, materials available | Operator action |
| in_progress | completed | QA check passed | Operator action |
| in_progress | failed | — | Operator action |

## Transition Rules

1. **No backward transitions** — once a state is left it cannot be re-entered.
2. **Terminal states** are `accepted`, `rejected`, `expired`, `delivered`, `cancelled`, `completed`, `failed`.
3. **Concurrent guards** — if two transitions compete, the first committed wins (optimistic locking via `version` column).

## Side Effects

| Transition | Side Effect |
|------------|-------------|
| Quote `draft → sent` | Email notification to customer |
| Quote `sent → accepted` | Auto-create Order in `created` state |
| Order `created → confirmed` | Create Production Job(s) in `queued` state |
| Order `confirmed → cancelled` | Cancel all `queued` production jobs |
| Production Job `in_progress → completed` | Check if all jobs for order are done → advance order |
| Order `fulfilled → delivered` | Send delivery confirmation email |

## Related Docs

- [DOMAIN_MODEL_HARDENED.md](DOMAIN_MODEL_HARDENED.md) — Invariants and access control
- [DOMAIN_EVENTS_MODEL.md](DOMAIN_EVENTS_MODEL.md) — Event catalog
- [RUNBOOK.md](RUNBOOK.md) — Operational procedures
