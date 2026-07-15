# 02 — Deployment and Migration Proof

## Commands executed (safe results)

| Command | Result |
|---|---|
| `pnpm verify:migrations` | ✅ Migration immutability verified for 16 migrations |
| `pnpm tsx tooling/db/schema-snapshot.ts verify` | ✅ No drift — composite `cbb91c13…827c1b` |
| `pnpm final:go` | ✅ CERTIFIED (DEV/STAGING/DEMO/PILOT/PROD GO — governance readiness only) |

## Clean deployment / clean install

The official PostgreSQL proof suite (`records-postgres-server.test.ts`) begins each run
by resetting to an empty schema and applying the **real** `migrations/0032 → 0044`
chain against the PostgreSQL 18.4 server. The suite's first assertion confirms the
lifecycle tables exist post-migration. Result: **PASS** (chain applies cleanly to an
empty official server).

## Unapplied migrations apply in order

The PGlite lifecycle suite applies the numeric chain `0032 → 0044` in lexical order.
Result: **PASS** (9/9).

## Additive upgrade path

`records-live-postgres.test.ts` builds the schema through `0043`, asserts the Phase-8B
closure objects are absent, applies **only** the additive `0044`
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP … IF EXISTS`), asserts
the new table/columns appear, and re-applies `0044` to prove idempotency. Result:
**PASS**.

## Schema snapshot match

`schema-snapshot.ts verify` reports no drift (composite `cbb91c13…`). Result: **PASS**.

## Missing critical configuration fails closed

The application boot path fails closed on missing critical configuration — observed
directly in CI logs as `BOOT ASSERTION FAILED: DATABASE_URL is not set. The API cannot
function without a database connection.` Result: **PASS** (fail-closed on absent
`DATABASE_URL`). Encryption key-ring and rate-limiter fail-closed behaviour is covered
in `11-security-and-privacy-proof.md`.

## Readiness endpoints

Readiness endpoint behaviour is defined in code (`/api/ready`, internal readiness
routes returning safe aggregate status). **NOT_PROVEN** against a deployed environment
in this local proof run — deferred to a deployed proof (see gate G12/G15 conditions).

## Verdict

Migration and clean-install/upgrade proof: **PASS**. Deployed-environment readiness
endpoints and health surfaces: **NOT_PROVEN** (no deployed environment provisioned).
