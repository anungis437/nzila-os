# Governance Graph — Recommended Boundaries (Phase 1)

> Who owns what, when Phase 2 happens. Boundaries are proposed; nothing is moved or renamed in Phase 1.

The IGG is a **composition** over existing packages, not a replacement for them. These boundaries are designed to keep the existing source-of-truth schemas authoritative and let the IGG live as a read-side projection.

## 1. Ownership lines

| Concern | Owner | Notes |
|---|---|---|
| Source-of-truth tables for institutional bodies, votes, negotiations, golden shares | `apps/union-eyes/db/` | **Unchanged.** Authoritative writer. |
| Generic graph substrate (nodes, edges, subgraphs, neighbors, paths) | `@nzila/platform-entity-graph` | **Unchanged.** Generic, polymorphic. |
| Generic decision substrate (decisions, edges, trails, evidence/policy refs) | `@nzila/platform-decision-graph` | **Unchanged.** Generic. |
| Canonical IGG type names (node kinds, edge kinds, decision kinds) | `@nzila/platform-ontology` | **Additive.** Registers new keys; no breaking change. |
| Locale-specific terminology | `@nzila/canadian-vocabulary`, `@nzila/cupe-vocabulary`, `@nzila/quebec-vocabulary` | **Unchanged.** Localizes labels. |
| Governance enforcement and runtime | `@nzila/governance*`, `@nzila/governed-workflow`, `@nzila/doctrine-enforcement` | **Unchanged.** Consumes IGG events. |
| Audit and evidence | `@nzila/audit`, `@nzila/evidence`, `@nzila/continuity-*` | **Unchanged.** Referenced by IGG decisions. |
| CLC and union intelligence | `@nzila/clc-decision-intelligence`, `@nzila/clc-executive-intelligence`, `@nzila/ue-cognition`, `@nzila/ue-assistant` | **Unchanged.** Consumers of the IGG read-model. |
| **Projection layer (FK schema → IGG nodes/edges/decisions)** | **Phase 2: TBD** | Likely a new package; not required for Phase 1. |

## 2. Phase 1 boundary rule

> Phase 1 changes nothing in the codebase except adding documentation under `reports/governance-graph/`.

This is a deliberate constraint. The institutional value of Phase 1 is *agreement on names and seams*, not code motion.

## 3. Phase 2 boundary rule (proposed, for later approval)

> The IGG is a **read projection**. Writes always flow into existing union-eyes tables.

Concretely:

- **Allowed:** A projection process reads `congress_memberships`, `voter_eligibility`, `golden_shares`, `reserved_matter_votes`, `negotiations`, `committeeMeetings`, etc., and emits `EntityNode` / `EntityEdge` / `DecisionNode` rows.
- **Not allowed in Phase 2 scope:** Adding new domain tables to `apps/union-eyes/db/` "for IGG purposes."
- **Not allowed in Phase 2 scope:** Mutating existing enums, statuses, or FK constraints in union-eyes for IGG purposes.
- **Permitted as an optional, pre-Phase-2 hygiene migration:** Promoting `golden_shares.holderType / status` and `reserved_matter_votes.matterType / finalDecision` from `text + comment` to `pgEnum`. This is value-preserving and additive.

## 4. Where the projection layer should live (deferred decision)

Two viable homes for the Phase 2 projection layer; both are acceptable. Phase 1 does not pick one.

| Option | Pros | Cons |
|---|---|---|
| New package `packages/institutional-governance-graph/` | Clear ownership; clean dependency graph; mirrors `clc-decision-intelligence` pattern. | One more package to maintain. |
| Module inside `apps/union-eyes/lib/igg/` | Keeps schema-aware code adjacent to the schema; fewer moving parts. | Couples the IGG projection to one app, blocks reuse from other apps. |

**Recommendation (non-binding for Phase 1):** New package, because the IGG should eventually be readable by `apps/web`, `apps/console`, `apps/zonga`, and other tenants of the platform — not just union-eyes. Confirm in Phase 2.

## 5. Strict no-go list for Phase 1

To preserve the audit-only character of this phase, the following are explicitly out of scope:

- Renaming any package.
- Renaming any enum value.
- Adding any column.
- Adding any table.
- Modifying any RBAC rule.
- Modifying any runtime path.
- Touching the representation-protocol JSON shape.
- Touching the golden-share `text` columns (even though promoting them is recommended).

## 6. Boundary diagram (proposed for Phase 2)

```
WRITE PATH (unchanged in Phase 2)
─────────────────────────────────
    User / API / Workflow
            │
            ▼
   apps/union-eyes/db/  ← source of truth (FK schema)


READ PATH (added in Phase 2)
────────────────────────────
   apps/union-eyes/db/
            │  reads
            ▼
   IGG Projection Layer
   (canonical type names from @nzila/platform-ontology;
    consults RepresentationProtocol;
    closes delegation transitive closure;
    materializes decision trails for institutional acts)
            │  emits
            ▼
   @nzila/platform-entity-graph   @nzila/platform-decision-graph
            │                              │
            └──────────────┬───────────────┘
                           ▼
        consumers: governance-runtime, governance-otel,
        audit, evidence, clc-decision-intelligence,
        ue-cognition, ue-assistant, dashboards, AI surfaces
```

## 7. One-line summary

> **Source-of-truth stays in `apps/union-eyes/db/`. The IGG lives downstream of it as a projection, named in `@nzila/platform-ontology`, served by `@nzila/platform-entity-graph` and `@nzila/platform-decision-graph`, consumed by everyone else.**
