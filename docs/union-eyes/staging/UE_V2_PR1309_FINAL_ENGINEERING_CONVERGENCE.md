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

## What this record does not prove

- Browser acceptance on desktop and mobile in English and French was not run against a running application in this change. The screen
  behaviour is proven with jsdom tests in both languages, including accessible names, alerts and retry. The Playwright runtime
  acceptance remains a CI check.
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
