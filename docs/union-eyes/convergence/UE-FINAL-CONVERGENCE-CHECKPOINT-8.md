# UE Final Convergence — Checkpoint 8 (Continuation 8)

Status: **progress, not completion. `UE_ENGINEERING_CONVERGENCE` is NOT ACHIEVED** and the exit gate was not forced. Staging and production remain NO-GO. Verdicts below are independent and none is promoted by a lower-level suite.

## What closed in this continuation

| Area | Before | After | Evidence |
| --- | --- | --- | --- |
| Dependency advisories (CI audit policy, `pnpm audit`, Trivy filesystem) | HIGH advisories in zod 3, msal-node, multer, undici, body-parser | policy PASS (18 non-high, 1 waived node-forge, 0 unwaived); Trivy filesystem scan **0 HIGH/CRITICAL** across every lockfile (run locally with the CI parameters and `.trivyignore`) | `5e99cb0ca`, `3f485c81f`; the standalone `.kilo` and `packages/scripts-book` lockfiles that the zod migration had left on 3.25.76 now resolve 4.6.7 |
| zod 3.25.76 → 4.6.7, monorepo-wide | — | single resolved version; behaviour preserved, not reinterpreted | `.partial()` default re-application neutralised by `partialWithoutDefaults`; `.errors`→`.issues` including four runtime sites tsc cannot see (`alert-rules.ts` had been swallowing every schema error); `.default().optional()` dead defaults; `z.uuid`→`z.guid`; regression test `zod4-semantics.test.ts` |
| Invite authority | an invitation survived the removal or demotion of its inviter | redemption requires the inviter to still be an active administrator of that organization (and an active user) | `ecc164e0f`; RLS predicate `auth_invite_inviter_live()` (no-argument definer, reads only the bearer's own invite — no membership oracle) |
| Session bridge | a revoked parent session left a 30-second bridge usable | the bridge records its parent session; the business predicate re-reads the parent on **every statement**, so revoking, expiring or swapping the parent ends authority at once | native auth suite 19/19 on the pinned pgvector PG16 image, incl. demoted / removed / suspended / cross-org / forged inviters and unknown / foreign / revoked / expired parents |
| Member location retention | the 24-hour retention was **never enforced** (the purge existed, "should run hourly", nothing called it) | cron-authenticated `app/api/cron/location-retention` runs the sweep under the system role in one transaction with its deletion-log evidence | native PG15 + PG16: runtime session cannot sweep others, system sweep deletes every member's expired rows and keeps live ones, an injected evidence failure rolls the whole sweep back, privileges minimal |
| `location_deletion_log` shape | **defect found by the native proof:** the Django stub (id, created_at, updated_at, deletion_type; no defaults) made every evidence insert fail, so the sweep could not record evidence and **self-service consent revocation (`DELETE /api/location/consent`) would have failed outright** | platform migration `0028_location_deletion_log_shape` (additive, idempotent), journal + README + approved lineage (UNQUALIFIED, sha256-bound) | census entry (COLUMNS_MISSING + REQUIRED_UNDECLARED) cleared |
| Unscoped-mutation baseline | 26 | **13** | scanner now matches organization identifiers case-insensitively and accepts the owning user as the scope of `USER_RLS_REQUIRED` relations; an uncalled id-only privileged writer (`updateDSARStatus`) and the two unwired duplicate retention sweeps in `lib/services` (one of which swallowed errors into a "purged" message) were retired; baseline can only shrink |
| Canonical schema census | 235 | **231** | 3 unreferenced declarations retired (`contract_rate_cards`, `contract_amendments`, `document_search_index`); `location_deletion_log` evolved. Regenerated on a fresh Django-first PG16 + bootstrap (`UE_CENSUS_WRITE`); exactly those entries leave, none added |
| CodeQL | 12 new alerts (10 high) in files the PR touched, with ineffective inline `codeql[...]` suppressions | fixed in code (see below); no suppression added | `26cf529e0`, `ec0773035`, `b842d8432` |
| Schema drift / Schema Integrity (CI) | failing: the committed runtime-schema oracle and canonical manifest were stale (332 published tables vs 366 declared) and the old check passed only by text-matching `updated_at` anywhere in a file | oracle and manifest republished from the current declarations; all four CI steps pass locally | `fd067a562` |
| Convergence check | `MUTABLE-REP-IDENTIFIER` failing since `scripts/reconcile-case-ownership.ts` was added in Continuation 7 | allowlisted with its reason (read-only CLI over the already-allowlisted reconciler) | `e289e0e70` |

### CodeQL fixes (real weaknesses, not suppressions)

- `email-template-builder.tsx`: a button `href` and an image `src` came verbatim from user block content, so a `javascript:` or `data:` value reached the DOM. New `safeAttributeUrl()` allows only `http(s)` (and `mailto` for links); an unsafe image is dropped; links gain `rel="noopener noreferrer"`.
- `request-validation` html rule, `notification-service` `stripHtml`, server fallback of `sanitizeHtml`: a single regex pass could reassemble `<script`/`<style` from nested fragments. CodeQL rejects every `<[^>]*>` strip regardless of what follows (the single-pass and loop forms both kept alerting), so they now share `stripMarkup()` (`lib/utils/strip-markup.ts`), a linear scanner that drops tags, comments and script/style content and never emits `<` or `>`. A test caught the first draft being quadratic on 200k `<`; it is now linear. The old `sanitize.test.ts` expectation (`Hellobad`) encoded script text leaking into the output and was updated to `Hello`.
- `deterministicReportGuardrails`: the email-detection regex was polynomial on long runs of `%`; quantifiers are bounded.
- `provision-entra-test-users.mjs`, `build-baseline.ts`: backslash is escaped before the characters it escapes.
- Django JWT authentication returned the verifier's exception text to the caller; the detail stays in the log and the response is generic.
- At the final head CodeQL passes (all three Analyze jobs and the CodeQL check). One medium `js/sensitive-get-query` warning on a financial-service remittance filter may remain; it is warning-level and does not fail the check.

## The 13 remaining mutation sites (reachability and reason)

| Site | Count | Reachability and why it is not closed |
| --- | --- | --- |
| `app/api/payments/webhooks/stripe/route.ts`, `app/api/workbook/[id]/claim/route.ts` → `workbooks` | 2 | Reachable. A workbook is an anonymous pre-tenant artifact: it has no organization until the claim sets `claimed_org_id`, so an organization predicate cannot exist. Scope is a single-use credential plus a state guard (`stripe_payment_ref IS NULL`, `claim_token IS NULL`). This is a classification statement, not a defect. |
| `lib/pilot/pilot-ownership.ts` first bind → `pilot_applications` | 1 | Reachable. The operation that *assigns* the organization (`verified_organization_id IS NULL` guard); the rebind, which does compare against the previous organization, is now recognised as scoped. |
| `services/geofence-privacy-service.ts` → `location_tracking`, `geofence_events` | 2 | The retention sweep (`expires_at <= now`), system-wide by design, wired to `app/api/cron/location-retention` and proven natively. The two unwired duplicate sweeps in `lib/services` were retired. |
| `lib/services/external-data/clc-partnership-service.ts` → `clc_sync_log` | 1 | No production importer. |
| `services/financial-service/src/jobs/*`, `…/notification-service.ts` → `dues_transactions`, `payments`, `notification_queue` | 7 | Latent financial-service sites with no mounted caller in the application; to be scoped before any is wired. |

## Schema census (231) — measured disposition, not suppression

| Disposition | Count | State |
| --- | ---: | --- |
| `CONTAINED_DENY_ALL` (no authority; contained) | 116 | classification, not a defect |
| `VERIFY_UNREACHABLE_THEN_RETIRE` | 39 | **computed from production entry points:** 15 are referenced only by modules no entry point reaches (workflow engine, audit-trail, tax-slip, immigration, indigenous-data, accessibility, segment and tenure queries …); retiring them means deleting those dead consumers and their tests — a bounded follow-up, not done blind. 24 are reachable (billing, dunning, pricing, notification workers, employment queries) and stay. `grievance_communications` was deliberately **not** retired: the Django backend still defines it. |
| `GLOBAL_REFERENCE_SHAPE` / `SYSTEM_ONLY_SHAPE` | 34 | shape classification |
| `LIVE_UNREFERENCED` | 15 | tenant tables with no code reference |
| `CREATE_RELATION_REQUIRED` | 10 | health-and-safety / payroll relations declared but absent from the lineage; each needs a **reviewed** CREATE with keys and RLS (domain design), so they are explicitly `dispositionExcluded` in the canonical manifest rather than invented here |
| `INDIVIDUAL_DECISION`, `RETIRE_DECLARATION` (4 left), `REGISTRY_GAP`, `SEPARATE_DATABASE` | 17 | individual decisions |

## Exact SHAs tested

Final code SHA for the gate run below: `f27b7ff8b81f8d95a51786873926053a08d87505`. The commit that adds this record changes documentation and one register only.

| Suite | SHA | Result |
| --- | --- | --- |
| Native PostgreSQL 16 and 15, fresh databases, runtime role: combined 10/10, thread-assignment 3/3, atomic-audit 6/6, census 4/4, documents 10/10, **location retention 5/5**, finance-duties 21/21, message-lifecycle 22 (+1 skipped), WorkAid 5/5 | `fd067a562` (no database code changed afterwards) | pass on both |
| Native auth proof (pinned `pgvector/pgvector:0.8.1-pg16@sha256:33198da2…`, `AUTH_NATIVE_PROOF=1`) | `fd067a562` | 19/19 |
| Contract tests (`--project contract-tests`, Git bash + `python3` shim) | `f27b7ff8b` | 302/302 (10,274 tests) |
| `pnpm lint` | `f27b7ff8b` | exit 0 (0 errors) |
| `turbo typecheck` (workspace) | `f27b7ff8b` | 238/238 tasks, exit 0 |
| Root `pnpm test:fast` | `f27b7ff8b` | 2,441 files passed, 31 skipped, 0 failed (33,488 tests passed, 681 skipped) |
| `apps/union-eyes` `tsc --noEmit` | `b842d8432` (the last commit touching typed source; later commits change tests only) | exit 0 |
| `pnpm validate:docs`, `pnpm governance:audit`, `check-ue-convergence`, migration lineage (incl. 0028) | `fd067a562` | pass |
| Trivy filesystem scan, CI parameters, local | `3f485c81f` | 0 HIGH/CRITICAL |
| Browser acceptance (member, representative, staff) | — | **not run** with credentials. The synthetic Playwright E2E (4 shards) passes in CI; it is not credentialed acceptance. |

Not run: the Windows-incompatible `rls:check-enforcement` (spawns `npx` without a shell; it already drifts from the frozen round-58 migration on the unmodified tree, 10,091 generated lines vs 9,217 committed, and is not wired into CI).

## Remote CI on PR #996

At `fd067a562`: 118 checks pass, 8 skipped, 2 fail. At `26cf529e0`: CodeQL 12 → 3 alerts; at `ec0773035`: 6 (the loop form was rejected too), which led to `stripMarkup()`. At `f27b7ff8b`: Unit Tests pass; `Analyze (javascript-typescript)`, `Publish required checks` and `Reconcile Secret Scan frozen head` failed with **GitHub API rate-limit 403s** (infrastructure, not code); the latter two were re-run; CodeQL could not be re-run, so the next push (`b6cb99b24`, documentation only) re-triggered it. **Result at `b6cb99b24`: 119 checks pass and 1 fails — Governance Gates, the maintainer `approved-experiment` label below.** CodeQL, Unit Tests, Dependency Audit, all Trivy scans, Schema Drift and Schema Integrity pass. The two failures at `fd067a562` were:

1. **CodeQL** — engineering, fixed above (12 → 3 → the two high alerts addressed in `f27b7ff8b`).
2. **Governance Gates** — **needs a maintainer, not an engineering change.** `validate-tier-focus` requires the `approved-experiment` label because the zod 4 migration necessarily touches Tier 3/4 apps (`agrimo`, `console`, `control-plane`, `cora`, `mobility`, `nacp-exams`, `nzila-hq`, `orchestrator-api`, `trade`, `trustcore`, `trustcore-trustops`, `union-eyes-demo`, `web`, `weekone`, `zonga`) through their `package.json` ranges and call sites. The existing `owner-approved` and `security-design-reviewed` labels were applied by a maintainer account; this label is the same kind of human approval and I did not apply it. Alternatives that avoid it would leave those apps declaring `zod ^3` while resolving 4.6.7, which I judged worse than asking.

## Readiness verdicts (independent)

| Verdict | State |
| --- | --- |
| `UE_CURSOR_DOCUMENT_INTEGRATION` | PASS (engineering only), unchanged |
| `ENGINEERING_CONVERGENCE` | **NOT ACHIEVED** — see the unmet gates below |
| `PERSONA_FOUNDATION_READINESS` | PARTIAL |
| `CREDENTIALED_END_TO_END_ACCEPTANCE` | NOT STARTED |
| `INSTITUTIONAL_POLICY_ADOPTION` | NOT ADOPTED |
| `STAGING_QUALIFICATION` | NOT STARTED |
| `PRODUCTION_RELEASE` | NO-GO |

### Why `ENGINEERING_CONVERGENCE` is not PASS

- Remote CI is not fully green: the Governance Gates tier-focus label needs a maintainer.
- Mutation baseline 13 and schema census 231 are not zero; the dispositions above show which are classification (no defect), which are a bounded dead-code retirement (15 tables), and which need domain-reviewed CREATE (10 tables).
- Not delivered in this continuation: kernel decisions for governance, elections and committee routes (they depend on mandates the institution has not issued), finance reads / remittances / payroll scoped reads, the WorkAid member journeys, and the staff messaging directory / retention-and-hold admin UI / unread counts.
- `union_rep_id` readers (deadline recipient resolver and reminder revalidation, knowledge graph, dashboard KPI, status-transition "unassigned draft" test) remain. Verified this continuation: none grants access; authority decisions use the kernel and the column is a dual-written compatibility mirror. Migrating them needs a system SELECT manifest grant on `ue_authority_resource_relationships` (platform migration, cache RLS closure, lineage, native proof) for no authority gain, so it is a documented deferral, not a closure.

## Residual identity risks (stated, not hidden)

- The inviter check is evaluated per statement; it is not locked across the whole redemption transaction, so an offboarding that commits between two statements of one redemption is not serialised.
- An inviter who is later **reactivated** revives that inviter's still-unexpired pending invitations; nothing revokes invitations on offboarding (the system role has no `invites` UPDATE grant, and adding one changes the hash-locked auth manifest).
- Provider bridges (no parent cookie) remain bounded by user and membership state and the 30-second expiry; they have no parent session to revoke.
- Legacy guard outside V2 and external counsel authentication are unchanged.

## Policy-dependent functionality (not engineering gaps)

Finance mandates, thresholds and duty holders; member OCR policy adoption; document sharing and retention disclosure policy; library link-type upload policy; message retention-policy adoption and legal-hold authority; WorkAid consent wording; ICRA review authority; the Privacy Officer DSAR processing workflow (the id-only status writer was retired rather than left callable).

## External activation gates

Credentialed signed-in browser journeys; OCR processor with real bytes; signature provider and its event receiver; SharePoint; live SAS issuance; WorkAid counsel-side activation and key custody (UE-CONV-G-003); the maintainer `approved-experiment` label.

## Stabilisation found by the final gate runs

- `lib/auth/__tests__/clc-national-role-boundary.test.ts` ran `grep -r` over `app lib actions services`, descending into `services/financial-service/node_modules`: 64 s measured with it, 3 s without; in the full root run it took ~147 s, exceeded the test timeout and failed two of three runs while passing alone. It now excludes `node_modules` and `.next`; assertions and scanned source are unchanged.
- Gate runs: `ec0773035` passed everything locally; `b842d8432` and `5eaee35a5` each failed one root `test:fast` file (the stale `Hellobad` expectation, then the CLC timeout); `f27b7ff8b` is fully green. An earlier gate run was stopped and restarted because source was edited during it.
