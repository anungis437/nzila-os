# Workstream G — Institutional Observability Surfaces (Audit)

**App:** `apps/union-eyes`
**Underlying substrate:** `@nzila/institutional-governance-graph` (Phase 4 read-only)
**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**Strategic principle:** *Inspectable institutional continuity infrastructure — not a SaaS dashboard, not an analytics cockpit.*
**Layer:** Display / read-only projection / governance-config. **No write paths, no schemas, no RBAC, no behavioural change.**

> Workstream G answers **"how did this institutional state emerge?"** — never **"how do we
> optimize institutional behaviour?"**.

## Method

This audit was performed by:

1. Inventorying the public surface of `packages/institutional-governance-graph/src/index.ts`
   (Phase 2 → Phase 4) and the doctrine fence in `governance/protected.ts`.
2. Inventorying existing union-eyes routes that already speak chronology / continuity /
   institutional-memory / governance-center vocabulary.
3. Cross-referencing against the WS G ten-question audit grid and the Phase 4 forbidden surfaces.
4. Mapping each IGG read primitive onto a candidate UE display surface — keeping every mapping
   read-only, additive, and governance-safe.

## IGG read-side substrate available to WS G

The package already exposes a complete, doctrine-fenced read surface. WS G is purely a *display*
of that surface — no new analytics, no new computation, no protected-semantic exposure.

| IGG export | Type | WS G use |
|---|---|---|
| `buildInstitutionalTimeline(graph, opts?)` | timeline rows (decisions / affiliations / representations / governance events / lineage / epoch markers) | **chronology rail** |
| `lineageChain(...)` (re-exported via timeline + queries) | succession chain via `SUPERSEDES` (post-redaction) | **lineage explorer** |
| `buildContinuityTimeline(graph, opts?)` | role-tenure / affiliation / steward / CBA / **succession breakpoints** | **continuity pathway** |
| `buildEvidenceConvergence(graph, opts?)` | per-decision evidence / knowledge / policy citation triplet | **evidence-linked governance timeline** |
| `buildExplainabilityRecords(graph, opts?)` | per-decision provenance refs + lineage refs + preceding event refs | **provenance card** |
| `summarizeProvenanceCoverage(records)` | counts only: total / with-evidence / with-knowledge / with-policy / with-lineage / with-preceding-event | **provenance coverage strip** |
| `collectInstitutionalObservability(graph, {enabled})` | gated counts-only snapshot | **observability footer / `/healthz`-style facets** |
| `redactProtected` / `assertNoProtectedKindsInReadSurface` / `assertNoProtectedKindsInProjections` | fence | **belt-and-suspenders** at every adapter boundary |

Every WS G surface MUST funnel through `redactProtected` once at the substrate boundary, then
trust the IGG builders to re-fence and assert. **WS G adds no new fence logic** — it consumes
the existing one.

## Audit answers (WS G ten-question grid)

1. **Which observability surfaces are safe now?** All Phase 4 IGG builders, plus the gated
   counts-only snapshot. They are doctrine-fenced and integer-only.
2. **Which chronology views already exist implicitly?** `dashboard/longitudinal-cognition` (now
   *Institutional Chronology Storybook* per WS F) renders calm narrative chapters anchored to
   the cognition kernel. It is *narrative chronology*. WS G adds *substrate chronology* — the
   IGG timeline itself, source-anchored, no inference.
3. **Which lineage relationships are understandable to users?** `SUPERSEDES`-anchored lineage
   chains (the only non-protected lineage relation; `OVERRIDES` is in the protected set).
4. **What continuity primitives should become visible?** Role tenure, affiliation transition,
   steward assignment, CBA ratification, and **succession breakpoints** — the exact public
   shape of `ContinuityEntryKind`.
5. **Which observability risks could drift into surveillance?** Anything that ranks, scores,
   weights, predicts, or aggregates per actor. Already enforced by the IGG fence + WS A–F
   narrative governance. WS G adds Part J terms.
6. **Which visual metaphors feel governance-safe?** Vertical chronology rails, archival cards,
   lineage breadcrumbs, lineage ladders, calm muted palettes, integer counts. Forbidden:
   force-directed graphs, heatmaps, leaderboards, network maps, cockpit gauges.
7. **Which institutional timelines are explainable?** All of `buildInstitutionalTimeline` —
   each row carries `sourceId` + `summary` + `category`, suitable for click-through to the
   underlying decision / edge / entity in future passes.
8. **What provenance should be visible?** Per-decision evidence / knowledge / policy / lineage
   counts + ID lists. **No content snippets**, **no autosummaries**.
9. **Which governance semantics must remain hidden?** Protected entity / event / decision /
   relationship kinds (Class B, golden share, reserved matter, vetoes, OVERRIDES, continuity
   protection internals). WS G never references these — the fence strips them before the row
   ever reaches the page.
10. **What UX patterns align with the institutional doctrine?** Read-only stacked cards on a
    chronology rail; lineage rendered as vertical ancestry chains; continuity as inspectable
    pathway with breakpoint markers; provenance shown as a count-only strip + per-decision
    reference list. **No** charts, **no** dashboards, **no** scoreboards.

## Existing UE surfaces that already touch this space

| Route | Status | WS G relationship |
|---|---|---|
| `dashboard/governance-center` | Cognition-kernel trust center (cognition substrate, not IGG). | Sibling. Untouched. |
| `dashboard/longitudinal-cognition` | Narrative chronology of cognition envelopes. | Sibling. Reads cognition kernel; WS G reads IGG substrate. |
| `dashboard/institutional-memory` | Memory explorer component. | Sibling. Continuity-adjacent. |
| `dashboard/continuity-intelligence` / `continuity-planning` / `continuity-simulation` | Reviewer-led continuity workspaces (component-driven). | Sibling. WS G adds the *substrate-anchored* read view of continuity. |
| `dashboard/operations` | Continuity Operations (per WS E). | Sibling. Operational chronology. |

WS G does **not** duplicate or supersede any of these. It adds a single new
**Institutional Observability** family that visibly renders the IGG Phase 4 read surface.

## WS G display surfaces (proposed, read-only)

A single new route family rooted at:

```
apps/union-eyes/app/[locale]/dashboard/institutional-observability/
```

| Sub-surface | IGG primitive | UI shape | Empty state |
|---|---|---|---|
| **Chronology rail** | `buildInstitutionalTimeline` | vertical rail of archival cards, grouped by year-month, ascending chronological | "No chronology entries available for this institution yet." |
| **Lineage explorer** | succession breakpoints from `buildContinuityTimeline` (kind = `succession_breakpoint`) | vertical lineage chain with predecessor → successor breadcrumbs | "No succession lineage recorded yet." |
| **Continuity pathway** | non-breakpoint `ContinuityEntry` rows | grouped by entity, calm horizontal strip per entity | "No continuity events recorded yet." |
| **Evidence-linked timeline** | `buildEvidenceConvergence` | per-decision card with evidence / knowledge / policy ref counts + ID lists | "No evidence-linked decisions yet." |
| **Provenance coverage** | `summarizeProvenanceCoverage(buildExplainabilityRecords(...))` | counts-only strip (6 fields, integers only) | "Awaiting first decision with provenance refs." |
| **Observability snapshot footer** | `collectInstitutionalObservability(graph, {enabled: …})` | small counts-only footer (substrate, timeline, evidence, continuity totals) | gate-disabled label |

### Visual / language direction

- **Visual:** muted slate palette (matches governance-center / longitudinal-cognition);
  vertical chronology rails; archival-modern cards; integer counts only; ISO timestamps
  rendered with `toLocaleString()`; no charts, no graphs, no progress bars, no badges that
  evaluate quality.
- **Language:** "chronology" / "lineage" / "continuity" / "provenance" / "preserved record"
  / "succession breakpoint" / "evidence reference" — the WS E/F ontology.

### Source adapter posture

UE does not yet have a wired `InstitutionalGovernanceSourceAdapter`. WS G adds a small
**read-only source helper** at `lib/institutional-observability/source.ts` that returns an
**empty substrate by default** (`{ nodes: [], edges: [], decisions: [] }`). This:

- proves the surface end-to-end through the doctrine fence,
- renders calm, governance-safe empty states for every panel,
- leaves the real DB → IGG plumbing as a discrete future workstream (no DB schema work in
  WS G).

The helper is server-only and behaviour-free — purely a placeholder constructor.

## Part H — protected-governance exposure audit

| Risk vector | Status |
|---|---|
| Class-B / golden-share references in copy | Not introduced. WS G copy uses only "succession", "lineage", "continuity", "evidence". |
| Veto / reserved-matter exposure | Not introduced. IGG `redactProtected` strips these from substrate before any WS G row is computed. |
| `OVERRIDES` lineage exposure | Not possible — IGG protected-relationship-kinds includes `OVERRIDES`; only `SUPERSEDES` survives redaction. |
| Continuity-protection internals | Not introduced. WS G surfaces only the public `ContinuityEntryKind` set. |
| Founder-control framing | Not introduced. Already enforced by `founderOptics` block. |

## Part J — narrative-CI vocabulary additions

To prevent regression as observability surfaces grow:

### Hard-fails (`surveillanceAi`)

- "governance cockpit"
- "institutional monitoring"
- "leadership scoreboard"
- "actor heatmap"
- "influence map"
- "caucus analytics"
- "power network"

### Warnings (`warningLevel`)

- "observability cockpit"
- "governance dashboard"
- "operational scoreboard"
- "continuity scoring"
- "lineage analytics"

### Glob extension

`tooling/marketing/narrative-audit.ts` — `INTERNAL_NARRATIVE_GLOBS` extended with the new
`institutional-observability/**/page.tsx` family so vocabulary drift is caught at CI.

## Acceptance gates

- `pnpm narrative:audit` — maturity ≥ 85, hard-fail = 0
- `pnpm narrative:check --ci` — green
- `pnpm --filter @nzila/institutional-governance-graph test` — 118 / 118 (unchanged)
- `pnpm typecheck` — 224 / 224

## Out-of-scope (deferred to a focused later workstream)

- Real `InstitutionalGovernanceSourceAdapter` wiring against the union-eyes DB. (WS G ships
  the empty-substrate placeholder; the adapter is a discrete data-layer workstream.)
- Per-decision drill-through to underlying records.
- Multi-tenant filtering UX (today's surfaces are organization-scoped via existing auth guard
  context).
- Bilingual copy lockstep on the new strings (will land in a focused i18n pass).
