# Nzila OS — Org Isolation Architecture

## Overview

Org isolation is the foundational security invariant of Nzila OS.
Every query, mutation, and audit event is scoped to exactly one Org.
Cross-Org data access is **structurally impossible** when using the platform correctly.

## 4-Layer Enforcement Model

```
┌──────────────────────────────────────────────────┐
│ Layer 4: Database FK Constraints                 │
│   entity_id NOT NULL + FK to entities.id         │
│   DB-level guarantee: no orphan entity data      │
├──────────────────────────────────────────────────┤
│ Layer 3: Scoped DAL (createScopedDb)             │
│   Runtime guarantee: every query WHERE-filtered  │
│   Insert auto-injects entityId                   │
│   Tables without entity_id → runtime throw       │
├──────────────────────────────────────────────────┤
│ Layer 2: Contract Tests (db-boundary.test.ts)    │
│   CI guarantee: no rawDb in apps/*               │
│   No drizzle() instantiation in apps/*           │
│   No direct driver imports (postgres, pg)        │
├──────────────────────────────────────────────────┤
│ Layer 1: ESLint (no-shadow-db)                   │
│   Editor/pre-commit: block @nzila/db/raw         │
│   Block drizzle-orm/postgres-js                  │
│   Block direct driver imports                    │
└──────────────────────────────────────────────────┘
```

## How It Works

### Scoped DAL (`createScopedDb`)

```typescript
import { createScopedDb } from '@nzila/db/scoped'
import { meetings } from '@nzila/db/schema'

// In your API route, after authorization:
const scopedDb = createScopedDb(ctx.entityId)

// SELECT — auto-filtered to entity
const rows = await scopedDb.select(meetings)
// → SELECT * FROM meetings WHERE entity_id = $entityId

// INSERT — entityId auto-injected
await scopedDb.insert(meetings, { kind: 'board', meetingDate: new Date() })
// → INSERT INTO meetings (entity_id, kind, meeting_date) VALUES ($entityId, ...)

// UPDATE — scoped
await scopedDb.update(meetings, { status: 'held' }, eq(meetings.id, meetingId))
// → UPDATE meetings SET status = 'held' WHERE entity_id = $entityId AND id = $meetingId

// DELETE — scoped
await scopedDb.delete(meetings, eq(meetings.id, meetingId))
// → DELETE FROM meetings WHERE entity_id = $entityId AND id = $meetingId
```

### Raw DB (`rawDb`)

```typescript
// ⚠️  ONLY for OS platform layer code (migrations, admin, system ops)
import { rawDb } from '@nzila/db/raw'

// This import is BLOCKED by ESLint in apps/* directories
// It is also caught by contract tests and CI
```

### Fail-Fast Behavior

| Scenario | Behavior |
|----------|----------|
| `createScopedDb('')` | Throws `ScopedDbError` immediately |
| `createScopedDb(undefined)` | Throws `ScopedDbError` immediately |
| `scopedDb.select(tableWithoutEntityId)` | Throws `ScopedDbError` at call time |
| `import rawDb from '@nzila/db/raw'` in app | ESLint error + contract test failure |
| `import drizzle from 'drizzle-orm/postgres-js'` in app | ESLint error + contract test failure |

## Invariants

| ID | Description | Enforcement |
|----|-------------|-------------|
| INV-06 | No raw DB access in application layer | ESLint + contract test |
| INV-07 | Entity isolation via Scoped DAL | Runtime + contract test |

## Transaction Support

```typescript
await scopedDb.transaction(async (tx) => {
  // tx is itself a ScopedDb — entity isolation maintained
  await tx.insert(meetings, { ... })
  await tx.update(resolutions, { ... }, eq(resolutions.id, resId))
})
```

## Migration from Direct DB Access

If your code currently uses `db` from `@nzila/db` directly:

```diff
- import { db } from '@nzila/db'
- import { meetings } from '@nzila/db/schema'
+ import { createScopedDb } from '@nzila/db/scoped'
+ import { meetings } from '@nzila/db/schema'

  export async function GET(req, { params }) {
    const { entityId } = await params
    const guard = await requireEntityAccess(entityId)
+   const scopedDb = createScopedDb(entityId)

-   const rows = await db.select().from(meetings)
-     .where(eq(meetings.entityId, entityId))
+   const rows = await scopedDb.select(meetings)
  }
```

## Related Documents

- [AUDIT_ENFORCEMENT.md](./AUDIT_ENFORCEMENT.md) — Automatic audit emission
- [VERTICAL_SCAFFOLDING.md](./VERTICAL_SCAFFOLDING.md) — Scaffolded verticals use scopedDb by default
- [ENFORCEMENT_SUMMARY.md](./ENFORCEMENT_SUMMARY.md) — Full enforcement layer summary

> **Terminology**: This project uses "Org" everywhere. Do NOT introduce "tenant".
