# Workstream K — Institutional Topology UX Audit (Step 1)

> Discovery & substrate map for transforming the Institutional Governance Graph
> (IGG) topology substrate into usable institutional mental models — hierarchy,
> affiliation, delegation, representation continuity, committee lineage,
> governance ancestry, and continuity-aware topology surfaces.
>
> **Scope guardrail (verbatim from charter):**
> Not graph-theater visualization, not social network mapping, not
> organizational analytics, not governance intelligence tooling, not influence
> visualization, not enterprise hierarchy dashboards, not AI topology systems.
> Surfaces must remain **governance-safe, inspectable, continuity-aware**.

---

## Part A — Substrate Map

### A.1 Package surface

`@nzila/institutional-governance-graph` is a **read-only, IO-free** package.
Its public surface (from [packages/institutional-governance-graph/src/index.ts](../../packages/institutional-governance-graph/src/index.ts)) groups into:

| Layer | Modules |
|---|---|
| Ontology | `ontology/kinds`, `ontology/canonicalization` |
| Lifecycle | `lifecycle/normalize` |
| Adapters | `adapters/source-adapter` |
| Projection | `projection/organizations`, `projection/affiliations`, `projection/voting`, `projection/representation`, `projection/build` |
| Delegation | `delegation/resolver` |
| Decisions | `decisions/mapper` |
| Governance (Phase 3) | `governance/protected`, `governance/chronology`, `governance/queries` |
| Governance (Phase 4) | `governance/timeline`, `governance/evidence`, `governance/continuity`, `governance/trust` |
| Observability | `observability/snapshot` |

### A.2 Read-only query API ([governance/queries.ts](../../packages/institutional-governance-graph/src/governance/queries.ts))

Six pure functions over a `GovernanceGraphProjection`:

| Function | Returns | UX use |
|---|---|---|
| `hierarchyAncestors(projection, nodeId)` | ordered ancestor node ids | Hierarchy crumb / ancestry rail |
| `hierarchyDescendants(projection, nodeId)` | descendant node ids | Sub-tree expand panel |
| `continuityCohort(projection, organizationId)` | members with continuity-linked edges | Affiliation + representation cohort surface |
| `eligibleVotersFor(projection, organizationId)` | voter node ids | Delegation pathway substrate |
| `dependencyClosure(projection, nodeId)` | transitive dependency set | Continuity-aware topology view |
| `nodesOfIggKind(projection, kind)` | node subset | Kind-scoped panels |

Doctrine note inside the file (verbatim):
> *Permitted: Lineage, Hierarchy, Continuity, Eligibility, Chronology,
> Dependency. FORBIDDEN: Predictive / influence / caucus / profiling /
> behavioural / optimization queries.*

### A.3 Protected fence ([governance/protected.ts](../../packages/institutional-governance-graph/src/governance/protected.ts))

| Set | Members |
|---|---|
| `IGG_PROTECTED_ENTITY_KINDS` | `CLASS_B_SPECIAL_VOTING_SHARE`, `RESERVED_MATTER` |
| `IGG_PROTECTED_RELATIONSHIP_KINDS` | `VETOES`, `HOLDS`, `OVERRIDES` |
| `IGG_PROTECTED_EVENT_KINDS` | `CLASS_B_VETO`, `GOLDEN_SHARE_SUNSET_PROGRESSION`, `RESERVED_MATTER_RAISED` |
| `IGG_PROTECTED_DECISION_CATEGORIES` | `class_b_veto`, `reserved_matter_vote` |

Two enforcement points:

- `assertNoProtectedKindsInReadSurface(projection)` — substrate guard.
- `assertNoProtectedKindsInProjections(entries, context)` — projection guard
  that scans `category`, `kind`, and `summary` fields.

The fence is explicitly described as *"a derivation rule, not an
access-control system"*. Every WS K UX surface must call `redactProtected`
on incoming nodes/edges and gate every observability panel with the
projection guard.

### A.4 Composition orchestrator ([projection/build.ts](../../packages/institutional-governance-graph/src/projection/build.ts))

`buildGovernanceGraphProjection(adapter)` resolves seven adapter calls in
parallel and returns:

```
GovernanceGraphProjection {
  nodes, edges, decisions, delegationResolutions,
  stats: {
    organizationCount, hierarchyEdgeCount, affiliationEdgeCount,
    eligibilityEdgeCount, delegationEdgeCount, representationEdgeCount,
    decisionCount
  }
}
```

The `stats` block is the **only** numeric surface WS K may render — and
only as integers. No derived ratios, scores, rankings, or trends.

### A.5 Continuity / lineage / explainability builders

| Module | Exports relevant to WS K |
|---|---|
| [governance/chronology.ts](../../packages/institutional-governance-graph/src/governance/chronology.ts) | `orderDecisionsChronologically`, `chronologyForEntity`, `lineageChain` |
| [governance/continuity.ts](../../packages/institutional-governance-graph/src/governance/continuity.ts) | `buildContinuityTimeline`, `successionBreakpoints`, `continuityForEntity`, `continuityForOrganization`, `continuityLineage` |
| [delegation/resolver.ts](../../packages/institutional-governance-graph/src/delegation/resolver.ts) | `resolveDelegationChains` (`DelegationResolutionState`) |
| [governance/trust.ts](../../packages/institutional-governance-graph/src/governance/trust.ts) | `buildExplainabilityRecords`, `explainabilityForDecision`, `explainabilityForEntity`, `summarizeProvenanceCoverage` |

### A.6 Consumer surface (`apps/union-eyes`)

Sole IGG consumer is
[apps/union-eyes/lib/institutional-observability/source.ts](../../apps/union-eyes/lib/institutional-observability/source.ts)
which wraps the package behind `getInstitutionalObservabilityView()` and
returns an `InstitutionalObservabilityView` shaped for the dashboard.

Adjacent `apps/union-eyes/lib/` directories are non-IGG (governance
middleware OTel, representation, narratives, storytelling, trust UI shells).

### A.7 Dashboard route inventory (12 routes under `app/[locale]/dashboard/`)

`admin/governance/`, `continuity-intelligence/`, `continuity-planning/`,
`continuity-simulation/`, `governance/`, `governance-center/`,
`governance-culture/`, `governance-recommendations/`,
`institutional-intelligence/`, `institutional-memory/`,
`institutional-observability/`, `institutional-operating-intelligence/`.

Only `institutional-observability/` currently consumes IGG. All other
routes are candidates for WS K topology panels (hierarchy, affiliation,
delegation, lineage, continuity-aware structures).

---

## Part B — Reference UX pattern

[apps/union-eyes/app/[[]locale[]]/dashboard/institutional-observability/page.tsx](../../apps/union-eyes/app/[locale]/dashboard/institutional-observability/page.tsx)
is the **canonical WS K template**. Properties every WS K surface must inherit:

- Server component; `await requireUser()` guard.
- Six panels: chronology rail · lineage explorer · continuity pathway ·
  evidence-linked timeline · provenance coverage · observability snapshot.
- Tailwind primitives: `PANEL`, `EMPTY`, `SECTION_HEADER`.
- **Integers only**; missing values render `—`. No charts, no gauges, no
  scores, no trends.
- Observability snapshot panel gated by `IGG_OBSERVABILITY_ENABLED=1`.
- Footer doctrine note (verbatim):
  > *This surface is governance-safe transparency over preserved
  > institutional records. It does not evaluate, rank, predict, or
  > recommend. Protected institutional semantics are redacted at the
  > graph layer before reaching this view.*

Every WS K surface MUST carry an equivalent footer.

---

## Part C — Hierarchy UX gap

**Substrate:** `hierarchyAncestors`, `hierarchyDescendants`,
`stats.hierarchyEdgeCount`, `nodesOfIggKind('organization')`.

**Gap:** No UI today exposes ancestor/descendant chains as inspectable
records. Users cannot trace "what governance bodies sit above / below this
organization" without reading source data.

**Proposed surface:** `dashboard/governance/` adds a *Hierarchy ancestry rail*
(ordered ancestor list) + a *Sub-structure list* (descendant list, depth-limited,
no auto-expansion). Both rendered as plain ordered lists in `PANEL` blocks
with integer counts and `—` empties.

---

## Part D — Affiliation & representation UX gap

**Substrate:** `continuityCohort`, `projectAffiliationEdges`,
`projectRepresentationEdges`, `stats.affiliationEdgeCount`,
`stats.representationEdgeCount`.

**Gap:** Representation continuity (who represents whom, and across which
continuity-linked relationships) is computed in the substrate but never
shown as a human-inspectable list.

**Proposed surface:** `dashboard/governance-center/` adds
*Affiliation structure* (cohort membership list per organization) and
*Representation continuity* (representative → represented entity list with
continuity-link annotation). Plain rows; no diagrams.

---

## Part E — Delegation pathways UX gap

**Substrate:** `eligibleVotersFor`, `delegation/resolver` exposing
`DelegationResolution` with `DelegationResolutionState`
(resolved · loop-broken · unresolved).

**Gap:** Delegation chains exist in `projection.delegationResolutions` but
are not surfaced — users cannot inspect *how* a vote eligibility resolves.

**Proposed surface:** `dashboard/governance-center/` adds *Delegation
pathways* — for each resolution, a row with delegator → terminal eligible
voter, intermediate hop count (integer), and resolution state badge text.
Loop-broken and unresolved states render as plain text labels (no color
semantics implying judgment).

---

## Part F — Committee / governance lineage UX gap

**Substrate:** `lineageChain` (chronology), `continuityLineage`,
`chronologyForEntity`.

**Gap:** Committee provenance ("this body succeeded that body") and
governance ancestry are derivable but not visible in any dashboard route.

**Proposed surface:** `dashboard/institutional-memory/` adds *Governance
lineage* — for a selected entity, an ordered lineage chain (ancestor body
→ … → current body) with chronology timestamps. Integer hop count.

---

## Part G — Continuity-aware topology UX gap

**Substrate:** `dependencyClosure`, `buildContinuityTimeline`,
`continuityForOrganization`, `successionBreakpoints`.

**Gap:** Continuity dependencies (which structures must persist for this
body to remain operative) and succession breakpoints are computed but not
rendered as inspectable institutional structures.

**Proposed surface:** `dashboard/continuity-intelligence/` adds
*Continuity-aware topology* — dependency closure list per organization +
succession breakpoint list (timestamped, plain text). Integer counts only.

---

## Part H — Explainability overlays

**Substrate:** `buildExplainabilityRecords`, `explainabilityForEntity`,
`explainabilityForDecision`, `summarizeProvenanceCoverage`.

**Gap:** WS K topology surfaces (Parts C–G) need a uniform "why is this
relationship here?" overlay so every rendered edge/row can show its
provenance record on demand.

**Proposed pattern:** every WS K row includes a small *Provenance* expand
slot rendering the matching `ExplainabilityRecord` fields verbatim
(no summarization, no inference). Provenance coverage panel reuses
`summarizeProvenanceCoverage` (integers only).

---

## Part I — Forbidden vocabulary (WS K narrative gate)

The following terms must remain absent from all WS K code, copy, comments,
and reports. They are forbidden because they reframe governance-safe
topology as analytics, intelligence, or optimization tooling:

- influence analysis, influence network, influence visualization
- organizational intelligence, organizational analytics, organizational monitoring
- governance analytics, governance optimization, governance command systems
- topology optimization, social topology, social graph
- institutional scoring, institutional monitoring
- behavioural governance, leadership analytics, leadership mapping
- power relationships, enterprise hierarchy dashboards
- AI topology, graph theater, network mapping

These extend `tooling/narrative/forbidden-vocabulary.ts` in WS K Step 2.

---

## Part J — Rewarded vocabulary (WS K narrative gate)

The following terms are the canonical WS K vocabulary and must appear in
the code, copy, and reports:

- institutional topology
- continuity pathways
- governance lineage
- procedural ancestry
- chronology, provenance, explainability
- continuity-aware structures
- inspectable institutional relationships
- governance-safe visibility
- representation continuity
- affiliation structure
- institutional hierarchy
- continuity-linked relationships
- preserved institutional records

These extend `tooling/narrative/required-vocabulary.ts` in WS K Step 2.

---

## Part K — Ten-question acceptance grid

| # | Question | Acceptance gate |
|---|---|---|
| 1 | Does the surface expose only IGG read-only queries (Part A.2)? | No new query helpers; no IO. |
| 2 | Is the protected fence enforced before render? | `redactProtected` + `assertNoProtectedKindsInProjections` called at the source boundary. |
| 3 | Are all numerics integers from `projection.stats` or substrate counts? | No ratios, no scores, no trends, no derived metrics. |
| 4 | Are empty values rendered as `—`? | Visual audit. |
| 5 | Is the page a server component behind `requireUser()`? | Match institutional-observability template. |
| 6 | Does the footer carry the verbatim doctrine note (Part B)? | String match in test. |
| 7 | Are any forbidden vocabulary terms (Part I) present? | `pnpm narrative:audit` ≥85, 0 hard-fail. |
| 8 | Are rewarded vocabulary terms (Part J) present in copy? | `pnpm narrative:check --ci`. |
| 9 | Do package + app type checks pass? | `pnpm typecheck`. |
| 10 | Do IGG package tests still pass? | `pnpm --filter @nzila/institutional-governance-graph test`. |

---

## Step 1 conclusion

Substrate is complete and read-only. The `institutional-observability`
page is a faithful template for every remaining WS K surface. WS K reduces
to (a) extending narrative vocabulary lists, (b) authoring five new
panels (hierarchy, affiliation/representation, delegation, lineage,
continuity-aware topology) across four existing dashboard routes, and
(c) wiring an explainability overlay reused across all five — each
gated by the protected fence and the ten-question acceptance grid above.

