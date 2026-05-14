# Phase 2 — Institutional Governance Graph (IGG) Projection Layer

## Implementation Report

**Package:** `@nzila/institutional-governance-graph` (v0.1.0)
**Location:** `packages/institutional-governance-graph/`
**Scope:** Backend projection layer only — additive, no DB / UI / RBAC / AI changes.
**Status:** ✅ Implemented, typechecked, fully tested.

---

## 1. Guiding Principle

> **Project, don't rewrite.**

The IGG layer introduces *no* new persistence, no schema migrations, no public surfaces, and no changes to existing read/write paths. It is a **pure, in-memory projection** that maps institutional governance source records (organizations, members, motions, reserved-matter votes, CBA ratifications, protocol amendments, delegations) onto the existing platform substrates:

- `@nzila/platform-entity-graph` — `EntityNode` / `EntityEdge`
- `@nzila/platform-decision-graph` — `DecisionNode`
- `@nzila/platform-ontology` — substrate type & relationship vocabularies

Golden-share / founder-control / Class-B-veto mechanics remain **internal metadata only**; they are surfaced in projection metadata under namespaced keys (`metadata.iggKind`, `metadata.iggCategory`, `outcome.iggCategory`) and are never exposed via decision-graph or entity-graph public types.

---

## 2. Files Created (13)

| # | File | Purpose |
|---|------|---------|
| 1 | `package.json` | Workspace package, ESM, workspace deps on entity-graph / decision-graph / ontology |
| 2 | `tsconfig.json` | TypeScript strict, ESM, `.js` extension imports |
| 3 | `vitest.config.ts` | Project name `institutional-governance-graph`, isolated config |
| 4 | `eslint.config.mjs` | Mirrors `platform-entity-graph` lint config |
| 5 | `README.md` | Package overview & boundary contract |
| 6 | `src/index.ts` | Public re-exports (ontology kinds, adapter types, build entrypoint) |
| 7 | `src/ontology/kinds.ts` | `IggEntityKinds`, `IggRelationshipKinds`, `IggEventKinds` + `substrateTypeFor` / `substrateRelationshipFor` mappers |
| 8 | `src/adapters/source-adapter.ts` | Input contract (`InstitutionalGovernanceSource`) — read-only DTO surface |
| 9 | `src/lifecycle/normalize.ts` | Normalises lifecycle states (active/provisional/pending/expired/terminated) |
| 10 | `src/decisions/mapper.ts` | Maps governance events → `DecisionNode` (motion / RMV / CBA / protocol amendment) |
| 11 | `src/projection/organizations.ts` | Organizations + `PARENT_OF` / `AFFILIATED_WITH` edges |
| 12 | `src/projection/affiliations.ts` | Member ↔ org affiliation projection (lifecycle-gated) |
| 13 | `src/projection/voting.ts` | Eligibility, delegation, and cast-vote edges |
| 14 | `src/projection/representation.ts` | Steward / LRO representation edges (lifecycle-gated) |
| 15 | `src/projection/build.ts` | Top-level `buildIggProjection()` orchestrator |
| 16 | `src/delegation/resolver.ts` | Effective-voter resolution with cycle detection |
| 17 | `src/projection.test.ts` | 17-test suite covering all projection paths |

(Counts include `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `README.md` — 13 source files under `src/` plus 5 package-config files.)

---

## 3. Boundary Decisions

### 3.1 Local kind vocabulary, namespaced

- All IGG kinds are stringly-typed with the `igg:` prefix (e.g. `igg:congress`, `igg:represents`).
- Substrate consumers see only the canonical platform-ontology types (`Organization`, `Member`, `Decision`, `Document`, `EvidencePack`, `AuditEvent`, and standard relationships `PARENT_OF` / `BELONGS_TO` / `LINKS_TO` / `APPROVED_BY` / `ASSIGNED_TO` / `HAS` / `DEPENDS_ON` / `REFERENCES`).
- IGG-specific kind retained on every node/edge as `metadata.iggKind` for downstream filtering without contaminating the ontology registry.

### 3.2 `substrateTypeFor` / `substrateRelationshipFor`

Centralised in `ontology/kinds.ts` to keep the IGG → substrate translation in one auditable place. Tested by all 17 cases.

### 3.3 `parent_of` substrate type

Mapped to substrate `'PARENT_OF'`. Caveat: the substrate ontology does not currently define an explicit `PARENT_OF` enum value — the projection emits the literal string and relies on consumers tolerating opaque relationship types. This is documented inline and forms part of the Phase-3 ontology-registry reconciliation.

### 3.4 Single test file

All 17 tests consolidated into `src/projection.test.ts` (vs. one-per-module) to keep the cross-cutting projection invariants (decision counts, edge totals, lifecycle gating, delegation cycles) co-located. Per-module tests can be split out in Phase 3.

### 3.5 Decision mapping

- `class_b_veto` → `DecisionTypes.REJECTION`
- `motion_outcome` / `protocol_amendment` → `DecisionTypes.POLICY_EVALUATION`
- `reserved_matter_vote` / `cba_ratification` → `DecisionTypes.APPROVAL`
- Lifecycle terminal states → `DecisionStatuses.EXECUTED`; otherwise `PENDING`.
- `knowledgeRefs` defaults to `[]` to satisfy strict optional-chain consumers.

### 3.6 Delegation resolver

Walks the delegation chain to find the effective voter, with cycle detection via a visited-set guard. Returns the original voter on cycle to avoid infinite recursion or silent data loss.

---

## 4. Validation Results

| Check | Command | Result |
|---|---|---|
| Package typecheck | `pnpm --filter @nzila/institutional-governance-graph typecheck` | ✅ 0 errors |
| Package tests | `pnpm --filter @nzila/institutional-governance-graph test` | ✅ 17 / 17 pass (35 ms) |
| Root typecheck | `pnpm typecheck` | ✅ 224 / 224 packages pass |

---

## 5. Non-Goals (preserved)

- ❌ No DB schema or migrations
- ❌ No write-path / mutation surfaces
- ❌ No RBAC / entitlement changes
- ❌ No UI components or routes
- ❌ No AI / agent surfaces
- ❌ No public exposure of golden-share / founder-control / Class-B-veto semantics — they remain internal metadata only.

---

## 6. Recommended Phase 3 Work

1. **Ontology registry migration** — promote IGG kinds (or a subset) into `@nzila/platform-ontology` as first-class enum values; reconcile the `PARENT_OF` substrate caveat.
2. **Persistence layer** — optional store adapter so the projection can be materialised and queried alongside the existing entity-graph persistence.
3. **Decision-graph integration** — pipe `mapInstitutionalDecision` outputs through `createDecisionNode` so governance decisions appear in the canonical decision trail.
4. **Controlled reserved-matter UI surfaces** — read-only governance dashboards that consume `buildIggProjection()` output via a server boundary; veto / Class-B mechanics remain admin-only.
5. **Per-module test split** — break `projection.test.ts` into module-scoped specs once the surface stabilises.
6. **Source adapter implementations** — concrete adapters for the existing union-eyes / cora / nacp-exams governance tables.

---

*Generated as part of the Institutional Governance Graph Phase 2 deliverable.*
