# Union Eyes — runtime acceptance (real application, native PostgreSQL)

Mission `UE-FULL-PLATFORM-CONVERGENCE-TO-STAGING-2026`. Verdict: **`READY_FOR_STAGING = NO`**. This page records what has been
executed against the running application, how to reproduce it, and the defects it found. It replaces no earlier evidence.

## Reproduce

```
node tooling/scripts/ue-runtime-up.mjs all        # PostgreSQL 16 in Docker, Django migrate, Drizzle bootstrap, QA seed,
                                                   # platform sandbox database, the app on :3002, then Playwright
node tooling/scripts/ue-runtime-up.mjs down
```

`apps/union-eyes/playwright.runtime.config.ts` runs `e2e/runtime/**` at desktop, tablet and mobile sizes against the running
server (no web server is started by the config). The first batch is
[`01-foundation-and-case-journey.spec.ts`](../../../apps/union-eyes/e2e/runtime/01-foundation-and-case-journey.spec.ts).

What is real: the Next.js server and proxy, the API handlers, the authority kernel, the atomic audit chain, the platform NAR
audit chain, native PostgreSQL with the runtime and system roles, and a real Chromium. What is a local fixture: the QA identities
(deterministic users, whose session cookie the platform auth honours only when `QA_TEST_ENV=true` and `UE_ENVIRONMENT=local`),
synthetic module entitlements for the two QA organizations, and a **local sandbox NAR store** (never immutable; see below).

## Executed (dev server, `NODE_ENV=development`)

The table is the best complete run: 17/17 at desktop and 6/6 at tablet and at mobile (29 tests). Later full runs on the same dev server were intermittently failed by the server itself (see R-12); no run has been made against a production build.

| Journey | Desktop | Tablet | Mobile |
|---|---|---|---|
| Stack healthy: database, auth, catalog authority admission | pass | n/a | n/a |
| Anonymous: API 401, app redirected to sign-in | pass | n/a | n/a |
| Suspended member refused | pass | n/a | n/a |
| Organization without the module: 403 `ENTITLEMENT_REQUIRED` (was a 500) | pass | n/a | n/a |
| Member files an intake through the real route; sealed proof returned | pass | n/a | n/a |
| Filing persisted in the application database and in the platform audit chain | pass | n/a | n/a |
| Member sees and opens the case; another organization's member gets 404 | pass | n/a | n/a |
| Spoofed organization cookie does not widen reads | pass | n/a | n/a |
| Steward holds only kernel-assigned cases, not the new filing | pass | n/a | n/a |
| Organization administrator cannot assign (no case authority from a title) | pass | n/a | n/a |
| Landing, navigation, no horizontal overflow, loading placeholders resolve: member, steward, staff, executive, governance, admin | 6/6 | 6/6 | 6/6 |

Not yet executed: restart-and-persist, logout/login persistence in a browser, attachments, escalation, supervisor and officer
oversight, notifications, revocation, finance, governance, organizing, WorkAid, federation, external collaboration and platform
operations. **Zero of Journeys A–I are complete.** Journey A stops at the file-to-steward handoff (finding R-05).

## Defects and gaps found by running the application

| ID | Finding | State |
|---|---|---|
| R-01 | `/api/cases/intake` answered an organization without the module with a 500 (`EntitlementError` unmapped). 62 other route files call `requireEntitlement`; those built on `withApi` already map it to 403, raw-handler routes still need a per-route check. | Intake fixed and tested at runtime. Raw-handler survey open. |
| R-02 | The platform audit tables (`audit_records`, decision tables) have no storage-authority classification, so placing them in the application database fails catalog admission (`applicationReady=false`, health `ok:false`). The intake route writes the NAR proof through `platformDb`, which shared `DATABASE_URL`. | `PLATFORM_DATABASE_URL` added to `@nzila/db/platform` (falls back to the old behaviour). Production topology decision outstanding: separate platform database, or classify and grant the tables. |
| R-03 | `audit_records` refuses any row without Azure immutable storage metadata (constraint plus trigger), and the NAR adapter requires Azure storage, so no developer or acceptance machine can create an audit proof. | Local sandbox store added (`packages/nar/src/storage/local-sandbox.ts`), gated on `NAR_STORAGE_MODE=local_sandbox`, `QA_TEST_ENV=true`, `UE_ENVIRONMENT=local`, not production; records are typed `local_sandbox`, `immutable=false`. A sandbox-only SQL relaxation (`tooling/sql/ue-runtime-sandbox-nar-relax.sql`) refuses to run unless the database name ends in `_sandbox`. Immutable storage is **not proven**. |
| R-04 | `UE_ENVIRONMENT` must be `local` for the QA session gate, but the environment schema in `lib/config/env-validation.ts` does not list `local`, so startup logs a validation error. | Open. |
| R-05 | Assigning a case needs a chief steward holding a supervisory mandate with the `assign` power. The QA seed has no chief-steward identity and issues no mandate, so nobody can hand a new filing to a steward; an organization administrator (correctly) cannot. | Open: add a clearly synthetic chief steward and mandate fixture through the authority store. |
| R-06 | `/api/claims` (used by the claims console) returns nothing to a steward, while `/api/cases` (kernel-scoped) returns the steward's assigned cases. | Open: confirm which surface a steward's console must use. |
| R-07 | Under `NODE_ENV=test` the Next dev server's eval-based bundles are blocked by the Content-Security-Policy, so the page never hydrates. The runtime uses `NODE_ENV=development`; the production artifact has not been run here. | Production-build run outstanding. |
| R-08 | Mobile header wraps to two rows and shows the organization name twice; one dashboard figure ("Avg. Days Open 181") reflects fixture dates. | Open (frontend wave). |
| R-10 | The canonical `feature_flags` table lacks `created_by` and `last_modified_by` that the ORM selects, so every feature-flag evaluation errored (2,890 log errors in one session) and failed closed. | Cache migration 0031 adds the two nullable columns (registered, UNQUALIFIED); errors stopped on the running stack after applying it. A native suite for it is outstanding. |
| R-11 | With Redis unconfigured the app still retries a Redis connection in a loop, logging an error every two seconds, while health reports Redis as `ok` (optional). | Open. |
| R-12 | The Next dev server stalled or reset connections after several repeated full runs on a memory-constrained machine (ECONNRESET, a placeholder that never resolved). The journeys passed on a fresh server; the intermittent failures are attributed to the dev server, not proven so. | A production-build run is required before any pass is relied on. |
| R-09 | Seed script `predev` runs `align-org-schema.ts`, which alters `organization_members` at dev start. A defect it masks in development (missing defaults) exists on the canonical schema. | Related fix already committed (ORM supplies the defaults). The script should not hide drift in qualification runs. |

## Stakeholder coverage in the QA fixtures

Fixture identities exist for: member, steward, staff (support agent), executive (president), governance (compliance manager),
administrator, a second-organization member and steward, a suspended member and an isolated external tester. There is **no**
fixture identity for: representative, senior representative or supervisor, financial officer, organizing staff, employer or
counterparty, external representative or legal counsel, WorkAid partner, federation, or platform operator. Those nine groups are
not yet exercised at runtime. They must be added through the existing identity, entitlement, mandate and profile architecture, not
as new database role names.
