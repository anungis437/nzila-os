# Workstream L — Governance Chronology UX Audit

**Status:** Step 1 of 11 — substrate readiness audit prior to chronology UX implementation.
**Scope:** Transform the Institutional Governance Graph (IGG) chronology substrate into a usable temporal interface layer through procedural timelines, institutional evolution, chronology inspection, decision lineage, continuity progression, governance epochs, and provenance-linked institutional history.
**Posture:** Chronology-aware, governance-safe, inspectable. **Not** activity feeds, analytics, monitoring, replay, scoring, or oversight dashboards.

---

## 1. Substrate Readiness Map

The IGG already exposes a complete chronology substrate behind the protected-fence (`redactProtected → assertNoProtectedKindsInReadSurface → build* → assertNoProtectedKindsInProjections`). All chronology UX surfaces are additive read-only projections and require **no** new substrate primitives — only routes, panels, vocabulary, and design components.

| UX Target | IGG Substrate Function(s) | Module |
|---|---|---|
| Procedural decision rails | `chronologyForEntity`, `orderDecisionsChronologically` | `governance/chronology.ts` |
| Decision lineage ladders | `lineageChain` (walks `SUPERSEDES` / `OVERRIDES`) | `governance/chronology.ts` |
| Institutional evolution timelines | `buildInstitutionalTimeline`, `timelineForOrganization` | `governance/timeline.ts` |
| Per-decision chronology inspection | `timelineForDecision` | `governance/timeline.ts` |
| Affiliation evolution rails | `timelineForAffiliation` | `governance/timeline.ts` |
| Representation evolution rails | `timelineForRepresentation` | `governance/timeline.ts` |
| Continuity progression | `continuityTimeline`, `buildContinuityTimeline`, `continuityForEntity`, `continuityForOrganization` | `governance/timeline.ts`, `governance/continuity.ts` |
| Succession breakpoints | `successionBreakpoints` | `governance/continuity.ts` |
| Continuity lineage rails | `continuityLineage` | `governance/continuity.ts` |
| Governance epoch markers | `governanceEpochTimeline` (`epoch_marker` kind) | `governance/timeline.ts` |
| Evidence convergence rails | `buildEvidenceConvergence`, `evidenceForDecision`, `evidenceForEntity`, `evidenceForOrganization`, `summarizeCitations` | `governance/evidence.ts` |
| Explainability overlays | `buildExplainabilityRecords`, `explainabilityForDecision`, `explainabilityForEntity`, `summarizeProvenanceCoverage` | `governance/trust.ts` |
| Protected fence | `assertNoProtectedKindsInProjections`, `redactProtected`, `IGG_PROTECTED_*` constants | `governance/protected.ts` |

**Substrate verdict:** Ready. All ten chronology UX surfaces are projectable from existing exports without graph-layer additions.

---

## 2. Audit Questions

### Q1 — Are the procedural-chronology surfaces substrate-ready?

**Yes.** Every targeted chronology surface maps to one or more existing IGG functions (see §1). No new graph primitives, no new edge kinds, no new entity kinds required.

### Q2 — Do the planned UX surfaces use institutional metaphors rather than operational metaphors?

**Required.** Surfaces must read as *procedural history*, *decision lineage*, *continuity progression*, and *governance epochs* — not as feeds, streams, or ticks. Vocabulary governance (Part I) enforces this by extending forbidden-vocabulary tooling.

### Q3 — Is there activity-feed drift risk?

**High default risk; mitigated by design rules.** A naive chronological list of decisions reads as a "feed". Mitigations: (a) entries grouped by *epoch* and *lineage*, not by recency; (b) no "new" / "unread" / "live" affordances; (c) no notification badges; (d) no auto-refresh; (e) entries are inspection rails, not action surfaces.

### Q4 — Are chronology surfaces continuity-safe?

**Yes, by construction.** Continuity surfaces project `continuityTimeline` + `successionBreakpoints` + `continuityLineage`, which are inherently institutional (succession, tenure, lineage) rather than personnel-tracking. The protected fence redacts protected entity / relationship / event / decision-category kinds *before* projection, so no internal-only continuity semantics can leak.

### Q5 — Is explainability required on every chronology entry?

**Yes.** Every rendered chronology entry must expose `evidenceRefs` / `knowledgeRefs` / `policyRefs` (from `EvidenceConvergenceEntry`) or its `ExplainabilityRecord` (from `trust.ts`). Entries with zero provenance render an `EMPTY` provenance affordance — they do not get hidden, but they are visually marked as unattested.

### Q6 — Are any governance semantics rendered implicitly?

**No.** All decision categories, edge kinds, and event kinds rendered to the UI must come through `applyOptions` + `assertNoProtectedKindsInProjections`. The UI never infers, never re-derives, never re-categorises.

### Q7 — Is the chronology surface cognitively overwhelming?

**Risk: High if rendered as a flat per-decision list.** Mitigations: (a) default view is *epoch-grouped*, not flat; (b) `since` / `until` / `kinds` options from `InstitutionalTimelineOptions` exposed as inspection filters (not analytics filters); (c) lineage ladders collapse by default to head + immediate predecessor; (d) per-entity chronology rails default to the entity's own decisions, not the organisation's full timeline.

### Q8 — How are governance epochs rendered?

**As markers, not as periods.** The `epoch_marker` kind in `InstitutionalTimelineEntryKind` is rendered as a horizontal divider with epoch label and `occurredAt`. Epoch markers do not get start / end ranges, do not get duration calculations, and do not get inter-epoch comparison affordances.

### Q9 — What is the overreach risk?

**Three identified risks:**

1. *Surveillance drift* — if per-actor chronology rails are exposed. **Mitigation:** chronology rails are per-*entity* (organisation, agreement, decision lineage) only, never per-actor.
2. *Predictive drift* — if "next decision" / "expected supersession" affordances are added. **Mitigation:** forbidden by Part F; explainability overlays are retrospective only.
3. *Ranking drift* — if epochs or lineages are sorted by impact / outcome / score. **Mitigation:** sort is `occurredAt` ascending only; no scoring fields rendered.

### Q10 — Do the surfaces preserve procedural legitimacy?

**Yes.** Every chronology entry traces to a decision, an edge, or an institutional event preserved in the IGG. No synthetic entries, no inferred entries, no aggregated entries. The chronology UX is a *window onto preserved institutional records*, not a constructed narrative.

---

## Part A — Procedural Timelines

**Substrate:** `buildInstitutionalTimeline`, `timelineForOrganization`, `applyOptions`, `sortAscending`.
**Surface:** Organisation-scoped procedural timeline rendered as an epoch-grouped vertical rail of `InstitutionalTimelineEntry` nodes (decision / affiliation / representation / governance_event / lineage / epoch_marker).
**Host route:** `apps/union-eyes/app/[locale]/dashboard/institutional-memory/`.
**Filters:** `since`, `until`, `kinds` — surfaced as inspection filters, never as analytics filters.
**Rules:** No "new since last visit", no count badges, no aggregations, no per-period rollups.

## Part B — Institutional Evolution

**Substrate:** `timelineForOrganization`, `timelineForAffiliation`, `timelineForRepresentation`.
**Surface:** Three parallel evolution rails (organisation, affiliation, representation) showing how institutional structure has changed across preserved decisions and edges.
**Host route:** `institutional-memory/` (evolution panel).
**Rules:** Evolution rails render entity refs and edge IGG kinds verbatim from the substrate. No "trend" language. No "change rate" metrics.

## Part C — Decision Lineage

**Substrate:** `lineageChain` (walks `IggRelationshipKinds.SUPERSEDES` / `OVERRIDES`), `chronologyForEntity`, `orderDecisionsChronologically`.
**Surface:** Lineage ladder showing decision → predecessor → predecessor… with each rung carrying decision id, `occurredAt`, summary, status, and provenance refs.
**Host route:** `institutional-memory/` (lineage panel) and per-decision drill into `timelineForDecision`.
**Rules:** Cycle-safe (already enforced in `lineageChain`); collapsed by default to head + immediate predecessor; expand reveals full chain.

## Part D — Continuity Progression

**Substrate:** `buildContinuityTimeline`, `continuityForEntity`, `continuityForOrganization`, `continuityLineage`, `successionBreakpoints`.
**Surface:** Continuity rail showing tenure, succession breakpoints, and continuity lineage as a procedural progression (institutional, not personnel).
**Host route:** `apps/union-eyes/app/[locale]/dashboard/continuity-intelligence/`.
**Rules:** Succession breakpoints render as markers with `occurredAt` and institutional summary only — never as performance evaluations, never as personnel comparisons.

## Part E — Governance Epochs

**Substrate:** `governanceEpochTimeline`, `epoch_marker` kind in `InstitutionalTimelineEntryKind`.
**Surface:** Horizontal epoch dividers within procedural / continuity / evolution rails. Epoch label + `occurredAt` + summary.
**Host route:** `continuity-intelligence/` (epochs panel).
**Rules:** Markers, not periods. No epoch-to-epoch comparison. No epoch ranking. No epoch-scoped aggregations.

## Part F — Chronology Explainability

**Substrate:** `buildExplainabilityRecords`, `explainabilityForDecision`, `explainabilityForEntity`, `summarizeProvenanceCoverage`, `EvidenceConvergenceEntry` (`evidenceRefs`, `knowledgeRefs`, `policyRefs`), `summarizeCitations`.
**Surface:** Per-entry explainability overlay — provenance refs, citation summary, coverage indicator. Entries with zero provenance render an `EMPTY` provenance affordance.
**Host route:** `institutional-observability/` (explainability overlay panel) and inline within every chronology rail.
**Rules:** Retrospective only — explainability is for what happened, never for what *will* / *should* happen. No predictive overlays. No recommendation overlays.

## Part G — Protected Governance Semantics

**Substrate:** `IGG_PROTECTED_ENTITY_KINDS`, `IGG_PROTECTED_RELATIONSHIP_KINDS`, `IGG_PROTECTED_EVENT_KINDS`, `IGG_PROTECTED_DECISION_CATEGORIES`, `assertNoProtectedKindsInProjections`, `redactProtected`.
**Surface:** Fence is invisible to the UI. UI never branches on `isProtected` — by the time entries reach the page component, all protected kinds have been redacted.
**Host route:** All chronology routes.
**Rules:** Page components must call substrate functions that internally apply the fence (e.g. `buildInstitutionalTimeline`, not raw graph access). Add `protected-projections` guard tests asserting that no protected kind appears in any projected entry across all chronology surfaces.

## Part H — Design System Alignment

**Components to add / extend:**

- `ChronologyRail` — vertical epoch-grouped list of entries.
- `LineageLadder` — collapsible predecessor chain.
- `ContinuityRail` — continuity-specific rail with succession breakpoint markers.
- `EpochDivider` — horizontal marker with label + `occurredAt`.
- `ExplainabilityChip` — provenance refs + coverage indicator (or EMPTY affordance).
- Reuse existing `PANEL`, `EMPTY`, `SECTION_HEADER` from observability template.
**Rules:** No animation suggesting motion-through-time (no scrubbing, no playback). No "live" indicators. No densities that read as feeds.

## Part I — Terminology Governance

**Forbidden vocabulary (extend `tooling/narrative/forbidden-vocabulary.ts`):**
> activity stream, operational replay, governance analytics, productivity timeline, behavioural chronology, organizational monitoring, executive oversight timeline, governance optimization chronology, institutional scoring, timeline analytics

**Rewarded themes (extend `tooling/narrative/required-vocabulary.ts`):**
> governance chronology, continuity progression, procedural history, chronology lineage, governance epochs, provenance, explainability, continuity-aware chronology, institutional evolution, preserved institutional records

**Gate:** `pnpm narrative:audit` must remain ≥ 85 with 0 hard-fail across all WS L pages and panels.

## Part J — Observability & Topology Convergence

WS L composes with WS J (observability) and WS K (topology):

- WS J observability panels gain a chronology overlay (per-entity rail) sourced from `chronologyForEntity`.
- WS K topology panels gain a per-node lineage drill sourced from `lineageChain` and `continuityLineage`.
- WS L chronology pages gain a topology context strip sourced from WS K queries (`hierarchyAncestors`, `continuityCohort`).

**Convergence host:** `institutional-observability/` exposes all three lenses (observability + topology + chronology) as parallel panels under a shared org / entity context.

## Part K — Runtime Narrative Governance Expansion

Step 11 of WS L will:

- Extend `forbidden-vocabulary.ts` with the Part I forbidden list.
- Extend `required-vocabulary.ts` with the Part I rewarded themes.
- Add CI gate assertions that `narrative:audit` covers `dashboard/institutional-memory/`, `dashboard/continuity-intelligence/`, `dashboard/institutional-observability/` and emits ≥ 85 with 0 hard-fail.
- Author `reports/governance-graph/workstream-l-governance-chronology-ux-implementation.md` summarising deliverables, gates, and convergence with WS J / WS K.

---

## 3. Routes Inventory (Pre-Implementation)

| Route | Current Role | WS L Role |
|---|---|---|
| `dashboard/institutional-memory/` | Institutional memory landing | Procedural timelines, institutional evolution, decision lineage |
| `dashboard/continuity-intelligence/` | Continuity overview | Continuity progression, governance epochs |
| `dashboard/institutional-observability/` | Observability snapshot (WS J host) | Chronology explainability overlays, convergence host |
| `dashboard/continuity-planning/` | Continuity planning | (Out of scope — planning is forward-looking; WS L is retrospective only) |

---

## 4. Step-by-Step Plan (Steps 2 – 11)

| Step | Deliverable | Substrate |
|---|---|---|
| 2 | Procedural timeline UX (`institutional-memory/` procedural panel) | `buildInstitutionalTimeline`, `timelineForOrganization` |
| 3 | Institutional evolution UX (evolution panel) | `timelineForOrganization`, `timelineForAffiliation`, `timelineForRepresentation` |
| 4 | Decision lineage UX (lineage panel + per-decision drill) | `lineageChain`, `chronologyForEntity`, `timelineForDecision` |
| 5 | Continuity progression UX (`continuity-intelligence/` progression panel) | `buildContinuityTimeline`, `continuityForOrganization`, `continuityLineage`, `successionBreakpoints` |
| 6 | Governance epoch rendering (epochs panel + epoch dividers across rails) | `governanceEpochTimeline`, `epoch_marker` kind |
| 7 | Chronology explainability overlays (provenance chips on every entry) | `buildExplainabilityRecords`, `summarizeProvenanceCoverage`, `summarizeCitations` |
| 8 | Protected chronology visibility guards (extend `protected-projections.test.ts`) | `assertNoProtectedKindsInProjections`, `IGG_PROTECTED_*` |
| 9 | Chronology-aligned design components (`ChronologyRail`, `LineageLadder`, `ContinuityRail`, `EpochDivider`, `ExplainabilityChip`) | (UI only) |
| 10 | Convergence wiring (WS J overlays + WS K drills + WS L context strip) | WS J / WS K queries + WS L projections |
| 11 | Vocabulary extension + implementation report | `tooling/narrative/*`, `narrative:audit` ≥ 85 |

---

## 5. Validation Gates Per Step

- `pnpm narrative:audit` — ≥ 85, 0 hard-fail.
- `pnpm narrative:check --ci`.
- `pnpm typecheck`.
- `pnpm --filter @nzila/institutional-governance-graph test`.
- New `protected-projections.test.ts` cases asserting zero protected kinds in projected chronology entries (Step 8).

---

This surface is governance-safe transparency over preserved institutional records. It does not evaluate, rank, predict, or recommend. Protected institutional semantics are redacted at the graph layer before reaching this view.
