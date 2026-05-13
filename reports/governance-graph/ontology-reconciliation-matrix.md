# Ontology Reconciliation Matrix
## Phase 3 — Institutional Governance Graph

**Decision authority:** This document is the source of truth for which IGG kinds are promoted into `@nzila/platform-ontology`, which remain IGG-local metadata, and which are protected.

**Hard rule:** Promotion is a substrate mutation. A promoted kind cannot be removed without breaking every consumer. When in doubt, **defer**.

---

## Classification scheme

| Status | Meaning |
|---|---|
| **Promote** | Add to `OntologyEntityTypes` / `RelationshipTypes` in Phase 3 |
| **Defer** | Re-evaluate in Phase 4 once a non-IGG consumer needs it |
| **IGG-local** | Keep as `metadata.iggKind` only; not a substrate concept |
| **Protected** | Never promote; never expose outside admin surfaces; enforced by test |

**Risk levels:** L (low — additive, no semantic ambiguity), M (medium — possible jurisdictional drift), H (high — constitutional or founder-protection exposure).

---

## Entity kind matrix

| IGG Kind | Current | Recommendation | Reason | Risk | Status |
|---|---|---|---|---|---|
| `igg:platform` | local | Already represented by substrate `Tenant` | Re-use the existing concept; do not duplicate | L | IGG-local (alias `Tenant`) |
| `igg:congress` | local | Add `Congress` to ontology | First-class institutional body referenced by CLC dashboards, executive-os, decision intelligence | L | **Promote** |
| `igg:federation` | local | Add `Federation` to ontology | Stable hierarchy primitive referenced cross-app | L | **Promote** |
| `igg:union` | local | Already represented by substrate `Organization` | A union *is* an organization with `metadata.iggKind = 'igg:union'` | L | IGG-local |
| `igg:local` | local | Already represented by substrate `Organization` | Same reasoning as `union` | L | IGG-local |
| `igg:region` | local | Same | Same | L | IGG-local |
| `igg:district` | local | Same | Same | L | IGG-local |
| `igg:employer` | local | Already `Organization` | Same | L | IGG-local |
| `igg:worksite` | local | Defer | May warrant promotion once mobility / health connectors need it | M | Defer |
| `igg:bargaining_unit` | local | Add `BargainingUnit` | First-class concept in CBA lineage; referenced by negotiation systems | L | **Promote** |
| `igg:committee` | local | Add `Committee` | Procedural primitive used by motions, voting, escalations | L | **Promote** |
| `igg:member` | local | Already `Member` | Existing substrate concept | L | IGG-local |
| `igg:steward` | local | Defer; surface as `Member` + role metadata | Steward is a *role* a Member holds, not a distinct kind | M | IGG-local |
| `igg:lro` | local | Defer; same | Same — role on a Member | M | IGG-local |
| `igg:national_rep` | local | Defer; same | Same | M | IGG-local |
| `igg:officer` | local | Defer; same | Same | M | IGG-local |
| `igg:negotiator` | local | Defer; same | Same | M | IGG-local |
| `igg:umrc` | local | **Protected** | Union Member Representative Council carries founder-control composition | H | **Protected** |
| `igg:class_b_special_voting_share` | local | **Protected** | Constitutional / founder-protection mechanic | H | **Protected** |
| `igg:reserved_matter` | local | **Protected** | Same | H | **Protected** |
| `igg:bylaw` | local | Already `Document` | Existing substrate concept | L | IGG-local |
| `igg:cba` | local | Already `Document` | Same | L | IGG-local |
| `igg:motion` | local | Add `Motion` | Procedural decision primitive; high reuse potential | L | **Promote** |
| `igg:proposal` | local | Defer | Overlaps with `Motion` semantics; let usage clarify before promoting both | M | Defer |
| `igg:decision` | local | Already `Decision` | Existing substrate concept | L | IGG-local |
| `igg:evidence` | local | Already `EvidencePack` | Existing substrate concept | L | IGG-local |
| `igg:audit_entry` | local | Already `AuditEvent` | Existing substrate concept | L | IGG-local |

**Promotion tally:** 5 entity kinds → `Congress`, `Federation`, `BargainingUnit`, `Committee`, `Motion`.
**Protected:** 3 kinds → `umrc`, `class_b_special_voting_share`, `reserved_matter`.
**Deferred:** 7 kinds.
**IGG-local (delegated to existing substrate concepts):** 12 kinds.

---

## Relationship kind matrix

| IGG Kind | Current | Recommendation | Reason | Risk | Status |
|---|---|---|---|---|---|
| `igg:parent_of` | mapped to `PARENT_OF` | Keep mapping | Substrate already covers this | L | IGG-local (mapped) |
| `igg:affiliated_with` | mapped to `BELONGS_TO` | Add `AFFILIATED_WITH` | Distinct semantics from `BELONGS_TO`; institutional affiliation has lifecycle | L | **Promote** |
| `igg:represents` | mapped to `ASSIGNED_TO` | Add `REPRESENTS` | Distinct legal/institutional semantics | L | **Promote** |
| `igg:member_of` | mapped to `BELONGS_TO` | Keep mapping | `BELONGS_TO` is the right fit | L | IGG-local (mapped) |
| `igg:bargains_for` | mapped to `ASSIGNED_TO` | Defer | Overlaps with `REPRESENTS`; let usage decide | M | Defer |
| `igg:negotiates` | mapped to `ASSIGNED_TO` | Defer | Same | M | Defer |
| `igg:supersedes` | mapped to `REFERENCES` | Defer | Document-versioning concern; covered by metadata | M | Defer |
| `igg:eligible_to_vote_in` | mapped to `LINKS_TO` | Keep IGG-local | Voting mechanics carry jurisdictional semantics; do not freeze | M | IGG-local |
| `igg:delegates_to` | mapped to `LINKS_TO` | Keep IGG-local | Same | M | IGG-local |
| `igg:casts` | mapped to `LINKS_TO` | Keep IGG-local | Same | M | IGG-local |
| `igg:holds` | mapped to `HAS` | **Protected** (golden-share holding) | Founder-protection coupling | H | **Protected** |
| `igg:vetoes` | mapped to `REFERENCES` | **Protected** | Founder-protection coupling | H | **Protected** |
| `igg:approves` | mapped to `APPROVED_BY` | Keep mapping | Already canonical | L | IGG-local (mapped) |
| `igg:tenured_as` | mapped to `HAS` | Defer | Role-tenure record; project as metadata first | M | Defer |
| `igg:governed_by` | mapped to `BELONGS_TO` | Add `GOVERNED_BY` | Distinct semantics: who governs whom (org → governing body) | L | **Promote** |
| `igg:depends_on` | substrate `DEPENDS_ON` | Already canonical | — | L | IGG-local (mapped) |
| `igg:overrides` | mapped to `REFERENCES` | Defer | Decision-graph already has `overrides` edge type | L | IGG-local |
| `igg:escalated_to` | mapped to `REFERENCES` | Defer (already in decision-graph as edge type) | Decision-graph carries this; do not duplicate at entity level | L | IGG-local |
| `igg:triggered_by` | mapped to `DEPENDS_ON` | Same | Same | L | IGG-local |
| `igg:informed_by` | mapped to `DEPENDS_ON` | Same | Same | L | IGG-local |

**Promotion tally:** 3 relationships → `AFFILIATED_WITH`, `REPRESENTS`, `GOVERNED_BY`.
**Protected:** 2 → `holds` (golden-share holding), `vetoes`.
**Deferred:** 5.
**IGG-local (mapped to existing substrate types):** 10.

---

## Event kind matrix (chronology — never promoted to ontology entities)

Events live in `IggEventKinds` and surface inside `DecisionNode.outcome.iggEventKind` or `EntityEdge.metadata.iggEventKind`. They are **never** entity kinds. Listed for completeness:

| Event Kind | Visibility |
|---|---|
| `affiliation_transition` | admin-safe |
| `steward_assignment` | admin-safe |
| `role_tenure_event` | admin-safe |
| `voting_session_opened` / `_closed` | admin-safe |
| `eligibility_set` | admin-safe |
| `delegation_declared` | admin-safe |
| `vote_cast` | **anonymized only** |
| `motion_outcome` | admin-safe |
| `negotiation_session` | admin-safe |
| `proposal_exchanged` | admin-safe |
| `cba_ratified` | admin-safe |
| `reserved_matter_raised` | **Protected** — visible only to `governance_suite` admins |
| `class_b_veto` | **Protected** |
| `golden_share_sunset_progression` | **Protected** |
| `protocol_amendment` | admin-safe |

---

## Promotion mechanics (Phase 3 implementation)

The promoted entity kinds and relationships will be added in a single, narrowly-scoped patch to `@nzila/platform-ontology/src/types.ts`:

```ts
// addition only — no removals, no renames
export const OntologyEntityTypes = {
  // … existing …
  CONGRESS: 'Congress',
  FEDERATION: 'Federation',
  BARGAINING_UNIT: 'BargainingUnit',
  COMMITTEE: 'Committee',
  MOTION: 'Motion',
} as const

export const RelationshipTypes = {
  // … existing …
  AFFILIATED_WITH: 'AFFILIATED_WITH',
  REPRESENTS: 'REPRESENTS',
  GOVERNED_BY: 'GOVERNED_BY',
} as const
```

After promotion, `substrateTypeFor` and `substrateRelationshipFor` in [packages/institutional-governance-graph/src/ontology/kinds.ts](../../packages/institutional-governance-graph/src/ontology/kinds.ts) return the promoted canonical type for the corresponding `igg:*` kind. The `metadata.iggKind` string is retained for backward compatibility.

**No removals.** The 12 IGG-local kinds delegated to existing substrate concepts continue to surface their `iggKind` string in metadata. This preserves all Phase 2 consumers.

---

## Protected-semantics fence

A single canonical constant is added to the IGG package and consumed by every visibility decision:

```ts
// packages/institutional-governance-graph/src/protected.ts
export const IGG_PROTECTED_KINDS = new Set<string>([
  'igg:umrc',
  'igg:class_b_special_voting_share',
  'igg:reserved_matter',
  'igg:holds',
  'igg:vetoes',
  'igg:class_b_veto',
  'igg:golden_share_sunset_progression',
  'igg:reserved_matter_raised',
])
```

A Phase 3 test (`protected-semantics.test.ts`) asserts:
1. None of these strings appear in promoted ontology types.
2. Public-tier query surfaces filter them out.
3. Read-model serializers strip them when the caller is not in `governance_suite`.

---

## Decision summary

| Bucket | Count | Action this phase |
|---|---|---|
| Entity kinds promoted | 5 | Add to `OntologyEntityTypes` |
| Relationship kinds promoted | 3 | Add to `RelationshipTypes` |
| Protected | 7 (3 entity + 2 rel + 2 event) | Codified in `IGG_PROTECTED_KINDS`; tested |
| Deferred | 12 | Re-review at Phase 4 kickoff |
| Already-substrate | 12 entity + 10 rel | No change |

This matrix is the input to every other Phase 3 deliverable.
