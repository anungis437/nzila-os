# @nzila/institutional-governance-graph

**Phase 2 — Safe Institutional Governance Graph (IGG) projection layer.**

This package projects existing Union Eyes institutional governance data
(organizations, congress memberships, voting eligibility, representation
protocols, motions, reserved-matter votes, negotiations) into the canonical
`@nzila/platform-entity-graph` and `@nzila/platform-decision-graph`
substrates **without modifying any source schema, write path, or RBAC
behaviour**.

## Core Rule

> **Project, don't rewrite.**

- ✅ Read-only — adapters describe an interface; concrete DB implementations live elsewhere.
- ✅ Additive — no schema migrations, no destructive changes, no renames.
- ✅ Composable — built on existing platform substrates.
- ❌ No UI, no AI surfaces, no public API endpoints, no event jobs.

## Surfaces

- `ontology/kinds` — IGG-specific entity, relationship, and event kinds.
  Maintained as **local constants** because the canonical
  `@nzila/platform-ontology` registry uses a fixed enum that does not yet
  include institutional-governance kinds. Phase 3 should migrate these into
  the central registry; until then they are namespaced under `igg:`.
- `adapters/source-adapter` — `InstitutionalGovernanceSourceAdapter`
  interface + Source record types. The interface is decoupled from Drizzle
  to ensure the projection layer never imports DB code.
- `lifecycle/normalize` — single canonical lifecycle vocabulary with safe
  fallback for unknown values (warning preserved in metadata).
- `projection/{organizations,affiliations,voting,representation}` — pure
  functions that turn Source records into `EntityNode` / `EntityEdge`
  shapes.
- `delegation/resolver` — chain resolver with cycle detection and weight
  preservation.
- `decisions/mapper` — `DecisionNode` skeletons for motion outcomes,
  reserved-matter votes, Class B vetoes, CBA ratifications, and protocol
  amendments.
- `projection/build` — orchestrator that builds a complete projection
  snapshot from an adapter.

## Non-Scope

UI graph viz, graph DB persistence, event-driven projection jobs,
convention workflows, complete transitive vote audit, AI reasoning,
public API endpoints, schema migrations, admin controls.
