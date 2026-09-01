# Code Audit Note — `OCI_METHOD` constant and workbook engines

**Purpose:** what the code actually exports, checked against the reduced method, per the
collapse-and-reconcile order. Patches applied are rename/constant-alignment only — no new
engines, no logic changes.

## `apps/union-eyes/lib/oci/frameworks/index.ts`

Exports the `OCI_METHOD` constant: 5 phases, each with `id`, `ordinal`, `name`, `productLayer`
(P1–P5), `productFamily`, `posture`. Before this pass, the shape already matched the phase names
this collapse kept as canonical (Recognition/Mapping/Stabilization/Infrastructure/Intelligence
mapped to P1–P5) — it did **not** match the other, now-deleted `OCI_METHOD.md` phase shape
(Recognition/Mapping/Stabilization/**Continuity Plan**/**Embedding**). In other words: the code
was already right; the doctrine file that disagreed with the code is the one that was wrong, and
has been rewritten to agree with the code.

Patches applied (rename/constant alignment only):

1. Doc comment `See docs/oci/oci-method.md` → `See docs/oci/OCI_METHOD.md` (the file the comment
   points at was a duplicate; now there is one file).
2. `productFamily: 'ICRA'` → `'OCRA'` for the Recognition/P1 phase. This was simply stale — the
   product was already renamed OCRA in the doctrine and in the pricing surfaces; the migration
   convergence plan (`docs/oci/superseded/migration/OCI_OCRA_CONVERGENCE_PLAN.md`) already documents this
   rename as executed everywhere except a long tail of technical identifiers. This is that tail.
3. `productFamily: 'OCI Diagnostic'` → `'OCI Diagnostic & Stabilization'` (P3) and
   `'OCI Runtime Infrastructure'` → `'OCI Runtime'` (P4) — matches the renamed ladder tier names in
   `oci-product-ladder.md`.
4. `doctrineVersion: '1.0.0'` → `'1.1.0'` — matches the method's new version.

No phase was added, removed, or reordered. No `id`, `ordinal`, or `posture` value changed.

## `apps/union-eyes/lib/oci/benchmark/*.ts`

Three files (`aggregateIntelligence.ts`, `sectorBaselines.ts`, `types.ts`) carry doc comments
citing `docs/oci/OCI_METHOD.md (Sections 3.6, 3.7, 6)`. In the pre-collapse file, section 6 was
"Method boundaries," not benchmark doctrine (benchmark doctrine was section 9) — the comments were
already citing the wrong section before this pass touched anything. In the rewritten file,
principles 3.6 (opt-in aggregate intelligence) and 3.7 (anti-surveillance) are unchanged in
substance and number; the benchmark/P5 gate they used to point at is now `OCI_METHOD.md` §6.5.
Comments updated to `(Sections 3.6, 3.7, 6.5)` / `(Sections 3.6, 6.5)` accordingly. No runtime
behaviour changed — these are comments only.

## `apps/union-eyes/lib/workbook/engines/` (Governance Entropy Workbook engines)

Reviewed the full barrel (`index.ts`): stewardship cartography, continuity mapping, governance
entropy, continuity lineage, continuity breakpoint, modernization alignment, transformation
roadmap, workbook synthesis, cross-module signals, OCI operational profile, plus per-module helper
engines (topology mapper, dependency graph, precedent mapper, governance interpretation matrix,
reconstruction burden analyzer, collapse predictor, redistribution planner, maturity pathway,
etc.).

**Finding:** every engine name maps cleanly onto an instrument already named and dispositioned in
the reduced method (`OCI_METHOD.md`, `oci-product-ladder.md`, and the instrument-disposition table
in `OCI_ANTI_SURVEILLANCE_POSITION.md`). None of the engines compute or expose a per-individual
score; all outputs described in their names are institutional (density, entropy, burden,
survivability, reconstruction cost). **No engine required a code change.** The doctrine files that
referenced this barrel (the old `OCI_METHOD.md` §13 "P3 Operationalization corpus" list) were
removed from the method file as part of the collapse — the engines themselves are untouched, and
the `docs/oci/stabilization/**` tree that documents them in detail is retained as
`internal/engineering` (see `SUPERSEDED.md`), not deleted.

## What was not changed, and why

- No table, column, or schema change. The forward-compatible P5 hooks
  (`workbooks.sectorBand`, `workbooks.institutionSizeBand`) were already landed and needed no
  edit.
- No engine logic, scoring formula, or threshold changed anywhere in
  `apps/union-eyes/lib/oci/` or `apps/union-eyes/lib/workbook/engines/`.
- `apps/union-eyes/lib/icra/` and `apps/union-eyes/lib/icra-ai/` (the OCRA scoring core and AI
  synthesis layer named in `docs/oci/ai/OCRA_AI_SYSTEM_ARCHITECTURE.md`) were read for this audit
  but not modified — that architecture document is demoted to `internal/engineering`, but the code
  it describes was already compliant with `OCI_AI_BOUNDARY.md` (reviewer-led, deterministic core,
  no scoring by AI) and required no change.
