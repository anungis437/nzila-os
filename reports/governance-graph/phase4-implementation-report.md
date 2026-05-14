# Phase 4 — Implementation Report

**Package:** `@nzila/institutional-governance-graph`
**Phase:** 4 — Governance Chronology, Evidence Convergence & Read-Only Institutional Observability
**Status:** ✅ Complete
**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**PR:** #516

---

## 1. Doctrine

Phase 4 is **strictly additive** and **read-only**. It introduces a chronology /
evidence / continuity / provenance / observability convergence layer over the
existing Phase 2–3 substrates, **without** altering write paths, projections,
or the protected-semantics fence.

### FORBIDDEN surfaces (NOT introduced)

The following were considered and explicitly rejected on constitutional /
governance-neutrality grounds. None of the modules below reference, compute,
infer, or expose any of these:

- Ranking / scoring / weighting
- "Trust score" / "governance score" / "leadership-stability index"
- Behavioural analytics / actor profiling / caucus analysis
- Power-network maps / political clustering / influence graphs
- Predictive simulation / forecasting / recommendation surfaces
- Governance-efficiency metrics / ratios / percentages / averages

### ALLOWED surfaces (introduced this phase)

- **Chronology** — temporally ordered governance events with stable categories.
- **Evidence convergence** — counts of citations attached to decisions.
- **Continuity** — succession / supersession lineage with breakpoints.
- **Provenance coverage** — counts (not ratios) of decisions citing
  evidence / knowledge / policy / lineage / preceding events.
- **Counts-only observability snapshot** — gated, read-only, integer counts
  for dashboards / log sampling / drift detection.

---

## 2. Deliverables

| # | Module | File | Tests |
|---|--------|------|-------|
| 1 | Audit | `reports/governance-graph/phase4-observability-audit.md` | n/a |
| 2 | Institutional timeline | `src/governance/timeline.ts` | 12 |
| 3 | Evidence convergence | `src/governance/evidence.ts` | 11 |
| 4 | Institutional continuity | `src/governance/continuity.ts` | 13 |
| 5 | Projection-fence reinforcement | `src/governance/protected.ts` (+ `protected-projections.test.ts`) | 15 |
| 6 | Cross-module integration | `src/governance/cross-module.test.ts` | 10 |
| 7 | Trust & explainability (provenance) | `src/governance/trust.ts` | 14 |
| 8 | Read-only institutional observability | `src/observability/snapshot.ts` | 9 |
| 9 | This implementation report | `reports/governance-graph/phase4-implementation-report.md` | n/a |

Plus pre-existing `governance.test.ts` (17) and `projection.test.ts` (17),
both green and unmodified.

**Total:** 9 test files, **118 / 118 tests passing**, `tsc --noEmit` clean.

---

## 3. Doctrine fence pipeline

Every read surface introduced in Phase 4 funnels through the same three-stage
fence defined in `src/governance/protected.ts`:

```
input graph
  → redactProtected(graph)                      // strips protected entity / event / decision categories
  → assertNoProtectedKindsInReadSurface(safe)   // post-redaction guard
  → <module-specific build>                     // counts / chronology / lineage only
  → assertNoProtectedKindsInProjections(out)    // belt-and-suspenders on the output
  → return read-only value
```

Each `build*` function additionally re-applies `redactProtected` internally
and filters by `isProtectedEventKind` so a missing `category` cannot leak a
protected `iggEventKind` through the surface.

---

## 4. Module summaries

### `governance/timeline.ts` — `buildInstitutionalTimeline`

Chronological merge of decision events and entity-edge transitions. Sorted
ascending by `occurredAt`. Each entry carries a stable `category` string and
references back to the originating substrate node/edge/decision id. **No
weights, no scores, no clustering.**

### `governance/evidence.ts` — `buildEvidenceConvergence`

Per-decision projection of evidence / knowledge / policy / lineage references.
Each entry exposes the underlying citation ids only — never source content,
never an evaluative judgement.

### `governance/continuity.ts` — `buildContinuityTimeline`

Succession / tenure / supersession lineage derived from entity-edge transitions
plus decision lineage. Surfaces explicit *breakpoints* (succession gaps,
revocations) without inferring "instability" or "leadership quality".

### `governance/trust.ts` — `buildExplainabilityRecords` + `summarizeProvenanceCoverage`

Per-decision explainability record (provenance refs, lineage refs, preceding
event id) plus a coverage summary that emits **integer counts only**:

- `totalDecisions`
- `decisionsWithEvidence`
- `decisionsWithKnowledge`
- `decisionsWithPolicy`
- `decisionsWithLineage`
- `decisionsWithPrecedingEvent`

No ratios, no percentages, no "trust score". The per-decision record carries
the same booleans / counts and never an evaluative label.

### `observability/snapshot.ts` — `collectInstitutionalObservability`

Gated counts-only snapshot. Returns `null` unless either:

- `options.enabled === true`, or
- `process.env.IGG_OBSERVABILITY_ENABLED === '1'`.

When enabled, returns:

```ts
{
  generatedAt: string,                     // ISO timestamp
  substrate:   { nodes, edges, decisions },
  timeline:    { entries },
  evidence:    { entries },
  continuity:  { entries },
  provenance:  { totalDecisions, decisionsWithEvidence,
                 decisionsWithKnowledge, decisionsWithPolicy,
                 decisionsWithLineage, decisionsWithPrecedingEvent },
}
```

Every field is a non-negative integer count or a stable string label.

---

## 5. Tests

### File breakdown

| File | Tests |
|------|-------|
| `src/governance/protected-projections.test.ts` | 15 |
| `src/governance/evidence.test.ts` | 11 |
| `src/governance/continuity.test.ts` | 13 |
| `src/governance/governance.test.ts` | 17 |
| `src/governance/timeline.test.ts` | 12 |
| `src/governance/cross-module.test.ts` | 10 |
| `src/observability/snapshot.test.ts` | 9 |
| `src/governance/trust.test.ts` | 14 |
| `src/projection.test.ts` | 17 |
| **Total** | **118** |

### Coverage themes

- **Doctrine fence** — every module has a "doctrine fence" describe-block
  that injects a protected category / event kind and asserts redaction.
- **Counts correctness** — fixture graphs with known shape verify exact
  counts (no off-by-one, no double-counting between substrate-level and
  decision-level surfaces).
- **Determinism** — observability snapshot is invoked twice and all fields
  except `generatedAt` are deep-equal.
- **Structural forbidden-keys** — observability output is `JSON.stringify`'d
  and asserted to contain none of: `score`, `rank`, `ranking`, `weight`,
  `ratio`, `percent`, `percentage`, `average`, `mean`, `efficiency`,
  `stability`, `caucus`, `prediction`, `forecast`, `recommendation`,
  `trustscore`.
- **Gate behaviour** — explicit `enabled:false` returns `null`; missing env
  - missing option returns `null`; env `'1'` enables; explicit
  `enabled:true` overrides missing env.

### Validation

```
pnpm --filter @nzila/institutional-governance-graph exec tsc --noEmit   # clean
pnpm --filter @nzila/institutional-governance-graph test -- --run
# Test Files  9 passed (9)
# Tests       118 passed (118)
```

---

## 6. Public API additions (barrel: `src/index.ts`)

```ts
// Phase 4
export * from './governance/timeline.js'
export * from './governance/evidence.js'
export * from './governance/continuity.js'
export * from './governance/trust.js'
export * from './observability/snapshot.js'
```

All exports are **read-only** functions / types. No write surface, no IO,
no side effects. The package remains a pure projection layer over the
caller-provided substrates.

---

## 7. Operational notes

- `collectInstitutionalObservability` performs no IO. It returns a value
  for the caller to log, expose via `/healthz`-style endpoints, or store
  as it sees fit.
- The env gate (`IGG_OBSERVABILITY_ENABLED=1`) is opt-in by default. With
  the gate disabled, the function does **zero work** beyond the gate read
  and returns `null` immediately.
- The snapshot is intentionally cheap (single-pass over the substrate)
  and safe to invoke per-request if the caller chooses.

---

## 8. Constitutional posture

Phase 4 preserves the package's constitutional neutrality:

- **No actor evaluation.** No surface scores, ranks, or rates any
  individual, organization, or class.
- **No predictive surface.** Every output describes what *has* happened,
  never what *will* or *should* happen.
- **No protected semantics leak.** The three-stage fence is enforced on
  every read path and tested per module.
- **Counts only.** No ratios, percentages, averages, or other derived
  evaluative metrics anywhere in the public surface.

Phase 4 is complete and ready for review.
