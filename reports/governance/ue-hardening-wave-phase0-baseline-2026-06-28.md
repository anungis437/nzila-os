# UE Hardening & Gate Convergence Wave — Phase 0 Baseline

- **Date:** 2026-06-28
- **Wave:** Union Eyes Hardening & Gate Convergence (security/governance convergence — NOT product development)
- **Phase:** 0 (baseline capture only — no fixes applied)
- **Status:** Baseline recorded. **HARD STOP for review before any code changes.**
- **Raw logs:** `reports/governance/baseline-2026-06-28/`

This report is the before/after proof set for the wave. Per the maintainer guardrails, **nothing was fixed** in Phase 0. Execution of Phase 1+ does not begin until this baseline is reviewed and approved.

---

## 1. Required repo gates (blocking-authoritative)

| Gate | Command | Exit | Result | Notes |
|------|---------|------|--------|-------|
| Doc consistency | `pnpm validate:docs` | 0 | ✅ PASS | 0 critical errors (1212 warnings / 1370 info, non-blocking). |
| Governance audit (composite) | `pnpm governance:audit` | 0 | ✅ PASS | Includes raw DB-import guard + contract tests + release/secrets/ownership audits. |
| — raw DB-import guard | `governance:check-db-imports` (within composite) | 0 | ✅ PASS | `check-ue-db-import-guard — clean (0 violations)`. |
| — contract tests | (within composite) | 0 | ✅ PASS | 28 files / 541 tests passing. |
| — financial-service health | (within composite) | 0 | ✅ PASS | `[financial-service:health] PASS`. |

**Conclusion:** All governance-authoritative blocking gates are **green** at baseline. The current narrow DB-import guard reports 0 violations because it only scans a small allowlisted path set — see §3 risk note. Heavy whole-repo `lint` / `typecheck` / unit suites remain CI-authoritative and were not re-run locally for this baseline.

---

## 2. Advisory validators (all currently failing)

| Validator | Command | Exit | Failure class | Root cause |
|-----------|---------|------|---------------|------------|
| UE infrastructure | `pnpm validate:ue-infrastructure` | 1 | **Path drift** | Expects `docs/union-eyes/institutional-operating-infrastructure/…`; corpus lives at `docs/categories/products-and-market/union-eyes/institutional-operating-infrastructure/`. |
| Runtime authority | `pnpm validate:runtime-authority` | 1 | **Path drift** | Expects `docs/union-eyes/runtime-authority-audit/…`; corpus lives at `docs/categories/products-and-market/union-eyes/runtime-authority-audit/`. |
| Navigation monetization | `pnpm validate:navigation-monetization` | 1 | **Path drift** | Expects `docs/union-eyes/navigation-monetization-matrix/…`; corpus lives at `docs/categories/products-and-market/union-eyes/navigation-monetization-matrix/`. |
| Runtime convergence | `pnpm validate:runtime-convergence` | 1 | **Path drift (transitive)** | Depends on nav-monetization + infrastructure anchors above; **registry-classified deprecated**. |
| Live readiness | `pnpm validate:live-readiness` | 1 | **Real / evidence-absent** | Expects `docs/nzila-live-audit/` (11 docs). Only an archived copy exists under `docs/categories/historical-archive/archive/iterations/nzila-live-audit`. Live-audit evidence not present in canonical location. |
| final:go | `pnpm final:go` | 1 | **Real / evidence-absent** | 24 failures / 3 passing. Certification artifacts (master finalization index, env certifications dev/staging/demo/pilot/prod, finalization evidence dir, rehearsal log, legitimacy audit) genuinely absent. Correctly stays advisory. |

### Drift vs real-risk split

- **Path drift (4):** UE infrastructure, runtime authority, navigation monetization, runtime convergence. The doctrine corpus **exists** — validators look in the pre-migration `docs/union-eyes/...` location. These are Phase 4 (validator path repair) targets, not security risks.
- **Real / evidence-absent (2):** live-readiness and final:go. These are not path bugs — the required certification/audit artifacts do not exist in canonical form. `final:go` is the production-blocking target and remains advisory with `target_classification: production-blocking`.

**Important:** No advisory failure here reflects a broken Union Eyes runtime. The failures are governance-proof location drift (4) and not-yet-produced production-certification evidence (2).

---

## 3. Risk note carried into Phase 1+

The blocking DB-import guard passing (0 violations) **does not** prove "no raw DB risk across UE." It scans a narrow allowlist (cases/claims/queries/workflow-engine). A prior static scan found ~261 UE API files importing raw `@/db`. Phase 3 will replace narrow path-only enforcement with **classified** coverage (fail only forbidden/unclassified sensitive routes; document allowed exceptions; queue the rest) — without failing CI on every raw import.

---

## 4. Files Phase 1 (withRLSContext contract) will touch

Phase 1 is scoped to the RLS org-boundary contract only:

- `apps/union-eyes/lib/db/with-rls-context.ts` — resolve the context-map overload to a binary contract (preferred: enforce supplied `organizationId`).
- `tooling/contract-tests/ue-rls-org-context.test.ts` — add tests proving supplied org is applied, cross-org is denied, missing/invalid fails closed, legacy current-user/org-metadata path still works; remove weak return-value-only assertions.

(Phase 2 will touch `apps/union-eyes/app/api/pilot/apply/[id]/**` and `security/redteam/ue-org-scope-fuzz.test.ts`; Phase 4 will touch the advisory validator scripts and/or doc paths; Phase 5 will touch `governance/gates/gate-authority-registry.json`, `docs/governance/gates/gate-taxonomy.md`, and `.github/workflows/nzila-governance.yml`. These are out of scope until Phase 1 review passes.)

---

## 5. Baseline verdict

- **Blocking gates:** GREEN (governance audit, doc consistency, DB-import guard, contract tests, financial-service health).
- **Advisory gates:** 6/6 failing — 4 path drift, 2 evidence-absent (incl. final:go, correctly advisory).
- **Union Eyes posture:** unchanged — controlled-pilot safe. No production-readiness claim is made.
- **Next action:** **HARD STOP.** Await review/approval before Phase 1 (withRLSContext contract) begins.
