# Governance Graph — Collision Risks (Phase 1)

> Where current modeling will resist a clean Phase 2 projection. Each item is a real friction surface, not a stylistic complaint.

The Phase 2 IGG projection does **not** require fixing any of these to ship. It does require *naming* them, so the projection layer can absorb the inconsistency rather than propagating it.

## 1. Five enum styles coexist in one app

The same conceptual idea — "an enumerated lifecycle / kind value" — is encoded five different ways across the schema:

| Style | Where | Example |
|---|---|---|
| `pgEnum` (Postgres native) | `union-structure-schema.ts`, `bargaining-negotiations-schema.ts`, `schema-organizations.ts`, `social-media-schema.ts`, `signature-workflows-schema.ts`, `reports-schema.ts` | `organizationTypeEnum`, `negotiationStatusEnum` |
| Inline-comment `text` columns | `governance-schema.ts` (`golden_shares`, `reserved_matter_votes`) | `holderType text` with allowed values listed in a comment |
| `const` objects (TS-side, not enforced in DB) | `clc-partnership-schema.ts` | `clcPerCapitaBenchmarks` categorical fields |
| `CHECK` constraints | `voting-schema.ts` | session type, vote option validity |
| Zod-validated TS `const` objects | `@nzila/platform-decision-graph`, `@nzila/platform-entity-graph` | `DecisionTypes`, `DecisionStatuses`, `ActorTypes` |

**Risk:** A single IGG read-model that has to discriminate node and edge kinds across all five styles will need style-specific adapters. There is no single source of truth for "what are the legal values."

**Containment:** Phase 2 should treat `pgEnum` as the canonical style for new IGG-relevant primitives, and write a thin adapter for the four legacy styles. Do not rewrite existing tables.

## 2. Two parallel "graph" surfaces

- **Generic substrate**: `@nzila/platform-entity-graph` + `@nzila/platform-decision-graph` — tenant-scoped, polymorphic, ontology-driven, Zod-validated.
- **Schema-encoded graph in `apps/union-eyes/db/`**: every governance relationship today is an FK between two domain tables (e.g. `congress_memberships`, `stewardAssignments`, `negotiations.expiringCbaId → resultingCbaId`).

**Risk:** If Phase 2 adds IGG concepts directly as new union-eyes tables, two graphs will exist — one in domain tables, one in `EntityEdge`. Queries will diverge. Drift will start immediately.

**Containment:** Treat `EntityEdge` as a **read-side projection** of the FK graph, not a write target. The FK schema remains authoritative; the IGG is its denormalized, queryable view.

## 3. The Class B Special Voting Share is encoded outside any enum/registry

`golden_shares.holderType`, `status`, and `reserved_matter_votes.matterType` and `finalDecision` are all encoded as plain `text` with an inline comment listing allowed values. This is the most constitutionally important table in the system, and it is the **least type-safe** schema.

**Risk:**

- A typo (`'vetoed_classB'` vs `'vetoed_class_b'`) is undetectable until query time.
- The IGG projection cannot reliably enumerate "all Reserved Matter outcomes" without re-parsing the comment.
- Adding a new Reserved Matter type requires a coordinated change in the comment, in app code, and in any analytics layer.

**Containment (Phase 2 hygiene, optional):** Promote these `text` columns to `pgEnum` in a *separate, additive* migration before the IGG read-model is published. If this is deferred, the projection layer must hold the canonical list itself and validate on read.

## 4. Representation pluralism is not yet visible to the platform

`RepresentationProtocol` lives as a JSON value inside `org_configurations` (category `'grievance'`, key `'representation_protocol'`). It captures critical institutional differences (CAPE LRO-led vs CUPE national-rep model vs steward-led), but:

- It is invisible to anyone not specifically loading `org_configurations`.
- Generic governance code in `@nzila/governance` and `@nzila/governance-runtime` cannot branch on representation model without knowing this key exists.
- Two unions on the same platform can have structurally different role topologies, and there is no platform-level type that says so.

**Risk:** Phase 2 IGG queries that ask "who represents this member?" will return *different shapes* depending on the union, and consumers may not know it. Reports and dashboards will silently mis-aggregate across unions.

**Containment:** The IGG projection must read `RepresentationProtocol` *first* and use it to decide which `represents` edges to materialize. The `domain-language` deliverable canonicalizes the representative-type vocabulary so consumers have one set of names regardless of preset.

## 5. Delegate lineage is latent — the rows exist, the edges don't

`voter_eligibility` carries `canDelegate: bool`, `delegatedTo: uuid?`, `votingWeight: numeric`. There is no `vote_delegations` table, no transitive-closure view, no audit log of when a delegation was granted or revoked, and no projection to `EntityEdge`.

**Risk:** Delegate democracy is structurally promised by the schema and structurally absent from the runtime. A vote audit cannot today answer "whose authority did delegate X exercise, transitively?" without bespoke SQL.

**Containment:** Phase 2 should treat `delegates_to` as a first-class IGG edge with its own temporal lifecycle. No schema change is strictly required, but the projection must close the transitive closure on read.

## 6. The org tree, congress edges, and CLC benchmarks live in three different mental models

- `organizations` (hierarchical self-FK) — internal hierarchy.
- `congress_memberships` — *external* affiliation edge.
- `clcPerCapitaBenchmarks`, `clcUnionDensity` — *external* analytic data about the same congress.

Today, "the CLC" can appear as: an `organizations` row (type `congress`), a target of `congress_memberships` rows, and a key in `clc_*` analytic tables — without any guarantee these three references resolve to the same entity.

**Risk:** A user asking "show me everything about the CLC" today depends on the consumer correctly joining three different conceptions of the same body.

**Containment:** The IGG projection should have a single canonical `organizationId` for each named congress/federation, and all three subsystems should resolve to it. No schema change required if the projection enforces it.

## 7. Constitutional acts are not modeled as decisions

`@nzila/platform-decision-graph` has a rich `DecisionNode` (with policy/evidence/knowledge refs, reasoning, confidence) — but the most consequential decisions in the union (a Class B veto, a CBA ratification, a strike authorization, a bylaw amendment) are **not** persisted as `DecisionNode`s today. They are persisted as rows in `reserved_matter_votes`, `voting_sessions`, `negotiations`, etc.

**Risk:** The decision-graph cannot today produce a `DecisionTrail` for "the strike authorization that triggered the strike fund payout that funded picket-line wages." That trail exists in the data, but not as a `DecisionTrail`.

**Containment:** Phase 2 should project terminal institutional acts onto `DecisionNode`s on read. No write path needs to change.

## 8. Tenancy boundary around the platform itself

`organizationTypeEnum` includes `'platform'` as a row in the same table as unions and locals. Operationally this means the platform operator is structurally indistinguishable from a tenant in many queries.

**Risk:** Cross-tenant aggregation queries that scan `organizations` may inadvertently include or exclude the platform row depending on filter discipline. For an IGG that is supposed to model *democratic* infrastructure, "the platform appears as a peer of the unions" is a modeling smell that consumers will trip on.

**Containment:** The IGG projection should treat `type = 'platform'` as a distinct tier (a substrate node, not a governance body) and exclude it from federation/union aggregations by default.

## 9. Vocabulary is fragmented across three packages plus in-app presets

`@nzila/canadian-vocabulary`, `@nzila/cupe-vocabulary`, `@nzila/quebec-vocabulary`, plus the representation-protocol presets, plus ad-hoc enum members, plus inline comments — there is no one place that says "these are the institutional terms this platform speaks."

**Risk:** Phase 2 documentation, UI labels, search, and AI surfaces will inevitably reuse different words for the same concept. The user-visible coherence of the platform suffers before any code is written.

**Containment:** [governance-graph-domain-language.md](governance-graph-domain-language.md) is the start of a single canonical lexicon. The vocabulary packages remain authoritative for *localized* terms; the lexicon canonicalizes the *concepts* they localize.

## 10. Summary

None of these collisions blocks Phase 2. All of them shape it. The recurring containment pattern is the same: **project, don't rewrite**. Phase 2 builds a read-side IGG view; the existing schemas remain authoritative writers.
