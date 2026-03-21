# @nzila/db

Database access layer for the NzilaOS platform. Built on Drizzle ORM with PostgreSQL, providing org-scoped queries and audited database operations.

## Exports

| Export | Purpose |
|--------|---------|
| `db` | Default Drizzle database instance |
| `rawDb` | Raw `postgres` connection for advanced queries |
| `createScopedDb(orgId)` | Org-isolated query builder with automatic `org_id` filtering |
| `createFullScopedDb(orgId)` | Extended scoped DB with all platform tables |
| `withAudit(db, actor)` | Wraps DB with audit trail logging |
| `createAuditedScopedDb(orgId, actor)` | Combined scoped + audited DB |
| `ORG_SCOPED_TABLES` | List of tables that enforce org-level isolation |
| `schema.*` | All Drizzle table schemas |

## Usage

```ts
import { createScopedDb } from '@nzila/db'

const db = createScopedDb(orgId)
const records = await db.select().from(schema.policies)
// Automatically filtered to orgId — no data leakage across orgs
```

## Schema

Schemas are defined under `src/schema/` using Drizzle's `pgTable` builder. Most tables include an `org_id` column for org isolation.

## Dependencies

- `drizzle-orm` / `postgres` — ORM and driver
- `zod` — schema validation
- Platform packages: `@nzila/platform-ontology`, `@nzila/platform-event-fabric`, `@nzila/platform-data-fabric`, and others
