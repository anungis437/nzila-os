# Flow — Control Layer Architecture

> Authoritative reference for the command-driven control layer.
> Every critical business mutation in Flow routes through this layer.

## Design Principles

1. **Single path for mutations** — No server action may directly mutate domain state. All status transitions, payment operations, and entity creation go through the command bus.
2. **Guard-before-write** — Every handler validates invariants, workflow transitions, and payment gates before persisting.
3. **Event-first** — Every successful mutation emits a domain event and writes an audit entry.
4. **Fail-safe** — Payment-gated operations (PO creation, production start, shipment) fail closed when payment gates are unresolved.
5. **Operationally visible** — Platform adapters expose health, metrics, evidence, and governance telemetry.

## Layer Structure

```
lib/control/
├── types.ts                    # CommandContext, CommandResult, gate result types
├── command-bus.ts              # Central execution pipeline
├── control-adapter.ts          # Server action bridge (legacy + v2 shapes)
├── register-handlers.ts        # Handler registration at startup
├── register-integrations.ts    # Side-effect dispatch registrations
├── index.ts                    # Barrel export
│
├── errors/                     # Typed error hierarchy
│   ├── invalid-transition-error.ts
│   ├── payment-gate-blocked-error.ts
│   ├── invariant-violation-error.ts
│   ├── entity-not-found-error.ts
│   ├── permission-denied-error.ts
│   └── integration-dispatch-error.ts
│
├── guards/                     # Pre-mutation validation
│   ├── invariant-guard.ts      # Entity existence + relationship checks
│   ├── workflow-guard.ts       # State machine transition validation
│   ├── payment-guard.ts        # Payment gate (deposit, overdue, PO clearance)
│   ├── production-guard.ts     # Production readiness checks
│   └── shipment-guard.ts       # Shipment readiness checks
│
├── dispatch/                   # Post-mutation effects
│   ├── event-dispatcher.ts     # Domain event emission
│   ├── audit-dispatcher.ts     # Audit trail (timeline repo)
│   └── side-effect-dispatcher.ts  # External integration dispatch
│
└── handlers/                   # 17 command handlers
    ├── create-quote.handler.ts
    ├── send-quote.handler.ts
    ├── accept-quote.handler.ts
    ├── request-quote-revision.handler.ts
    ├── convert-quote-to-order.handler.ts
    ├── confirm-order.handler.ts
    ├── require-deposit.handler.ts
    ├── record-payment.handler.ts
    ├── confirm-payment.handler.ts
    ├── create-purchase-order.handler.ts
    ├── send-purchase-order.handler.ts
    ├── confirm-purchase-order.handler.ts
    ├── start-production.handler.ts
    ├── complete-production.handler.ts
    ├── create-shipment.handler.ts
    ├── mark-shipment-shipped.handler.ts
    └── mark-shipment-delivered.handler.ts
```

## Execution Pipeline

Every command follows this 10-step pipeline:

```
1. Validate command input (Zod schema)
2. Load domain state (repository)
3. Run invariant checks (entity exists, belongs to org)
4. Run workflow validation (state machine transition)
5. Run payment/production/shipment guards (if applicable)
6. Persist domain mutation (repository write)
7. Emit persisted domain events (event dispatcher)
8. Write audit metadata (audit dispatcher)
9. Dispatch external side effects (integrations)
10. Return structured CommandResult
```

## Command Bus

The command bus is the single entry point for execution:

```ts
import { execute } from '@/lib/control/command-bus'
import type { CommandContext, CommandResult } from '@/lib/control/types'

const result: CommandResult = await execute(
  {
    type: 'create_quote',
    org_id: 'org-shopmoica',
    actor_id: 'user-123',
    customer_id: 'cust-uuid',
    title: 'Corporate Order',
    currency: 'CAD',
    lines: [{ description: 'Caps', quantity: 100, unit_price: 12.50 }],
  },
  { org_id: 'org-shopmoica', actor_id: 'user-123' },
)
```

## Control Adapter

Server actions use the control adapter to bridge between the legacy `ActionResult` shape and the command bus:

```ts
import { executeCommand } from '@/lib/control/control-adapter'

// In a server action:
const result = await executeCommand({
  type: 'send_quote',
  org_id: orgId,
  actor_id: userId,
  quote_id: quoteId,
})
// Returns: { ok: boolean, data?: CommandResult, error?: string }
```

## Guard Chain

| Guard | Scope | Blocks |
|-------|-------|--------|
| Invariant | All commands | Missing entities, broken references, invalid totals |
| Workflow | Status mutations | Illegal state transitions (e.g., DRAFT → ACCEPTED) |
| Payment | PO, production, shipment | Unpaid deposits, overdue payments |
| Production | Production start | Missing PO, unresolved payment, no vendor |
| Shipment | Shipment creation | Incomplete production, missing address |

## Event System Integration

The control layer bridges into the existing Flow event system:

- `dispatchDomainEvent()` → calls `emitFlowEvent()` → persisted to `flow_domain_events` table
- `dispatchAuditEntry()` → writes to `commerce_timeline_events` via `timelineRepo`
- `dispatchSideEffects()` → triggers registered integrations (Zoho, Shopify, Canva, notifications)

## Platform Adapters

Flow implements all four platform contracts:

| Contract | Adapter | Endpoint |
|----------|---------|----------|
| Health | `health-adapter.ts` | `/api/health` |
| Metrics | `metrics-adapter.ts` | `/api/metrics` |
| Evidence | `evidence-adapter.ts` | `/api/evidence/export` |
| Governance | `governance-adapter.ts` | `/api/governance/telemetry` |

## Related Documents

- [COMMAND_REFERENCE.md](./COMMAND_REFERENCE.md) — All 17 commands
- [GUARD_REFERENCE.md](./GUARD_REFERENCE.md) — Guard details
- [WORKFLOW_ENFORCEMENT_AUDIT.md](./WORKFLOW_ENFORCEMENT_AUDIT.md) — Enforcement audit
- [ORDER_CENTRIC_ENFORCEMENT.md](./ORDER_CENTRIC_ENFORCEMENT.md) — Order boundary audit
- [PLATFORM_CONTRACTS.md](./PLATFORM_CONTRACTS.md) — Platform contract implementation
