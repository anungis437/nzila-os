# 05 — Authorization and RLS Proof

Executed against the official PostgreSQL **18.4** server using **non-owner database
roles** (the suite connects as the superuser then `SET ROLE` to a non-privileged role so
RLS is genuinely enforced — a superuser/owner would bypass RLS).

## Suite

- File: `packages/sage-core/src/records-postgres-server.test.ts`
- Command: `SAGE_PG_TEST_URL=… pnpm --filter @nzila/sage-core exec vitest run src/records-postgres-server.test.ts`
- PostgreSQL version: **18.4**
- Result: **11 passed / 11**
- Roles (safe aliases): `sage_app` (application, non-owner), `sage_internal_exec`
  (internal executor), `sage_recipient` (recipient, read-limited)

## Proven properties

| Property | Result |
|---|---|
| Org A cannot READ org B lifecycle rows (RLS `USING`) | PASS |
| Org A cannot MUTATE/INSERT for org B (RLS `WITH CHECK`) | PASS |
| Recipient role has no lifecycle write privileges (`permission denied`) | PASS |
| Generic administrators lack narrow destruction authority (service `FORBIDDEN`) | PASS |
| Human-only actions reject service/system actors | PASS |
| Internal executor limited to intended execution authority | PASS |
| Tenant GUC (`app.tenant_id`) change alone never exposes both tenants | PASS |

## Concurrency (independent sessions)

| Scenario | Result |
|---|---|
| Hold wins — hold committed on a 2nd connection aborts atomic `deletion_started` | PASS (zero storage calls) |
| Destruction wins — after `deletion_started`, later hold placement rejected | PASS |
| Executor fencing — stale lease reclaimed, old owner fenced out | PASS |
| Two concurrent claimers → exactly one winner | PASS |

## Verdict

Authorization and tenant isolation under real non-owner PostgreSQL roles: **PASS**.
This is the strongest available proof short of a deployed multi-tenant environment and
covers the reviewer's requirement that tenant-GUC changes alone do not bypass
authorization.
