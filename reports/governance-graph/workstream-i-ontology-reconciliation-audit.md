# Workstream I — Ontology Reconciliation & Institutional Semantic Governance Audit

**Date:** 2026-05-12
**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**Scope:** `packages/platform-ontology`, `packages/institutional-governance-graph`,
`apps/union-eyes` (read surfaces only).
**Doctrine:** Institutional semantic discipline. *Additive, classification-driven,
explainable. No automation. No analytics. No exposure. No promotion of protected
governance metadata.*
[packages/institutional-governance-graph/src/ontology/kinds.ts](../../packages/organizational-governance-graph/src/ontology/kinds.ts).
The canonical [packages/platform-ontology/src/types.ts](../../packages/platform-ontology/src/types.ts)

## 1. Why this audit exists

Workstreams A–G converged Union Eyes onto an Institutional Governance Graph (IGG)
that emits projections into the canonical platform substrate
(`@nzila/platform-entity-graph`, `@nzila/platform-decision-graph`). IGG declares
**~25 entity kinds, 20 relationship kinds and 16 event kinds** in
The canonical [packages/platform-ontology/src/types.ts](../../packages/platform-ontology/src/types.ts)
ships **34 entity types and 11 relationship types** keyed for cross-domain
business operations (Tenant, Person, Case, Claim, EvidencePack, AuditEvent, …).

   substrate one PR at a time (e.g. someone adds `Congress` to
   `OntologyEntityTypes` for convenience).
2. **Protected-semantic promotion** — Class B / golden-share / reserved-matter
   constructs become first-class ontology citizens, eroding the founder-protection
   fence established in `governance/protected.ts`.
3. **Cross-domain semantic collision** — generic terms (`Decision`, `Member`,
   `Approval`) carry subtly different meanings across IGG, agrimo, trustcore and
   veridian-care, producing untraceable behavioural divergence.

Workstream I introduces **institutional semantic governance**: a classification
make every promotion deliberate, reviewable and reversible.

---

For each candidate concept, the audit answers the ten verbatim questions
from the Workstream I prompt:

1. Is it substrate-worthy across multiple domains?
2. Is it specific to institutional governance?
3. Is it protected (founder protection / Class B / continuity safeguards)?
4. Is it duplicated in another package?
5. Is it expressible via existing canonical kinds?
6. Does promotion expand surface area inappropriately?
7. Could promotion enable analytics or scoring downstream?
8. Does promotion preserve continuity discipline?
9. Does promotion preserve explainability?
10. Does promotion preserve institutional safety?

### Canonical Ontology Decision Rule

A concept is **only** classified as *Canonical ontology* when answers 1–2 are
"yes / domain-neutral", 3 is "no", 4–5 are "no" and 6–10 are all "preserves
discipline". Any single failure pushes the concept into IGG-local, runtime
overlay, observability, continuity, protected-metadata, historical-compat,
or never-canonicalize.

---

## 3. Inventory at audit time

### 3.1 Canonical ontology — `@nzila/platform-ontology`

Source: [packages/platform-ontology/src/types.ts](../../packages/platform-ontology/src/types.ts#L11)

  Client, Family, Case, Claim, Program, Document, Communication, Task, Workflow,
  Decision, RiskEvent, Policy, Approval, EvidencePack, AuditEvent, Asset,
  Property, Deal, Invoice, Payment, Shipment, Product, Farmer, Parcel, Subsidy,
  RegistryRecord.
The full enumeration with rationale per concept is in
[reports/governance-graph/ontology-classification-matrix.md](../../reports/governance-graph/ontology-classification-matrix.md).
  DEPENDS_ON, PARENT_OF, CHILD_OF, ASSIGNED_TO, CREATED_BY, APPROVED_BY.

- **Statuses (5):** active, inactive, archived, pending, suspended.

The canonical registry is **closed-set** (TypeScript const enum). Adding kinds
requires a substrate change — explicitly out of scope for IGG (see
[packages/institutional-governance-graph/src/ontology/kinds.ts](../../packages/organizational-governance-graph/src/ontology/kinds.ts#L1)
header comment).

### 3.2 IGG-local ontology — `@nzila/institutional-governance-graph`

Source: [packages/institutional-governance-graph/src/ontology/kinds.ts](../../packages/organizational-governance-graph/src/ontology/kinds.ts#L19)

- **Entity kinds (25):** PLATFORM, CONGRESS, FEDERATION, UNION, LOCAL, REGION,
  DISTRICT, EMPLOYER, WORKSITE, BARGAINING_UNIT, COMMITTEE, MEMBER, STEWARD, LRO,
  NATIONAL_REP, OFFICER, NEGOTIATOR, UMRC, **CLASS_B_SPECIAL_VOTING_SHARE**,
  **RESERVED_MATTER**, BYLAW, CBA, MOTION, PROPOSAL, DECISION, EVIDENCE,
  AUDIT_ENTRY.
- **Relationship kinds (20):** PARENT_OF, AFFILIATED_WITH, REPRESENTS, MEMBER_OF,
  BARGAINS_FOR, NEGOTIATES, SUPERSEDES, ELIGIBLE_TO_VOTE_IN, DELEGATES_TO,
  CASTS, **HOLDS**, **VETOES**, APPROVES, TENURED_AS, GOVERNED_BY, DEPENDS_ON,
  **OVERRIDES**, ESCALATED_TO, TRIGGERED_BY, INFORMED_BY.
- **Event kinds (16):** AFFILIATION_TRANSITION, STEWARD_ASSIGNMENT,
  ROLE_TENURE_EVENT, VOTING_SESSION_OPENED, VOTING_SESSION_CLOSED,
  ELIGIBILITY_SET, DELEGATION_DECLARED, VOTE_CAST, MOTION_OUTCOME,
  NEGOTIATION_SESSION, PROPOSAL_EXCHANGED, CBA_RATIFIED,
  **RESERVED_MATTER_RAISED**, **CLASS_B_VETO**,
  **GOLDEN_SHARE_SUNSET_PROGRESSION**, PROTOCOL_AMENDMENT.

Bold entries are already enumerated as protected in
[packages/institutional-governance-graph/src/governance/protected.ts](../../packages/organizational-governance-graph/src/governance/protected.ts#L26).

### 3.3 Existing fence

The three-stage protected-semantics fence
(`redactProtected → assertNoProtectedKindsInReadSurface → build* →
assertNoProtectedKindsInProjections`) is the *only* defence in place today
against protected-kind exposure. There is **no** defence against:

- A future PR adding `CLASS_B_SPECIAL_VOTING_SHARE` to
  `OntologyEntityTypes` in `platform-ontology`.
- A future PR routing `CongressMember` through the canonical `Member` kind
  with founder-protection metadata.
Workstream I closes those gaps.

---

## 4. Concept-by-concept classification rationale

### 4.1 Institutional structural concepts

| Concept | Q1 substrate-worthy? | Q2 institution-specific? | Q3 protected? | Verdict |
|---|---|---|---|---|
| Congress | No (institutional only) | Yes | No | **IGG-local** |
| Federation | No | Yes | No | **IGG-local** |
| Union | No | Yes | No | **IGG-local** |
| Local | No | Yes | No | **IGG-local** |
| Committee | No | Yes | No | **IGG-local** |
| Steward / LRO / NationalRep / Officer / Negotiator | Partial — already covered by `Person` / `Member` | Yes (role overlay) | No | **Runtime overlay** on canonical `Member` (kind preserved in `metadata.iggKind`) |
| UMRC | No | Yes | No | **IGG-local** |
| CLASS_B_SPECIAL_VOTING_SHARE | No | N/A — protected | **Yes** | **Protected governance metadata** — never canonical, never read-surface |
| RESERVED_MATTER | No | N/A | **Yes** | **Protected governance metadata** |

### 4.2 Institutional relationship concepts

| Concept | Q5 expressible canonically? | Q6 surface area? | Verdict |
|---|---|---|---|
| REPRESENTS | Maps to `ASSIGNED_TO` (substrate fallback already in place) | Expanding canonical to include REPRESENTS would inject institutional semantics into agrimo/trustcore graphs | **IGG-local** (substrate kind in `metadata.iggKind`) |
| AFFILIATED_WITH | Maps to `BELONGS_TO` | Same risk | **IGG-local** |
| GOVERNED_BY | Maps to `BELONGS_TO` | Same risk | **IGG-local** |
| DELEGATES_TO | Maps to `LINKS_TO` | Same risk | **IGG-local** |
| ESCALATED_TO | Maps to `REFERENCES` | Same risk | **IGG-local** |
| MEMBER_OF | Maps to `BELONGS_TO` | Same risk | **IGG-local** |
| SUPERSEDES | Maps to `REFERENCES` | Useful for chronology — could be canonical for documents/policies, but needs cross-domain demand first | **Historical compatibility** (kept IGG-local until cross-domain demand) |
| PARTICIPATES_IN | Not present; participation is modelled via votes/sessions | N/A | **Never canonicalize** — implied by event projections, never a relationship edge |
| **VETOES** / **HOLDS** / **OVERRIDES** | N/A — protected | N/A | **Protected governance metadata** |

### 4.3 Continuity & lineage primitives

| Concept | Verdict | Reason |
|---|---|---|
| InstitutionalTimeline | **Continuity abstraction** (IGG-local read view) | Composed from chronology entries; has no canonical equivalent and must remain read-only |
| RoleTenure / SuccessionLink | **Continuity abstraction** | Modelled via `TENURED_AS` edges; lineage view only |
| AffiliationTransition | **Continuity abstraction** | Already an IGG event kind |

| ModuleDisplayMetadata | **Observability abstraction** | Cosmetic surface, must not become an entity kind |
| TrustExplainabilityRecord | **Observability abstraction** | Read-only convergence, no scoring, no rank, no weight |
| GovernanceDecision (display projection) | **Observability abstraction** for the read view; the underlying `Decision` is canonical | Distinguish substrate `Decision` from the IGG read shape |

### 4.5 Forbidden canonicalizations (Q7 + Q10 fail)

Any future construct named or behaving like the following must **never** be
promoted to the canonical ontology, regardless of demand:

- InstitutionalScore, GovernanceScore, TrustScore (numeric ranking → analytics)
- GovernanceForecast, GovernancePrediction (predictive automation)
- InfluenceTopology, OrganizationalIntelligence, GovernanceAI (surveillance framing)
- BehaviouralGovernance, GovernanceCommandSystem (command-and-control framing)
- Class B / golden-share / reserved-matter — already protected; deny-listed
  here for defence-in-depth against future renames.

---

## 5. Audit answers (verbatim Q&A)

The full enumeration with rationale per concept is in
[reports/governance-graph/ontology-classification-matrix.md](ontology-classification-matrix.md).
The following are the consolidated answers across the inventory:

1. **Substrate-worthy across multiple domains?** Only generic abstractions
   already in `platform-ontology` qualify. No IGG-local kind currently
   demonstrates cross-domain demand sufficient for promotion.
2. **Specific to institutional governance?** All 25 IGG entity kinds and 20
   relationship kinds are institution-specific.
3. **Protected?** 2 entity kinds, 3 relationship kinds, 3 event kinds and 2
   decision categories are protected. They appear in the deny-list shipped in
   §6 below.
4. **Duplicated in another package?** No duplications detected today. Risk
   exists for `Member` (canonical) vs. `MEMBER` (IGG) — disambiguated by the
   `igg:` namespace prefix.
5. **Expressible via existing canonical kinds?** Yes for the structural
   relationships (BELONGS_TO, REFERENCES, LINKS_TO, ASSIGNED_TO, HAS, DEPENDS_ON,
   PARENT_OF). Substrate fallback is already implemented at
   [packages/institutional-governance-graph/src/ontology/kinds.ts](../../packages/organizational-governance-graph/src/ontology/kinds.ts#L160).
6. **Surface area expansion?** Promotion of any IGG kind would inject
   institutional semantics into every consumer of `platform-ontology`. **Not
   acceptable** without explicit cross-domain demand and a substrate proposal.
7. **Enables analytics or scoring?** Several candidate names (Influence,
   Topology, Score, Forecast) would. They are deny-listed.
8. **Preserves continuity discipline?** Continuity primitives must remain
   read-only abstractions composed from chronology + tenure + succession edges.
   No canonical `ContinuityTransition` entity kind.
9. **Preserves explainability?** Observability and trust read views must remain
   counts-only and lineage-only. No structural keys (score, rank, ratio,
   percentage, average, weight, prediction, recommendation).
10. **Preserves institutional safety?** Protected governance metadata stays
    behind the three-stage fence and is additionally deny-listed against future
    canonicalization.

---

## 6. Canonicalization deny-list (to be enforced in §F implementation)

The deny-list is the *intent declaration*. The implementation in
[packages/institutional-governance-graph/src/ontology/canonicalization.ts](../../packages/organizational-governance-graph/src/ontology/canonicalization.ts)
enforces it at test time and exposes inspection helpers.

**Tier 1 — Absolute (protected governance metadata, never canonicalize):**

- Entity kinds: `igg:class_b_special_voting_share`, `igg:reserved_matter`
- Relationship kinds: `igg:vetoes`, `igg:holds`, `igg:overrides`
- Event kinds: `igg:class_b_veto`, `igg:golden_share_sunset_progression`,
  `igg:reserved_matter_raised`
- Decision categories: `class_b_veto`, `reserved_matter_vote`

**Tier 2 — Forbidden semantic shapes (analytics / surveillance / command):**

- Any name containing: `score`, `rank`, `ranking`, `weight`, `ratio`,
  `percent`, `percentage`, `average`, `mean`, `efficiency`, `stability`,
  `caucus`, `prediction`, `forecast`, `recommendation`, `topology`,
  `influence`, `surveillance`, `command-system`, `behavioural-governance`,
  `governance-ai`, `governance-optimization`, `organizational-intelligence`,
  `predictive-governance`, `institutional-scoring`.

**Tier 3 — Hold-for-demand (IGG-local until proven cross-domain):**

- Structural institutional kinds (Congress, Federation, Union, Local,
  BargainingUnit, Committee, …) and institutional relationship kinds
  (REPRESENTS, AFFILIATED_WITH, GOVERNED_BY, DELEGATES_TO, ESCALATED_TO,
  MEMBER_OF). May only be promoted via an explicit substrate proposal that
  re-runs questions 1–10.

---

## 7. Recommendations

1. **Ship the canonicalization deny-list as code** (§F) so promotions cannot
   land silently.
2. **Ship reconciliation tests** that fail CI if (a) a deny-listed kind
   appears in `OntologyEntityTypes` / `RelationshipTypes`, (b) a protected
   IGG kind escapes the read fence, or (c) an IGG export accidentally adopts
   a forbidden semantic shape.
3. **Extend the narrative vocabulary** (§J) so the same discipline is
   enforced at the documentation surface — forbidden ontology-pollution terms
   on the negative axis, continuity / explainability / lineage themes on the
   rewarded axis.
4. **Do not** alter `platform-ontology` in this workstream. The canonical
   registry remains closed-set; IGG keeps using the substrate-fallback
   pattern with `metadata.iggKind` preservation.
5. **Continue prohibiting** automation, analytics, scoring, ranking,
   prediction, forecasting and exposure of protected metadata.

---

## 8. Out of scope

- Any change to the canonical `OntologyEntityTypes` / `RelationshipTypes`
  enums.
- Any new runtime behaviour, persistence, or background processing.
- Any UI exposure, dashboard, or analytical projection.
- Any modification to the existing protected-semantics fence — Workstream I is
  *additive* and only layers the canonicalization deny-list above it.
