# Nzila OS — Enforcement Upgrade Migration Notes

## Version

**Upgrade Date:** 2026-02-21
**Type:** Structural Enforcement Upgrade (Non-Breaking, Additive)

## Summary

This upgrade transitions Nzila OS from convention-enforced governance to
structurally enforced, developer-proof, multi-layer guarantees.

**No existing APIs, contracts, or behaviors are removed or weakened.**

## New Packages & Modules

| Module | Purpose |
|--------|---------|
| `@nzila/db/raw` | Explicit raw DB export (internal only) |
| `@nzila/db/scoped` | Entity-scoped DAL (`createScopedDb`) |
| `@nzila/db/audit` | Automatic audit emission (`withAudit`) |
| `@nzila/db/eslint-no-shadow-db` | ESLint rule blocking raw DB in apps |
| `@nzila/os-core/boot-assert` | Runtime boot assertions |
| `@nzila/cli` | CLI package with `create-vertical` command |

## New Contract Tests

| File | Invariants |
|------|-----------|
| `db-boundary.test.ts` | INV-06 (no raw DB), INV-07 (scoped DAL) |
| `audit-enforcement.test.ts` | INV-08 (auto audit), INV-09 (audit structure) |
| `vertical-governance.test.ts` | INV-10 (CLI structure), INV-11 (route auth) |
| `enforcement-hardening.test.ts` | INV-12 (boot assert), INV-13 (audit immutability), INV-14 (CI pipeline) |

## New Invariants

| ID | Description | Added To |
|----|-------------|----------|
| INV-06 | No raw DB access in application layer | `invariants.test.ts`, `db-boundary.test.ts` |
| INV-07 | Org isolation via Scoped DAL | `invariants.test.ts`, `db-boundary.test.ts` |
| INV-08 | Automatic audit emission for CRUD | `invariants.test.ts`, `audit-enforcement.test.ts` |
| INV-09 | Audit module structure and exports | `invariants.test.ts`, `audit-enforcement.test.ts` |
| INV-10 | Vertical scaffolding enforces governance | `vertical-governance.test.ts` |
| INV-11 | Every API route has authorization | `vertical-governance.test.ts` |
| INV-12 | Boot assertion prevents unvalidated runtime | `enforcement-hardening.test.ts` |
| INV-13 | Audit table immutability at DB level | `enforcement-hardening.test.ts` |
| INV-14 | CI enforcement pipeline ordering | `enforcement-hardening.test.ts` |

## Migration Steps for Existing Code

### For existing API routes (optional, recommended):

```diff
- import { db } from '@nzila/db'
+ import { createScopedDb } from '@nzila/db/scoped'
+ import { withAudit } from '@nzila/db/audit'

  export async function POST(req, { params }) {
    const { entityId } = await params
    const guard = await requireEntityAccess(entityId)
+   const scopedDb = createScopedDb(entityId)
+   const auditedDb = withAudit(scopedDb, {
+     actorId: guard.context.userId,
+     entityId,
+   })

-   const [row] = await db.insert(meetings).values({ entityId, ... }).returning()
-   await recordAuditEvent({ entityId, action: 'meeting.create', ... })
+   const [row] = await auditedDb.insert(meetings, { ... }).returning()
+   // ↑ audit emitted automatically
  }
```

### For new verticals:

```bash
nzila create-vertical my-vertical
# All governance posture is included automatically
```

## Backward Compatibility

- All existing `db` imports from `@nzila/db` continue to work
- All existing `recordAuditEvent()` calls continue to work
- All 21 existing contract tests are preserved and pass
- No API routes are changed
- No schema changes required

## Rollback Procedure

This upgrade is purely additive. To rollback:

1. **Remove new files:**
   - `packages/db/src/raw.ts`
   - `packages/db/src/scoped.ts`
   - `packages/db/src/audit.ts`
   - `packages/db/eslint-no-shadow-db.mjs`
   - `packages/os-core/src/boot-assert.ts`
   - `packages/cli/` (entire directory)
   - New contract test files

2. **Revert package.json exports** in `@nzila/db` and `@nzila/os-core`

3. **Revert ESLint configs** — remove `noShadowDb` from all app configs

4. **Revert invariants.test.ts** — remove INV-06 through INV-09

5. **Verify:** `pnpm contract-tests` passes

No database migration or data rollback required.

## Performance Impact

The Scoped DAL adds a thin JavaScript wrapper over Drizzle queries.
Expected overhead: < 1ms per query (column validation + entityId injection).
No additional database round trips compared to manual entity filtering.

`withAudit` adds one async audit write per mutation. This is the same
cost as the existing manual `recordAuditEvent()` calls — just automatic.
