# UE V2 PR #1309 final engineering convergence record

This record binds each claim to its source change, its test and the evidence tier it reaches. It is a source and local-runtime record. It
makes no staging claim: staging still serves the older application, `UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`, and PR #1309 stays a
draft on hold. Nothing here is a merge, deployment or promotion request.

Source baseline: `f48655250134ab16318ddc07061f4ac6a79753bc`. The commits that follow it on `fix/ue-private-document-delivery` are the
change set described below. The pull request head is stated in the pull request description and in the final report, because a record
committed to the branch cannot name its own commit.

## Evidence tiers used

| Tier | Meaning here |
| --- | --- |
| Source | Read from the committed change |
| Unit / route | Vitest on the exact files, with mocked or PGlite storage |
| Local native | Vitest against a disposable native PostgreSQL 16 database built by `ue-runtime-up.mjs db --fresh` |
| CI | The pull request checks on the head commit, read from the check runs |
| Staging | Not claimed anywhere in this record |

## Defect and evidence matrix

| # | Defect found | Fix | Proof (tier) |
| --- | --- | --- | --- |
| 1 | Server diagnostics and English refusal text could reach a French page; 5xx text reached people in several readers | One client failure policy in `lib/client/api-envelope.ts`; every 5xx uses controlled bilingual status wording; technical text is never shown | `api-envelope` tests, per-family French tests, response-shape census (Unit / route) |
| 2 | Sign-in policy showed "saved" on any ok response; partial read-back; lost response treated as rollback | Snapshot sent with the save; route locks the stored row and answers 409 when it moved; form reads the policy back without cache and compares every setting; a mismatch or lost response is "not confirmed" | `auth-policy-form` tests, `admin.test.ts`, route test (Unit / route) |
| 3 | Two first saves of the sign-in policy could both find no row to lock; the loser raised a raw database error | The insert runs in a savepoint and a unique-key loss is reported as a conflict, never an overwrite or a raw error | `admin.test.ts` conflict and non-conflict cases (Unit / route) |
| 4 | Magic-link verification had no second-factor step and no French refusals | Second-factor step; 429 and 5xx distinguished from a refused link | `app/magic-link/verify/page.test.tsx` (Unit / route) |
| 5 | Platform members console and the AI endpoint tester were unproven as operator-only and showed raw bodies | Routes require `platform_lead` and `requirePlatformStaffAuthority`; failure text uses the shared policy; both are deliberately English-only operator tools | `platform-console-boundary.test.ts`, console tests (Unit / route) |
| 6 | Document authorization had a second policy engine that ignored case relationship, uploader and link spelling | `document-authorization-service` applies the canonical `hasDocumentContextAccess` plus classification policy; related, precedent and evidence-reference consumers pass link and uploader facts | `document-authorization-service.test.ts`, `verified-dependency-store.pglite.test.ts` (Unit / route) |
| 7 | No matrix proved who is let in or refused for case-linked and organization-level documents against stored state | Download route matrix over personas, link spellings, privacy labels and reassignment; audit rows must equal the released document ids | `app/api/documents/[id]/download/route.pglite.test.ts` (26 cases, Unit / route) |
| 8 | Grievance read, related and precedent suggestions, and the repository detail read returned the stored file address; screens linked to it | The address is no longer selected or returned; each screen opens a document through the audited, time-limited download path (`useAuthorizedDocumentOpen`) and explains a refusal in English or French | `grievance-detail-console.test.tsx`, `document-suggestion-panels.test.tsx`, `documents-repository-id.route.test.ts` (Unit / route) |
| 9 | Accents missing from French document-journey copy | Corrected in the journey, browser repository, OCR intake, bulk download and portal copy | Updated journey and unit tests (Unit / route) |
| 10 | The committed V2 source plan and catalog projection no longer matched two changed sources, so bootstrap refused to run | Plan regenerated with the hash-locked wheelhouse (`plan.ts --self-test --check` twice) and the catalog overlay rebound to the new plan digest | Native database build, `current-security-contract` and bootstrap tests (Local native) |
| 11 | A screen's own log line ("HTTP 503", "Request failed with status 500") or the browser's "Failed to fetch" could be shown as the failure text; the CLC analytics dashboard showed raw shape errors and English text on a French page | `isStatusLine` and plain fallbacks in the shared helpers replace status lines with status wording; bulk operations and the CLC dashboard use the shared bilingual policy | `api-envelope.test.ts`, `clc-analytics-dashboard.test.tsx`, `bulk-operations.test.tsx`, updated jsdom suites (Unit / route) |

## Local native evidence

A disposable PostgreSQL 16 database was built with `node tooling/scripts/ue-runtime-up.mjs db --fresh --postgres-version 16` using Python
3.11 and the hash-locked `backend/requirements.lock`. An earlier subset on that shape (`document-intake.postgres.test.ts`,
`documents-external-workbook-routes.postgres.test.ts`, `external-resource-read.postgres.test.ts` and `grievances-routes.postgres.test.ts`)
passed 76 tests. The native config's full file list is in the qualification section below and replaces the earlier statement that the
full native matrix was left to CI.

`pnpm test:fast` on this source, with no native clone URL set: 3,286 files (3,161 passed, 124 skipped, 1 failed) and 43,766 tests (42,105
passed, 1,632 skipped, 16 failed). The one failing file is `apps/union-eyes/db/__tests__/external-resource-read.postgres.test.ts`. It
requires `UE_NATIVE_TEMPLATE_URL` and `UE_AUTHORITY_COMBINED_URL`. The same file passed inside the native suite below. The assertion was
not weakened and the file was not excluded. A plain `pnpm test:fast` without that database still fails that file.

## Browser acceptance on the owned production build

State: `TARGETED_TESTED` on a disposable production build. Not `STAGING_PROVEN` and not `PRODUCTION_ACCEPTED`.

The application was built and served by `node tooling/scripts/ue-runtime-up.mjs up --prod --redis --rebuild` (Next.js production server
on `127.0.0.1:3002`, PostgreSQL 16 on `127.0.0.1:55430`). Playwright config `apps/union-eyes/playwright.browser.config.ts`, spec
`e2e/runtime-browser/14-browser-journeys.spec.ts`. Projects: desktop Chromium, mobile Chromium (Pixel 7), mobile WebKit (iPhone 14).
Each project runs the journeys in `en-CA` and `fr-CA`. Evidence JSON is under `.ue-runtime/evidence/browser-journeys-<project>.json`
(16 records per project: journey, locale, persona, observed HTTP statuses, and the database rows read back).

Journeys, each in both languages: wrong password refused in the page language, then password plus authenticator; a member files a case
and the row is read back from `claims` before the list and the detail page open it; seven member pages carry `lang` and no message-key
leak; an administrator saves the sign-in policy, the page reads it back with GET, `user_management.org_auth_policies` and one
`org_policy_updated` audit row agree, then the previous value is restored; a member and another organization receive 403 and a stale
save receives 409; sign-out leaves `/api/cases` at 401 and the next dashboard navigation renders the sign-in form; no cookie and a
forged `nzila_session` both land on `/{locale}/login` with the form rendered; forgot-password and reset-password render in the cookie
language, a real reset request is acknowledged, and a forged token is refused with the catalog sentence for `Invalid or expired reset link`.

On the production build of `61f9d712742f1c6d5a55163042e02ab7393c753f`: desktop Chromium 16 passed, mobile Chromium 16 passed, mobile
WebKit 16 passed. The WebKit run was repeated once. The first pass on that build failed the four administrator journeys because this
machine's address already had 10 `invalid_password` audits inside 15 minutes (the wrong-password step of the runs immediately before
it). That is the sign-in risk engine (`login_soft_lockout`, score 50: ten failures from the IP plus a privileged role), not a policy-page
defect. The repeat started from a count of zero and passed 16. A later production rebuild, after the case-type label fix below, re-ran
only the filing journey: 2 passed on each of the three projects. The other 14 journeys were not repeated on that rebuild.

Defects closed from this browser pass:

| # | What the browser showed | Fix | Proof |
| --- | --- | --- | --- |
| 12 | `GET /login`, `/signup` and `/sign-up` returned 500. Server redirects and the sign-in form's own links land there, and those pages have no translation provider. `/forgot-password` and `/reset-password` returned 500 for the same reason. A redirect `Location` dropped the loopback port. | The edge sends the three pages that have a locale twin to the reader's language and keeps the query. The recovery pages have their own provider, the same language rule, and French copy. A loopback host keeps its port. | `lib/locales.test.ts`; browser journeys `no-session-redirect` and `password-recovery` (48 of 48 on the build above) |
| 13 | A French sign-in page showed the route's English refusal, including the risk engine's soft lockout | Known refusal sentences map to `loginForm` in both catalogs | `login-form-flows.test.tsx`; the sign-in journey asserts the French page does not show the English sentence |
| 14 | The document navigation told a member "Bibliotheque du personnel" | A member sees "Mes documents" / "My documents"; the staff label keeps its accent | `documents/__tests__/layout.test.tsx` |
| 15 | The case detail printed the stored type `wage_dispute` on a French page. Status and priority beside it were translated. | Detail uses the same catalog lookup as the member list. Intake types (`wage_dispute`, `safety`, `discipline`, `discrimination`, `harassment`, `benefits_denial`, `contracting`) are in every catalog. An unknown type is put in words. | `member-case-list.test.tsx`; `page.test.tsx`; filing journey re-run, 2 passed on each project, body contains `claimTypes.wageDispute` and not `wage_dispute` |
| 16 | The anonymous-filing checkbox, the onboarding dismiss control and the feedback dismiss control were under 24px | Each is at least 24px on the box the person touches | Filing journey touch-target check on the mobile projects |

## What the earlier browser section does not prove

The 48-journey pass on `61f9d712742f1c6d5a55163042e02ab7393c753f` did not cover invitation redemption, steward assignment, officer and
executive action, correspondence, platform-executive organization creation, or session expiry. Those journeys are in the qualification
section below, on a later production build of this source. That earlier section remains the record of the first matrix, not of this source.

- Staging behaviour is not claimed. Local production-build evidence is `TARGETED_TESTED`. It is not `STAGING_PROVEN` and not
  `PRODUCTION_ACCEPTED`.
- `UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO — RUNTIME_PROOF_REQUIRED`. Health reports `catalogAuthority.status=ok` and
  `applicationReady=false` together: catalog admission passed, and the process does not advertise the product as ready.
- The `Security Design Review Gate` requires the `security-design-reviewed` label from `@nzila/security`. The label already on the pull
  request is a human disposition. This record does not add or treat it as a new review.
- The operator consoles stay English-only by decision; French is not required of them.
- GitHub Actions for the commit that contains this record cannot be named here. The pull request description states that head after the
  checks are read. This file does not claim `CI_VERIFIED`.

## Residual risk a reviewer should read

- `lib/services/document-authorization-service.ts` resolves staff status through `hasRoleInOrganization` when a caller does not pass it.
  Seniority opens only unlinked organization-level documents; linked documents still need the case relationship.
- Removing the stored address from list and suggestion payloads is a contract change for any client that read `fileUrl`. No repository
  client does; the upload forms still accept an address as input.
- The response-shape census ceilings are unchanged (findings 0).

## CI repair after `eee69955d`

The next two commits repair the four failing checks and add journeys. This section does not name its own commit. The pull request description states the head. Nothing here is Step 1 acceptance.

| Failure | Cause | Correction | Proof |
| --- | --- | --- | --- |
| INV-06 raw driver | The browser and document specs imported `pg` | `queryOwnedRuntime` in `scripts/runtime/db-inspect.ts`. The boundary exemption list is unchanged | `db-boundary.test.ts` 16 passed; full contract suite 309 files, 10,177 tests passed |
| Document repository route tests | Fixtures still returned the link on the document row. The routes read every link as its own query | Fixtures supply the link query. Expected 403 and 404 were not rewritten | Both route files passed, 50 tests |
| E2E shard 3 fixture operator | Playwright never received `QA_TEST_ENV=true` | The workflow exports the flag with the operator URL. A foreign host, wrong user, wrong database and a missing flag throw | `fixture-auth.test.ts` |
| E2E shard 4 storage | The document spec evaluates `@nzila/blob` and the production app had no storage | `up --azurite` starts loopback Azurite and the repository ClamAV adapter. Production accepts that endpoint only for loopback, account `devstoreaccount1`, and both fixture flags | Blob tests 12 passed. A disposable adapter scan returned `{"engine":"clamav","status":"clean"}` |

## Local qualification on the rebuilt production process

State: `TARGETED_TESTED` on a disposable production build of this source. Not `CI_VERIFIED`, not `STAGING_PROVEN`, and not `PRODUCTION_ACCEPTED`. This section replaces the earlier statement that invitation redemption, the private-document suite, the three-browser matrix and the five repository commands were still outstanding.

The prior process on port 3002 was stopped. `node tooling/scripts/ue-runtime-up.mjs db --fresh` recreated the owned PostgreSQL 16 container, migrated and seeded it. `node tooling/scripts/ue-runtime-up.mjs up --prod --rebuild --redis --azurite` then rebuilt Next.js and started it. Build id `1795622902678` (11:10 AM America/Toronto). Healthy at 11:17 AM America/Toronto: process, database, auth and Redis `ok`; catalog authority `ok` with `applicationReady=false`. Loopback Azurite is `http://127.0.0.1:10000/devstoreaccount1`, container `union-eyes`, ClamAV adapter `http://127.0.0.1:18080`. The invitation bearer is written only under the private runtime state directory when the local QA guard is on. It is absent from the create and accept JSON, from the evidence files, and from this record.

Re-running bootstrap after pgvector had been installed into that container failed closed (`FRAMEWORK_UNDECLARED_FUNCTION_AUTHORITY` for `halfvec` functions). The supported provisioner treats `vector` as optional when the image does not provide it. The fresh container used for this boot is the stock `postgres:16` image, with the extension unavailable, which is the same condition as `db --fresh`. The native suite below had already run on a container where the extension was installed after bootstrap, matching the CI order in `ue-native-postgres.yml`.

Browser matrix, `playwright.browser.config.ts`, projects desktop Chromium, mobile Chromium (Pixel 7) and mobile WebKit (iPhone 14), `en-CA` and `fr-CA`, workers 1: 75 passed, 0 failed (4.5 minutes, finished 11:23 AM America/Toronto). That is the original journeys plus the Step 1 journeys, including the ten-failure soft lockout on each project. Each journey releases the `127.0.0.1` login-failure window first. The soft-lockout test still requires ten failures and still records `login_soft_lockout`.

Observed on all three projects, from `.ue-runtime/evidence/step1-journeys-<project>.json` (no bearer):

| Journey | Result read back |
| --- | --- |
| Invitation | Create 201 with no `token` property. Forged, expired, already-used and tampered accepts returned 400. Revoke returned 200 and a later accept returned 400. A wrong-organization revoke returned 403. The redeemed user has one membership, in the inviting organization. The body `organizationId` does not move the invite. |
| Assignment | A new filing is outside the mandate (assign 404). After that filing alone is scoped, assign and reassign return 200 and `claims.assigned_to` is the second steward. The canonical fixture cases are not reassigned. The other organization receives 404. |
| Messages | Thread create 201 and `messages.thread.create` is in `public.audit_logs`. The inbox shows the subject. The French page is French. The other organization receives 404. |
| Document library | "My documents" and "Mes documents". An unknown id is 404. |
| Platform executive | Local administrator 403. Unappointed platform title 403. No row inserted. A disposable platform executive receives 201; the organization row's parent, type and level match; `organization.create` and `platform.organization.manage.authorized` (`basis=platform_executive`) are in `public.audit_logs`. Demotion to officer makes the next create 403 with `platform.organization.manage.denied` and `no_live_scoped_platform_staff_mandate`. |
| Officer, correspondence, privacy | Internal note is absent from the member read. Foreign notes 404. Leadership report 200 for the executive and 403 for the member, and the report does not contain the note. Correspondence persists as `draft`. The member is refused. The other organization receives 403 or 404. |
| Session | Expiring the isolated tester's session returns the browser to sign-in. Password and authenticator open the dashboard. |
| Retry | The first filing request is aborted and the page shows a failure. The next submit persists one case. |

Runtime API matrix, `ue-runtime-up.mjs test`: 95 passed, 163 skipped, 0 failed (9.7 minutes, finished 11:33 AM America/Toronto). The skips are the tablet and mobile duplicates of the desktop API journeys. Desktop journey A passed, including the steward's fixture-case list.

Private documents, `playwright.documents.config.ts`, against that Azurite: 13 passed, 0 failed (1.8 minutes, finished 11:19 AM America/Toronto). The suite covers intake and scan, both case-link spellings, authorized download of the stored bytes, organization-level and restricted labels, two-case links, reassignment and revocation, lease binding (other actor, other document, tampered token, expiry, replay), version replacement, hash mismatch, missing object, audit failure with no successful download, the size bound (413), and concurrent downloads. `.ue-runtime/evidence/document-evidence.json` records the assigned representative's issue and content responses as 200 and the `document.download` and `document.download_served` audits. The filing member is refused.

Commands on this source, before this record was added:

| Command | Result |
| --- | --- |
| `pnpm lint` | 172 tasks successful |
| `pnpm typecheck` | 238 tasks successful |
| `pnpm test:fast` | 3,161 files / 42,105 tests passed; 124 files / 1,632 tests skipped; 1 file / 16 tests failed only because the native clone URL is unset |
| `pnpm exec vitest run --project contract-tests` | 309 files, 10,177 tests passed |
| `vitest.native.config.ts` on the fresh PostgreSQL 16 template | 101 files / 1,059 tests passed; 1 file / 4 tests skipped. The skips are the four legacy-topology cases in `current-security-installer.native.test.ts` listed in `tooling/scripts/lib/ue-native-expected-skips.json`. They are not passes. |
| `npx vitest run --config security/redteam/vitest.config.ts` | 7 files, 106 tests passed |
| `plan.ts --self-test --check` with `UE_V2_WHEELHOUSE=/tmp/ue-wheelhouse` | passed. 783 tables, 6,326 statements, 303 decisions, 35 exclusions, 0 security blockers, `fullReadiness=NOT_YET_PROVEN` |
| Catalog overlay check from `apps/union-eyes` | "Current canonical catalog overlay matches its source compilers" |

`pnpm validate:docs` and `pnpm governance:audit` are run again after this section, because they read the documentation tree. Their result for this record is stated in the pull request description with the other exact-head checks. The generated audit reports those commands rewrite are not part of the change.

`insertAuthRow` returns only the inserted columns and the primary key. `RETURNING *` required `SELECT` on columns the redemption role must not read (`42501`). Callers use the inserted identity columns. The V2 source plan was regenerated from that file; the SQL statement text is unchanged and the enum digests moved with the commitment hash. `sourcePlanDigest` in `catalog-v2-decisions.json` is the SHA-256 of `JSON.stringify` of the plan. `UE_RUNTIME_STATE_DIR` is declared test-only. The provisioner passes the recorded loopback Azurite and ClamAV settings into later Playwright processes.

The previous head's Union Eyes shard 4 failed inside `scope-case` after a real intake returned 201. `restore-fixtures` can finish without an auth transaction when the seeded rules, mandates, and assignments already match. Issuing supervision for a newly filed case cannot. `executeAuthContext` requires `AUTH_DATABASE_URL` and refuses the operator and the runtime login. The Playwright job exported those two database URLs and did not export the dedicated auth gateway URLs, so the child process threw `AUTH_DATABASE_URL is required for scoped auth execution; ordinary/system fallback is forbidden`. The catch had dropped `error.message`, which is why the log showed only `name: 'Error'`. Both workflow env writers now export `AUTH_DATABASE_URL` and `AUTH_SYSTEM_DATABASE_URL` from the same provisioner environment, with the passwords masked. A `scope-case` using the operator as `DATABASE_URL` plus those gateway URLs completed against the fresh database. The disposable invitation and executive stamps use `crypto.randomBytes` hex, so they are not `Math.random` and the stored email stays lowercase. CodeQL had flagged the previous `Math.random` stamps.

The previous head's GitHub Actions had three failing checks: the Union Eyes shard that runs the new browser journeys and the private-document suite, the shard-result aggregator that reports that shard, and CodeQL on the two `Math.random` stamps. The source described above exports the auth gateway URLs and replaces `Math.random`. That head's shard 4 then failed for two different causes, read from the job log at 12:50 PM America/Toronto. `AUTH_DATABASE_URL` was present. The disposable executive journey threw `Owned fixture MFA key required` because the Playwright process did not receive `AUTH_MFA_ENCRYPTION_KEY`, while the application had been started with that derived key. The private-document `beforeAll` then exceeded the CI config's 60-second hook cap; the documents config used for the local 13-test run allows 180 seconds, and two `scope-case` transactions do not fit in 60. This source masks and exports the same 64-character derived key, and the document hook raises its own timeout to 180 seconds. The assertions are unchanged. The Actions result for the commit that contains this paragraph is read after it is pushed.

## Qualification contract

`pnpm test:fast` is `vitest run --project=!contract-tests`. That command includes the Union Eyes unit project and the heavy project. It does not include `vitest.native.config.ts`. A clean invocation, with no runtime database URL and no storage endpoint in the environment, finished at 1:19 PM America/Toronto: 3,161 files passed, 124 files skipped, 42,105 tests passed, 1,632 tests skipped, 0 failed (17.7 minutes). The 16-test file `external-resource-read.postgres.test.ts` is not in those totals. The heavy project excludes it. Selecting it without an owned clone still fails closed inside the native project, and the native results contract treats a file that did not run as a failure. An unprovisioned run is not a pass.

Those 16 assertions were run unmodified against a clone of the fresh owned PostgreSQL 16 template (`UE_NATIVE_TEMPLATE_URL` set to the operator URL; the native setup created the clone, the four restricted logins, and `UE_AUTHORITY_COMBINED_URL`). 16 passed in 99 seconds, finished 12:42 PM America/Toronto. The clone database was absent after the run. The same file's earlier failure under plain `test:fast` was the missing clone, not a product assertion.

The 124 skipped fast-suite files are tests the fast command does not provision. They include the disposable PostgreSQL files that skip unless `RLS_ENFORCEMENT_TEST_URL` or the native clone URLs are set. A shell that still held those URLs made four of them fail on a missing `ue_rls_scratch` database and made a blob unit test and a PGlite document test follow the loopback storage endpoint. That run is not the qualification. The native PostgreSQL job sets the clone URL and `RLS_ENFORCEMENT_TEST_URL`, runs every native file, and fails if a test skips without an entry in `ue-native-expected-skips.json`. The 1,632 skipped tests inside the passing files are the same separation. They are not counted as passes.

The runtime API matrix's 163 skips are `test.skip` on tablet and mobile for journeys marked "API journey: runs once, at desktop". Desktop journey A passed. Mobile Chromium and mobile WebKit in the 75-test browser matrix are the mobile proof. Those 163 skips are repeated API coverage, not missing journeys.

## Legacy installer provenance

The four cases in `current-security-installer.native.test.ts` stay skipped. The file runs only when `UE_CURRENT_SECURITY_NATIVE_PROOF=1`, and it refuses a template that already contains `user_management.auth_business_org_authorized(uuid,text[])`. It also requires a database named `ue_*`, owned by `uev2admin`, with the enabled event trigger `ue_guard_deadline_reassignment_convergence_policy` owned by `uev2admin`. The test starts no server and does not modify the template. No workflow, provisioner command, tag, or fixture in this repository builds that database. The current-security installer says released SQL is evidence only. The hashed migration files it reads are not a complete released database, and copying the current canonical database would be refused as already current. The missing artifact is a disposable database installed by `uev2admin` from the released pre-current security topology. Its owner is `team-union-eyes-engineering@nzila.ai`. The four skips remain expected skips. They are not passes, and they are not removed.

## Step 1 decision on this source

These decisions are separate.

- `STEP_1_ENGINEERING_COMPLETE` = NO until every required check on the commit that contains this section has passed. The corrections are in the source. The exact-head Actions result is not yet that commit's result.
- `STEP_1_ACCEPTED` = NO. The acceptance contract includes that Actions result, and the four released-topology cases are not proven.
- `STAGING_GO` = HELD. Staging still serves `6a60c95c9de17e9343e0414bb51766afbc190054`. No staging persona, byte, or expiry proof is claimed.
- `PRODUCTION_GO` = HELD. Production deployment is not authorized.
- `UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`. Phase 3B does not start.
- `fullReadiness` stays `NOT_YET_PROVEN`.

Unresolved in-scope engineering defects known before the Actions result for this section: none that this source leaves uncorrected. The shard 4 causes above are corrected here and are not yet re-qualified on Actions. Outstanding dependency, not a code change: the released-topology database named above. Local production-build evidence remains `TARGETED_TESTED`.

Step 2 does not start from this record. It starts only after `STEP_1_ACCEPTED` = YES. That requires the required checks on the exact final head to pass, the fast command and the native cohort to keep the pass/fail split above, and a decision on the released-topology dependency: either those four cases pass against a genuine released database, or the owner records that the transition proof stays outside Step 1. Staging and production stay held either way.
