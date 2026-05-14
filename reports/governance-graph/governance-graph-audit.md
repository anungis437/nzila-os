# Governance Graph — Audit (Phase 1)

> What already exists in the repo, in institutional language, with file evidence.

## 1. Executive read

The Institutional Governance Graph (IGG) is **not** a green-field initiative. The Union Eyes app and its supporting platform packages already encode a substantial portion of what a democratic-union governance graph requires — but they encode it as **isolated tables, isolated enums, and isolated subsystems**, not as a single connected institutional fabric.

The audit found five load-bearing primitives already present:

1. A typed organizational hierarchy (`platform → congress → federation → union → local → region → district`).
2. A federation-affiliation edge between organizations (`congress_memberships`).
3. Voting infrastructure with delegate-lineage primitives (`voter_eligibility.canDelegate`, `delegatedTo`, `votingWeight`).
4. Constitutional governance: a Class B Special Voting Share with mission-protection veto rights and a 5-year sunset clause (`golden_shares`, `reserved_matter_votes`).
5. A per-union, configurable representation protocol (`RepresentationProtocol`) that already formalizes the fact that CAPE, CUPE, and steward-led unions do *not* share the same role topology.

Underneath those, two **generic graph substrates** already exist as separate platform packages:

- `@nzila/platform-entity-graph` — `EntityNode`, `EntityEdge`, `EntitySubgraph`, `RelationshipPath`, `NeighborResult`, `EntityGraphStore`.
- `@nzila/platform-decision-graph` — `DecisionNode`, `DecisionEdge`, `DecisionTrail`, with first-class `policyRefs[]`, `evidenceRefs[]`, `knowledgeRefs[]`, `reasoning`, and `confidence`.

These two packages are tenant-scoped, polymorphic, and ontology-driven (via `@nzila/platform-ontology`). **They are the natural substrate for IGG.** Phase 2 should compose on top of them rather than re-invent a graph layer inside `apps/union-eyes`.

## 2. Inventory of governance-relevant artifacts

### 2.1 Schema (Drizzle, PostgreSQL) — `apps/union-eyes/db/`

| Schema file | Institutional meaning | Notable primitive |
|---|---|---|
| [db/schema-organizations.ts](../../apps/union-eyes/db/schema-organizations.ts) | The org tree itself | `organizationTypeEnum` covers `platform / congress / federation / union / local / region / district`; self-FK `parentId`, `hierarchyPath text[]`, `hierarchyLevel int` |
| [db/schema/congress-memberships-schema.ts](../../apps/union-eyes/db/schema/congress-memberships-schema.ts) | Federation affiliation edge | `congress_memberships` is already a typed graph edge with temporal lifecycle (`active / suspended / expired / pending`) |
| [db/schema/union-structure-schema.ts](../../apps/union-eyes/db/schema/union-structure-schema.ts) | Internal union structure | `employers`, `worksites`, `bargainingUnits`, `committees`, `committeeMemberships`, `stewardAssignments`, `roleTenureHistory` |
| [db/schema/committee-workspace-schema.ts](../../apps/union-eyes/db/schema/committee-workspace-schema.ts) | Parliamentary procedure inside committees | Motion outcomes: `carried / defeated / tabled / withdrawn`; `quorumMet` flag |
| [db/schema/voting-schema.ts](../../apps/union-eyes/db/schema/voting-schema.ts) | Membership voting | 8 session types incl. `convention / ratification / strike_authorization / bylaw_amendment`; `voter_eligibility` carries `canDelegate`, `delegatedTo`, `votingWeight`; `votes` are anonymized via `voterHash` + `auditHash` |
| [db/schema/governance-schema.ts](../../apps/union-eyes/db/schema/governance-schema.ts) | Constitutional governance | `golden_shares` (Class B, 51% on Reserved Matters, $1 redemption, 5-year sunset) + `reserved_matter_votes` with `final_decision: approved / rejected_class_a / vetoed_class_b` |
| [db/schema/bargaining-negotiations-schema.ts](../../apps/union-eyes/db/schema/bargaining-negotiations-schema.ts) | Collective bargaining lifecycle | `negotiations` with `expiringCbaId → resultingCbaId` lineage; session types include `caucus`, `conciliation`, `ratification`; team roles include `chief_negotiator`, `legal_counsel`, `subject_expert` |
| [db/schema/clc-partnership-schema.ts](../../apps/union-eyes/db/schema/clc-partnership-schema.ts) | Inter-organizational benchmarking | `clcPerCapitaBenchmarks`, `clcUnionDensity` |

### 2.2 App layer — `apps/union-eyes/lib/`

| File | Role |
|---|---|
| [lib/representation/protocol-types.ts](../../apps/union-eyes/lib/representation/protocol-types.ts) | `RepresentationProtocol` (versioned, persisted as JSON in `org_configurations`); presets `PROTOCOL_STEWARD_LED`, `PROTOCOL_LRO_LED` (CAPE), CUPE preset; representative types `steward / lro / national_rep / officer`; `StewardPermissions` 5-flag matrix |

### 2.3 Platform packages — `packages/`

| Package | Role |
|---|---|
| `@nzila/platform-entity-graph` | Generic semantic graph: `EntityNode`, `EntityEdge`, `EntitySubgraph`, `EntityGraphStore` (tenant-scoped, polymorphic) |
| `@nzila/platform-decision-graph` | Decision lineage: `DecisionNode` with policy / evidence / knowledge refs; `DecisionEdge` types `depends_on / overrides / escalated_to / triggered_by / informed_by`; `DecisionTrail` |
| `@nzila/platform-ontology` | Canonical entity types and relationship types (registry, validators) |
| `@nzila/governance`, `@nzila/governance-runtime`, `@nzila/governance-middleware`, `@nzila/governance-operations`, `@nzila/governance-otel`, `@nzila/governance-review`, `@nzila/governance-telemetry`, `@nzila/governed-workflow` | Existing governance evaluation / observability stack |
| `@nzila/audit`, `@nzila/evidence`, `@nzila/continuity-observability`, `@nzila/continuity-review` | Trust / audit substrate |
| `@nzila/doctrine-enforcement`, `@nzila/institutional-cognition-core` | Doctrinal / institutional reasoning |
| `@nzila/canadian-vocabulary`, `@nzila/cupe-vocabulary`, `@nzila/quebec-vocabulary` | Localized institutional terminology |
| `@nzila/clc-decision-intelligence`, `@nzila/clc-executive-intelligence` | CLC-level analytics |

## 3. What the audit confirms is already real

- **The org tree is hierarchical, not flat.** `organizationTypeEnum` and the self-FK `parentId` admit federations, congresses, regions, and districts as first-class — not as a tag on a flat `organization` record.
- **Federation is already an edge, not a column.** `congress_memberships` decouples "who you are affiliated with" from "who you are," with its own lifecycle.
- **Delegate democracy is already in the data.** `voter_eligibility.canDelegate / delegatedTo / votingWeight` is the latent shape of a delegate-lineage subgraph; the rows exist, the edges are not yet drawn.
- **Parliamentary procedure exists.** Committee meetings carry / defeat / table / withdraw motions, and bargaining has a recognized `caucus` session type.
- **Constitutional governance is real, not aspirational.** `golden_shares` + `reserved_matter_votes` encodes a mission-protection veto held by a Union Member Representative Council, with a 5-year sunset converting Class B to ordinary equity if compliance is maintained. This is a concrete constitutional primitive, not metadata.
- **Union pluralism is data, not a configuration smell.** `RepresentationProtocol` formalizes the differences between CAPE (LRO-led, stewards as workplace contacts), CUPE (national-rep model), and steward-led unions. The flat-SaaS assumption "every tenant looks alike" has already been broken — deliberately.

## 4. What the audit confirms is *missing* (without trying to fix it here)

- **There is no IGG read-model.** Each subsystem (org tree, congress edges, voting, bargaining, golden share, representation protocol) is queryable on its own, but not as one connected institutional graph.
- **There is no canonical mapping** from these institutional concepts onto `EntityNode`/`EntityEdge` in `@nzila/platform-entity-graph`. The substrate exists; the projection is unwritten.
- **There is no canonical mapping** from constitutional / parliamentary / electoral *acts* (a motion carrying, a CBA being ratified, a Class B veto, a delegate casting a weighted vote) onto `DecisionNode`/`DecisionEdge` in `@nzila/platform-decision-graph`.
- **Style heterogeneity** in the schema layer (see [governance-graph-collision-risks.md](governance-graph-collision-risks.md)) makes a single read-model harder to project cleanly than it needs to be.
- **The vocabulary is fragmented** across `canadian-vocabulary`, `cupe-vocabulary`, `quebec-vocabulary`, in-app representation presets, and ad-hoc enum members. There is no single lexicon document the platform agrees on. [governance-graph-domain-language.md](governance-graph-domain-language.md) proposes one.

## 5. Bottom line for Phase 2 planning

The IGG is roughly **70% modeled and 0% projected**. The institutional primitives exist; the connective tissue does not. Phase 2 should be a *projection and composition* exercise on top of `platform-entity-graph` + `platform-decision-graph`, not a schema rewrite of `apps/union-eyes/db/`.
