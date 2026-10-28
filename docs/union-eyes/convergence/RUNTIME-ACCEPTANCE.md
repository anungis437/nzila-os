# Union Eyes — runtime acceptance (real application, native PostgreSQL)

Mission `UE-FULL-PLATFORM-CONVERGENCE-TO-STAGING-2026`. Verdict: **`READY_FOR_STAGING = NO`**. This page records what has been
executed against the running application, how to reproduce it, and the defects it found. It replaces no earlier evidence.

## Reproduce

```
node tooling/scripts/ue-runtime-up.mjs all --prod  # PostgreSQL 16 in Docker, Django migrate, Drizzle bootstrap, QA seed,
                                                   # platform sandbox database, a production build served on :3002,
                                                   # Playwright at three viewports, then the restart-persistence check
node tooling/scripts/ue-runtime-up.mjs down
```

`apps/union-eyes/playwright.runtime.config.ts` runs `e2e/runtime/**` at desktop, tablet and mobile sizes against the running
server (no web server is started by the config). The first batch is
[`01-foundation-and-case-journey.spec.ts`](../../../apps/union-eyes/e2e/runtime/01-foundation-and-case-journey.spec.ts).

What is real: the Next.js server and proxy, the API handlers, the authority kernel, the atomic audit chain, the platform NAR
audit chain, native PostgreSQL with the runtime and system roles, and a real Chromium. What is a local fixture: the QA identities
(deterministic users, whose session cookie the platform auth honours only when `QA_TEST_ENV=true` and `UE_ENVIRONMENT=local`),
synthetic module entitlements for the two QA organizations, and a **local sandbox NAR store** (never immutable; see below).

## Latest run (R-13 closure): production build via the orchestrator

`up --prod --rebuild`, `test --prod` and `restart-check --prod` against the rebuilt tree: **41 passed, 0 failed, 46 API-only journeys skipped off desktop by design, 2.6 minutes**; restart check 2/2. The full Union Eyes suite on the same tree (app server stopped, `--maxWorkers=4`): 1,416 files, 20,221 tests passed. New specs: `03-intake-triage-assignment.spec.ts` (a freshly filed case from intake through routing, representation and oversight, with refusals and revocation) and the extended `02-persistence-after-restart.spec.ts`.

### Rate limiting (real Redis)

`ue-runtime-up.mjs up --prod --redis` starts a Redis 7 container. `e2e/runtime/04-rate-limiting.spec.ts` proves, against the production build: a credential-keyed mutation limit enforced exactly (60 per minute) with no organization header and no idempotency key; a forged `x-org-id` cannot exhaust another tenant; the shared store decides while Redis is up; with Redis **stopped** health says degraded, the limit is still enforced from process memory (exactly 60 allowed, then 429) and responses say `X-RateLimit-Mode: degraded`, while reads are unaffected; after Redis **recovers** the limiter returns to the shared store within the circuit breaker's 30 second cool-down without restarting the application. Unit tests: `lib/rate-limit/proxy-api-guard.test.ts` (10) and `app/api/health/route.test.ts` (2).

### Audit sandbox containment

Through the real NAR adapter (13 tests in `packages/nar`): no local record and no proof under staging, production, pilot, demo, a production deployment type, Vercel production, a production app environment, a production NZILA mode, a production deployment environment, no QA flag, or no sandbox mode; under the explicit local configuration the record is typed `local_sandbox` with `immutable: false` and no environment variable can change that. **The production Azure immutable adapter has not been exercised**; it needs an approved nonproduction Azure integration environment, which is an external dependency. The sandbox must never count as audit qualification for staging.

### Migration qualification (native PostgreSQL 16)

Cache migrations 0031 and 0032 are qualified by `db/__tests__/migration-0031-feature-flags-attribution.postgres.test.ts` and `migration-0032-grievance-events-actor.postgres.test.ts` (11 tests): upgrade from the preceding schema, preserved rows and indexes, idempotency, rollback (0032 refuses when it would lose history), fail-closed without the table, and the runtime role's privileges on the combined database. Migration 0030 was qualified earlier on PG15 and PG16. PG15 was not rerun for 0031 and 0032. No production database was touched.

## Earlier run: production build, fresh container, via the orchestrator

`ue-runtime-up.mjs up --prod --fresh` provisioned a new PostgreSQL 16 container from nothing (Django migrate, the approved Drizzle bootstrap with ledger verification of 69 rows including cache migrations 0030 to 0032, QA seed, sandbox platform database), built and served the production bundle and reported healthy. `test --prod` then passed **33 of 33 executed tests (30 are API journeys that run once, at desktop, by design) in 2.4 minutes with zero failures**, and `restart-check --prod` stopped the application, started it again, and proved the filed case, its audit proof and its tenant and steward boundaries survived (1/1). The same suite on the development server needed 8.7 minutes and failed a different test on each run.

## Earlier run: dev server, `NODE_ENV=development` (superseded for reliability; kept as history)

The table is the best complete dev-server run: 17/17 at desktop and 6/6 at tablet and at mobile (29 tests). Later full runs on the same dev server were intermittently failed by the server itself (see R-12); no run has been made against a production build.

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
| Coordinator (scoped supervisory mandate) assigns; steward sees and works the case; member never sees internal notes | pass | n/a | n/a |
| Steward walks the lifecycle through the workbench's status names; a refused escalation writes nothing; a permitted escalation commits grievance, event, case resolution and audit together | pass | n/a | n/a |
| Reassignment revokes the first steward at once (404 on case, notes and queue), the new steward gains access, state holds for a fresh request context | pass | n/a | n/a |
| Landing, navigation, no horizontal overflow, loading placeholders resolve: member, steward, staff, executive, governance, admin | 6/6 | 6/6 | 6/6 |

Not yet executed: restart-and-persist, logout/login persistence in a browser, attachments, supervisor and officer
oversight, notifications, finance, governance, organizing, WorkAid, federation, external collaboration and platform
operations. **Zero of Journeys A–I are complete.** Journey A now passes the file-to-steward handoff on a seeded case; the freshly filed case stays unreachable to a coordinator (R-13), and the Representative, Supervisor and Officer steps are not yet exercised.

## Defects and gaps found by running the application

| ID | Finding | State |
|---|---|---|
| R-01 | `/api/cases/intake` answered an organization without the module with a 500 (`EntitlementError` unmapped). 62 other route files call `requireEntitlement`; those built on `withApi` already map it to 403, raw-handler routes still need a per-route check. | Intake fixed and tested at runtime. Raw-handler survey open. |
| R-02 | The platform audit tables (`audit_records`, decision tables) have no storage-authority classification, so placing them in the application database fails catalog admission (`applicationReady=false`, health `ok:false`). The intake route writes the NAR proof through `platformDb`, which shared `DATABASE_URL`. | `PLATFORM_DATABASE_URL` added to `@nzila/db/platform` (falls back to the old behaviour). Production topology decision outstanding: separate platform database, or classify and grant the tables. |
| R-03 | `audit_records` refuses any row without Azure immutable storage metadata (constraint plus trigger), and the NAR adapter requires Azure storage, so no developer or acceptance machine can create an audit proof. | Local sandbox store added (`packages/nar/src/storage/local-sandbox.ts`), gated on `NAR_STORAGE_MODE=local_sandbox`, `QA_TEST_ENV=true`, `UE_ENVIRONMENT=local`, not production; records are typed `local_sandbox`, `immutable=false`. A sandbox-only SQL relaxation (`tooling/sql/ue-runtime-sandbox-nar-relax.sql`) refuses to run unless the database name ends in `_sandbox`. Immutable storage is **not proven**. |
| R-04 | `UE_ENVIRONMENT=local` is required by the QA session gate but was absent from the environment-validation enum, so every start logged a validation error. | **Fixed:** the enum now matches `lib/runtime/environment.ts` (`local`, `dev`, and the existing values). |
| R-05 | Assigning a case needs a chief steward holding a supervisory mandate with the `assign` power. The QA seed had no chief-steward identity and no mandate. | Fixed in the fixture: a synthetic, clearly labelled chief steward (`ue-qa-chief-steward-primary`) and a resource-scoped supervisory mandate, issued through the authority store under a synthetic issuance rule. The handoff on a seeded case now passes (coordinator assigns, steward sees and works it, member never sees internal notes). |
| R-06 | `/api/claims` (used by the claims console) returns nothing to a steward, while `/api/cases` (kernel-scoped) returns the steward's assigned cases. | Open: confirm which surface a steward's console must use. |
| R-07 | Under `NODE_ENV=test` the Next dev server's eval-based bundles are blocked by the Content-Security-Policy, so the page never hydrates. The dev runtime uses `NODE_ENV=development`. | Superseded: the production build is now the acceptance runtime (see Latest run). |
| R-08 | Mobile header wraps to two rows and shows the organization name twice; one dashboard figure ("Avg. Days Open 181") reflects fixture dates. | Open (frontend wave). |
| R-10 | The canonical `feature_flags` table lacks `created_by` and `last_modified_by` that the ORM selects, so every feature-flag evaluation errored (2,890 log errors in one session) and failed closed. | Cache migration 0031 adds the two nullable columns (registered, UNQUALIFIED); errors stopped on the running stack after applying it. A native suite for it is outstanding. |
| R-11 | With Redis unconfigured the app retried a Redis connection every two seconds forever, logging an error each time, while health reported Redis `ok`. Cause: `initRedis()` silently defaulted to `redis://localhost:6379`. | **Fixed:** with nothing configured it does not reconnect, logs once, and every cache lookup is a miss; health reports the absence as degraded. |
| R-12 | The Next dev server stalled or reset connections after several repeated full runs on a memory-constrained machine (ECONNRESET, a placeholder that never resolved). The journeys passed on a fresh server; the intermittent failures are attributed to the dev server. | Resolved by the production-build runtime: 33/33, repeatable, in 2.4 minutes. |
| R-09 | Seed script `predev` runs `align-org-schema.ts`, which alters `organization_members` at dev start. A defect it masks in development (missing defaults) exists on the canonical schema. | Related fix already committed (ORM supplies the defaults). The script should not hide drift in qualification runs. |
| R-13 | Case facts carried no jurisdiction, so no scoped mandate could cover a newly filed case and nobody could route one. | **Fixed.** The unit is the organization that owns the case: written by the server from the authenticated membership at intake, never accepted from a client, matched exactly and never inherited through the hierarchy (territory has no governed source and stays absent). Two independent explicit grants: a `cases` triage designation (administrator, expiring, revocable) lets the coordinator SEE the unassigned queue as metadata only, and a unit-scoped supervisory mandate with the `assign` power lets them ROUTE; neither is a read. The assignment audit names the deciding mandate and its instrument. Proven on a freshly filed case (`03-intake-triage-assignment.spec.ts`, 8 of 8) with refusals for administrator, unmandated steward, read-only supervisor, officer and another tenant, then mandate revocation, designation revocation and restoration; assignments survive a restart. |
| R-14 | `claimHistoryReference` returned the public claim id when `UE_CANONICAL_BOOTSTRAP_V2=0`, but the physical `claim_updates.claim_id` foreign key targets the internal primary key, so every case note, transition and reassignment history write failed with a foreign-key violation (HTTP 500) in the mode the QA session gate and the CI e2e workflows require. | Fixed: the reference always resolves the internal primary key; unit test added; verified over HTTP and against native PostgreSQL. Note the deployment template sets the flag to `1` while CI sets `0`, so mode parity is itself unproven. |
| R-15 | The workbench status selector and `next-actions` speak the claim vocabulary (`under_review`, `investigation`), but `PATCH /api/cases/[caseId]/transition` only accepted CUPE ids, so every status change made from the workbench was refused (the UI ignores a non-OK reply). | Fixed: the route translates a claim name that is not itself a CUPE id and still refuses unknown values; unit tests added. The workbench still swallows a refusal silently (open, frontend wave). |
| R-16 | The physical `grievances` table (Django-managed) has no database defaults for its NOT NULL columns, and the ORM emits `default`, so every grievance insert failed (`id` null). Same defect class as the roster insert found earlier. | Fixed for `grievances` with ORM-side `$defaultFn`. Other Django-managed tables carry the same risk: open, needs a sweep. |
| R-17 | `grievance_events.actor_user_id` is `uuid` in the approved migrations but `text` in the ORM and the Django model; every principal here is a text id, so recording an escalation event failed. | Migration `0032_grievance_events_actor_text` added and registered (UNQUALIFIED); applied to the runtime database only; rollback refuses if any actor is not a uuid. |
| R-18 | `updateClaimStatus` built the LRO signal input with the wrong shape (no `timeline`, wrong field names) through an `as unknown as` cast, so signal detection threw for every claim in `submitted`, and the swallowed error made every workflow-engine transition fail. Its history writes also used the public claim id against the internal-key FK (see R-14). Escalation committed its grievance even when the case transition was refused. | Fixed: correct `CaseForSignals`, internal keys for history rows, and the escalation now throws to roll back so a refusal leaves no grievance. Verified: refused escalation leaves 0 grievances; permitted escalation commits grievance, event, resolution and audit together. |
| R-19 | First-time assignment and reassignment failed over HTTP: the kernel executor handed a `Date` to the postgres driver unconverted (500). A no-op reassignment (kernel already names the assignee) left the `assigned_to` mirror empty, and the workflow guard that reads the mirror then refused the next step. The QA fixture also had no `case_assignment` issue/revoke rules, so reassignment was correctly refused. | Fixed: `bind` serialises dates; the mirror is reconciled on a no-op; synthetic labelled QA rules added through an audited transaction. Revocation proven: the old steward gets 404 immediately. |
| R-20 | With Redis unconfigured the build logged "rate limiting will fail-closed" at start and then "failing open" on every request. | **Fixed and proven with a real Redis** (see Rate limiting below). The contract: an explicit per-route limit rejects when its store is missing; only the catch-all organization limit fails open; the edge API guard enforces the same limit from process memory when Redis is unavailable and says so on every response; health reports degraded; recovery is automatic. |
| R-21 | Cold-start latency after a restart, and FIPS and environment warnings on every start. | **Measured; partly addressed.** Port open in 5 to 6 s; the first `/api/health` took 14.6 s (loading the 500-table schema module and opening the first connection). A fire-and-forget warm-up now completes about 10 s after the port opens and the first health then takes 0.6 s; a request inside that window still pays the load. The orchestrator abandoned and re-sent its health request every 20 s, which produced a 72 s observation and a piled-up connection queue; its per-request timeout is now 120 s. FIPS boundary warnings are an environment prerequisite (FIPS-enabled Node), not suppressed. **No latency budget is defined or enforced yet; open.** |
| R-22 | The orchestrator itself had two defects found by its first from-scratch run: Django was given a hard-coded password instead of the generated one, and on Windows a shell split `CREATE DATABASE x` into separate arguments. | Fixed; the from-scratch run now succeeds. |
| R-23 | The NAR local sandbox gate treated `NODE_ENV=production` as a production signal, so a locally run production build could not create an audit proof (intake 500, `Missing env: AZURE_STORAGE_ACCOUNT_NAME`). `NODE_ENV` describes the build, not the deployment. | Changed deliberately to the same signal set as the QA session gate (explicit `UE_ENVIRONMENT=local`, `QA_TEST_ENV=true`, sandbox mode, and no production deployment signal). One test that asserted the old refusal was replaced; a positive case and three new refusal cases were added. |
| R-24 | `/api/dashboard/stats` returns tenant-wide counts (active, pending and high-priority claims, member count) to any member, and returns zeros if its query fails. | Open: scope aggregates to the caller (kernel read scope) or restrict them to officer reporting; a query failure must not look like zero. |
| R-25 | `/api/grievances/[id]/assign` requires GUID principal ids, but kernel principals are text identifiers, so an escalated grievance cannot be assigned to a text-id representative. | Open. The Representative handoff is proven as a reassignment of the case; grievance-stage assignment is not proven. |
| R-26 | Two audit stores: kernel authority events go to `public.audit_logs`, route audits to `audit_security.audit_logs` (different columns). | Open: reporting and evidence export must read both; document or consolidate. |
| R-27 | Three unit tests encoded the old defective history behaviour (R-14) and one the response shape. | Updated with disclosure: the legacy-mode test no longer re-points the foreign key at `claims.claim_id`; it asserts the internal-key contract against the Django-shaped foreign key. |
| R-28 | ORM/physical parity sweep (`scripts/runtime/orm-physical-parity.ts`, 520 tables): 662 NOT NULL columns in 216 tables have no database default while the ORM emits `DEFAULT` (class of R-16). | Open; `organization_members` and `grievances` fixed. Evidence file `evidence/vs-orm-physical-parity-eba009ba6.json`. Fix by table as journeys reach them, with an insert test each. |
| R-29 | 16 principal columns in 8 tables are `text` in the ORM and `uuid` in the database (class of R-17), including `external_document_access_grants`, `external_matter_access_grants` and `representation_authorities`. They sit under RLS policies and one foreign key. | Open: needs a migration that recreates the policies and re-runs the storage-authority catalog tests; scheduled with the External Counsel / Employer / WorkAid journeys. |
| R-30 | 2,124 ORM-declared columns across 168 tables are absent from the physical schema. | Open: triage by surface as journeys reach them. |
| R-31 | The proxy mutation limiter was unreachable for any request without an `Idempotency-Key` (an early `return` preceded it) and, where reachable, was keyed on the client-supplied `x-org-id` header. **Demonstrated on the vulnerable build:** 75 authenticated mutations, none throttled; and with an idempotency key and a forged `x-org-id` naming another tenant, the attacker was throttled in the victim's bucket and the legitimate victim then received 429. | **Fixed.** `lib/rate-limit/proxy-api-guard.ts` keys every bucket on the presented credential (hashed, never stored) and the client address (a 5x ceiling so rotating credentials cannot multiply the allowance) and covers every API request including public routes, except probes, signed provider callbacks, cron and the auth endpoints (own limiter). 10 unit tests plus the runtime suite below. |
| R-32 | Public API routes and several raw-handler write routes had no limit of their own. | Open as a review: the edge guard now covers them; abuse-sensitive public endpoints (public intake, sign-up) and expensive per-user operations still need route-level limits reviewed one by one. |

## Stakeholder coverage in the QA fixtures

Fixture identities exist for: member, steward, staff (support agent), executive (president), governance (compliance manager),
administrator, a second-organization member and steward, a suspended member and an isolated external tester. There is **no**
fixture identity for: representative, senior representative or supervisor, financial officer, organizing staff, employer or
counterparty, external representative or legal counsel, WorkAid partner, federation, or platform operator. Those nine groups are
not yet exercised at runtime. They must be added through the existing identity, entitlement, mandate and profile architecture, not
as new database role names.
