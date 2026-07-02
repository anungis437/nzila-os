# UE Hardening Wave — Phase 3 Report

**Phase:** 3 — Classified raw DB guard expansion
**Date:** 2026-06-28
**Status:** ✅ COMPLETE — hard stop before Phase 4
**Win condition met:** Raw DB risk is now **visible, classified, and fail-closed
for high-risk unclassified sensitive routes** — NOT "all raw DB imports removed".

**Scope guard:** Classification-driven guard expansion only. No validator-path
repair, no gate taxonomy, no CI wiring, no live-readiness, no `final:go`, no
runtime separation, no schema changes, no pilot-ownership changes, no broad RLS
cleanup, no "fix all raw DB imports" campaign.

---

## 1. Objective (verbatim)

> Expand the UE raw DB import guard from narrow path-only enforcement into
> classified sensitive-route coverage without failing CI on every raw DB import.

**Primary invariant:** the repo must distinguish *raw DB import* from *unsafe raw
DB import*. Phase 3 did **not** attempt to fix every direct DB import.

---

## 2. Starting state

`tooling/contract-tests/ue-no-raw-db.test.ts` (INV-31) was narrow: it only flagged
`db.execute()` outside `withRLSContext()` and raw `postgres`/`pg` driver imports,
governed by a path allowlist. It was **blind** to the far more common pattern —
importing `db` and calling `db.select/insert/update/delete()` directly — which is
exactly how most sensitive routes (including the Phase 2 pilot routes) touch the
database. There was no way to tell an acceptable admin/system direct read from an
unsafe cross-tenant one.

---

## 3. What changed

**Additive only** — the existing INV-31 block was left untouched (no CI wiring or
behavior change for the narrow guard). A new INV-31b block + a classification
registry were added.

| Artifact | Change |
|----------|--------|
| `tooling/contract-tests/ue-raw-db-classification.json` | **NEW** — classification registry: category definitions (with `failing` flags) + per-file classification for every sensitive-domain route with direct DB usage. |
| `tooling/contract-tests/ue-no-raw-db.test.ts` | **EXTENDED** — added `INV-31b — UE Sensitive-Domain Raw DB Classification` describe block (8 tests) alongside the untouched INV-31 block. |

---

## 4. Domains covered

`pilot`, `admin`, `governance`, `organizations`, `dues`, `grievances`, `pension`,
`cases`, `claims`.

The guard recursively scans every non-test `.ts/.tsx` under
`apps/union-eyes/app/api/<domain>/` and detects direct DB access via:
`db.select|insert|update|delete|execute|transaction(`, `db.query.`, and raw
`postgres`/`pg` driver imports.

**53** sensitive-domain files perform direct DB access today; **all 53 are
classified** (0 unclassified, 0 stale — scan set and registry are exactly aligned).
`pension` and `claims` route trees currently have **no** direct DB usage (service-
layer mediated); they remain in scope so any future raw DB usage is caught.

---

## 5. Classification categories implemented

| Category | Fails CI? | Meaning |
|----------|:--------:|---------|
| `allowed-system-route` | ❌ no | System/infra route, no tenant-scoped data (health, readiness, schema, maintenance). |
| `allowed-admin-route` | ❌ no | Platform/admin-gated management or diagnostic route. |
| `requires-org-scope-wrapper` | ❌ no | Tenant route whose safe pattern is an org-scope / ownership wrapper. Migration-tracked when the wrapper is not yet present. |
| `requires-rls-context` | ❌ no | Tenant route whose safe pattern is `withRLSContext` / `withSystemContext` scoping. Migration-tracked when not yet present. |
| `legacy-deprecated` | ❌ no | Known legacy route slated for sunset; tolerated, do not extend. |
| **`forbidden-direct-db`** | ✅ **yes** | Disallowed direct DB access; must be removed/wrapped. |
| **`unclassified-sensitive`** (implicit) | ✅ **yes** | Sensitive direct DB usage absent from the registry. Fail-closed governance pressure. |

---

## 6. Failing categories (enforced)

Only two categories fail CI:

1. **`forbidden-direct-db`** — explicitly disallowed direct DB access.
2. **`unclassified-sensitive`** — any sensitive-domain file with direct DB access
   that is not present in the registry. Adding raw DB to a sensitive domain now
   *forces* an explicit classification or the contract test fails.

Current count in both failing categories: **0** — the guard is green and
non-noisy today, while remaining fail-closed for anything new or anything an
operator deliberately marks forbidden.

---

## 7. Exceptions report (tolerated direct DB usage)

All 53 classified entries are non-failing. Breakdown:

### allowed-admin-route — 9
- `app/api/admin/ai-usage/route.ts`
- `app/api/admin/database/health/route.ts`
- `app/api/admin/database/optimize/route.ts`
- `app/api/admin/dues/overview/route.ts`
- `app/api/admin/duplicates/route.ts`
- `app/api/admin/members/stats/route.ts`
- `app/api/admin/seed-cupe-pilot/route.ts`
- `app/api/admin/stats/overview/route.ts`
- `app/api/pilot/bootstrap/cupe/route.ts`

### requires-rls-context — 26
- `app/api/cases/[caseId]/export/route.ts`
- `app/api/dues/arrears/[id]/payment/route.ts`
- `app/api/dues/arrears/route.ts`
- `app/api/dues/reconciliation/auto-match/route.ts`
- `app/api/governance/board-packets/[id]/route.ts`
- `app/api/governance/board-packets/route.ts`
- `app/api/governance/council-elections/route.ts`
- `app/api/governance/dashboard/route.ts`
- `app/api/governance/elections/sessions/[id]/route.ts`
- `app/api/governance/elections/sessions/[id]/vote/route.ts`
- `app/api/governance/elections/sessions/route.ts`
- `app/api/governance/events/route.ts`
- `app/api/governance/golden-share/route.ts`
- `app/api/governance/lifecycle/policies/route.ts`
- `app/api/governance/mission-audits/route.ts`
- `app/api/governance/policies/rules/route.ts`
- `app/api/governance/policy-templates/route.ts`
- `app/api/governance/reserved-matters/[id]/class-b-vote/route.ts`
- `app/api/governance/reserved-matters/[id]/route.ts`
- `app/api/governance/reserved-matters/route.ts`
- `app/api/organizations/[id]/analytics/route.ts`
- `app/api/organizations/[id]/members/route.ts`
- `app/api/organizations/[id]/route.ts`
- `app/api/organizations/route.ts`
- `app/api/pilot/feedback/route.ts`
- `app/api/pilot/overview/route.ts`

### requires-org-scope-wrapper — 18
- `app/api/governance/elections/sessions/[id]/results/route.ts` *(migration)*
- `app/api/grievances/[id]/access/route.ts`
- `app/api/grievances/[id]/assign/route.ts`
- `app/api/grievances/[id]/convert/route.ts`
- `app/api/grievances/[id]/documents/route.ts`
- `app/api/grievances/[id]/priority-override/route.ts`
- `app/api/grievances/[id]/status/route.ts`
- `app/api/grievances/import/route.ts`
- `app/api/grievances/route.ts`
- `app/api/organizations/[id]/ancestors/route.ts` *(migration)*
- `app/api/organizations/[id]/children/route.ts` *(migration)*
- `app/api/organizations/[id]/descendants/route.ts` *(migration)*
- `app/api/organizations/hierarchy/route.ts` *(migration)*
- `app/api/organizations/search/route.ts` *(migration)*
- `app/api/pilot/apply/[id]/commercial-transition/route.ts`
- `app/api/pilot/current/route.ts`
- `app/api/pilot/demo-data/route.ts`
- `app/api/pilot/onboarding/route.ts`

### allowed-system-route — 0
### legacy-deprecated — 0
### forbidden-direct-db — 0

---

## 8. Migration queue (deferred — acknowledged gaps, non-failing)

Six routes are classified but flagged `migration: true` — authenticated but their
direct DB reads are **not yet** org-scoped (cross-org directory/aggregate reads).
They are tolerated now and queued for a later DB-hardening wave:

1. `app/api/organizations/[id]/ancestors/route.ts` — org-hierarchy ancestor lookup (`auth()` only).
2. `app/api/organizations/[id]/children/route.ts` — org-hierarchy children lookup (`auth()` only).
3. `app/api/organizations/[id]/descendants/route.ts` — org-hierarchy descendants lookup (`auth()` only).
4. `app/api/organizations/hierarchy/route.ts` — cross-org directory listing (`auth()` only).
5. `app/api/organizations/search/route.ts` — cross-org directory search (`auth()` only).
6. `app/api/governance/elections/sessions/[id]/results/route.ts` — `withApi` officer + `governance_suite` entitlement, but reads by session id without an explicit per-org scope.

These are **read-only** org-directory / governance-aggregate endpoints behind
authentication; they are not silent cross-tenant mutation paths. Hardening them
(org-scoping the queries) is deferred per the no-route-rewrite constraint.

---

## 9. Tests added / updated

`INV-31b` describe block (8 tests), all green:
1. registry self-check — every referenced category is defined.
2. guard is live — sensitive domains actually contain direct DB usage (> 0).
3. **no `unclassified-sensitive`** — every detected sensitive direct-DB file is classified.
4. **no `forbidden-direct-db`** — no current file is forbidden.
5. no stale registry entries (soft warn; never blocks).
6. **PROOF (fail-closed):** a synthetic unclassified sensitive raw DB path → `unclassified-sensitive`, `failing: true`.
7. **PROOF (non-noisy):** sampled classified exceptions (admin / org-scope / RLS) → not unclassified, `failing: false`.
8. **PROOF (forbidden fails):** `forbidden-direct-db.failing === true` and all five tolerated categories `failing === false`.

Verification:
- `vitest run --config tooling/contract-tests/vitest.config.ts ue-no-raw-db` → **13 passed** (5 INV-31 + 8 INV-31b).
- Independent cross-check: detected **53** = registry **53**, unclassified **0**, stale **0**.
- `get_errors` on the test + registry JSON → no errors.
- Full-project `tsc` not run directly (OOM/SIGABRT on this machine); types validated via language server + CI `turbo typecheck`. No CI wiring touched.

---

## 10. Remaining raw DB risks deferred to Phase 4+ / later DB-hardening wave

1. **Org-directory routes are not org-scoped** (the 6 migration-queue items) — read-only cross-org reads behind auth; org-scope the queries in a later wave.
2. **Classification accuracy is signal-assisted, not proven per-route** — categories were assigned from protection signals (RLS / org-wrapper / admin auth) + targeted reads, not an exhaustive per-route audit. A later wave can audit each `requires-*` entry and promote properly-wrapped ones or harden the gaps.
3. **`db.query.` / audited-helper detection is heuristic** — the scan is text-static; a route could route DB access through an indirection the regex misses. Acceptable for a governance-pressure gate; deepen if needed later.
4. **Non-route DB access** outside the nine sensitive `app/api` domains (lib/services/server-actions) is **out of Phase 3 scope** — INV-31 still covers `app/` + `actions/` for the narrow patterns; broader service-layer classification is future work.
5. **Pre-existing items carried from earlier phases** remain deferred: `pilot_applications` lacks a real `organization_id` column; `getCurrentUser().organizationId` `DEFAULT_ORGANIZATION_ID` fallback. Not touched here.

---

## 11. Scope-discipline confirmation

- ✅ No validator-path repair, no gate taxonomy, no CI wiring, no live-readiness, no `final:go`, no runtime separation.
- ✅ No schema changes, no pilot-ownership changes, no broad RLS cleanup.
- ✅ No mass route rewrites — zero route files modified.
- ✅ Guard is classification-driven and non-noisy: fails only on `forbidden-direct-db` + `unclassified-sensitive`; current failing count is 0.
- ✅ Did **not** attempt to remove every raw DB import.

**HARD STOP — do not begin Phase 4 (validator path repair) without explicit
approval.**
