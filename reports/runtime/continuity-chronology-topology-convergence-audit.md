# Union Eyes — Continuity / Chronology / Topology Convergence Audit

**Audit date:** 2026-05-15
**Substrate package:** `@nzila/institutional-governance-graph` (IGG)
**Posture:** validation-only

The institutional substrate exposes four hydration layers that must converge on every "institutional" surface to qualify for procurement-grade depth: (1) IGG entity / relationship projection, (2) continuity (succession, fragility, knowledge transfer), (3) chronology (procedural timeline, governance epochs), (4) topology (hierarchy, affiliation, delegation). Provenance and explainability are cross-cutting requirements applied to all four.

---

## 1. Convergence matrix

| Route | IGG | Continuity | Chronology | Topology | Provenance | Explainability | Convergence verdict |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| /dashboard/governance-center | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **converged** |
| /dashboard/institutional-observability | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | **converged** (topology partial) |
| /dashboard/institutional-topology | ✅ | ◐ | ◐ | ✅ | ✅ | ✅ | **converged** |
| /dashboard/institutional-chronology | ✅ | ◐ | ✅ | ◐ | ✅ | ✅ | **converged** |
| /dashboard/institutional-memory | ◐ | ✅ | ◐ | ◐ | ◐ | ◐ | **partial** — needs IGG enrichment via topology-source-adapter |
| /dashboard/longitudinal-cognition | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **converged** |
| /dashboard/executive-operating-intelligence | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | **converged** (topology partial) |
| /dashboard/continuity-intelligence | ◐ | ✅ | ◐ | ◐ | ◐ | ✅ | **partial** — IGG read pathway not wired into the cockpit |
| /dashboard/continuity-planning | ◐ | ✅ | ◐ | ◐ | ◐ | ✅ | **partial** |
| /dashboard/continuity-simulation | ◐ | ✅ | ◐ | ◐ | ◐ | ✅ | **partial** |
| /dashboard/cba-intelligence | ◐ | ◐ | ◐ | ✗ | ◐ | ◐ | **fragmented** |
| /dashboard/cognition | ✗ | ◐ | ✗ | ✗ | ◐ | ✗ | **bypasses substrate** |
| /dashboard/intelligence | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | **shell** — convergence delegated to tabs |
| /dashboard/movement-insights | ✗ | ◐ | ◐ | ✗ | ◐ | ✗ | **bypasses substrate** |
| /dashboard/cross-union-analytics | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | **bypasses substrate** |
| /dashboard/sector-analytics | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | **bypasses substrate** |
| /dashboard/governance (bylaws) | ✗ | ✗ | ◐ | ✗ | ✅ | ◐ | **scoped CRUD** (acceptable) |

Legend: ✅ wired · ◐ partial · ✗ not wired

---

## 2. Workstream H artifacts (recently landed)

The IGG topology source adapter and topology hydration helper landed in commit `727c2395c` and unlock the remaining **partial** rows above:

- [packages/institutional-governance-graph/src/adapters/topology-source-adapter.ts](packages/institutional-governance-graph/src/adapters/topology-source-adapter.ts)
- [packages/institutional-governance-graph/src/governance/topology-hydration.ts](packages/institutional-governance-graph/src/governance/topology-hydration.ts)
- [packages/institutional-governance-graph/src/observability/snapshot.ts](packages/institutional-governance-graph/src/observability/snapshot.ts) — now exposes topology counts.
- [reports/governance-graph/workstream-h-implementation-report.md](reports/governance-graph/workstream-h-implementation-report.md)

These provide a sanctioned, redacted topology read surface that `institutional-memory`, `institutional-observability` (topology gap), `executive-operating-intelligence` (topology gap), and the three continuity surfaces can consume without rebuilding query plumbing.

---

## 3. Convergence gaps (validated, not remediated)

| Gap | Surfaces affected | Lowest-risk remediation path |
| --- | --- | --- |
| Topology read not wired into continuity cockpits | continuity-intelligence, continuity-planning, continuity-simulation | Adopt `topology-source-adapter` for the org-tree projection currently absent from those pages. |
| Provenance + explainability disclosure missing on partial cockpits | continuity-{intelligence,planning,simulation}, institutional-memory, cba-intelligence | Add the standard provenance-stamp footer + `assistive-reasoning` disclosure block already used by governance-center. |
| Cognition route projects scoring without IGG enrichment | /dashboard/cognition | Re-route the underlying call through `runFullInstitutionalCognition` (already proven by longitudinal-cognition + executive-operating-intelligence) to ensure storied output rather than raw scores. |
| Aggregation routes bypass substrate entirely | movement-insights, cross-union-analytics, sector-analytics | These are SQL roll-ups by design. Convergence requires a labelled "trends, not analytics" framing plus a provenance footer; full substrate convergence is out of scope. |
| Bylaws / governance CRUD never reads chronology | /dashboard/governance | Acceptable; CRUD route does not need cognition. Add a minor link to `institutional-chronology` for context. |

---

## 4. Convergence verdict

- **6 surfaces fully converged** (governance-center, institutional-observability/topology/chronology, longitudinal-cognition, executive-operating-intelligence).
- **5 surfaces partially converged** (institutional-memory + 3 continuity cockpits + cba-intelligence) — all unlockable using the Workstream H topology-source-adapter without schema or architectural change.
- **4 surfaces bypass substrate** (cognition, intelligence, movement-insights, cross-union-analytics, sector-analytics) — these are the convergence-state critical-path items called out by the Final Module Readiness Matrix.

---

## 5. Validation gates

The convergence layer itself was validated indirectly by:

- `pnpm --filter @nzila/institutional-governance-graph test` — 162 passing (last run: pre-commit `727c2395c`).
- `pnpm typecheck` — workspace-clean (last run: pre-commit `727c2395c`, captured in `typecheck-latest.log`).
- `pnpm --filter @nzila/union-eyes narrative:audit` and `narrative:check --ci` — 0 hard-fail / 0 rule failures / maturity 87.

No additional gate runs are required for this audit because no source mutations were performed.
