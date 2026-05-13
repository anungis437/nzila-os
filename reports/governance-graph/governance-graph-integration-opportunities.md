# Governance Graph — Integration Opportunities (Phase 1)

> Where existing packages and schemas already do most of the work an Institutional Governance Graph would need. The pattern here is *composition*, not new construction.

This deliverable answers a single question: **for each IGG capability we will eventually need, what already exists in the repo that we should reuse?**

No schema changes are proposed. No new packages are required.

## 1. Substrate: nodes, edges, traversal

| IGG capability | Existing package | What it gives us |
|---|---|---|
| Typed nodes with tenant scope, canonical name, status, lifecycle | `@nzila/platform-entity-graph → EntityNode` | Generic, ontology-driven, Zod-validated. |
| Typed edges with kind, direction, evidence | `@nzila/platform-entity-graph → EntityEdge` | Same substrate. Already polymorphic. |
| Subgraph queries, neighbor lookups, relationship paths | `EntitySubgraph`, `NeighborResult`, `RelationshipPath` | Already shaped to what an IGG read-model exposes. |
| Persistent store contract | `EntityGraphStore` | Repository interface to project IGG into. |

**Reuse plan:** A Phase 2 projection layer reads union-eyes domain tables and emits `EntityNode` / `EntityEdge` rows tagged with IGG-specific `nodeType` / `edgeType` values registered in `@nzila/platform-ontology`. Nothing new is invented at the substrate level.

## 2. Decision-trail capability

| IGG capability | Existing package | What it gives us |
|---|---|---|
| Decisions with policy, evidence, knowledge refs | `@nzila/platform-decision-graph → DecisionNode` | All four fields already exist. |
| Decision relationships (`depends_on`, `overrides`, `escalated_to`, `triggered_by`, `informed_by`) | `DecisionEdge` | Direct fit for institutional acts. |
| Decision trail / lineage | `DecisionTrail` | Already supports the "show me the chain" use case. |
| 12 decision types + Zod schemas | included | Ready to extend with institutional types. |

**Reuse plan:** Class B vetoes, CBA ratifications, strike authorizations, bylaw amendments, and motion outcomes project onto `DecisionNode` on read. The decision-graph already supports lineage; the IGG just needs to feed it.

## 3. Vocabulary and ontology

| IGG capability | Existing package | What it gives us |
|---|---|---|
| Canonical type registry | `@nzila/platform-ontology → registry` | One place to declare IGG node and edge kinds. |
| Relationship kind registry | `@nzila/platform-ontology → relationships` | Same. |
| Schema and validators | `@nzila/platform-ontology → schema`, `validators` | Validation reused, not rewritten. |
| Locale-specific institutional terms | `@nzila/canadian-vocabulary`, `@nzila/cupe-vocabulary`, `@nzila/quebec-vocabulary` | Localization already separated from concepts. |

**Reuse plan:** Add IGG type names (e.g. `congress`, `federation`, `union`, `local`, `bargaining_unit`, `committee`, `motion`, `voting_session`, `golden_share`, `reserved_matter`, `cba`) to `platform-ontology` registries. Vocabulary packages localize the labels, ontology owns the keys.

## 4. Governance enforcement and runtime

| IGG capability | Existing package |
|---|---|
| Policy evaluation surface | `@nzila/governance` |
| Middleware enforcement (HTTP / RPC / job) | `@nzila/governance-middleware` |
| Runtime policy decisions | `@nzila/governance-runtime` |
| Operations-layer governance | `@nzila/governance-operations` |
| OpenTelemetry span emission for governance events | `@nzila/governance-otel` |
| Reviewer workflow | `@nzila/governance-review` |
| Telemetry sink | `@nzila/governance-telemetry` |
| Composable governed workflow | `@nzila/governed-workflow` |
| Doctrine enforcement (rule-as-code) | `@nzila/doctrine-enforcement` |

**Reuse plan:** When the IGG projection emits a Class B veto event, it flows through `governance-runtime` (decision), `governance-otel` (observability), `governance-review` (human signoff if needed), and `governance-telemetry` (metric). Phase 2 wires events; it does not invent the enforcement plumbing.

## 5. Audit and evidence

| IGG capability | Existing package |
|---|---|
| Tamper-evident audit log | `@nzila/audit` |
| Evidence persistence and references | `@nzila/evidence` |
| Continuity observability | `@nzila/continuity-observability` |
| Continuity review | `@nzila/continuity-review` |
| Institutional cognition core | `@nzila/institutional-cognition-core` |

**Reuse plan:** Every IGG-projected institutional act (motion outcome, vote tally, ratification, veto, sunset progression) can be backed by an `@nzila/audit` entry and reference `@nzila/evidence` records. The IGG does not store evidence; it links to it.

## 6. Domain intelligence already aligned with IGG concepts

| IGG capability | Existing package | Notes |
|---|---|---|
| CLC-level decision intelligence | `@nzila/clc-decision-intelligence` | Already operates at the congress tier. |
| CLC-level executive intelligence | `@nzila/clc-executive-intelligence` | Already operates at the congress tier. |
| Union cognition surfaces | `@nzila/ue-cognition` | Already speaks the union vocabulary. |
| Union assistant | `@nzila/ue-assistant` | Conversational surface over the same domain. |

**Reuse plan:** These packages become natural consumers of the IGG read-model. The IGG turns scattered FK joins into one queryable surface; CLC and UE intelligence packages stop hand-rolling those joins.

## 7. Domain-specific schemas already encoding the institution

| IGG capability | Existing schema | Reuse pattern |
|---|---|---|
| Federation membership lifecycle | `db/schema/congress-memberships-schema.ts` | Project to `affiliated_with` edge with status. |
| Org tree + jurisdiction + sector | `db/schema-organizations.ts` | Project to organizational node hierarchy. |
| Workplace structure (employer, worksite, bargaining unit, committee) | `db/schema/union-structure-schema.ts` | Project as nodes with FK-derived edges. |
| Parliamentary procedure (motions, quorum) | `db/schema/committee-workspace-schema.ts` | Project motion outcomes as `DecisionNode`s. |
| Voting + delegation primitives | `db/schema/voting-schema.ts` | Project `delegates_to`, `eligible_to_vote_in`, `casts` edges. |
| Mission-protection / Class B veto | `db/schema/governance-schema.ts` | Project veto as terminal `DecisionNode` with `vetoes` edge. |
| Negotiation + CBA lineage | `db/schema/bargaining-negotiations-schema.ts` | Project `negotiates`, `supersedes` edges; ratification → `DecisionNode`. |
| Steward / LRO / officer assignments | `db/schema/union-structure-schema.ts → stewardAssignments`, `roleTenureHistory` | Project tenure as temporal `represents` edge. |
| Representation pluralism | `apps/union-eyes/lib/representation/protocol-types.ts` + `org_configurations` | IGG projection consults protocol *first* to decide which `represents` edges to materialize. |

## 8. What the IGG does *not* need to build

Because the substrate, decisions, ontology, governance, audit, evidence, telemetry, and CLC/UE intelligence layers already exist, Phase 2 does **not** need to:

- Build a graph database.
- Invent a decision-trail format.
- Invent a tenant model.
- Invent an evidence model.
- Invent an audit model.
- Invent a governance enforcement layer.
- Invent a vocabulary system.

Phase 2 needs to build **one thing**: a projection layer that reads the existing FK schema and emits `EntityNode` / `EntityEdge` / `DecisionNode` / `DecisionEdge` rows under canonical IGG type names registered in `@nzila/platform-ontology`. Everything else is already in the repo.

## 9. Composition map (one-page)

```
                 apps/union-eyes/db/  (source of truth, unchanged)
                        │
                        ▼
   ┌───────────── Phase 2 IGG Projection Layer ─────────────┐
   │  reads FK rows  →  resolves RepresentationProtocol      │
   │                 →  resolves ontology type names         │
   │                 →  emits nodes + edges + decisions      │
   └─────────────────────────────────────────────────────────┘
                        │
       ┌────────────────┼─────────────────┐
       ▼                ▼                 ▼
 platform-entity-  platform-decision-  platform-ontology
 graph             graph               (registry/types)
       │                │
       └────────┬───────┘
                ▼
 governance / governance-runtime / governance-otel / audit / evidence /
 institutional-cognition-core / clc-decision-intelligence / ue-cognition
```

The arrows are all *reads* and *projections*. No arrow points back into `apps/union-eyes/db/`.
