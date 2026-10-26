# UE Final Convergence — Checkpoint 7 (Continuation 7)

Status: progress, not completion. Staging and production remain NO-GO. Verdicts below are independent.

## Document integration checkpoint (certified, unchanged)

- `UE_CURSOR_DOCUMENT_INTEGRATION = PASS` (engineering only), code `756abaea1`, records `7cc7bf980`. Recovery tags `ue-pre-cursor-t2t3-checkpoint` (`f9d879016`) and `ue-post-cursor-t2t3-integration` (`756abaea1`) are intact.
- All 16 source→integration mappings were re-verified by script (source present, integrated commit an ancestor of HEAD, subject and author equal). The only path differences from Cursor's source are the four regenerated inventory outputs and Cursor's OCR route, which was intentionally replaced by the kernel-governed route.
- `origin` branch tip `029ff2e45` is an ancestor of HEAD; nothing was lost in cherry-pick retries, resets or inventory regeneration.
- The security assertions of the removed OCR route tests are preserved in `lib/documents/ocr-authority.test.ts` (a privileged / highly-sensitive denial test was added).
- The two "environmental" contract tests (`union-eyes-p4-authority-rollout`, `union-eyes-automation-rules-ownership`) run on Windows with Git bash first on `PATH` and a `python3.exe` shim; they pass. They are **not** converted into skips or silent passes: the contract project was run in full this way (302/302).

## Measured P0 debt reduction

| Measure | Before | After | Evidence |
| --- | --- | --- | --- |
| Unscoped-mutation baseline (`ue-mutation-scope-baseline.json`) | 276 | **26** | `lib/__tests__/mutation-scope-ratchet.test.ts`; 93 `lib/services` and 34 `app/api` sites closed with PGlite proofs |
| Canonical schema census (fresh native PG16) | 351 | **235** | 116 dead Drizzle declarations retired with migration/dependency evidence; none suppressed (the remaining 235 are exactly the unretired set) |
| Route coverage manifest | — | 988 routes, 713 mutating, 57 kernel-decided | regenerated; kernel and subordinate scanners extended |
| Financial duties | unreachable | arrears payment is the *execute* duty on a registered payment (`lib/authority/store/finance-route-adapter.ts`, `POST /api/payments/[id]/duties`) | 18 PGlite + 21 native tests, fails closed until mandates are issued |
| Messaging journeys | partial | lifecycle (close/archive, legal hold), read markers, policy-parameterised retention, staff workspace | platform 0025 / cache 0024; 22 native tests |
| WorkAid union side | none | consent wording, consent, referral, per-document authorisation, shares, revocation cascade | platform 0027 / cache 0026; 5 native tests |
| Identity revocation | gaps | issuance approvals, member-counsel, MFA, bind-error token leak fixed; membership reconciliation and subordinate-authority register added | PGlite revocation suites |

Residual 26 mutation sites: 7 latent financial-service, 2 platform-global workbook sites, 2 pilot compare-and-set sites the scanner cannot see, 15 user-scoped location/geofence/privacy rows.

## Document adversarial review (bounded)

- **Fixed (genuine defect):** `intakes/[id]/cancel` triggered a system-wide reap. `finalizeIntakeObjects` now takes `only:{organizationId,intakeId}`; the cancel route uses it (new PGlite test; 40/40 intake tests).
- **Migration ordering 0022/0023:** the bootstrap applies cleanly on fresh PG15 and PG16.
- **Signature provider:** the repository has no inbound provider webhook receiver (status is polled through `getDocumentStatus`), so no unsigned provider event can be accepted. A receiver, if added later, must carry verified provenance, replay protection and provider event time. This is an external prerequisite (provider credentials), not an engineering gap in the current code.
- **Residual (pre-existing, P1) — closed after the main checkpoint (commit following `46e0b6c3a`):** `POST /api/documents/repository` with a non-case `linkedEntityType` (for example `member`, `other`, a library type) skipped the kernel case check even when the id named a case of the organization. The route now resolves such an id against the organization's grievances and applies the same kernel decision (`getEffectiveCaseAccess`); a non-case id files as before. Library-type uploads (`policy_library`, `template_library`, `collective_agreement`) are still open to any member role: restricting them is an institutional policy decision and is listed below as policy-dependent.
- No required document control was disabled without a canonical replacement.

Also found and fixed while qualifying: migration 0025's lifecycle guard allowed a second `close` or `archive` record for the same thread (caught by the native runtime-role test; guard now refuses it).

## Exact SHAs tested

Integration HEAD for the evidence below: `61812e606601235c8ec3fbae7335e755a446078b` (on top of `a7c5d7532`, the main checkpoint commit).

| Suite | SHA | Result |
| --- | --- | --- |
| `apps/union-eyes` suite (`npx vitest run`) | `a7c5d7532` | 1468 files passed, 3 skipped; 20,657 tests passed, 26 skipped, 0 failed |
| Root `pnpm test:fast` | `61812e606` | 2435 files passed, 30 skipped, 0 failed (an earlier run at `a7c5d7532` failed 3 files; see below) |
| Contract tests (`--project contract-tests`) | `61812e606` | 302/302 (Git bash + `python3` shim) |
| TypeScript (`apps/union-eyes`, `tsc --noEmit`) | `61812e606` | exit 0 |
| `pnpm lint` | `61812e606` | exit 0 (0 errors; 3,055 pre-existing warnings) |
| `pnpm validate:docs`, `pnpm governance:audit`, `inventory:check`, `check-ue-convergence`, migration-lineage (9/9) | `61812e606` (inventory regenerated; docs and governance run on the pre-commit tree of the same change set) | pass |
| Native PostgreSQL 16.15, fresh databases, runtime role: combined 10/10, thread-assignment 3/3, atomic-audit 6/6, census 4/4, documents 10/10, finance-duties 21/21, message-lifecycle 22 passed + 1 skipped, WorkAid 5/5 | `61812e606` | pass |
| Native PostgreSQL 15.19, same eight suites | `61812e606` | pass |
| Browser acceptance (member, representative, staff) | — | **not run** with credentials. The synthetic Playwright E2E (4 shards) passes in CI at `4ce566044`; it is not credentialed acceptance (see the CI findings section). |

What the root run found: the earlier `a7c5d7532` root run failed 3 `union-eyes-heavy` files (13 tests) because six SYSTEM-mutation caller digests in the V2 source plan were stale (pilot commercial-transition, transaction-fee-engine, organizations, admin cache, admin database optimize, admin users). The mutation-bearing statements were checked and are unchanged apart from added organization predicates and a same-transaction audit insert; the 53-relation census is unaffected. Only those digests were re-pinned (precedent `f1ec341ff`); the full V2 source plan was **not** regenerated (it needs the hash-locked wheelhouse run). The contract project also found four drifts (identity-provider residual register moved under `packages/platform-auth`, staff page added to `PAGE_ACCESS_MATRIX`, FSM source anchor, finance DESCRIPTIVE set), all fixed in `61812e606`.

Native runs prove real roles and grants (runtime role cannot delete, truncate or `SELECT … FOR UPDATE` append-only tables). They are **not** staging isolation and **not** credentialed acceptance. A native run needs a *fresh* database for each suite: authority records are append-only, so a reused database produces duplicate-key failures that are artefacts of the run, not defects.

The vitest worker-start timeout (`documents-console.journey.test.tsx`) did not recur in the full suite at `a7c5d7532` or in the root run at `61812e606`; it remains a machine-load artefact, not a closed defect.

## Remote CI findings (first PR #996 run, after the pushes above)

The first remote run exposed defects that local runs on Windows could not. Each was reproduced locally and fixed at the cause; none was suppressed.

| Finding | Cause | Fix |
| --- | --- | --- |
| **`apps/union-eyes/app/api/documents/repository/downloads/route.ts` was never committed** | `.gitignore` carried the Python-packaging pattern `downloads/`, which silently excluded the bulk-download route (Cursor finding B3: per-document authorization, partial-success reporting). The file existed only in the local working tree, so every local suite passed while the route was absent from every commit and from CI. `git log --all` shows no commit ever contained it. | `.gitignore` now exempts Next.js API route folders; the route is tracked (`82c2ac3ac`). A scan of ignored-but-present files under `apps`, `packages`, `tooling` and `docs/union-eyes` found no other file. |
| E2E bootstrap failed (`platform 0014 fail-closed: public.message_threads does not exist`) | The synthetic CI database ran only the Drizzle bootstrap; platform SQL from 0013 onward extends Django-owned tables. | Django migrates first in the E2E workflow (as in production and in the native proofs). Verified locally on a fresh PostgreSQL 15 database (Django migrate, Drizzle bootstrap, `seed:test-env`); the CI run is the remaining proof. |
| Agent-coordination contract failed in CI | It proves commit ancestry; the contract jobs used a shallow checkout. | Both contract jobs check out with `fetch-depth: 0`. |
| Canonical-schema verify, script-alias guard, ops snapshot age, GA in-memory-Map gate, auth-authority README declaration, red-team org-scope heuristic | Stale manifest (`organization_id` on two clause-library tables that the runtime does not have), a thin wrapper alias, a 9-day-old evidence snapshot, three static or one-shot `Map` declarations, a superseded README sentence, five retired 501 routes the heuristic could not recognise. | Manifest republished from the runtime-schema oracle, alias inlined, snapshot regenerated, `ga-check:exempt` with reasons, validator updated to the Entra declaration, helper recognised (`0ab02de16`, `82c2ac3ac`). |

Still failing remotely and **not** changed by this branch: `Dependency Audit`, `pnpm audit`, `Trivy` and the `CodeQL` gate (the five "new" alerts are Trivy-reported dependency advisories — zod, @azure/msal-node, multer — attributed to the lockfile; `Dependency Audit` already failed on `main` at `0c994b968`), their dependent `Governance Gate`, `Governance Gates` (`validate-tier-focus`: the Tier 2 app `flow` is touched by three test-stability edits and the gate needs the human `owner-approved` label), and `Security Design Review Required`, which needs a human `security-design-reviewed` label from @nzila/security. None was waived, labelled or bypassed.

### Result at `4ce566044` (the third remote run)

Passing: Contract Tests, Pilot Contract Tests, Unit Tests (both), Unit coverage (shared, union-eyes), Red-Team Adversarial, Schema Drift Detection, Governance Integrity, Ops Documentation Pack, Workspace Typecheck and Lint, and all four `UE PR E2E worker` shards.

The E2E workers are signed-in Playwright journeys against a **synthetic, credential-free** database built the production way (Django migrate, then the Drizzle bootstrap). Making them pass needed real changes, not exclusions: the QA seed now gives the QA steward the QA cases through the relationship store (`scripts/seed-test-env-kernel.ts`), and four specs that encoded the retired role-seniority model now act as the assigned steward and assert that an admin without a mandate is refused (403/404). That is useful regression evidence for the member and staff landing, but it is **not** `CREDENTIALED_END_TO_END_ACCEPTANCE`: no real identity, representative persona on a non-production candidate, OCR processor, signature provider or SharePoint was involved.

The document integration verdict stays `PASS` (engineering only), but its evidence was weaker than recorded until the `.gitignore` fix: the bulk-download route and its tests had run only from an untracked working-tree file. They are now tracked and ran in the remote suites above.

## Readiness verdicts (independent)

| Verdict | State |
| --- | --- |
| `UE_CURSOR_DOCUMENT_INTEGRATION` | PASS (engineering only) |
| `ENGINEERING_CONVERGENCE` | NOT ACHIEVED |
| `PERSONA_FOUNDATION_READINESS` | PARTIAL |
| `CREDENTIALED_END_TO_END_ACCEPTANCE` | NOT STARTED |
| `INSTITUTIONAL_POLICY_ADOPTION` | NOT ADOPTED |
| `STAGING_QUALIFICATION` | NOT STARTED |
| `PRODUCTION_RELEASE` | NO-GO |

## Policy-dependent functionality (not engineering gaps)

- Finance mandates, thresholds and duty holders; reclassifying "post to arrears" as a duty.
- Member OCR policy adoption; document sharing and retention disclosure policy; who may upload into the institutional library link types.
- Message retention-policy adoption and legal-hold authority (the UI honestly shows `policy_not_adopted`; no default period, no deletion job).
- WorkAid consent wording (capture is refused until an institution records approved wording; the test wording is a labelled fixture).

## External activation gates

Credentialed signed-in browser journeys; OCR processor with real bytes; signature provider and its event receiver; SharePoint; live SAS issuance; WorkAid counsel-side activation and key custody (UE-CONV-G-003).

## Engineering-incomplete (still open)

- **Finance:** remittances, payroll runs and finance reads stay role-gated (no payment subject to attach a duty to).
- **Messaging:** no staff directory (assignee typed as id); no admin UI for retention adoption and holds; no unread counts or escalation. The staff conversation page is deliberately not a primary navigation entry (the representative navigation is frozen at seven destinations); it is reached contextually from Today (`components/inbox/inbox-console.tsx`). The campaign detail page used to call a message-thread path and a nonexistent `/send`; it now uses `/api/communications/campaigns/:id` and states that campaign delivery is not available (no delivery capability exists; `lib/__tests__/campaign-page-contract.test.ts`).
- **Identity:** invite tokens after inviter removal. Two routes were assessed and neither is a safe local change: (a) adding the inviter's live admin membership to `inviteLive` needs a definer predicate because the redemption role cannot read `organization_users`, which changes the hash-locked auth storage authority and its plan digests (needs the wheelhouse regeneration and the native auth suite); (b) revoking an offboarded inviter's pending invites from `revokeMemberAccess` needs either an `invites` UPDATE grant for the system role (same hash-locked manifest) or an organization-admin context that a platform-admin offboarder does not hold. Nothing in the code revokes an invite at all today. Also open: the legacy guard outside V2, external counsel auth, and the session bridge outliving a revoked parent by up to 30 s. *Closed after the main checkpoint:* triage designations in the case path and the designation notification recipients now require the holder's live eligible staff membership (PGlite both lineages; native PG15 and PG16 for the legacy lineage; the V2 predicate against a designation is not proved natively).
- **`union_rep_id`:** the remaining readers (deadline recipient resolver and reminder revalidation, knowledge graph, dashboard KPI) only choose who is notified or labelled; none grants access, and the column is written as a kernel-synchronised compatibility mirror. Migrating them needs a system SELECT manifest grant on `ue_authority_resource_relationships` (a platform migration, cache RLS closure, lineage entry and native proof) for little authority gain, so it is deferred rather than forced. The historical-assignment migration itself is in place: `lib/authority/store/case-ownership.ts` plans and executes the governed backfill (approval hash, stale-approval refusal, audit), and `scripts/reconcile-case-ownership.ts` is the new read-only operator report (`CASE_OWNERSHIP_RECONCILE_DATABASE_URL`, exit 0/1/2). Verified on native PostgreSQL 15 against a case with an unmatched legacy owner: reported `not_active_member`, exit 1, nothing written. An ambiguous legacy value is never converted into authority.
- **Audit coverage:** the route-manifest audit-gap baseline is now 0 (it was 271 before checkpoint 6). The last route, `icra/report/[assessmentId]/review`, audits claimed-assessment decisions atomically; the authority question (shared cron secret, self-asserted reviewer role) stays open and is not an engineering decision.
- Schema census 235 remaining; mutation residuals 26 (user-owned location and privacy rows, uncalled service code, latent financial-service sites); governance and voting routes are not kernel-decided; WorkAid has no counsel-side UI and no native counsel-read proof.
