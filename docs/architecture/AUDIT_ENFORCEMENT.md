# Nzila OS — Audit Enforcement Architecture

## Overview

Audit logging in Nzila OS is **impossible to forget** for CRUD operations.
The `withAudit()` wrapper automatically emits audit events for every
insert, update, and delete — with no manual call required.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ API Route Handler                                           │
│   const ctx = await authorize(req)                          │
│   const scopedDb = createScopedDb(ctx.entityId)             │
│   const auditedDb = withAudit(scopedDb, {                   │
│     actorId: ctx.userId,                                    │
│     entityId: ctx.entityId,                                 │
│     actorRole: ctx.role                                     │
│   })                                                        │
│                                                             │
│   // Every mutation below is auto-audited                   │
│   await auditedDb.insert(meetings, { kind: 'board' })       │
│   await auditedDb.update(resolutions, { status: 'signed' }) │
│   await auditedDb.delete(drafts, eq(drafts.id, id))         │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼  (automatic)
┌─────────────────────────────────────────────────────────────┐
│ Audit Event Emission                                        │
│   • entityId, actorId, table, action, timestamp             │
│   • correlationId (auto-generated or provided)              │
│   • Hash-chained via computeEntryHash()                     │
│   • Written to append-only audit_events table               │
│   • Fallback to stdout if DB write fails                    │
└─────────────────────────────────────────────────────────────┘
```

## When to Use `withAudit` vs `recordAuditEvent`

| Scenario | API | Notes |
|----------|-----|-------|
| CRUD operations (insert/update/delete) | `withAudit(scopedDb, ctx)` | **Preferred** — automatic |
| Governance lifecycle events | `recordAuditEvent()` | Manual — for state machine transitions |
| Evidence pack operations | `recordAuditEvent()` | Manual — cross-cutting concerns |
| Authorization denied events | `recordAuditEvent()` | Manual — security telemetry |
| Non-DB actions (email, webhook) | `recordAuditEvent()` | Manual — external side effects |

## Audit Event Schema

```typescript
interface AuditEvent {
  entityId: string           // Scoped entity
  actorId: string            // Who performed the action
  actorRole?: string         // RBAC role at time of action
  table: string              // Target table name
  action: 'insert' | 'update' | 'delete'
  timestamp: string          // ISO 8601
  correlationId: string      // Request-level tracing
  values?: Record<string, unknown>  // Mutation payload
}
```

## Hash Chain Integrity

All audit events are hash-chained using SHA-256:

```
Event N: hash = SHA256({ payload, previousHash: Event[N-1].hash })
```

This ensures:
- Tamper evidence: any modification breaks the chain
- Append-only: deletions are detectable
- Verifiable: `verifyEntityAuditChain(entityId)` validates the full chain

## Database Enforcement

The `audit_events` table has:
- `prevent_audit_mutation` trigger — blocks UPDATE/DELETE at DB level
- No CASCADE deletes from parent tables
- `hash` column required (NOT NULL)

## Invariants

| ID | Description | Enforcement |
|----|-------------|-------------|
| INV-08 | Automatic audit emission for CRUD operations | withAudit wrapper + contract test |
| INV-09 | Audit module structure and exports | Contract test |

## Integration with Authorization

The recommended pattern in API routes:

```typescript
import { createScopedDb } from '@nzila/db/scoped'
import { withAudit } from '@nzila/db/audit'
import { authorize } from '@nzila/os-core/policy'

export const POST = withAuth({ requiredScope: 'governance:write' }, async (req, ctx) => {
  const entityId = extractEntityId(req)
  await authorizeEntityAccess(ctx, entityId)

  const scopedDb = createScopedDb(entityId)
  const auditedDb = withAudit(scopedDb, {
    actorId: ctx.userId,
    entityId,
    actorRole: ctx.role,
    correlationId: req.headers.get('x-request-id') ?? undefined,
  })

  // All mutations auto-audited from here
  const [meeting] = await auditedDb.insert(meetings, { kind: 'board', ... }).returning()
  return NextResponse.json(meeting, { status: 201 })
})
```

## Backward Compatibility

The existing `recordAuditEvent()` function in `apps/console/lib/audit-db.ts`
is **preserved**. It remains the correct choice for non-CRUD governance events.
The `withAudit()` wrapper is additive — it enriches CRUD operations with
automatic audit emission without removing any existing capability.

## Related Documents

- [ORG_ISOLATION.md](./ORG_ISOLATION.md) — Scoped DAL foundation
- [VERTICAL_SCAFFOLDING.md](./VERTICAL_SCAFFOLDING.md) — Scaffolded verticals use withAudit by default
- [ENFORCEMENT_SUMMARY.md](./ENFORCEMENT_SUMMARY.md) — Full enforcement layer summary
