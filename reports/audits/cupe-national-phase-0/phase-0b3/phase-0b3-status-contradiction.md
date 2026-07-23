# Phase 0B.3 — Status Contradiction Resolution

**Section:** 1
**Date:** 2026-07-23 (America/New_York)

---

## 1. The contradiction

`reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-closure-report.md`
and `phase-0b2r-amber-closure.md` simultaneously assert:

- Phase 0B.2R is **CLOSED** (closure ledger complete, 16 sections).
- Phase 0B **classification** is **AMBER — FOUNDATIONAL RUNTIME
  INTEGRATION INCOMPLETE**.

These two assertions are internally inconsistent. Either:

- (a) Runtime integration remains materially incomplete, in which case
  the AMBER report must identify at least one concrete blocker, or
- (b) The AMBER classification is stale/over-conservative, in which
  case Phase 0B must be adjudicated GREEN.

## 2. Resolution

Per the systematic open-items enumeration in
[phase-0b3-open-items-register.md](phase-0b3-open-items-register.md),
**zero** items block Phase 0B GREEN when evaluated against the actual
Phase 0B mandate (four pillars: two-lineage organization model, KPI
identifier value/type contract, sanctioned cross-lineage provisioning
entry point, at-least-one production runtime proof).

Therefore condition (a) does not hold, and condition (b) is confirmed.

## 3. Root cause of the AMBER retention

The Phase 0B.2R AMBER retention was justified via `phase-0b2r-amber-closure.md §4`
by measuring against **five** resolver-integration paths (pilot events
audit, pilot metrics, KPI ingestion, RLS org context, broader audit
sites). This five-path bar:

- was quoted from the original Phase 0B **downgrade note**
  (a self-imposed retrospective standard), not from the Phase 0B.2
  corrective mandate as it was actually issued;
- confuses **Phase 0B foundational identifier-integrity work** with
  **Phase 0C foundational-slice feature work**;
- contradicts the literal Phase 0B.2R mandate, which stated:

  > at least one test must execute: API/server action → resolver →
  > PostgreSQL. Mocks alone are insufficient.

Phase 0B.2R §7 satisfies that literal "at least one" mandate with:

- One production call site (`apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts`).
- One real-DB integration test (`platform-audit-events.integration.test.ts`) that
  hits native PostgreSQL and is witnessed by `psql` (`org_id` = UUID
  physically present in `public.audit_events`).
- Two composed-runtime proofs (§10 clean composition, §11 existing-DB
  upgrade) that exercise the same call site in both greenfield and
  upgrade shapes.

## 4. The Phase 0B mandate — what actually gates GREEN

From `cupe-national-phase-ledger.md` §Phase 0B fixes (PH0-FIX-010,
PH0-FIX-011, PH0-FIX-012), Phase 0B is titled
**"Organization and Identifier Integrity Closure"** and comprises:

1. Two-lineage organization model with same-UUID FK + CHECK constraint.
2. KPI identifier value/type contract aligned to engine `makeId(prefix)`.
3. Sanctioned cross-lineage provisioning entry point (resolver).
4. At least one API → resolver → PostgreSQL runtime proof (mocks alone
   insufficient).

Phase 0B is **not** titled "resolver saturation across all downstream
integration paths." Broader wiring is a Phase 0C deliverable.

## 5. Adjudicated status

- Phase 0B.2R remains **CLOSED** (all 16 sections landed, artefacts on
  disk, commits pushed).
- Phase 0B classification is **corrected** from AMBER to
  **GREEN — PHASE 0B FOUNDATIONAL RUNTIME PROVEN**.
- The five-path bar cited in `phase-0b2r-amber-closure.md §4` is
  reclassified: paths #1 (pilot events audit) is proven (Phase 0B);
  paths #2, #3, #4, #5 are Phase 0C feature scope.

## 6. Cross-references

- Open-items register (pivotal): [phase-0b3-open-items-register.md](phase-0b3-open-items-register.md)
- Runtime callsite proof: [phase-0b3-runtime-callsite-proof.md](phase-0b3-runtime-callsite-proof.md)
- Prior AMBER closure (superseded): [../phase-0b2r/phase-0b2r-amber-closure.md](../phase-0b2r/phase-0b2r-amber-closure.md)
- Final adjudication: [phase-0b3-final-adjudication.md](phase-0b3-final-adjudication.md)
