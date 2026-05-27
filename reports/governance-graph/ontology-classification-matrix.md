# Ontology Classification Matrix — Workstream I

**Doctrine.** Every institutional concept is classified into exactly one of
eight scopes. Promotions require an explicit substrate proposal that re-runs
the ten audit questions in
[reports/governance-graph/workstream-i-ontology-reconciliation-audit.md](workstream-i-ontology-reconciliation-audit.md).

**Scopes.**

1. **Canonical ontology** — `@nzila/platform-ontology` registered enum.
2. **IGG-local semantic** — `igg:`-namespaced; substrate kind preserved in
   `metadata.iggKind`.
3. **Runtime overlay semantic** — derived role/view at projection time; not a
   distinct entity kind.
4. **Observability abstraction** — counts-only / lineage-only read view, gated.
5. **Continuity abstraction** — read-only chronology / tenure / succession view.
6. **Protected governance metadata** — fenced from read surfaces; deny-listed
   against canonicalization.
7. **Historical compatibility semantic** — kept IGG-local pending cross-domain
   demand; do not promote without re-audit.
8. **Never canonicalize** — analytics / surveillance / command-shaped names;
   permanently deny-listed.

**Promotion status.**

- `frozen` — no promotion path.
- `hold-for-demand` — promotable only via an explicit substrate RFC.
- `denied` — permanently rejected.
- `n/a` — already canonical.

---

## Structural entities

| Concept | Current Scope | Recommended Scope | Promotion Status | Risk Level | Reason | Protected? |
|---|---|---|---|---|---|---|
| Tenant | Canonical | Canonical | n/a | low | Cross-domain primitive | No |
| Organization | Canonical | Canonical | n/a | low | Cross-domain primitive | No |
| Person | Canonical | Canonical | n/a | low | Cross-domain primitive | No |
| Member (canonical) | Canonical | Canonical | n/a | low | Cross-domain primitive | No |
| Document | Canonical | Canonical | n/a | low | Cross-domain primitive | No |
| Decision (canonical) | Canonical | Canonical | n/a | medium | Shared with IGG `Decision` view; disambiguate by package boundary | No |
| EvidencePack | Canonical | Canonical | n/a | low | Cross-domain primitive | No |
| AuditEvent | Canonical | Canonical | n/a | low | Cross-domain primitive | No |
| Congress | IGG-local | IGG-local | hold-for-demand | medium | Institution-specific; promotion would inject governance semantics into all canonical consumers | No |
| Federation | IGG-local | IGG-local | hold-for-demand | medium | Same as Congress | No |
| Union (IGG) | IGG-local | IGG-local | hold-for-demand | medium | Same as Congress | No |
| Local (IGG) | IGG-local | IGG-local | hold-for-demand | medium | Same as Congress | No |
| Region / District (IGG) | IGG-local | IGG-local | hold-for-demand | low | Geography overlay on Organization | No |
| Employer / Worksite | IGG-local | IGG-local | hold-for-demand | low | Domain-specific framing on Organization | No |
| BargainingUnit | IGG-local | IGG-local | hold-for-demand | medium | Highly institution-specific construct | No |
| Committee | IGG-local | IGG-local | hold-for-demand | medium | Institution-specific | No |
| UMRC | IGG-local | IGG-local | hold-for-demand | low | Institution-specific naming | No |
| Steward | IGG-local entity + Runtime overlay | Runtime overlay on `Member` | hold-for-demand | low | Role projection; substrate kind already `Member` | No |
| LRO | IGG-local + Runtime overlay | Runtime overlay on `Member` | hold-for-demand | low | Role projection | No |
| NationalRep | IGG-local + Runtime overlay | Runtime overlay on `Member` | hold-for-demand | low | Role projection | No |
| Officer | IGG-local + Runtime overlay | Runtime overlay on `Member` | hold-for-demand | low | Role projection | No |
| Negotiator | IGG-local + Runtime overlay | Runtime overlay on `Member` | hold-for-demand | low | Role projection | No |
| ClassBSpecialVotingShare | IGG-local (protected) | Protected governance metadata | **frozen** | high | Founder-protection construct; never read-surface, never canonical | **Yes** |
| ReservedMatter | IGG-local (protected) | Protected governance metadata | **frozen** | high | Founder-protection construct | **Yes** |
| Bylaw | IGG-local | IGG-local | hold-for-demand | low | Document subtype; promotion would over-fit canonical Document | No |
| CBA | IGG-local | IGG-local | hold-for-demand | low | Document subtype | No |
| Motion | IGG-local | IGG-local | hold-for-demand | low | Decision precursor; substrate kind already `Decision` | No |
| Proposal | IGG-local | IGG-local | hold-for-demand | low | Decision precursor | No |
| GovernanceDecision (read view) | IGG-local read shape | Observability abstraction (read-only projection of canonical `Decision`) | hold-for-demand | medium | Display semantics only — never a new substrate kind | No |
| ProceduralEscalation | IGG-local concept (event-derived) | IGG-local | hold-for-demand | medium | Composed from `ESCALATED_TO` edges and escalation events; not an entity kind | No |

## Relationship kinds

| Concept | Current Scope | Recommended Scope | Promotion Status | Risk Level | Reason | Protected? |
|---|---|---|---|---|---|---|
| BELONGS_TO / HAS / REFERENCES / LINKS_TO / DEPENDS_ON / PARENT_OF / CHILD_OF / ASSIGNED_TO / CREATED_BY / APPROVED_BY / PRODUCES | Canonical | Canonical | n/a | low | Cross-domain primitives | No |
| REPRESENTS | IGG-local (substrate fallback `ASSIGNED_TO`) | IGG-local | hold-for-demand | medium | Institution-specific representation semantics | No |
| AFFILIATED_WITH | IGG-local (fallback `BELONGS_TO`) | IGG-local | hold-for-demand | medium | Institution-specific | No |
| GOVERNED_BY | IGG-local (fallback `BELONGS_TO`) | IGG-local | hold-for-demand | medium | Institution-specific | No |
| DELEGATES_TO | IGG-local (fallback `LINKS_TO`) | IGG-local | hold-for-demand | medium | Voting-context delegation; institution-specific | No |
| ESCALATED_TO | IGG-local (fallback `REFERENCES`) | IGG-local | hold-for-demand | medium | Procedural escalation semantics | No |
| MEMBER_OF | IGG-local (fallback `BELONGS_TO`) | IGG-local | hold-for-demand | medium | Membership semantics already covered by canonical BELONGS_TO | No |
| SUCCESSOR_TO | Not present (composed from tenure events) | Continuity abstraction | hold-for-demand | medium | Composed from `TENURED_AS` + chronology; not an entity edge today | No |
| PARTICIPATES_IN | Not present | **Never canonicalize** | denied | low | Implied by votes/sessions; promotion would balloon edge surface | No |
| SUPERSEDES | IGG-local (fallback `REFERENCES`) | Historical compatibility | hold-for-demand | low | Plausible cross-domain candidate (policy/document); not promoted today | No |
| BARGAINS_FOR / NEGOTIATES | IGG-local | IGG-local | hold-for-demand | low | Institution-specific | No |
| ELIGIBLE_TO_VOTE_IN / CASTS / APPROVES (IGG) | IGG-local | IGG-local | hold-for-demand | low | Voting-context semantics | No |
| TENURED_AS | IGG-local | Continuity abstraction (IGG-local backing edge) | hold-for-demand | medium | Source for tenure / succession views | No |
| INFORMED_BY / TRIGGERED_BY | IGG-local | IGG-local | hold-for-demand | low | Provenance edges | No |
| **VETOES** | IGG-local (protected) | Protected governance metadata | **frozen** | high | Class B mechanic | **Yes** |
| **HOLDS** | IGG-local (protected) | Protected governance metadata | **frozen** | high | Class B mechanic | **Yes** |
| **OVERRIDES** | IGG-local (protected) | Protected governance metadata | **frozen** | high | Class B mechanic | **Yes** |

## Event / continuity / observability

| Concept | Current Scope | Recommended Scope | Promotion Status | Risk Level | Reason | Protected? |
|---|---|---|---|---|---|---|
| InstitutionalTimeline | IGG-local read view | Continuity abstraction | hold-for-demand | low | Composed view; never an entity kind | No |
| ContinuityTransition | IGG-local concept | Continuity abstraction | hold-for-demand | medium | Founder-protection adjacent; read-only | No |
| RoleTenure / SuccessionLink | IGG-local | Continuity abstraction | hold-for-demand | low | Composed from tenure events | No |
| AffiliationTransition | IGG event kind | Continuity abstraction | hold-for-demand | low | Already an event kind | No |
| InstitutionalObservabilitySnapshot | IGG read view (gated) | Observability abstraction | frozen | low | Counts-only, env-gated, no persistence | No |
| ModuleDisplayMetadata | UE app concept | Observability abstraction | frozen | low | Cosmetic only | No |
| TrustExplainabilityRecord | IGG read view | Observability abstraction | frozen | low | Lineage-only, no scoring | No |
| ChronologyEntry | IGG read view | Continuity abstraction | hold-for-demand | low | Backing data for timeline | No |
| EvidenceCitation | IGG read view | Observability abstraction | hold-for-demand | low | Read-only convergence over canonical EvidencePack | No |

## Forbidden semantic shapes (Tier 2 deny-list)

| Concept | Current Scope | Recommended Scope | Promotion Status | Risk Level | Reason | Protected? |
|---|---|---|---|---|---|---|
| InstitutionalScore / GovernanceScore / TrustScore | not present | **Never canonicalize** | denied | high | Numeric ranking → analytics framing | n/a |
| GovernanceForecast / GovernancePrediction | not present | **Never canonicalize** | denied | high | Predictive automation framing | n/a |
| InfluenceTopology / OrganizationalIntelligence | not present | **Never canonicalize** | denied | high | Surveillance framing | n/a |
| GovernanceCommandSystem / BehaviouralGovernance | not present | **Never canonicalize** | denied | high | Command-and-control framing | n/a |
| GovernanceAI / PredictiveGovernance | not present | **Never canonicalize** | denied | high | Automation framing | n/a |
| InstitutionalSurveillance | not present | **Never canonicalize** | denied | high | Surveillance framing | n/a |

---

## Reading guide

- A row whose **Recommended Scope** matches **Current Scope** is in compliance.
- A row whose **Promotion Status** is `denied` or `frozen` is enforced by the
  canonicalization deny-list at
   [packages/institutional-governance-graph/src/ontology/canonicalization.ts](../../packages/organizational-governance-graph/src/ontology/canonicalization.ts).
- A row whose **Promotion Status** is `hold-for-demand` may only move to
  *Canonical* via an RFC that re-runs the ten audit questions.
