# UE Hardening & Gate Convergence Wave — Phase 5: Gate Taxonomy & CI Authority

**Date:** 2026-06-28
**Phase:** 5 of the wave (Phases 0–4 complete and approved)
**Scope (verbatim):** *"Proceed to Phase 5 only: gate taxonomy and CI authority. Do not touch product code, RLS, pilot ownership, raw DB classification, validator path repair, live-readiness evidence, final:go certification artifacts, runtime separation, schema design, or broad documentation content. Objective: Make gate authority explicit so 'green' means the right thing at the right stage."*
**Outcome:** ✅ Complete — **HARD STOP** for human review before Phase 6.

---

## 1. Objective and invariant

**Primary invariant (verbatim):** The repo must distinguish: blocking gates;
advisory gates; deprecated/legacy gates; production-certification gates not yet
achieved.

**Review constraint (verbatim):** *"The risk is over-promoting. Acceptable: Make
gate authority explicit and honest. Not acceptable: Declare the repaired
validators production-blocking before they have stable green evidence. The right
Phase 5 outcome is not 'everything is green.' It is: The repo now knows which
green matters, which red is advisory, and which red blocks production
certification later."*

This was honored. **No validator was promoted.** Authority was made explicit and
honest.

---

## 2. What changed

### 2.1 Registry rewritten v1 → v2 (single source of truth)

[`governance/gates/gate-authority-registry.json`](../../governance/gates/gate-authority-registry.json)

- `$schema` bumped to `gate-authority-registry/v2`, with `version`, `asOfDate`,
  and `supersedes` provenance fields. (Safe extension — a grep confirmed **no
  programmatic consumer** of the v1 schema existed; only markdown references. A
  contract test now locks the v2 shape.)
- Added a `taxonomy.categories` map of **7 categories**, each with explicit
  `enforcement` + `stage` + `description`.
- Added `taxonomy.enforcementSemantics` (blocking / report-only / excluded) and
  `taxonomy.authorityRules` (5 rules — including *"classification is the ENFORCED
  authority; target_classification is aspirational ONLY"*).
- Every gate (36 total) now carries: `classification`, `scope`, `owner`,
  `rationale`, `promotionCriteria[]`, `demotionCriteria[]`,
  `knownLimitations[]`, `lastVerified` (plus `targetClassification` /
  `promotionCondition` / `repairRequired` / `supersededBy` where applicable).

**v1 → v2 classification mapping applied:**

| v1 | v2 |
| --- | --- |
| `blocking` | `pr-blocking` (default) / `release-blocking` (for `ga-state`, `release-migration-safety`, `db-drift-check`, `ga-check`) |
| `advisory` | `advisory` |
| `deprecated` | `deprecated` |
| `future_doctrine` | `experimental` |

**Counts (verified against the live registry):**

| Classification | Count |
| --- | --- |
| `pr-blocking` | 15 |
| `release-blocking` | 4 |
| `pilot-blocking` | 0 |
| `production-blocking` | **0** |
| `advisory` | 10 |
| `experimental` | 5 |
| `deprecated` | 2 |
| **Total** | **36** |

`enforcedBlocking: 19`, `reportOnly: 15`, `excluded: 2`,
`productionBlockingAchieved: 0`.

### 2.2 Authority runner (pure core + thin CLI)

[`tooling/governance/gate-authority.ts`](../../tooling/governance/gate-authority.ts)

- Pure, testable core: `loadRegistry`, `validateRegistry`, `runAuthority`,
  `enforcementFor`, `renderAuthorityMap`, `runSelfTest`.
- `runAuthority` semantics: **deprecated → never executed**; **blocking failure →
  exit 1**; **advisory / experimental failure → exit 0** (counted, not fatal).
- CLI modes:
  - `--validate` *(blocking)* — registry integrity + honesty rule (a
    `production-blocking` *target* may not already be blocking-enforced).
  - `--self-test` *(blocking)* — synthetic proof of the blocking-vs-advisory
    semantics, runnable in CI without re-executing real validators.
  - `--report` *(non-failing)* — prints the authority map, annotates advisory /
    repair-required / production-target gates (`::warning::`), and writes
    `reports/governance/gate-authority-map.json`.

### 2.3 Package scripts

[`package.json`](../../package.json): added `gate-authority:validate`,
`gate-authority:report`, `gate-authority:selftest`.

### 2.4 CI wiring

[`.github/workflows/nzila-governance.yml`](../../.github/workflows/nzila-governance.yml)

- New **`gate-authority`** job: `--validate` (blocking) → `--self-test`
  (blocking synthetic proof) → `--report` (non-failing) → uploads the authority
  map artifact (365-day retention).
- Added `gate-authority` to the `governance-gate` summary job's `needs:` plus a
  failure-check block.
- **Deliberately does NOT re-execute the heavy validators** — that would risk
  hard-failing CI on *known* advisory failures. Enforcement semantics are proven
  by the runner's pure core + synthetic fixtures, not by re-running real gates.

### 2.5 Doctrine document

[`docs/governance/gates/gate-taxonomy.md`](../../docs/governance/gates/gate-taxonomy.md)
— first-class doctrine: the 7 categories, enforcement semantics, authority rules,
per-gate metadata schema, and the honest current-state snapshot.

### 2.6 Contract test

[`tooling/contract-tests/gate-authority.test.ts`](../../tooling/contract-tests/gate-authority.test.ts)
(`INV-GATE-AUTHORITY`, **17 tests, all passing**): proves advisory failure ≠ CI
fail; blocking failure = CI fail; deprecated excluded; every gate validly
classified; summary counts match reality; `final:go` visible-but-advisory; the
path-repaired UE validators are **not** over-promoted; repair-required gates are
flagged; **0** gates are `production-blocking`; v2 schema + 7 categories present.

---

## 3. Honesty ledger — what was NOT promoted

| Validator | Status after Phase 5 | Why not promoted |
| --- | --- | --- |
| `validate-runtime-authority` | advisory (target `release-blocking`) | Green after Phase 4, but green ≠ promotion; needs stability evidence. |
| `validate-runtime-convergence` | advisory (was deprecated) | Green only **via legacy doc fallback**; flagged for re-deprecation once `validate-runtime-integrity` subsumes it. |
| `validate-runtime-integrity` | advisory (target `release-blocking`) | Not yet stable on main. |
| `validate-ue-infrastructure` | advisory, **`repairRequired`** | **Real** failing signal: upstream doctrine anchors archived; review doc missing validator references. Not repointed at archived snapshots. |
| `validate-navigation-monetization` | advisory, **`repairRequired`** | Review doc missing required validator references. |
| `validate-live-readiness` | advisory (target `production-blocking`) | Production evidence **absent** — not fabricated. |
| `validate-infra-convergence` | advisory (target `production-blocking`) | Evidence absent. |
| `validate-final-go` (`pnpm final:go`) | advisory (target `production-blocking`), **visible** | Remains advisory until zero missing certification artifacts AND full-chain rehearsal pass. **Never made blocking.** |

**Production-certification gates achieved: 0.** Targets only:
`validate-live-readiness`, `validate-infra-convergence`, `validate-final-go`.

---

## 4. Verification performed

- `pnpm gate-authority:validate` → ✅ "36 gates, all classified."
- `pnpm gate-authority:selftest` → ✅ advisory ≠ fail, blocking = fail, deprecated excluded.
- `pnpm gate-authority:report` → ✅ authority map rendered + artifact written; warnings emitted for advisory/repair-required/production-target gates.
- `INV-GATE-AUTHORITY` contract test → ✅ 17/17 passing.
- Workflow YAML + `package.json` parse-validated.
- `get_errors` on the runner and the test → no errors.

---

## 5. Constraints honored

- No production-readiness claim. `productionBlockingAchieved: 0`.
- No `final:go` promotion. Advisory + visible only.
- No advisory → blocking promotion (running green ≠ promotion).
- No validator content repair beyond taxonomy/registry documentation.
- No CI hard-fail on known advisory failures.
- No broad workflow rewrite beyond gate-authority behavior.
- No fabricated evidence; `validate-ue-infrastructure` not pointed at archived doctrine snapshots.

---

## 6. Deferred to later phases (NOT done here)

- Promotion of any advisory validator to blocking (requires stability evidence + PR).
- Repair of `validate-ue-infrastructure` / `validate-navigation-monetization` missing references and archived anchors.
- Production-certification evidence for `validate-live-readiness`, `validate-infra-convergence`, `validate-final-go`.
- Runtime separation (Phase 6).

---

## HARD STOP

Phase 5 is complete and verified. **Do not begin Phase 6 (runtime separation)
without explicit human approval.**
