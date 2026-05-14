# Workstream G — Institutional Observability Surfaces (Implementation)

**Status:** ✅ Complete
**App:** `apps/union-eyes`
**Underlying substrate:** `@nzila/institutional-governance-graph` (Phase 4, read-only, doctrine-fenced)
**Layer:** Display / read-only projection / governance-config. **No write paths, no schemas, no RBAC, no behavioural change.**
**Strategic principle:** *Inspectable institutional continuity infrastructure — not a SaaS dashboard, not an analytics cockpit.*

> Workstream G answers **"how did this institutional state emerge?"** — never **"how do we
> optimize institutional behaviour?"**.

## Convergence outcome

WS G closes the loop opened by WS A–F. The governance vocabulary, continuity ontology, and
narrative chronology framing established in earlier workstreams now have a **substrate-anchored
read surface** that visibly renders the IGG Phase 4 read primitives — chronology, lineage,
continuity pathway, evidence convergence, provenance coverage, and a counts-only observability
snapshot — with every panel funnelled through `redactProtected` at the substrate boundary and
guarded by an `IGG_OBSERVABILITY_ENABLED`-style gate at the snapshot footer.

The new surface is a **display projection** of IGG read builders. It introduces no new analytics,
no inference, no scoring, no ranking, no automation, no write paths, and no protected-semantic
exposure. The doctrine-fence enforcement is borrowed wholesale from IGG; WS G adds **no new
fence logic** of its own.

## Audit input

- Pre-implementation audit: `reports/narrative/workstream-g-observability-audit.md`
- Surface mapping: IGG public read-side primitives → UE chronology / lineage / continuity /
  evidence / provenance / observability-snapshot panels.
- Doctrine fence: `packages/institutional-governance-graph/governance/protected.ts` and the
  IGG `redactProtected` / `assertNoProtectedKindsInReadSurface` /
  `assertNoProtectedKindsInProjections` belt-and-suspenders.

## Files changed

### Display layer (route + adapter)

| Path | Kind | Purpose |
|---|---|---|
| `apps/union-eyes/lib/institutional-observability/source.ts` | new | Server-only read-helper; returns an empty IGG substrate by default (`{ nodes: [], edges: [], decisions: [] }`). Adapter passes through `redactProtected` at the boundary and exposes `collectInstitutionalObservability(graph, { enabled })` gated by env. |
| `apps/union-eyes/app/[locale]/dashboard/institutional-observability/page.tsx` | new | Read-only route family rendering: chronology rail, lineage explorer (succession breakpoints), continuity pathway, evidence-linked timeline, provenance coverage strip, observability snapshot footer. Calm muted slate palette; integer counts only; no charts; no graphs; no scoreboards; no badges that evaluate quality. |

### Workspace dependency

| Path | Change |
|---|---|
| `apps/union-eyes/package.json` | Added `"@nzila/institutional-governance-graph": "workspace:*"` (pulls in the Phase 4 doctrine-fenced read surface). |
| `pnpm-lock.yaml` | Lockfile updated by `pnpm install` to link the workspace package. |
| `packages/institutional-governance-graph/**` | Newly tracked. Phase 4 substrate package (118 tests). |

### Narrative governance config

| Path | Change |
|---|---|
| `apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts` | Added `observability-guard` to the `ForbiddenTerm` category union. Added `observabilityGuards: ForbiddenTerm[]` (~22 compound terms covering surveillance / scoring / cockpit / heatmap / influence-map / leaderboard / actor-analytics drift). Spread into `FORBIDDEN_VOCABULARY` between `founderOptics` and `warningLevel`. NOTE: `"performance ranking"` was deliberately **excluded** because it collided with legitimate marketing copy (`institutional-continuity` page + i18n bundles). |
| `apps/union-eyes/tooling/marketing/config/required-vocabulary.ts` | Added `OBSERVABILITY_DOCTRINE_REQUIRED: RewardTerm[]` (10 entries: chronology, lineage, succession, continuity, provenance, evidence reference, …). Exported, available for future rule wiring; not currently bound to a maturity rule (maturity already passes 88/100 without it). |
| `apps/union-eyes/tooling/marketing/narrative-audit.ts` | `INTERNAL_NARRATIVE_GLOBS` extended with `app/[[]locale[]]/dashboard/institutional-observability/**/page.tsx` and `…/layout.tsx` so the new family is swept by `narrative:check`. |

### Reports

| Path | Kind |
|---|---|
| `reports/narrative/workstream-g-observability-audit.md` | new (audit) |
| `reports/narrative/workstream-g-implementation-report.md` | new (this document) |

## Doctrine compliance — what WS G does NOT do

- ❌ **No scoring.** No actor scores, no decision scores, no continuity scores.
- ❌ **No ranking.** No leaderboards, no top-N lists, no "best/worst" framings.
- ❌ **No prediction.** No forecasts, no risk projections, no "likelihood" framings.
- ❌ **No automation.** Surfaces are read-only display; there is no action button, no
  bulk-mutation, no governance-altering control.
- ❌ **No behavioural inference.** No engagement metrics, no usage analytics, no actor
  profiling.
- ❌ **No protected-semantic exposure.** Class B, golden share, reserved matter, vetoes,
  `OVERRIDES`, and continuity-protection internals are stripped by IGG `redactProtected`
  at the substrate boundary and asserted absent by IGG `assertNoProtectedKindsInProjections`
  on every read-side builder. WS G never references these kinds in copy or types.
- ❌ **No write paths.** No DB writes, no API mutations, no schema changes, no RBAC changes,
  no FSM changes, no auth changes.
- ❌ **No charts / heatmaps / graphs / cockpits.** Only chronology rails, archival cards,
  lineage breadcrumbs, and integer count strips.
- ❌ **No cross-actor aggregation.** Counts are per-decision or per-entity only.

## What WS G DOES do

- ✅ **Chronology rail** rendering `buildInstitutionalTimeline` rows (decision / affiliation /
  representation / governance-event / lineage / epoch entries) as a vertical archival rail
  grouped by year-month.
- ✅ **Lineage explorer** rendering `succession_breakpoint` entries from
  `buildContinuityTimeline` as a vertical predecessor → successor breadcrumb chain.
- ✅ **Continuity pathway** rendering non-breakpoint `ContinuityEntry` rows grouped by entity.
- ✅ **Evidence-linked timeline** rendering `buildEvidenceConvergence` per-decision cards
  with evidence / knowledge / policy reference **counts and ID lists** — no content snippets,
  no summaries.
- ✅ **Provenance coverage strip** rendering `summarizeProvenanceCoverage` — six integer
  counts, nothing else.
- ✅ **Observability snapshot footer** rendering `collectInstitutionalObservability(graph, {
  enabled })` — gated counts-only snapshot. When the gate is off, renders a calm
  "observability snapshot is gated" label.
- ✅ **Empty-substrate default.** The adapter returns `{ nodes: [], edges: [], decisions: [] }`
  by default, so every panel renders a calm governance-safe empty state out of the box. The
  real DB → IGG adapter is a discrete future workstream — explicitly out of WS G scope.

## Validation — acceptance gates

| Gate | Result |
|---|---|
| `pnpm narrative:audit` (root) | hard-fail = 0 · rule-failures = 0 · maturity = 88/100 · files = 96 · warnings = 229 |
| `pnpm --filter @nzila/union-eyes narrative:check` | clean (identical hard-fail = 0) |
| `pnpm --filter @nzila/institutional-governance-graph test` | **118 / 118** across 9 files (unchanged from Phase 4 baseline) |
| `pnpm typecheck` (root, `turbo typecheck`) | **224 / 224 successful** · 206 cached · 57.5s · exit 0 |

## Out-of-scope (deferred — not WS G)

- Real `InstitutionalGovernanceSourceAdapter` wiring against the union-eyes DB. (WS G ships the
  empty-substrate placeholder; the adapter is a discrete data-layer workstream.)
- Per-decision drill-through into underlying records.
- Multi-tenant filtering UX. (The route is org-scoped via existing auth-guard context.)
- Bilingual lockstep on the new strings (deferred to a focused i18n pass — copy is currently
  English-only, doctrine-aligned).
- Wiring `OBSERVABILITY_DOCTRINE_REQUIRED` into a maturity rule (maturity already passes; this
  is a future tightening lever).

## Lineage to prior workstreams

| WS | Anchor delivered to WS G |
|---|---|
| A–C | Doctrine fence, protected-semantic taxonomy, narrative governance ontology. |
| D | Module semantic audit; institutional-memory framing. |
| E | i18n catalogue uplifted to chronology / continuity / institutional-memory ontology. |
| F | Inline runtime copy converged on reviewer-led continuity language; internal-narrative glob coverage extended. |
| **G** | Substrate-anchored read surface for IGG Phase 4 — chronology, lineage, continuity, evidence, provenance, observability snapshot — all read-only, all doctrine-fenced. |
