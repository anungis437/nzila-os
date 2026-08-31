# 25 — Union Eyes SaaS Operational Readiness — Rerun (post B → D → C)

**Gate:** `UE_SAAS_OPERATIONAL_READINESS`
**Ruling (this snapshot):** `NO_GO — RUNTIME_PROOF_REQUIRED`
**Audited SHA (`origin/main`):** `0a2c9fa0b` (PR #746 merged)
**Rerun date:** 2026-08-31
**Prior snapshot:** [`24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md`](24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md)
(audited SHA `cebe1d520`, ruling `NO_GO`, 5 findings)
**Remediation history since 24:** Cluster A (#742), Cluster B (#743), Cluster D (#744), Cluster C
(#746) — merged in that dependency order (B and D before C, per instruction, so C's evidence
reconciliation describes final post-remediation behavior rather than becoming stale again).

This is a targeted rerun, not a from-scratch re-derivation. File 24 is left unmodified as the
historical snapshot. This file re-verifies each of file 24's 5 confirmed findings against the
current SHA, re-runs the anti-theatre scanner, and recomputes the runtime-proof queue and final
ruling. Sections not affected by any of the four clusters (§3 persona audit structure, §5 OCRA
verdict, §7 leadership data-boundary read) are reconfirmed by spot-check, not re-authored in
full — no new evidence contradicts them.

---

## 1. Confirmed findings from file 24 — resolution status

| # | File 24 finding | Resolution | Evidence |
|---|---|---|---|
| 1 | `UE-STAFF-MEMBER-DIRECTORY = BLOCKER` — `/dashboard/members` has no `page.tsx`, staff nav 404s | **CLOSED** (Cluster A, #742) | `apps/union-eyes/app/[locale]/dashboard/members/page.tsx` now exists — server wrapper (`requireUser()` + `hasMinRole('steward')`) rendering `<MembersConsole />`. Registered in `PAGE_ACCESS_MATRIX` (`tooling/contract-tests/ue-persona-access.test.ts`). The multi-candidate-org "biggest result wins" fetch heuristic flagged in file 24 §1 was also replaced with a single authoritative `buildMembersFetchUrl()` call. |
| 2 | `/api/deadlines/upcoming` fabricates empty-success on backend failure | **CLOSED** (Cluster B, #743) | `route.ts` now re-exports `crud.GET`/`crud.POST` directly — no fabricated-empty-success wrapper. Anti-theatre R-8 count for this file dropped from file 24's baseline (5 total R-8 findings) to the current 4 (§2 below). `UnionDashboard` (the only in-repo consumer) remains deliberately unwired, per file 24's own instruction not to wire an unfixed route up as-is — it is fixed now, but still `LATENT_UNEXPOSED`, which is an accepted, unchanged state. |
| 3 | `maturity.json`: `analytics_readiness` top-level/gap inconsistency; `access_reviews` stale blocker text | **CLOSED** (Cluster C, #746) | `analytics_readiness` top-level promoted `partial` → `closed`, matching its own already-closed gap. `access_reviews` blocker text corrected to state CI enforcement (`.github/workflows/access-review-gate.yml`) exists and the real remaining gap is substantive Azure Entra-backed account measurement. `contracts_complete`/`data_integrity`/`observability` left untouched, per file 24 §8's own instruction not to infer closure from partial signals — these remain open below (§4). One correction made *during* Cluster C's own CI run, not anticipated by file 24: the inherited edit had also rewritten `generated_from` to a descriptive string, which broke the **separate**, previously-unknown-to-file-24 `Portfolio Governance` CI check (`scripts/generate-portfolio-artifacts.ts --check`), which force-generates that field from `governance/portfolio/product-catalog.json` for every `apps/*/maturity.json`. Reverted to the exact generator-produced value. This means file 24's own claim ("no automated generator exists" for `maturity.json`) was itself inaccurate — a generator does exist and is CI-enforced; corrected here for the record. |
| 4 | `executive-operating-intelligence` nav-advertised to executives but pilot-mode-excluded at runtime (presentation/access mismatch) | **CLOSED** (Cluster D, #744) | `lib/dashboard/role-experience.ts` gained `getVisibleNavigationForExperience(experience, isPilotMode)`, filtering `getNavigationForExperience()` through the existing `canAccessDashboardPath()` policy. `components/sidebar.tsx` and `components/mobile/BottomNav.tsx` now both call this instead of the raw, unfiltered function — the previous sidebar filter was tautological (`nav.filter(entry => new Set(nav.map(e => e.href)).has(entry.href))`, i.e. a no-op). A second, previously-undiscovered instance of the same defect class was found and fixed in the same pass: `admin`'s "Exports" (`/dashboard/movement-insights/export`) was also nav-advertised but pilot-excluded — now also correctly hidden. Both the underlying route access-guard (`canAccessDashboardPath`) and the presented navigation now agree in pilot mode; nothing changed about which routes are access-gated, only whether the nav honestly reflects that gate. |
| 5 | `/dashboard/institutional-memory` not reachable from any audited persona's canonical navigation | **STILL OPEN — deliberately parked, not closed by any cluster** | Confirmed via fresh grep of `role-experience.ts`: no reference to `institutional-memory` in any experience's navigation array. This was recorded in the B → D → C remediation plan as a `RECORDING_CRITICAL_SURFACE_DECISION` for a later, separate pass (whether to wire it into nav, and for which persona) — not attempted here. Remains `LATENT_UNEXPOSED`, same classification as file 24. |

**Result: 4 of 5 file-24 findings closed. The 5th (institutional-memory nav wiring) was explicitly
out of scope for clusters A/B/C/D and remains open by design, not by omission.**

---

## 2. Anti-theatre scan — rerun

`pnpm reality:anti-theatre` against `0a2c9fa0b`:

**0 errors, 1265 warnings, 4862 files scanned** (file 24 baseline: 0 errors, 1266 warnings, 4856
files scanned).

| Rule | File 24 count | This rerun | Delta | Note |
|---|---:|---:|---:|---|
| R-2 (hardcoded readiness) | 1 | 1 | 0 | Unchanged — `app/api/admin/database/health/route.ts:39`, not touched by any cluster, still flagged, still not independently re-verified. |
| R-6 (silent-swallow catches) | 322 | 322 | 0 | Unchanged — pre-existing Wave 1 backlog item, not in scope for this remediation sequence. |
| R-7 (route missing capability-registry entry) | 938 | 938 | 0 | Unchanged — the new `/dashboard/members/page.tsx` is a page, not an API route, so it does not add to this count; no new API routes were added by any of the four clusters. |
| R-8 (empty authoritative payload as 200) | 5 | 4 | **−1** | `/api/deadlines/upcoming` finding closed by Cluster B. The remaining 4 R-8 findings are unrelated to this remediation sequence and were not investigated in this pass. |

Files-scanned delta (+6) reflects new test files added across the four clusters (`sidebar.test.tsx`,
`BottomNav.test.tsx`, `route.test.ts` for deadlines/upcoming, `build-members-fetch-url.test.ts`,
`role-experience.test.ts` additions, `members/page.tsx` itself) — not a scope change to the
scanner.

---

## 3. Canonical route matrix — recomputed

Re-deriving file 24 §2's table against `getNavigationForExperience()` on the current SHA:

**Result: 43 of 43 canonical navigation destinations are `PAGE_EXISTS`.** (File 24: 42 of 43,
with staff `Members` → `/dashboard/members` as the sole `PAGE_MISSING`.) No other destination
changed page-existence state.

The `executive-operating-intelligence` and `movement-insights/export` routes remain
`PAGE_EXISTS_PENDING_RUNTIME_PROOF` (unchanged, per file 24 §2) — Cluster D changed whether
they are *presented* in pilot mode, not their underlying runtime-proof status, which is
unaffected by a navigation-layer fix.

---

## 4. `maturity.json` — current state

| Field | File 24 snapshot | Current (`0a2c9fa0b`) | Status |
|---|---|---|---|
| `generated_from` | `governance/portfolio/product-catalog.json` | `governance/portfolio/product-catalog.json` | Unchanged (confirmed CI-enforced ground truth — see §1 row 3 correction) |
| `analytics_readiness` (top-level) | `partial` (stale vs. its own `closed` gap) | `closed` | **Reconciled** |
| `access_reviews` | `partial`, stale blocker text | `partial`, corrected blocker text | **Reconciled** (status unchanged — genuinely still partial) |
| `contracts_complete` | `false`, `REQUIRES_REVALIDATION` | `false`, unchanged | **Still open** — not independently re-verified, per instruction not to infer closure |
| `data_integrity` | `partial` | `partial`, unchanged | **Still open** |
| `observability` | `partial` | `partial`, unchanged | **Still open** |
| `status` / `exposure` | `pilot` / `internal` | `pilot` / `internal` | Unchanged |
| `last_validated` | `2026-08-27` | `2026-08-31` | Bumped to this reconciliation date |

No field was closed without new evidence. `contracts_complete`, `data_integrity`, and
`observability` remain exactly as open as file 24 found them.

---

## 5. Sean continuity critical path, leadership data-boundary, OCRA — reconfirmed unchanged

- **Sean continuity path (file 24 §6):** step 7 ("deadlines follow successor") upgrades from
  `DEFECT (partial)` to `CODE_PROVEN` for the specific route audited (`/api/deadlines/upcoming`
  no longer fabricates success) — but the path's overall classification remains
  `RUNTIME_PROOF_REQUIRED`, because steps 1, 4, 5, 8, and 9 were never source-code defects to
  begin with; they were always blocked on live-staging proof, which no cluster in this
  remediation sequence attempted to provide. Step 10 (institutional memory) is unchanged (§1
  row 5 above).
- **Leadership data-boundary audit (file 24 §7):** not re-traced in this pass — no cluster
  touched `/dashboard/leadership` or `/dashboard/executive-operating-intelligence`'s data-loading
  functions. File 24's finding (no hierarchy-spanning aggregation found, therefore no
  over-exposure risk, but also no delivered federation rollup) stands unchanged.
- **OCRA terminology (file 24 §5):** not touched by any cluster. `RETAIN` verdict stands
  unchanged.

---

## 6. Runtime-proof queue — recomputed

Every item in file 24 §9 remains exactly as classified. **None of clusters A, B, C, or D
performed or could perform live-staging verification** — they were source-code, backend-logic,
and documentation-truth fixes, not infrastructure-proof work. Restating file 24's queue here
with no changes, since it would be dishonest to imply progress that did not happen:

| Item | Classification |
|---|---|
| Live PostgreSQL RLS tenant-boundary probes | `REQUIRED_BEFORE_SAAS_PASS` |
| Grievance deadline assignment convergence (#722 scope) | `REQUIRED_BEFORE_SAAS_PASS` |
| Concurrent worker/lease recovery | `REQUIRED_BEFORE_SAAS_PASS` |
| Real successor reminder delivery | `REQUIRED_BEFORE_SAAS_PASS` |
| Real auth/session/offboarding against deployed Entra | `REQUIRED_BEFORE_SAAS_PASS` |
| Actual deployed route health for the 43 canonical nav destinations (§3) | `REQUIRED_BEFORE_SAAS_PASS` |
| Production/staging telemetry (OTEL traces → Azure Monitor dashboards) | `REQUIRED_BEFORE_SAAS_PASS` |
| Worker/cron scheduling proof | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| Backup/restore currency | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| Integrations/secrets/configuration | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| Mobile layout | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| EN/FR browser parity | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| Audit/history persistence (live staging, not just contract tests) | `REQUIRED_BEFORE_SAAS_PASS` |
| Document/evidence access revocation | `REQUIRED_BEFORE_SAAS_PASS` |
| Legal/client taxonomy validation | `FUTURE_EXTERNAL_VALIDATION` — unchanged, out of scope |

---

## 7. Ledger ruling

**`UE_SAAS_OPERATIONAL_READINESS = NO_GO — RUNTIME_PROOF_REQUIRED`**

This is a materially different `NO_GO` than file 24's. File 24's gate failed on a confirmed
**source-code blocker** (a 404 on canonical staff navigation) plus four tracked
document/presentation defects. This rerun confirms:

- All four source/document defects from file 24 are closed (§1), except the one item explicitly
  parked by the remediation plan itself (institutional-memory nav wiring — a scope decision,
  not a bug).
- Zero new source-code or document-truth blockers were introduced or discovered in this rerun.
- The gate remains `NO_GO` **solely** because the runtime-proof queue (§6) — which was never a
  source-code problem — has not been executed. Every item there requires deployed
  staging/production infrastructure (live Postgres RLS, concurrent workers, real Entra auth,
  Azure Monitor) that this remediation sequence never had the scope or infrastructure access to
  provide.

Per the audit programme's own stated expectation (see the B → D → C remediation instruction
this file closes out): *"If source blockers are closed and only runtime proofs remain, proceed
directly into a focused Phase 3A Runtime Acceptance workstream rather than returning to
miscellaneous source remediation."* That is the correct next step from here — not further
source-code hunting, and **not** Phase 3B (recording environment), which remains blocked until
this gate reads `PASS`.

## Next steps (not performed in this file)

Phase 3A Runtime Acceptance workstream: execute the `REQUIRED_BEFORE_SAAS_PASS` rows of §6
against real deployed staging infrastructure (Canada Central Container Apps environment,
per repo memory), each with captured evidence artifacts (drill logs, trace exports, RLS probe
transcripts), then re-run this ledger a third time before evaluating the gate again. Phase 3B
(recording environment, LIUNA fixtures, recording identities, recording certification
artifacts) must not begin until that rerun reads `PASS`.
