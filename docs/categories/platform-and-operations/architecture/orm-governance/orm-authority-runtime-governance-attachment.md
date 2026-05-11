# ORM Authority — Runtime Governance Attachment

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document defines how runtime governance systems must reflect (and
validate against) canonical ORM ownership.

---

## 1. Purpose

Runtime governance must remain coherent with the canonical ORM
authority model. Governance signals about an entity must reference the
canonical owner; governance state about an environment must reference
its bootstrap attestation; governance signals about a release must
reference both.

If runtime governance drifts from canonical ORM ownership, governance
itself becomes a source of misinformation.

---

## 2. Required Validations

For each governance signal type, the following validations apply.

### 2.1 Governance event legitimacy

- Each governance event must reference its subject by canonical primary
  key (Django entity id), not by a Drizzle-owned projection id.
- Event metadata must include the environment identifier
  (`UE_ENVIRONMENT` / `NZILA_MODE`) and the deployment release id.

### 2.2 Entity legitimacy

- A governance system that asserts "entity X exists" must validate
  the assertion against the canonical owner (Django) at signal-write
  time, not against a projection.
- Stale projection reads are a known governance failure mode and must
  be documented at the signal definition.

### 2.3 Attestation legitimacy

- Attestations recorded in `ue_attestation.*` must include the
  bootstrap attestation row id (or content hash) of the environment in
  which the attestation was generated.
- An attestation generated in an environment with
  `legacy_replay_override = true` must carry that flag through the
  attestation payload — downstream consumers may then choose to
  ignore or quarantine such attestations.

### 2.4 Deployment legitimacy

- Each deployment governance signal must reference the bootstrap
  attestation of the target environment.
- A deployment signal that cannot reference such a row is itself a
  drift signal.

### 2.5 Continuity legitimacy

- Continuity signals must reference the canonical entities they
  observe (by Django pk) and must not invent identifiers.
- Continuity rollups stored in `ue_continuity.*` must include the
  source canonical entity references in the row payload.

---

## 3. Reflection Requirements

Runtime governance dashboards and APIs must reflect:

- The current canonical owner of every entity displayed.
- The bootstrap attestation row of every environment displayed.
- The snapshot digest (where applicable) of every environment
  displayed.
- The TSOSA secret topology of every environment displayed (per
  [`transitional-shared-secret-topology.md`](../../union-eyes/release/transitional-shared-secret-topology.md)).

These reflections may not be omitted; they make ORM authority and
operational topology visible at runtime governance level.

---

## 4. Detection of Drift

Drift between runtime governance and canonical ORM ownership must be
detected by:

- Periodic governance reconciliation jobs that re-validate signal
  subjects against canonical entities.
- The legitimacy validator (`db:validate`) at PR/CI time.
- Operator review of bootstrap attestations during release-gate.

When drift is detected:

- The drifted signal is quarantined (not deleted).
- A governance reconciliation event is recorded in `ue_governance.*`.
- The canonical owner team and the governance team coordinate
  reconciliation within the release cycle.

---

## 5. Implementation Sequence

This phase formalizes the contract. Implementation of automated
reconciliation jobs and runtime reflection is a follow-on phase. The
contract above is enforceable today by code review and operator
discipline, and is the basis for the future automation.
