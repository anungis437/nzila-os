# Governance Graph — Phase 2 Readiness (Phase 1)

> A scorecard. What is ready, what is missing, and what must be agreed *before* Phase 2 begins. Phase 2 itself is **not** specified here.

This deliverable closes Phase 1. It is the handoff document.

---

## 1. Readiness scorecard

| Capability the IGG needs | Status | Where it is today |
|---|---|---|
| Generic node substrate | ✅ Ready | `@nzila/platform-entity-graph → EntityNode` |
| Generic edge substrate | ✅ Ready | `@nzila/platform-entity-graph → EntityEdge` |
| Subgraph / neighbor / path queries | ✅ Ready | `EntitySubgraph`, `NeighborResult`, `RelationshipPath` |
| Persistent store interface | ✅ Ready | `EntityGraphStore` |
| Decision substrate (with policy/evidence/knowledge refs, reasoning, confidence) | ✅ Ready | `@nzila/platform-decision-graph → DecisionNode` |
| Decision-edge kinds (`depends_on`, `overrides`, `escalated_to`, `triggered_by`, `informed_by`) | ✅ Ready | `@nzila/platform-decision-graph → DecisionEdge` |
| Decision trail | ✅ Ready | `DecisionTrail` |
| Ontology registry, relationships, validators | ✅ Ready (additive registration needed) | `@nzila/platform-ontology` |
| Org tree (Platform → Congress → Federation → Union → Local → Region → District) | ✅ Ready | [db/schema-organizations.ts](../../apps/union-eyes/db/schema-organizations.ts) |
| Federation/affiliation lifecycle | ✅ Ready | `db/schema/congress-memberships-schema.ts` |
| Workplace structure (employer, worksite, bargaining unit, committee) | ✅ Ready | `db/schema/union-structure-schema.ts` |
| Parliamentary procedure (motions, quorum) | ✅ Ready | `db/schema/committee-workspace-schema.ts` |
| Voting + delegation + anonymized vote storage | ✅ Ready (transitive closure latent) | `db/schema/voting-schema.ts` |
| Class B Share, Reserved Matters, sunset | ✅ Ready (text columns, not enums — see risks) | `db/schema/governance-schema.ts` |
| Negotiation lifecycle + CBA lineage | ✅ Ready | `db/schema/bargaining-negotiations-schema.ts` |
| Steward / LRO / officer assignments + tenure | ✅ Ready | `union-structure-schema.ts → stewardAssignments`, `roleTenureHistory` |
| Representation pluralism | ✅ Ready (in JSON, opaque to platform) | `apps/union-eyes/lib/representation/protocol-types.ts` |
| Governance enforcement / runtime / OTel / review / telemetry | ✅ Ready | `@nzila/governance*` family |
| Audit + Evidence + Continuity | ✅ Ready | `@nzila/audit`, `@nzila/evidence`, `@nzila/continuity-*` |
| CLC and union intelligence consumers | ✅ Ready | `@nzila/clc-decision-intelligence`, `@nzila/clc-executive-intelligence`, `@nzila/ue-cognition`, `@nzila/ue-assistant` |
| **Projection layer (FK schema → IGG nodes/edges/decisions)** | ❌ Missing | Phase 2 scope |
| **Canonical IGG names registered in `@nzila/platform-ontology`** | ❌ Missing | Phase 2 scope |
| **Uniform lifecycle vocabulary across the projection** | ❌ Missing | Phase 2 scope |
| **Delegation transitive closure resolver** | ❌ Missing | Phase 2 scope |
| **Vocabulary unification across `canadian-` / `cupe-` / `quebec-`** | ⚠️ Partial | Optional pre-Phase-2 hygiene |
| **Class B / Reserved Matter columns promoted from text → pgEnum** | ⚠️ Optional | Optional pre-Phase-2 hygiene |

> **Score: 70% modeled, 0% projected.**
>
> The institution exists in the schema. The graph does not exist yet because nothing reads the schema as a graph.

---

## 2. What is missing (the four gaps)

### Gap 1 — Projection layer

There is no code today that reads `congress_memberships`, `voter_eligibility`, `golden_shares`, `reserved_matter_votes`, `negotiations`, `committeeMotions`, etc., and emits them as `EntityNode` / `EntityEdge` / `DecisionNode` rows. This is the central Phase 2 build.

### Gap 2 — Canonical names in the ontology

`@nzila/platform-ontology` does not yet register IGG node kinds (`congress`, `federation`, `union`, `local`, `bargaining_unit`, `committee`, `motion`, `voting_session`, `golden_share`, `reserved_matter`, `cba`) or edge kinds (`affiliated_with`, `delegates_to`, `represents`, `bargains_for`, `negotiates`, `supersedes`, `vetoes`, `holds`, `tenured_as`, `governed_by`). Without registration, the substrate has no shared vocabulary.

### Gap 3 — Delegation transitive closure

`voter_eligibility.canDelegate / delegatedTo / votingWeight` exists today as **flat rows**. There is no resolver that composes a delegation chain (A → B → C) into a single effective `casts` edge with cumulative weight. Delegation is the single most under-modeled primitive in the institution today.

### Gap 4 — Uniform lifecycle vocabulary

Different schemas use different lifecycle words: `active`/`suspended`/`expired`/`pending` (affiliations); `active`/`sunset_triggered`/`converted`/`dormant` (golden share); `carried`/`defeated`/`tabled`/`withdrawn` (motions); `approved`/`rejected_class_a`/`vetoed_class_b` (reserved matters). The IGG projection must expose a *uniform lifecycle vocabulary* without changing the underlying enums.

---

## 3. Pre-Phase-2 prerequisites (no code changes required)

These are the things to **agree on** before Phase 2 begins. None of them require touching the codebase.

1. **Lexicon agreement.** Confirm the canonical names in [governance-graph-domain-language.md](governance-graph-domain-language.md). Once confirmed, that file becomes the source of truth for ontology registration, locale label keys, and consumer surface naming.
2. **Boundary agreement.** Confirm the ownership lines in [governance-graph-recommended-boundaries.md](governance-graph-recommended-boundaries.md). In particular, confirm that the IGG is a **read projection** and that writes continue to flow into existing union-eyes tables.
3. **Projection-layer home.** Decide between `packages/institutional-governance-graph/` and `apps/union-eyes/lib/igg/`. Recommendation: a new package, to keep the read-model reusable across apps. Defer this decision to Phase 2 kickoff if useful.
4. **Lifecycle vocabulary.** Agree on the uniform lifecycle terms the projection will expose (e.g. `active`, `dormant`, `sunset`, `terminated`, `pending`, `provisional`). The underlying enums stay as they are; the projection translates.
5. **Constitutional act recognition.** Agree that the following are *first-class decisions* in the IGG: motion outcomes, voting-session conclusions, CBA ratifications, Class B vetoes, golden-share sunset progressions, protocol amendments. Each becomes a `DecisionNode` with full evidence/policy refs.
6. **Representation-protocol primacy.** Agree that the projection layer **always** consults the active `RepresentationProtocol` (steward-led vs LRO-led) before materializing `represents` edges. Pluralism is not a feature flag; it is a structural rule.

---

## 4. Optional pre-Phase-2 hygiene (small, value-preserving)

These are *not* required, but they would make Phase 2 cleaner. Each is additive and does not break callers.

| Hygiene item | Effort | Why it helps |
|---|---|---|
| Promote `golden_shares.holderType / status` from `text + comment` to `pgEnum`. | Small | Type-safety on the most constitutionally important rows. |
| Promote `reserved_matter_votes.matterType / finalDecision` to `pgEnum`. | Small | Same reasoning. |
| Add `db/schema/voting-schema.ts` CHECK-constraint values to a shared `as const` export. | Tiny | Lets the projection import canonical values instead of re-typing them. |
| Add an index on `voter_eligibility(delegatedTo, votingSessionId)`. | Tiny | Required by any future delegation transitive-closure query. |

> None of the above changes runtime behavior. None are required for Phase 2 to begin.

---

## 5. Risks to revisit at Phase 2 kickoff

These are documented in [governance-graph-collision-risks.md](governance-graph-collision-risks.md) and bear repeating here as gates:

1. Five enum styles coexist — the projection must translate, not enforce.
2. Two parallel "graph" surfaces (substrate + FK schema) — projection must choose where to live (read side, not write side).
3. `RepresentationProtocol` is JSON in `org_configurations` — projection must consult it; do not assume defaults.
4. Delegation chains are latent — projection must close them.
5. Golden-share / Reserved-Matter columns are `text` — projection must validate at the boundary.

Containment over rewrite is the rule. Every collision is solvable in the projection layer.

---

## 6. Explicit non-scope for Phase 2 (as currently understood)

> Phase 2 is **not** specified in this document.

The following are deliberately *not* committed here, and remain open questions for Phase 2 kickoff:

- The exact wire shape of projected `EntityNode` / `EntityEdge` / `DecisionNode` rows.
- The cadence of projection (event-driven vs scheduled vs hybrid).
- The query surface (GraphQL? RPC? Direct repository?).
- Which consumer surface lights up first (CLC dashboards? UE assistant? Governance review queue?).
- Whether the projection persists into `entity_graph` storage or is computed on demand.
- Whether `RepresentationProtocol` gets promoted from JSON to a typed table.

These are Phase 2 design decisions. Phase 1 deliberately leaves them open.

---

## 7. Phase 1 closure checklist

| Item | Status |
|---|---|
| Audit of repo evidence for IGG primitives | ✅ [governance-graph-audit.md](governance-graph-audit.md) |
| Ontology map (nodes, edges, events, properties) | ✅ [governance-graph-ontology-map.md](governance-graph-ontology-map.md) |
| Collision and containment risks | ✅ [governance-graph-collision-risks.md](governance-graph-collision-risks.md) |
| Integration / reuse opportunities | ✅ [governance-graph-integration-opportunities.md](governance-graph-integration-opportunities.md) |
| Recommended boundaries | ✅ [governance-graph-recommended-boundaries.md](governance-graph-recommended-boundaries.md) |
| Domain language (lexicon) | ✅ [governance-graph-domain-language.md](governance-graph-domain-language.md) |
| Phase 2 readiness scorecard | ✅ this document |
| Index / TOC | ✅ [README.md](README.md) |
| Code modifications | ⛔ **None.** Phase 1 is audit-only. |

---

## 8. One-line summary

> **The Institutional Governance Graph is 70% already-built and 0% already-projected. The next move is not to build a graph; it is to agree on names and seams, then write a single read-side projection layer over the schema that already exists.**
