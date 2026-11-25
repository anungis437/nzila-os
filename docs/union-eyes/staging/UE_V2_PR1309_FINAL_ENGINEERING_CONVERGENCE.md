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
3.11 and the hash-locked `backend/requirements.lock`. On it, `document-intake.postgres.test.ts`,
`documents-external-workbook-routes.postgres.test.ts`, `external-resource-read.postgres.test.ts` and `grievances-routes.postgres.test.ts`
ran with `vitest.native.config.ts`: 4 files, 76 tests, 0 skipped. This is a subset. The complete native matrix (PostgreSQL 15 and 16) is
a pull request check and is read from CI, not from this record.

`pnpm test:fast` on the final head: 3158 files passed, 124 skipped (skips pre-date this change), 1 failed. The one failing file is
`db/__tests__/external-resource-read.postgres.test.ts` (16 tests). It needs an owned native database clone and is unchanged from `main`; run
through `vitest.native.config.ts` against the native PostgreSQL 16 database above it passes 16 of 16. A plain `pnpm test:fast` without that
database therefore still fails that file, as it does on `main`.

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

## What this record does not prove

- The browser spec above does not cover invitation and onboarding, steward assignment, supervisory review, officer or executive action,
  messages and correspondence attachments, document upload, preview, download and versions, external delivery and expiry, member privacy
  restrictions, organization changes by a platform executive, or session expiry. Those remain outside this browser evidence. The screen
  behaviour they share with the covered journeys is still covered by the jsdom tests named above. The Playwright runtime acceptance in CI
  is a separate check.
- Staging behaviour is not claimed. The sign-in policy atomicity and document matrix are source, route and local native evidence.
- The `Security Design Review Gate` requires the `security-design-reviewed` label from `@nzila/security`. The change touches the
  sign-in policy path, so that review is a human disposition owned by that team; the label is not added by this change.
- The operator consoles stay English-only by decision; French is not required of them.

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

Desktop Chromium, English, on the production process that was already running (so it does not include the invitation outbox):

- A case outside the chief steward's supervisory mandate is not assignable. A case the mandate names is reassigned and the new assignee is read back. The supervisor can read it. The other organization cannot.
- A member starts a conversation. `messages.thread.create` is in `public.audit_logs`. The inbox shows the subject in English and the French page is French. The other organization cannot read the thread.
- The document library says "My documents" and "Mes documents". An unknown document id is 404.
- Organization creation is refused for a local administrator and for the fixture platform title, which is not a platform executive. No organization row was inserted.
- Expiring the isolated tester's session returns the browser to sign-in. Password and authenticator then open the dashboard.
- Aborting the filing request once, then submitting again, writes the case.

Each browser journey releases the shared `login_failed` window for `127.0.0.1` before it runs, and one journey still requires ten failures to soft-lock the administrator. That lockout journey is in the spec and has not been executed on this process yet.

Still not proven on this source: invitation redemption (the bearer is written only to the local fixture outbox, which the running process does not have), the private-document byte suite against Azurite, the three-browser matrix of the original 16 journeys plus these new ones, the five repository commands, and the GitHub Actions result for this head.
