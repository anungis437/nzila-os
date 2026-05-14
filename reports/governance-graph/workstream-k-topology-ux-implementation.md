# Workstream K — Topology UX Implementation Report (Step 11)

> Final report for WS K (Institutional Topology UX). Documents the
> deliverables, route shape, validation gates, and per-step commit
> trail for the canonical institutional-topology read-surface.

---

## 1. Outcome

A single canonical read-only route —
[apps/union-eyes/app/[[]locale[]]/dashboard/institutional-topology/page.tsx](../../apps/union-eyes/app/[locale]/dashboard/institutional-topology/page.tsx) —
now exposes six topology panels (hierarchy · affiliation/representation ·
delegation pathways · governance lineage · continuity-aware topology ·
substrate counts) plus an inline explainability overlay and the verbatim
doctrine footer. All panels read from a single
`getInstitutionalTopologyView()` adapter that runs `redactProtected` once
on the upstream institutional graph.

## 2. Deliverables

### 2.1 Audit
- [reports/governance-graph/workstream-k-topology-ux-audit.md](./workstream-k-topology-ux-audit.md)
  — substrate map, reference UX template, per-gap analyses (Parts C–G),
  explainability overlays, forbidden + required vocabulary.

### 2.2 Narrative vocabulary
- [apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts](../../apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts)
  — `topologyUx` bucket forbidding influence/analytics/optimization/AI-topology terms.
- [apps/union-eyes/tooling/marketing/config/required-vocabulary.ts](../../apps/union-eyes/tooling/marketing/config/required-vocabulary.ts)
  — `TOPOLOGY_UX_REQUIRED` (12 phrases) for the institutional-topology surface.

### 2.3 Substrate adapter
- [apps/union-eyes/lib/institutional-topology/source.ts](../../apps/union-eyes/lib/institutional-topology/source.ts)
  — exports `InstitutionalTopologyView` + view types, `getInstitutionalGraph()`
  (placeholder empty graph), and `getInstitutionalTopologyView()` which:
  1. Pulls the graph.
  2. Runs `redactProtected` (single fence pass).
  3. Composes hierarchy / affiliation+representation / delegation /
     lineage / continuity-topology projections.
  4. Returns integer substrate counts and an ISO `generatedAt`.

### 2.4 Read-surface
- [apps/union-eyes/app/[[]locale[]]/dashboard/institutional-topology/page.tsx](../../apps/union-eyes/app/[locale]/dashboard/institutional-topology/page.tsx)
  — server component, `await requireUser()`, six `PANEL` blocks, integers
  only, `—` for empty values, lineage hop chips, continuity kind badges,
  delegation state badges, affiliation cohort sub-strip with member counts,
  inline "Shows / Does not show" explainability overlay, doctrine footer
  rendered verbatim.

### 2.5 Protected-kind projection guard
- [apps/union-eyes/lib/institutional-topology/__tests__/source.test.ts](../../apps/union-eyes/lib/institutional-topology/__tests__/source.test.ts)
  — 3 vitest cases: (a) placeholder graph empty + well-typed,
  (b) every projected view passes `assertNoProtectedKindsInProjections`
  (hierarchy / affiliation+representation edges / delegation states /
  lineage chains all mapped to the IGG scan-fields shape), (c) integer
  substrate counts + ISO `generatedAt`.

### 2.6 Route deviation rationale
- [reports/governance-graph/workstream-k-route-deviation.md](./workstream-k-route-deviation.md)
  — explains why the audit's per-gap five-route plan was consolidated
  into a single canonical `/dashboard/institutional-topology` route
  (single fence pass, single doctrine footer, mental-model coherence,
  shared explainability overlay, single substrate-counts block).

## 3. Validation gates

The following gates were exercised per step and at the close of the
workstream:

| Gate | Status |
|---|---|
| `pnpm --filter @nzila/union-eyes narrative:audit` (≥85 avg, 0 hard-fail) | Pass at Step 2 vocabulary extension |
| `pnpm --filter @nzila/union-eyes narrative:check --ci` | Pass after vocabulary + page convergence |
| `pnpm typecheck` | Pass after each substrate / page / test edit |
| `pnpm --filter @nzila/institutional-governance-graph test` | Pass — protected-fence contract intact |
| `lib/institutional-topology/__tests__/source.test.ts` (vitest) | Pass — 3/3 cases green |

## 4. Commit trail

| Step | Commit | Subject |
|---|---|---|
| 1 | `3a291ec81` | docs(ws-k): step 1 institutional topology UX audit |
| 2 | `da9de15a2` | chore(ws-k): step 2 extend narrative vocabulary for institutional topology UX |
| 3 | `71a1a37bd` | chore(ws-k): step 3 add institutional-topology read-only source helper |
| 4 | `a912e1c2d` | chore(ws-k): step 4 add institutional-topology canonical page (5 panels + coverage strip) |
| 5 | `646d28086` | chore(ws-k): step 5 add affiliation cohorts sub-strip with member counts |
| 6 | `f2b6e4523` | chore(ws-k): step 6 add delegation state badges and pathway visualization |
| 7 | `33dd56d67` | chore(ws-k): step 7 refine lineage hop chips and continuity kind badges |
| 8 | `2b4f049f4` | chore(ws-k): step 8 add inline explainability overlay (shows / does not show) |
| 9 | `041d12881` | chore(ws-k): step 9 add protected-kind projection guard test |
| 10 | `04b3a67b5` | chore(ws-k): step 10 add route deviation rationale |
| 11 | _this report_ | chore(ws-k): step 11 add implementation report |

## 5. Doctrine compliance summary

- **Governance-safe transparency only** — no scoring, no ranking, no
  predictions, no recommendations. Integers only. Empty values render `—`.
- **Protected institutional semantics redacted at the graph layer** —
  `redactProtected` runs once in the adapter; the projection guard test
  exercises `assertNoProtectedKindsInProjections` against every view
  shape on every test run.
- **Single doctrine footer** — verbatim on the canonical route.
- **Single explainability overlay** — "Shows / Does not show" statement
  applies uniformly to every panel.

## 6. Forward notes

- The substrate adapter currently returns an empty placeholder graph.
  When the upstream institutional graph is wired, no surface change is
  needed — the views compose generically over the redacted graph.
- Any future panel that needs topology data on a different route MUST
  consume `getInstitutionalTopologyView()` rather than re-derive a
  parallel adapter (see route-deviation §5).
