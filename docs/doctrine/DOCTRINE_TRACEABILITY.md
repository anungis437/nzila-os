# Nzila OS — Doctrine Traceability

<!--
  ARTIFACT TYPE: Doctrine Traceability (Product-to-Pillar Mapping)
  DOCTRINE_VERSION: 1.0.0
  CHANGE CLASS: Standard — requires engineering + doctrine review.
  CANONICAL SOURCE: docs/doctrine/DOCTRINE.md (Section 2)
-->

> Doctrine without operational embodiment becomes abstraction.
> This file maps platform capabilities to doctrine pillars.
> Capabilities without pillar anchors are flagged as Doctrine Debt.
> Pillars without platform capabilities are flagged as Implementation Gaps.

---

# The 7 Doctrine Pillars

| Pillar | Definition |
|--------|-----------|
| **Continuity** | Preservation of operational capability, governance integrity, and execution consistency across time and transition |
| **Governance** | Policy enforcement, accountability, explainable decision-making, institutional oversight |
| **Explainability** | Traceability of decisions, operational actions, and system behavior |
| **Trust** | Demonstrated reliability, operational consistency, accountability, governance transparency |
| **Sovereignty** | Institutional ability to understand, govern, export, audit, and survive independent of vendor lock-in |
| **Evidence** | Evidence-native traceability, audit lineage, governance records as operational byproducts |
| **Federation** | Coordinated autonomy across organizational boundaries with structural coherence |

---

# Capability-to-Pillar Mapping

## Replay Systems → Explainability + Evidence

**Description:** System capability to replay, inspect, and audit governance decisions and operational actions.

**Doctrine Pillars:** Explainability, Evidence

**Platform Locations:** (TBD — requires codebase audit of replay, audit, and lineage components)

**Status:** ✅ Doctrine-backed — replay systems are explicitly referenced in `vocabulary.md` under Governance Replay.

---

## Scoped RBAC → Federation + Sovereignty

**Description:** Role-based access control scoped to organizational boundaries, enabling multi-entity deployment without cross-organizational data exposure.

**Doctrine Pillars:** Federation, Sovereignty

**Platform Locations:** (TBD — requires codebase audit of RBAC, permission, and scoping components)

**Status:** ✅ Doctrine-backed — referenced in constitution.md and principles.md (Principle 6: Federation Requires Coordinated Autonomy).

---

## Audit Lineage → Evidence + Explainability + Trust

**Description:** Operational audit trails that create traceable lineage for decisions, approvals, and system actions.

**Doctrine Pillars:** Evidence, Explainability, Trust

**Platform Locations:** (TBD — requires codebase audit of audit, log, and record components)

**Status:** ✅ Doctrine-backed — foundational to evidence-native architecture in vocabulary.md.

---

## Export Systems → Sovereignty

**Description:** Capability for organizations to export their operational data, governance records, and institutional memory without dependency on continued vendor relationship.

**Doctrine Pillars:** Sovereignty

**Platform Locations:** (TBD — requires codebase audit of export components)

**Status:** ✅ Doctrine-backed — Operational Sovereignty definition in vocabulary.md.

---

## Continuity Logs → Continuity + Operational Memory

**Description:** Systems that preserve operational state, governance history, and institutional context across time and transitions.

**Doctrine Pillars:** Continuity

**Platform Locations:** (TBD — requires codebase audit of continuity, memory, and log components)

**Status:** ✅ Doctrine-backed — Operational Memory definition in vocabulary.md.

---

## AI-Assisted Operations → Explainability + Governance + Trust

**Description:** AI capabilities that assist operational workflows and governance processes.

**Doctrine Pillars:** Explainability, Governance, Trust

**Doctrine Constraint:** ALL AI-assisted operations must expose decision lineage (Principle 4: Explainability Over Black Boxes). Opaque AI behavior is not permissible in any trust-sensitive workflow.

**Platform Locations:** (TBD — requires codebase audit of AI, ML, and intelligence components)

**Status:** ✅ Doctrine-backed — Governed AI position in constitution.md.

---

## Federation Governance → Federation + Sovereignty + Governance

**Description:** Infrastructure supporting multi-organizational governance relationships while preserving organizational autonomy.

**Doctrine Pillars:** Federation, Sovereignty, Governance

**Platform Locations:** (TBD — requires codebase audit of federation, multi-org, and scoping components)

**Status:** ✅ Doctrine-backed — Sovereign Federation definition in vocabulary.md.

---

# Doctrine Debt Register

Doctrine debt exists when a capability has no traceable connection to a doctrine pillar, OR when a pillar has no corresponding platform capability.

## Current Status

**Note:** Full codebase audit is required to populate this register with specificity. The entries below are structural placeholders derived from doctrine analysis.

| ID | Type | Description | Priority |
|----|------|-------------|----------|
| DD-001 | Implementation Gap | Scoring systems (ICI, GFA, TDB) defined in frameworks.md but not yet implemented as platform capabilities | High |
| DD-002 | Implementation Gap | Governance Fragility scoring not yet surfaced as buyer-facing measurement | High |
| DD-003 | Implementation Gap | Trust Debt scoring framework exists in doctrine but has no product embodiment | Medium |
| DD-004 | Audit Required | AI capabilities need explicit explainability audit against Principle 4 | High |
| DD-005 | Audit Required | Export capabilities need sovereignty audit against Operational Sovereignty definition | Medium |

## Doctrine Debt Review Process

1. Engineering team audits codebase quarterly against this file.
2. New capabilities added to platform must be registered here before shipping.
3. Doctrine debt items are prioritized by: governance risk > sovereignty risk > trust risk > continuity risk.
4. Doctrine debt must not block shipping but must be documented at merge time.

---

# Pillar Coverage Assessment

| Pillar | Platform Capabilities Present | Status |
|--------|------------------------------|--------|
| Continuity | Continuity logs, operational memory systems | Partial — audit required |
| Governance | Approval workflows, audit lineage, policy enforcement | Partial — audit required |
| Explainability | Replay systems, audit trails | Partial — AI explainability audit required |
| Trust | Audit lineage, governance consistency | Partial — scoring not yet operational |
| Sovereignty | Export systems, scoped data boundaries | Partial — export audit required |
| Evidence | Audit lineage, record traceability | Partial — audit required |
| Federation | Scoped RBAC, multi-org support | Partial — full audit required |

**All entries marked "audit required" must be resolved by the next doctrine review cycle.**

---

# Codebase Audit Instructions

To complete this traceability map, run the following audit:

```
Search: apps/, services/, platform/, packages/
Patterns:
  - replay, audit, lineage → Explainability, Evidence
  - rbac, permission, scope, role → Federation, Sovereignty
  - export, download → Sovereignty
  - continuity, memory, log, history → Continuity
  - federation, multi-org, tenant (flagged) → Federation
  - ai, ml, intelligence, copilot → Explainability (requires audit)
  - governance, policy, approval, escalation → Governance
```

For each match: document file path, capability description, and assigned pillar in this file.
