# Convergence tranche 10c: a raw Date in a `sql` template no longer crashes the driver

Date: 2026-11-02. Branch `agents/ue-cursor-final-closure`. Base commit `39403a3b1`; source commit: see the ledger entry `UE-RAW-DATE-PARAMETERS-20261102`.
Credit: none (cross-cutting source evidence, `defectCredit` 0, `closureCredit` 0). Nothing is closed. `READY_FOR_STAGING` stays `NO`.
This tranche acts on "if you identify flaws or missing aspects, fix them too": the enhanced RBAC native proof (tranche 10b) found that every audit write threw, and the cause was not in the RBAC code.

## What was wrong

The application's clients are drizzle over postgres.js. drizzle's postgres-js driver replaces the driver's serializers for `timestamptz`, `timestamp` and `date` with identity functions, because drizzle encodes a value
through its column mapper (a `Date` becomes its ISO string) before the value reaches the driver. A `Date` interpolated into a raw `sql\`...\`` template has no column, so it reaches the driver as an object, and the
driver throws `TypeError [ERR_INVALID_ARG_TYPE]: The "string" argument must be of type string or an instance of Buffer or ArrayBuffer. Received an instance of Date` when it writes the bind message. A column operator
(`eq`, `gte`) encodes through its column and is not affected; only a bare interpolation is.

Mock-based unit tests cannot see this (the mocked `execute` never serializes a parameter), and the native route proofs had not sent a `Date` this way.

Measured by type, not by name (`scripts/runtime/raw-date-params.ts`: the TypeScript checker over every interpolation of every `sql` tagged template, 3,915 files, 1,113 templates, 66 s): **58 raw `Date` parameters
in 13 production files**:

| file | sites |
|---|---|
| `app/[locale]/dashboard/admin/rewards/analytics/page.tsx` | 12 |
| `db/queries/deadline-queries.ts` | 12 |
| `lib/services/rewards/export-service.ts` | 10 |
| `lib/engagement-scoring.ts` | 9 |
| `db/queries/scheduled-reports-queries.ts` | 3 |
| `lib/services/rewards/wallet-service.ts`, `services/platform-economics/billing-service.ts`, `services/clc/per-capita-calculator.ts`, `lib/services/board-packet-generator.ts` | 2 each |
| `actions/admin-actions.ts`, `lib/documents/intake-lifecycle.ts` (the retry sweep), `lib/services/rewards/template-service.ts`, `lib/mobile/mobile-engine.ts` | 1 each |

Each would throw when executed through a production client. Whether each is reachable is not established here; the point is that none of them can work, and that the class is closed once, where the clients are built.

## What changed

- `db/driver-dates.ts`: `serializeRawDates(client)` keeps drizzle's behavior for everything drizzle already encoded and sends a `Date` as its ISO-8601 instant, which is what drizzle's own column mappers send
  (PostgreSQL reads it as a `timestamptz`, as the UTC wall clock of a `timestamp`, and as the UTC day of a `date`). It wraps the serializer it finds (so it is idempotent and delegates for every non-Date), and must run after
  `drizzle()` has been constructed over the client, because drizzle installs its serializers at construction.
- Applied by all four clients that build drizzle over postgres.js: `db/db.ts` (tenant), `db/system-db.ts` (system), `lib/database/multi-db-client.ts` and `db/test-db.ts`.
- `lib/...` call sites are not edited one by one: a per-site change would leave the next one broken. The enhanced RBAC module nonetheless sends its dates as text itself (the UTC day for a `date` column, the instant for a
  timestamp), so it does not depend on the helper.

## Verification

- Unit `db/__tests__/driver-dates.test.ts` (9): the helper against a drizzle-like client (Date to ISO for the three types, drizzle-encoded text and null unchanged, other types untouched, idempotent, delegates to the
  serializer it replaces); every production factory calls `serializeRawDates` after constructing drizzle, and **no other application module constructs a drizzle postgres.js client** (a new one fails the test until it
  applies the helper).
- Native `db/__tests__/driver-raw-dates.postgres.test.ts`, real PostgreSQL 16, the production options (`prepare: false`): **5 of 5**. A drizzle client without the helper is refused (`Received an instance of Date`: the
  hazard, held as a canary so the helper is removed, not left as dead code, if drizzle ever serializes it itself); with the helper a raw `Date` is the instant for `timestamptz`, the UTC wall clock for `timestamp` and the UTC day
  for `date`, with and without a cast, in `>=`, `BETWEEN` and `INSERT`; a null is still null; a drizzle column mapper and an operator still take and return a `Date`.

## What this does not do

- A raw `tx.execute` still returns timestamps and dates as the server's text (drizzle installs identity parsers too). Code that reads a raw result as a `Date` is a different defect class, not measured here (the enhanced RBAC
  module maps its rows; nothing else was changed).
- The command-line tools (`scripts/production/first-admin-cli.ts`, `scripts/bootstrap-v2`) and `services/financial-service` build their own clients and are not covered.
- The type-aware scan is informational (about a minute): it is not run in CI. No HTTP-level proof of any of the 58 sites. Exact-SHA CI for the final head and an independent reviewer are outstanding. No defect or CLOSED credit.
