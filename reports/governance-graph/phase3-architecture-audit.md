# Phase 3 — Architecture Audit
## Institutional Governance Graph (IGG) Initiative

**Status:** Audit-only. No code changes.
**Scope:** Establish what already exists in the platform that the IGG must align with, what assumptions are safe, and what would break if violated.
**Outcome:** Pre-conditions and constraints that govern every Phase 3 deliverable.

---

## 1. The substrate landscape (what already exists)

| Substrate | Path | Persistence | Chronology | Notes |
|---|---|---|---|---|
| `@nzila/platform-ontology` | [packages/platform-ontology/src](../../packages/platform-ontology/src) | Drizzle (`ontologyEntities`, `ontologyRelationships`) | `createdAt` / `updatedAt` per entity | **Fixed enums** — `OntologyEntityTypes` and `RelationshipTypes` are `as const` literal unions. Adding values is a substrate change. |
| `@nzila/platform-entity-graph` | [packages/platform-entity-graph/src](../../packages/platform-entity-graph/src) | Interface (`EntityGraphStore`) + reference in-memory store | Implicit via traversal | Persistent backend pluggable per consumer. No graph DB today. |
| `@nzila/platform-decision-graph` | [packages/platform-decision-graph/src](../../packages/platform-decision-graph/src) | Drizzle (`decisionNodes`, `decisionEdges`) + in-memory store | First-class: `createdAt`, `executedAt`, `expiresAt`, edge types `triggered_by` / `informed_by` | Already the canonical decision-chronology surface. The IGG mapper produces shapes compatible with it. |
| `@nzila/platform-governance` | [packages/platform-governance/src/auditTimeline.ts](../../packages/platform-governance/src/auditTimeline.ts) | In-memory reference timeline | ISO timestamps + commit hashes | Used for compliance/policy audit trail, not for institutional governance. |
| `@nzila/os-core` (evidence) | [packages/os-core/src/evidence](../../packages/os-core/src/evidence) | Azure Blob + PostgreSQL `evidence_packs` / `audit_events` | **Hash-chained NAR** (Non-Alterable Record) | The strongest chronology primitive in the platform. Tamper-evident. |
| `@nzila/institutional-governance-graph` (Phase 2) | [packages/institutional-governance-graph/src](../../packages/institutional-governance-graph/src) | Pure projection — no persistence | Borrowed from decision-graph timestamps | The only IGG-specific surface today. |
| Union-eyes governance | [apps/union-eyes/db/schema/domains/governance/governance.ts](../../apps/union-eyes/db/schema/domains/governance/governance.ts), [apps/union-eyes/app/[locale]/dashboard/admin/governance](../../apps/union-eyes/app/%5Blocale%5D/dashboard/admin/governance) | PostgreSQL (`golden_shares`, `reserved_matter_votes`) + admin-only Next.js console | `created_at` / `updated_at` + `consecutiveComplianceYears` (5-year sunset) | **Already production**. RBAC: `minRole: 'admin'` + `entitlement: 'governance_suite'`. Must not be touched by Phase 3 except as a read source. |

---

## 2. Ten audit questions, ten audited answers

### Q1. Which IGG kinds deserve ontology promotion?

Ontology promotion is a substrate mutation. Every promoted kind permanently widens the canonical type union and can be referenced by any consumer. Promotion criteria:

- Stable across institutional contexts (not jurisdiction-specific)
- Already first-class in production tables (not just IGG-internal)
- Non-protected (does not expose constitutional or veto semantics)
- Reused by ≥ 1 consumer outside the IGG

**Provisional promotion list (full reasoning in the matrix):**
`Congress`, `Federation`, `BargainingUnit`, `Committee`, `Motion` — these are first-class institutional bodies/acts that any cross-platform consumer (CLC dashboards, decision intelligence, executive-os) will need to reference by name.

### Q2. Which kinds should remain metadata-only?

Anything carrying constitutional or founder-protection semantics:
- `class_b_special_voting_share`, `class_b_veto`, `golden_share_sunset_progression`, `reserved_matter`, `vetoes`, `holds`, `umrc`

These remain `metadata.iggKind` strings inside the IGG package. They are read by admin-only surfaces (`governance_suite` entitlement) and never appear in the canonical ontology enum, never in public APIs, never in AI prompts.

### Q3. Which relationships are stable enough for canonicalization?

The substrate already has `PARENT_OF`, `BELONGS_TO`, `LINKS_TO`, `ASSIGNED_TO`, `APPROVED_BY`, `DEPENDS_ON`, `REFERENCES`. The IGG-specific *semantic* relationships that have stable institutional meaning across jurisdictions:

- `AFFILIATED_WITH` (union → congress/federation)
- `REPRESENTS` (steward / LRO / national rep → member)
- `GOVERNED_BY` (entity → governing body)

These three are candidates for canonical relationship promotion. `DELEGATES_TO`, `ELIGIBLE_TO_VOTE_IN`, `CASTS` are voting-mechanic-specific and should remain IGG-local because they carry jurisdiction-coupled semantics (proxy rules, weight caps).

### Q4. Where would ontology pollution become dangerous?

Three failure modes:

1. **Constitutional leakage** — promoting `class_b_*` exposes founder-protection mechanics to any consumer that reads the registry. Once leaked, it cannot be recalled.
2. **Jurisdictional drift** — promoting voting-mechanic relationships would freeze one delegation model into the canonical vocabulary. Quebec, federal, and provincial regimes differ on proxy semantics.
3. **Surface confusion** — promoting too many specific kinds (`Steward`, `LRO`, `NationalRep`, `Negotiator`, `Officer`) collapses substrate discipline; these are roles a `Member` can hold, not distinct entity types.

The matrix in [ontology-reconciliation-matrix.md](ontology-reconciliation-matrix.md) classifies every IGG kind against these failure modes.

### Q5. What persistence strategies fit current repo truth?

The platform already commits to:

- PostgreSQL via Drizzle for substrate persistence (entity graph, decision graph, ontology, evidence)
- In-memory reference stores for unit tests and local development
- Azure Blob for immutable artifacts (evidence packs)

There is **no graph database** in the repo. There is no event-store. Adopting either would be a multi-quarter migration.

The only viable Phase 3 persistence options are: (a) projection-only (current); (b) a thin **cached projection** materialised into the existing entity-graph + decision-graph tables; (c) a future relational IGG store (deferred). Full comparison in [persistence-strategy.md](persistence-strategy.md).

### Q6. What governance queries are already implied by runtime?

Reading existing surfaces:

- [apps/union-eyes/app/[locale]/dashboard/admin/governance](../../apps/union-eyes/app/%5Blocale%5D/dashboard/admin/governance) implies: list reserved matters, show vote tallies, show signatories, show bylaws.
- [apps/union-eyes/app/api/governance/reserved-matters/route.ts](../../apps/union-eyes/app/api/governance/reserved-matters/route.ts) implies: tabular access patterns gated by `governance_suite` entitlement.
- `decisionGraph.getDecisionTrail` implies: chronological lineage queries.
- `auditTimeline` implies: filtered timeline queries by org / app / event type / since.

Phase 3 governance queries should mirror these patterns: filtered, paginated, chronology-aware, RBAC-respecting reads — never arbitrary graph walks exposed to untrusted callers.

### Q7. What chronology systems already exist but remain disconnected?

Three independent chronology surfaces exist:

1. `decisionGraph` — `createdAt`, `executedAt`, `expiresAt`, `triggered_by`/`informed_by` edges
2. `auditTimeline` — flat append-only event log
3. `evidence packs` — hash-chained NAR with `sealedAt`

The IGG today produces `DecisionNode`-shaped objects but does not emit them into any chronology surface. Phase 3 must define a *one-way* mapping from IGG decisions → decision-graph and from IGG audit-relevant transitions → audit timeline. No reverse flow.

### Q8. What read-only governance surfaces are safe now?

Three theme families pass governance-safety review:

- **Topology** — institutional hierarchy, affiliation lineage (no veto/Class B exposure)
- **Chronology** — decision lineage, protocol-amendment timeline, motion outcome history
- **Continuity** — representation continuity over time, role tenure (without political profiling)

Each must be:
- Admin/operator-only at minimum (`governance_suite` or new `governance_observability` entitlement)
- Internally hosted (no public route)
- Decorated with provenance (every node/edge displays its `sourceRecordId`)

### Q9. What governance semantics must remain internal-only?

A protected-semantics list, treated as the single source of truth for visibility decisions:

```
PROTECTED:
  - class_b_special_voting_share / golden_share_sunset_progression
  - class_b_veto / reserved_matter / vetoes
  - umrc (Union Member Representative Council) composition
  - founder-control mechanics
  - sunset clause progression details
  - any "holds" relationship for governance-lock semantics
```

These can be referenced internally for chronology integrity, but:
- Never surface in canonical ontology
- Never expose via public or member-tier API
- Never include in AI prompts or training inputs
- Never visualize in network graphs

A test in Phase 3 will assert that none of these strings appear in any non-admin surface output.

### Q10. What future AI integrations would become safe later?

Today: **none** are safe. The IGG is too young, the chronology integration is incomplete, and the protected-semantics fence is enforced only by convention.

Future-safe (Phase 4+) candidates, in order of safety:
1. *Chronology summarization* — given a series of `DecisionNode`s, produce a human-readable "how this state emerged" narrative. Read-only, no recommendation.
2. *Affiliation drift detection* — anomaly flagging on affiliation transitions; alert humans, never act.
3. *Procedural completeness checking* — given a motion, verify required quorum/notice steps were recorded. Compliance audit, not optimization.

Explicitly out of scope, ever: outcome prediction, influence scoring, optimization recommendations, behavioural profiling.

---

## 3. Inventoried files referenced by Phase 3

| Concern | File |
|---|---|
| Ontology enums (substrate) | [packages/platform-ontology/src/types.ts](../../packages/platform-ontology/src/types.ts) |
| Entity graph types | [packages/platform-entity-graph/src/types.ts](../../packages/platform-entity-graph/src/types.ts) |
| Decision graph types | [packages/platform-decision-graph/src/types.ts](../../packages/platform-decision-graph/src/types.ts) |
| Decision graph operations | [packages/platform-decision-graph/src/operations.ts](../../packages/platform-decision-graph/src/operations.ts) |
| Audit timeline | [packages/platform-governance/src/auditTimeline.ts](../../packages/platform-governance/src/auditTimeline.ts) |
| Evidence sealing | [packages/os-core/src/evidence/seal.ts](../../packages/os-core/src/evidence/seal.ts) |
| IGG Phase 2 package | [packages/institutional-governance-graph/src](../../packages/institutional-governance-graph/src) |
| Golden share / RMV schema (read source, do not mutate) | [apps/union-eyes/db/schema/domains/governance/governance.ts](../../apps/union-eyes/db/schema/domains/governance/governance.ts) |
| Existing admin governance console | [apps/union-eyes/app/[locale]/dashboard/admin/governance/page.tsx](../../apps/union-eyes/app/%5Blocale%5D/dashboard/admin/governance/page.tsx) |
| RMV API (read source) | [apps/union-eyes/app/api/governance/reserved-matters/route.ts](../../apps/union-eyes/app/api/governance/reserved-matters/route.ts) |

---

## 4. Constraints binding every Phase 3 deliverable

These are not aspirational. Violating any voids the deliverable.

1. **No write paths.** The IGG remains read-only. Adapters call `db.execute(sql\`SELECT …\`)` only.
2. **No DB schema changes.** No migrations, no `ALTER TABLE`, no new tables in this phase.
3. **No RBAC change.** New surfaces inherit the strictest existing entitlement (`governance_suite`, `minRole: 'admin'`).
4. **No public routes.** Dashboards live under the existing `[locale]/dashboard/admin/` tree; APIs under `/api/governance/*` with the same guards.
5. **Protected semantics never canonicalize.** Enforced by tests, not just convention.
6. **No graph database.** Persistence (if any) lives in the existing PostgreSQL substrate.
7. **No AI / agent surfaces.** Phase 3 is chronology, not intelligence.
8. **Additive package boundaries.** All new code lands in `packages/institutional-governance-graph/` or a new sibling like `packages/institutional-governance-read-models/`. No edits to existing apps except optional dashboard scaffold mounts gated behind feature flags.
9. **Constitutional neutrality.** The graph describes structure; it never recommends.

---

## 5. Recommendation set forwarded to other Phase 3 docs

| Carried into | Decision |
|---|---|
| [ontology-reconciliation-matrix.md](ontology-reconciliation-matrix.md) | Promote 5 entity kinds + 3 relationships; keep 7 protected; defer 8. |
| [persistence-strategy.md](persistence-strategy.md) | Phase 3 stays projection-only with optional cached materialisation deferred to Phase 3.5. |
| Decision-graph integration | One-way emit only. No back-pressure into source tables. |
| Source adapters | Drizzle-backed read adapter living inside `apps/union-eyes`; the package only exposes the interface. |
| Governance queries | Mirror existing API patterns; reuse `withApi` framework + `governance_suite` entitlement. |
| Read-only dashboards | Scaffolds only; mount behind feature flag; visual direction = archival/infrastructural. |
| Chronology utilities | Pure functions over `DecisionNode[]`; no IO. |
| Protected semantics | A single `IGG_PROTECTED_KINDS` constant + enforcement test. |

---

## 6. Phase 3 closure pre-conditions

Phase 3 may proceed once:

- [x] This audit is filed.
- [ ] Ontology reconciliation matrix is filed and accepted.
- [ ] Persistence strategy is filed and accepted.
- [ ] An entitlement decision is made: reuse `governance_suite` or add `governance_observability` (recommendation: reuse `governance_suite` until usage justifies a finer split).
- [ ] A package-boundary decision is made: extend `@nzila/institutional-governance-graph` (recommendation) vs. spawn a sibling `@nzila/institutional-governance-read-models`.
