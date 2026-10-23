# 13 — Integration handoff contract

**To:** Codex (owner of the Union Eyes staging candidate and its release governance).
**From:** WorkAid preparation worktree. Nothing here asks Codex to change timing; nothing here has been applied to any operational file.
**Authority:** analysis and synthetic reproduction only. No push, PR, merge, deployment, staging access, real data or counterpart communication.

## 1. Binding to exact commits and contents

| Item | Value |
|---|---|
| Platform source inspected (all source references below) | `anungis437/nzila-os` `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` = `origin/main` (re-verified at the start and end of the slice) |
| Preparation branch | `agents/workaid-prep-20261023`, local only, in worktree `C:/APPS/nzila-os.worktrees/pasted-text-processing` |
| Content commit(s) | Recorded in `docs/union-eyes/workaid/evidence/COMMIT_BINDING.md` (written in the commit that follows the content commit, because a file cannot contain the id of its own commit) and in the status report |
| Content hashes | `docs/union-eyes/workaid/evidence/harness-manifest.json` — SHA-256 of every file this branch adds |
| Test evidence | `docs/union-eyes/workaid/evidence/test-results.json` (command, Node version, base commit, every case with its status) |
| Source citations | Every platform reference is a path plus line at the pinned SHA. The tests read the **pinned blobs** (`git show 38a824918:<path>`), so they remain valid after Codex's branch moves |

If `origin/main` or the staging branch advances, re-run `node scripts/platform-tripwire.ts --root <checkout>` (informational; it reports `PRESENT/ABSENT/FILE_MISSING` per cited pattern and never fails).

**Isolation proof.** `test/isolation.test.ts` asserts every changed or added path relative to the base is under `docs/union-eyes/workaid/` or `tooling/workaid-prep/`; no manifest, lockfile, workspace file, migration, workflow, app or package is touched. Since Slice C, `scripts/guard.ts` additionally refuses any write outside those prefixes or OS temp and any write into another registered worktree (`test/write-isolation.test.ts`), and the repository's document validator runs only in a temp sandbox. Other worktrees were not modified: Codex-pattern worktrees under `C:/Users/AubertNungisa/.codex/worktrees/` (`multer-987-qualification` `9d49b7982`, `ue-catalog-admission` `1d52b79d5`, `ue-navigation-acceptance` `38a824918`); `C:/APPS/nzila-os-navigation` was observed advancing between my reads (`6319d92c8` → `9f1ad0668`) and was not touched.

## 2. Platform defects routed to Codex (not patched here)

Each row: pinned reference → synthetic reproduction in this branch → proposed test change → what Codex decides. "Repro" tests pass when the reproduction demonstrates the defect or the reference contract satisfies the proposed assertion; **a passing repro means the finding is reproducible, not fixed.**

| # | Findings | Pinned source (at `38a824918`) | Synthetic reproduction (`tooling/workaid-prep/test/platform-repro.test.ts`) | Proposed test change |
|---|---|---|---|---|
| 1 Server-action detector | WA-R3-001, WA-R3-019; WA-T081, WA-T094 | `tooling/contract-tests/server-action-org-scoping.test.ts:72` `if (!content.includes("'use server'")) continue`. 7 of the 10 `apps/union-eyes/actions/*-actions.ts` files use `"use server"`. Exception ledger `governance/exceptions/org-required-server-actions.json` (entries expire; member-segments **2026-11-17**) | `[WA-T081]` ×4 incl. measured counts at the pinned SHA; `[WA-T094]` | Replace the substring test with `detectUseServerDirective` semantics (both quotes, prologue and inline, ignore comments/strings); add a deliberately failing fixture: a `"use server"` file without `resolveOrgContext` and not in the ledger must fail; add an assertion that expired ledger entries fail. Reference: `src/platform-repro/server-action-detector.ts` |
| 2 Signed document URLs | WA-R3-006, WA-INT-002, WA-INT-003; WA-T082 | `lib/services/document-storage-service.ts:237` `expiresIn: 365*24*60*60`; `:196-197` Azure comment says SAS but returns `${blobServiceClient.url}${this.bucket}/${key}`; `:221` put precedes `:236` sign inside one rethrowing `try` | `[WA-T082]` ×3; `[WA-INT-002]`; `[WA-INT-003]` ×2 | (a) Unit: signing is called with TTL ≤ 3600 s and never > SigV4 7-day max; (b) run the real SDK presigner against a local mock to decide whether a one-year TTL throws (finding §4.1 of [10](10_GROK_FINDINGS_RECONCILIATION.md)); (c) failure injection: signer throws after put → object removed or orphan recorded; (d) Azure: returned URL has `sig`/`se` or is not returned at all, and a private-container anonymous GET is denied; (e) a new mint after grant revoke is denied. Reference: `storage-policy.ts` |
| 3 Metadata and key leakage | WA-R3-012, WA-INT-001; WA-T097 (also WA-R3-010/022, WA-T091) | `document-storage-service.ts:169` key contains `doc.documentName`; `:183`/`:216` metadata `documentName`; `:249-253` error log contains `documentName` | `[WA-INT-001][WA-T097]` canary across key, metadata, log context | Canary test: upload with a synthetic clinical-name document; assert the canary is absent from object key, object metadata, URLs and every logger call argument; metadata keys limited to an allow-list; sanitize or drop user text in keys. Notification: assert free-form `title`/`message` cannot carry a document title for restricted classes |
| 4 Search authorization | WA-R3-005, WA-R3-013; WA-T090 | `app/api/search/universal/route.ts:134-137` `ilike(documents.title/filename/name/documentType, …)` **before** `:184` `isDocumentVisibleByPolicy`; `:190` `hasCaseAccess: isStewardPlus \|\| canViewCase \|\| !row.linkedEntityId` | `[WA-T090]` ×3 (reference ordering never evaluates restricted titles; legacy ordering scores them) | Two-role fixture (authorized / unauthorized) with a canary title: unauthorized caller gets no hit, no count, no autocomplete; restricted/unlinked sensitive classes deny by default; compare response timing/shape of hit vs no-hit for the unauthorized caller |
| 5 Revocation | WA-R3-008, WA-R3-015, WA-R4-09; WA-T084, WA-T100 | `lib/services/representation-authority-service.ts:120` `revokeRepresentationAuthority` → `:127` `.update(representationAuthorities)` then audit; no reference to `externalMatterAccessGrants`/`externalDocumentAccessGrants`/session revocation | `[WA-T084]` source gap; reference cascade in `test/publication-revocation.test.ts` (`revokeAuthorization`) | Integration (clone DB): revoke authority → matter and document grants `revoked` in the **same transaction** as the audit write; subsequent external read denied; reminder/notification deep links denied; revocation epoch/cache invalidated. Distinguish DOA revocation (no technical grant cascade) |
| 6 Session handling | WA-R3-015, WA-R3-018 | `lib/auth/session.ts:9-10` re-exports `revokeSession`, `revokeAllUserSessions`; `lib/services/member-access-revocation-service.ts:97-98` already revokes **all** sessions of the real auth user id (the nearest existing pattern) | Reference output `sessionInvalidations` = `[{userId, matterId}]` (scoped) | Decide the scope: `revokeAllUserSessions` is user-wide (all organizations); a specialist serving several unions would lose unrelated sessions. Prefer re-checking the grant on every request plus an epoch/denylist scoped to (user, matter); add a test that revoking Union A access leaves the same user's Union B session valid. Identity-provider behaviour is `BLOCKED_EXTERNAL_EVIDENCE` |
| 7 Evaluator observations | (not in Grok findings) | `representation-authority-service.ts:51` `representativeOrganizationId?` optional → check skipped when omitted; `scope` column not read by `evaluateRepresentationAuthority` or the external evaluators; `app/api/external/**` hard-reject `matterType !== 'grievance'` (e.g. `documents/[id]/route.ts:22`) | none (observations) | Confirm across all call sites whether the specialist-organization check can be skipped by a caller; if WSIB matter access is ever enabled, extend routes deliberately (it is `NOT_IMPLEMENTED` today) |
| 8 Release gate | WA-R3-017, WA-R3-025; WA-T087 | `docs/union-eyes/reality-remediation/25_…`, `30_…` | none | Single gate record `PLATFORM-GATE`. Nothing in this branch overrides or reinterprets it |
| 9 Member-portal surfaces (Slice C, read-only inspection) | WA-C-003; see [16](16_MEMBER_PORTAL_REUSE_ASSESSMENT.md) | `app/api/members/merge` returns 200 for an unimplemented capability (stub POST `{status:'accepted'}`); `members/[id]/documents` is a generic CRUD route over `documents` whose `[id]` is the document id and which sets no owner column; `app/[locale]/dashboard/member/timeline/[caseId]/page.tsx` fetches `/api/cases/${caseId}/timeline` without credentials and expects `data.timeline` while the route returns `{data: [...]}` behind a `grievance_case_suite` entitlement and exposes `actor`; `portal/dues/balance` takes the organization id from the client | None run (running the application is out of scope). Static reading only | Confirm the merge stub returns 501; confirm whether the timeline page renders for a member and whether any link to it is advertised; decide the subject-member binding for member-visible documents before any WorkAid reuse |

## 3. Reusable Union Eyes capabilities confirmed (source-level only)

Three-layer grants with expiry/revocation columns; evaluators denying on wrong user/organization/specialist-organization/matter; deadline-engine *transport* patterns (mirrored as a contract, **not imported**); demo persona vocabulary. See [01](01_WORKAID_REALITY_BASELINE.md).

## 4. Which operational components would eventually change

### 4.1 Can stay isolated until adoption (no dependency on the staging candidate)

All of `tooling/workaid-prep/src/*` domain contracts and their tests; fixtures; the findings/requirements/matrix generators; professional-decision work; persona journeys; Clio coexistence design. They import nothing from the application.

### 4.2 Requires the staging candidate to be finalized first (touches shared or operational surface)

| Component (path at `38a824918`) | Change | Why it must wait |
|---|---|---|
| `apps/union-eyes/db/schema/*`, `migrations/`, migration journal | New tables: referral, claim, decision, issue, objection, submission (11 states, recipient, attempt, receipt), **filing record (determinations and authority responses, append-only), requirement-source registry, tribunal assessment**, task, reminder, publication (with French text and union-visibility), deadline obligation, dependency, acceptance; RLS policies; typed authorization instrument; grant `sourceAuthorizationId` | The migration journal and canonical bootstrap are under Codex's qualification (`UE_V2_CANONICAL_FRESH_BOOTSTRAP` is `UNQUALIFIED` per the demo doc). No migration may be proposed against an unqualified journal |
| `representation-authority-schema.ts` | Matter type for WSIB (the existing `wcb_claim` label is generic), acceptance record | Schema/enum migration |
| `representation-authority-service.ts`, `external-resource-authorization-service.ts`, `app/api/external/**` | Cascade revocation (row 5); remove the hard-coded `'grievance'` matter-type rejection for the new matter type; new routes for referrals and publication | Security-sensitive; routes are release-critical |
| `lib/services/document-storage-service.ts`, `app/api/search/universal/route.ts`, notification schemas | Rows 2–4 | Shared services; already defects independent of WorkAid |
| `lib/deadline-engine/**` | **No change.** WorkAid obligations and receipt tasks get their own tables/worker; the grievance resolver stays grievance-only | Reuse is forbidden by design (WA-R3-023) |
| `app/api/cases/intake/route.ts` | **No change.** A new specialist-referral route is added instead | CUPE vocabulary and grievance entitlement |
| `lib/reality/capability-registry.ts`, `tooling/contract-tests/*`, `governance/exceptions/*` | New capability entries (`NOT_IMPLEMENTED` until proven), new architectural invariants (detector, tripwires) | Shared governance files |
| Navigation / member portal | New member view over `memberStatusView` | Must not advertise any route that is not implemented (UE rule) |

### 4.3 Needs an external decision before any code

D-01…D-24 in [11](11_WORKAID_VALIDATION_DECISIONS.md); privacy/legal review for D-03, D-10, D-18, D-20, D-21.

## 5. Portability of the tests

The suite uses `node:test` and imports with `.ts` extensions, so it runs with no installation. Porting to the monorepo's Vitest is a mechanical import swap (`describe`/`it`/`expect`); nothing depends on Node-only behaviour except the pinned-blob reads (`git show`) and `import.meta.dirname`.

## 6. What Codex does not need to do

Nothing in this document requires a change to the staging candidate, its timing or its qualification plan. If a routed item is accepted, the reproduction and proposed test are inputs; Codex owns whether, when and how to implement.
