# ADR-AGRI-002: Cora Food-Economy Ceiling Architecture

**Date**: 2026-10-07  
**Status**: ACCEPTED  
**Decision scope**: Product ceiling, ownership, authority, evidence, and implementation sequence  
**Implementation scope**: Architecture and documentation only

## Context

[ADR-AGRI-001](./ADR-AGRI-001-cora-agrimo-product-boundary.md) established
Cora and Agrimo as first-class peer products with distinct product-owned
domains and a shared agricultural core. The [Phase 0B implementation-seam
audit](../CORA_IMPLEMENTATION_SEAM_AUDIT.md) found no live Cora agricultural
repository call, no Cora-owned persistence boundary, and no Cora-specific
write authorization in the app. It also identified existing agricultural
tables whose product ownership is unresolved.

The repository contains reusable shared primitives, placeholder Cora pages,
and historical planning statements, but none of those establish an
implemented Cora capability or grant write authority. The product ceiling and
its implementation truth therefore need one explicit, evidence-based
architecture.

## Decision

### V3 doctrine alignment - 2026-10-13

**Binding identity:** Cora is **Agricultural Institutional Infrastructure**.
Its core capability is **institutional composability**. The earlier
food-economy ceiling below remains a bounded capability horizon, not an
alternative identity, implementation commitment or activation authority.

This alignment records the accepted corrections supplied for
`NLI_CFA_Discovery_Brief_v3_Oct2026` and
`CORA_Stress_Test_Playbook_v3_Oct2026`. Their full external texts are not
stored in this repository or supplied with the correction prompt; no
line-by-line external-document comparison or CFA findings are claimed.
The supplied strategic states are:

```text
CORA_DISCOVERY_BRIEF_V3 = PASS_WITH_MINOR_ALIGNMENT
CORA_STRESS_TEST_PLAYBOOK_V3 = PASS_WITH_MINOR_ALIGNMENT
CORA_STRESS_TEST_DOCTRINE = READY_FOR_REPO_SYNC
```

Binding doctrine takes precedence over earlier architectural overcommitments:

- Cora operates infrastructure; it does not become evidence authority.
  The originating institution retains authority over what it issued;
  the recipient retains authority over its own conclusions.
- Origin, subject, custody/transmission, infrastructure ownership and
  recipient decision are separate roles. Nzila-operated infrastructure can
  support federated institutional evidence authority.
- Provenance, scope, conditions and relevant temporal state travel with
  evidence. Observation time, source modification, effective time and
  currentness are not interchangeable.
- Producer control applies where the actual authority and rights permit,
  not universally. Public institutional and private evidence can follow
  different authority paths.
- Consent, instruction, institutional mandate, contractual authority,
  legal basis and access preference are distinct. They are not six
  interchangeable legal authorizations. ACCESS_PREFERENCE is a standing
  user/producer choice only within upstream authority; it overrides neither
  law/regulation, contract, mandate nor another party's rights.
- Minimize data; do not prohibit all evidence entering Cora. Cora may
  reference, hash, verify or lawfully carry certificates/documents without
  issuing them. The mechanism is not frozen by doctrine.
- Universal producer-held keys, universal consent, no-single-owner,
  attestations-only and absolute no-data-pooling claims are not binding
  Cora doctrine. Existing reference/hash-only or consent-requiring contracts
  retain their narrower controls until separately authorized changes;
  this qualification does not relax runtime denial.

The [stress-test framework](../CORA_STRESS_TEST_FRAMEWORK.md) is the canonical
route/phase governance home, with source-rights inheritance, independent
route scoring, preregistration, decision memos and portfolio rules.
Production activation, commercial pilot commitment and material route
expansion are `BLOCKED_STRESS_TEST`. Separately authorized foundational
engineering to make a hypothesis testable can continue; there is no
blanket stop-engineering order or live/source permission.

Earlier capability horizon:

> **Cora is the intelligence and coordination network for the food economy.**

Cora is a first-class product for Canada and data-rich agricultural
environments. Agrimo remains a first-class operational agricultural platform
for cooperative, offline-first, and emerging-market contexts. Neither product
is subordinate to, a deployment profile of, or a replacement for the other.
NzilaOS is the shared control plane.

The ceiling comprises Farmer 360; Farmer Value Creation; Value Opportunity;
Scenario Analysis; Opportunity Passport; Association Observatory; Collective
Opportunity Detection; Collective Action; a farmer-controlled Evidence
Wallet; Standards & Assurance Registry; benchmark compatibility; Capital
Readiness; Commerce & Settlement Awareness; Research, Adoption & Outcome
Intelligence; Policy Intervention Intelligence; Foodchain Graph;
Food-System Intelligence; and Verified Value Created.

The authoritative capability-to-dependency, read/write-model, external
authority, and maturity map is
[CORA_CEILING_CAPABILITY_TRUTH.md](../CORA_CEILING_CAPABILITY_TRUTH.md).
Canonical concept ownership and future write authority are in
[CORA_DOMAIN_OWNERSHIP_MATRIX.md](../CORA_DOMAIN_OWNERSHIP_MATRIX.md).

## Domain and Shared-Core Model

- Cora owns agricultural food-economy interpretation, opportunity and
  scenario state, Cora-specific decision records, association and collective
  opportunity domains, agricultural framework adapters, capital-readiness
  context, outcome interpretation, and food-system relationships.
- Agrimo owns its operational farm/cooperative execution records and
  workflows. Cora must not mutate Agrimo-owned records.
- Shared agricultural primitives represent only semantics that are genuinely
  common. Sharing a type, package, tenant, database, or identifier does not
  transfer record ownership or grant mutation authority.
- NzilaOS/shared owns generic identity, organization and tenant scope,
  authorization, policy, audit, evidence, provenance, consent, export,
  workflow, methodology/versioning, graph, integration, and commerce
  primitives where those are already canonical.
- Existing `agri_forecasts`, `agri_price_signals`, and `agri_risk_scores`
  remain ownership-unresolved. Documentation or legacy import notes calling
  them “Cora-writable” are not authorization. Do not reuse them as
  Cora-owned storage without a separately reviewed ownership and data-sharing
  contract; prefer an additive Cora-owned persistence seam in a future
  authorized phase.

## Write-Authority Doctrine

The ownership matrix uses five authority classes:

| Class                             | Meaning                                                                                                                                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORA_WRITE_ALLOWED_FUTURE`       | Cora may write only its own domain records after a separately authorized implementation phase establishes service-layer permission checks, validation, audit/evidence/provenance, retention, and tenant-safe persistence. It grants no present permission. |
| `SHARED_WRITE_VIA_SERVICE`        | Mutations must go through the canonical shared service and its own authorization, consent, audit, and policy contracts; direct Cora storage writes are not implied.                                                                                        |
| `READ_ONLY_EXTERNAL`              | Cora may consume only an explicitly authorized, purpose-limited read/reference contract.                                                                                                                                                                   |
| `AGRIMO_OWNED_DO_NOT_WRITE`       | Agrimo remains the writer and owner of its operational record; Cora may not mutate it.                                                                                                                                                                     |
| `EXTERNAL_AUTHORITY_DO_NOT_WRITE` | The named external authority owns the definition or decision; Cora may adapt, map, or display it but may not authoritatively change it.                                                                                                                    |

Future Cora writes must use server-derived identity and organization scope,
explicit Cora capabilities, a Cora domain service, and a Cora-owned
repository. Tenant filtering is necessary but does not prove product
ownership. Existing Agri roles, shared package access, database connectivity,
or administrative status do not imply Cora authority. Verify deployed
database grants and RLS before any future write path. Preserve the current
read-only contract until a separately authorized phase replaces it with
ownership-aware controls and tests.

## Farmer Data Rights and Aggregation

Freeze the following doctrine:

1. **Farmer-first reciprocity:** Do not collect information without an
   intended participant value and a stated purpose.
2. **Evidence once, reuse many:** Authorized evidence may be reused only
   where the applicable source authority, purpose, rights and policy allow;
   establish participant consent where actually required, not universally.
3. **Purpose limitation:** Permission to share evidence for one purpose does
   not grant universal access or downstream reuse.
4. **Association aggregation:** Use only authorized evidence; enforce
   configurable cohort thresholds; default to aggregate rather than
   individual exposure; block trivial re-identification routes; and preserve
   purpose limitations and auditability.
5. **Explicit participation:** A farmer is not a collective-action
   participant merely because their evidence contributed to an aggregate
   signal. Invitation and consent precede participation.
6. **Data portability:** Farmers and farm enterprises must be able to export
   their authorized evidence and provenance through shared export primitives.
7. **No data sale:** Cora’s economic model must not depend on selling
   identifiable producer data.
8. **No hidden sponsored intelligence:** Vendor payments must not silently
   affect rankings, analyses, or recommendations. Any permitted sponsorship
   must be disclosed and separated from analytical logic.

## Intelligence Epistemology

All Cora conclusions use the following distinct types:

`OBSERVATION`, `DERIVED_METRIC`, `ASSOCIATION`, `ANALYTICAL_FINDING`,
`HYPOTHESIS`, `RECOMMENDATION`, `FORECAST`, `SCENARIO`, and
`ATTRIBUTED_OUTCOME`.

Every consequential conclusion must retain its source evidence,
methodology/version, confidence, time scope, organization scope, and
limitations. A derived value or association is not a causal claim. AI output
does not bypass this taxonomy, validation, or evidence/provenance
requirements. Projected value is not realized value; association is not
attribution.

## Value and Collective-Action Lifecycles

The canonical value-creation lifecycle is:

`OBSERVE → UNDERSTAND → IDENTIFY OPPORTUNITY → MODEL → VALIDATE → DECIDE → PREPARE → EXECUTE OUTSIDE/THROUGH AUTHORIZED SYSTEMS → MEASURE → LEARN`

Opportunity decisions support `EXPLORE`, `VALIDATE`, `PREPARE`, `PROCEED`,
`HOLD`, and `REJECT`. `PROCEED` is a decision disposition, not evidence that
Cora executes a regulated or external action.

Collective opportunity progresses through:

`individual signals → cluster detection → governed aggregation → collective hypothesis → participant invitation → consent → shared business case → institutional disposition → execution pathway → outcome measurement`

No participant is enrolled implicitly by analytics. Consent, purpose,
eligibility, and association authorization remain explicit at each relevant
transition.

## Framework and External-Authority Model

Use one generic, versioned framework architecture with these concepts:

`Framework`, `FrameworkVersion`, `Requirement/Metric`, `Methodology`,
`EvidenceRequirement`, `Applicability`, `EvaluationRule`,
`MissingDataPolicy`, `ConfidencePolicy`, `ExternalAuthority`,
`EffectivePeriod`, `AssessmentResult`, and `EvidenceGap`.

NzilaOS/shared owns generic methodology and versioning primitives where
canonical. Cora owns agricultural adapters, applicability interpretation,
evidence mapping, gap interpretation, and result presentation. The framework
owner retains methodology, benchmark definitions, and certification
authority. Adapters must preserve source, version, effective period, and
authority attribution.

- **National Index V2:** `PENDING_EXTERNAL_SPEC`. Do not invent or persist
  metric definitions before an authoritative specification exists.
- **B Corp:** `DESIGN_ONLY` adapter architecture. Cora may eventually map
  evidence and identify readiness gaps; it may not certify, claim B Lab
  endorsement, or silently reinterpret requirements.

## Capital, Commerce, and Settlement Boundary

Cora owns capital requirement context, opportunity readiness, evidence
sufficiency, financing-structure context, agricultural commercial
interpretation, and realized-proceeds interpretation. Cora does not own
underwriting, credit approval, lending decisions, regulated financial
advice, payment execution, settlement finality, or asset/title finality.

NzilaOS/shared owns canonical obligation, payment, settlement, allocation,
and reconciliation primitives where already present. External regulated
financial entities decide credit and external payment rails execute
payments. Preserve these distinctions:

`COMMERCIAL OBLIGATION != PAYMENT EVENT != SETTLEMENT FINALITY != ASSET/TITLE FINALITY`

Cora may hold authorized references and read models only; it does not become
the authority for the referenced obligation or settlement state.

## Integration-First Product Boundary

Cora is intentionally integration-first. It does not aim to replace full
FMIS platforms, agronomic execution systems, climate MRV engines,
certification authorities, bank/payment rails, every accounting platform,
or commodity marketplaces. It integrates with governed external and shared
systems.

Cora’s differentiated ownership is farmer value creation, opportunity
intelligence, association intelligence, collective action, reusable
agricultural evidence, framework interoperability, opportunity-to-realized-
value lineage, and institutional/food-system intelligence. Integration
never transfers an external system’s decision authority to Cora.

## Maturity and Truth Discipline

Capability maturity is assessed per product capability, not per imported
package or UI route. A package dependency, marketing statement, static
placeholder, legacy roadmap, schema shape, or unverified shared primitive
does not prove an end-to-end Cora capability. `IMPLEMENTED` requires
production-relevant implementation evidence and validation; do not use
`IMPLEMENTED_PENDING_RUNTIME_VALIDATION` as a proxy for unconnected
scaffolding.

The accepted ceiling is not a maturity claim. See the truth map for
capability-by-capability evidence and statuses. The product catalog’s
incubating status, internal deployment, pre-revenue state, and no-proof
level remain unchanged.

## Earlier Implementation Dependency Order

1. Canonical evidence extension
2. Cora-owned persistence seam
3. Farmer 360 read model
4. Value Opportunity
5. Scenario / Decision
6. Opportunity Passport
7. Verified Value Created
8. Association Observatory
9. Collective Opportunity
10. Collective Action
11. Evidence package/share adapters
12. Framework registry/adapters
13. Data Gap Registry
14. Foodchain Graph
15. Research/policy intelligence
16. Capital readiness
17. Commerce/settlement interpretation
18. Food-system intelligence

Under v3 this earlier sequence is a dependency reference, not a frozen
implementation mechanism or a stress-test prerequisite. This is a dependency and design order, not authorization or a delivery
commitment. Before each implementation slice, separately authorize the work,
confirm current repository truth and external specifications, define tenant
and data-rights controls, and validate the relevant shared service contract.

## Non-Goals and Consequences

This decision does not implement product capabilities, change permissions,
create schemas, run migrations, authorize integrations, create a database,
implement National Index methodology, encode B Corp certification logic,
execute payments, make credit decisions, deploy, merge, or mutate production.
Phase 2 is not authorized by this ADR.

Future Cora mutations require an additive Cora-owned domain/service/repository
boundary with explicit Cora grants; no unrestricted Agrimo table access.
Framework and financial authorities remain external where specified.
Evidence, applicable authority/consent, provenance, tenant scope, audit, and purpose limitation
must be applied at the service boundary, not inferred from UI controls.

## References

- [ADR-AGRI-001: Cora and Agrimo Product Boundary Reconstitution](./ADR-AGRI-001-cora-agrimo-product-boundary.md)
- [Cora Implementation-Seam Audit — Phase 0B](../CORA_IMPLEMENTATION_SEAM_AUDIT.md)
- [Cora Domain Ownership Matrix](../CORA_DOMAIN_OWNERSHIP_MATRIX.md)
- [Cora Ceiling Capability Truth](../CORA_CEILING_CAPABILITY_TRUTH.md)
