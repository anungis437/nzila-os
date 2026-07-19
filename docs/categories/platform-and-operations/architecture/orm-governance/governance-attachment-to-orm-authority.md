# Governance Attachment to ORM Authority

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document defines the safe attachment of governance runtime
systems (telemetry, attestations, continuity observability, evidence,
stabilization signals) to the canonical ORM authority model.

---

## 1. Principle

Governance systems must observe and attest. They must not become
shadow operational authorities.

Concretely:

- Governance systems may **read** canonical entities to derive
  observations and attestations.
- Governance systems may **write** to their own scoped Drizzle tables
  (under `ue_governance.*`, `ue_continuity.*`, `ue_attestation.*`,
  `ue_telemetry.*`).
- Governance systems may **not write** to canonical Django entities.

---

## 2. Interaction Patterns

### 2.1 Governance telemetry

- Read: unknown canonical entity, via governed query layers.
- Write: `ue_telemetry.*` only.
- Lifecycle: bounded retention, periodic rollup; never authoritative.

### 2.2 Runtime attestations

- Inputs: deployment metadata (env vars), runtime probes, snapshot
  digests, bootstrap attestation row.
- Storage: `ue_attestation.*`.
- Output channels: governance review feeds, release-gate dashboards.

### 2.3 Continuity observability

- Inputs: runtime probes, request traces, error rates, dependency
  health signals.
- Storage: `ue_continuity.*`.
- Must not back-fill from production by querying canonical entities for
  business state — that is application analytics, not continuity.

### 2.4 Governance evidence

- Inputs: release artifacts, attestations, validation reports.
- Storage: `ue_attestation.*` (evidence projections); canonical
  evidence remains in object storage with its own immutability.
- Drizzle evidence projections are derived; the canonical record is the
  signed artifact in storage.

### 2.5 Stabilization systems

- Inputs: telemetry rollups, continuity signals.
- Storage: `ue_governance.*` for stabilization state machines.
- Outputs: governance events written into `ue_governance.*` and
  surfaced to operators.

---

## 3. Boundary Rules

| Rule                                                              | Enforcement                                  |
|-------------------------------------------------------------------|----------------------------------------------|
| Governance writes never target Django-owned tables                | Code review + future contract test            |
| Governance reads of canonical entities go through query layers    | Code review                                   |
| Governance retention is bounded and explicit per table            | Schema review at PR time                      |
| Governance projections do not become canonical sources of truth   | Topology document + review                    |
| Governance schemas live only in scoped Drizzle namespaces         | `db:validate`                                 |

---

## 4. Anti-Pattern: Shadow Operational Authority

A shadow operational authority is a governance table that, by accident
or convention, becomes the de-facto source of truth for an operational
fact (because it's easier to query, more denormalized, or has better
indexes than the canonical entity).

Shadow operational authorities must be detected and reconciled:

- If a Drizzle governance table has become the de-facto answer to an
  operational question, the governance team and the canonical owner
  team must reconcile within one release cycle — either by promoting
  the table to canonical (Django) or by re-pointing readers at the
  canonical entity.
- The canonical schema topology must be updated to record the
  resolution.

---

## 5. Operational Implications

- Governance dashboards may consume both canonical and Drizzle data;
  they must label which is which.
- Governance attestations recorded in `ue_attestation.*` must reference
  the canonical entity primary key (e.g. organization_id) — never
  duplicate canonical state.
- Governance writes are non-blocking for canonical operations and must
  fail open on the governance side rather than block the canonical
  request path.
