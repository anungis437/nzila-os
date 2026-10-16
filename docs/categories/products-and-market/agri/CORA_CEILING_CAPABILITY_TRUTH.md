# Cora Ceiling Capability Truth

**Authority:** [ADR-AGRI-002](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md)  
**Repository evidence:** [Phase 0B implementation-seam audit](CORA_IMPLEMENTATION_SEAM_AUDIT.md)  
**Date:** 2026-10-07  
**Portfolio truth:** Cora remains `incubating`, internal, `pre-revenue`, with
zero customers, zero pilots, and `proof_level: none` in
[`product-catalog.json`](../../../../governance/portfolio/product-catalog.json).

## Status rules

| Status                                   | Meaning                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `IMPLEMENTED`                            | Capability is connected end-to-end in the product and supported by relevant tests/evidence.     |
| `IMPLEMENTED_PENDING_RUNTIME_VALIDATION` | End-to-end implementation exists but designated runtime validation is still outstanding.        |
| `PARTIAL`                                | A meaningful, tested part of the capability works in the product, with clear missing scope.     |
| `DESIGN_ONLY`                            | Product intent or architecture is documented; no end-to-end capability is established.          |
| `DEFERRED`                               | Explicitly outside the present delivery scope or reserved for a later authorized slice.         |
| `BLOCKED`                                | A known dependency, authority, or safety condition prevents implementation.                     |
| `PENDING_EXTERNAL_SPEC`                  | An authoritative external specification is required before design can define substantive rules. |

The classifications below describe Cora product capabilities, not whether a
shared package contains reusable primitives. Most app pages remain
placeholders; a route, TODO, marketing statement, legacy roadmap, package
dependency, table shape, or unverified capability name is not implementation
evidence. Farmer 360 has a local DB-backed service/persistence acceptance
harness with synthetic canonical identity, membership, and grant records. It
does not validate Entra or production identity. Its capability truth remains
`DESIGN_ONLY`; a separate institutional policy is still required before
Agrimo facts may be disclosed.

## Authoritative capability map

| Capability                                 | Product owner                                                                                                  | Shared dependencies                                                                                                  | Read model                                                                                | Write model                                                                                               | External authority                                                     | Maturity state                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Farmer 360                                 | Cora                                                                                                           | Shared farm/producer/field/season/production primitives; identity, org, authorization, evidence, provenance, consent | Cora profile context and source facts only after separate source-disclosure authorization | Cora-owned `FarmEnterprise` and `FarmEconomicProfile` projections; no Agrimo source-row writes            | Source systems retain source-fact authority                            | `DESIGN_ONLY` ([source-disclosure foundation](CORA_FARMER_360.md)); no active Agrimo-to-Cora policy |
| Farmer Value Creation                      | Cora                                                                                                           | Evidence/provenance, policy, workflow, methodology/versioning                                                        | Cora opportunity, scenario, decision, and outcome read models over authorized inputs      | Cora-owned opportunity and outcome interpretation records                                                 | Counterparties own offers; external systems own execution facts        | `DESIGN_ONLY`                                                                                       |
| Value Opportunity                          | Cora                                                                                                           | Shared identity/org, evidence, provenance, policy                                                                    | Cora opportunity candidates and their cited inputs                                        | Cora-owned `ValueOpportunity` lifecycle                                                                   | Counterparties retain offer authority                                  | `DESIGN_ONLY`                                                                                       |
| Scenario Analysis                          | Cora                                                                                                           | Shared methodology/versioning, provenance, analytics primitives                                                      | Versioned Cora scenario projections                                                       | Cora-owned scenario inputs, assumptions, and results                                                      | Source providers retain source authority                               | `DESIGN_ONLY`                                                                                       |
| Opportunity Passport                       | Cora                                                                                                           | Shared evidence, provenance, consent, export, audit                                                                  | Authorized evidence and opportunity package view                                          | Cora-owned package manifest; evidence sharing/export only through shared service                          | Evidence originators retain source authority                           | `DESIGN_ONLY`                                                                                       |
| Association Observatory                    | Cora                                                                                                           | Shared authorization, consent, aggregation policy, audit, evidence                                                   | Authorized and thresholded aggregate/member-intelligence views                            | Cora-owned profiles, aggregate observations, and freshness/quality findings                               | Associations own membership and institutional decisions                | `DESIGN_ONLY`                                                                                       |
| Collective Opportunity Detection           | Cora                                                                                                           | Shared graph, evidence, provenance, aggregation and consent policy                                                   | Governed cluster and collective-hypothesis views                                          | Cora-owned collective opportunity candidates; no participant enrollment by inference                      | Association/institution owns disposition                               | `DESIGN_ONLY`                                                                                       |
| Collective Action                          | Cora                                                                                                           | Shared workflow, consent, org relationships, evidence, audit                                                         | Collective business case and participant state                                            | Cora-owned coordination and decision state; external execution remains external                           | Institutions and participants own their approvals/actions              | `DESIGN_ONLY`                                                                                       |
| Farmer-controlled Evidence Wallet          | Cora owns agricultural packages, claim templates, and UX; NzilaOS owns generic evidence rails                  | Evidence, provenance, consent, grants, export, audit                                                                 | Farmer-authorized evidence and provenance view                                            | Cora package metadata via shared evidence services; purpose-bound share grants via shared consent service | Evidence originator retains source authority                           | `DESIGN_ONLY`                                                                                       |
| Standards & Assurance Registry             | Cora owns agricultural adapters and presentation; shared methodology/versioning is reused                      | Generic framework/version primitives, evidence, provenance                                                           | Versioned framework metadata and Cora mappings                                            | Cora-owned adapter/mapping records; external definitions remain read-only                                 | Framework issuer/certifier                                             | `DESIGN_ONLY`                                                                                       |
| Benchmark compatibility                    | Cora owns applicability, evidence mapping, gap interpretation, and results                                     | Shared methodology, evidence, provenance, confidence policy                                                          | Versioned benchmark assessment/readiness projections                                      | Cora-owned assessment and mapping results only                                                            | Benchmark owner controls definitions and official results              | `DESIGN_ONLY`                                                                                       |
| Capital Readiness                          | Cora                                                                                                           | Evidence/provenance, opportunity and scenario models, shared policy                                                  | Cora readiness and evidence-sufficiency view; authorized lender requirements              | Cora-owned readiness interpretation, not credit outcome                                                   | Lenders/underwriters own underwriting, approval, and lending decisions | `DESIGN_ONLY`                                                                                       |
| Commerce & Settlement Awareness            | Cora owns agricultural commercial interpretation; NzilaOS/shared owns canonical commerce/settlement primitives | Commerce core, authorized obligation/payment/settlement reads, evidence                                              | Cora interpretation of obligations and proceeds, with distinct settlement references      | Cora-owned interpretation only; never payment, allocation, reconciliation, or settlement writes           | Contracting parties, regulated institutions, and payment rails         | `DESIGN_ONLY`                                                                                       |
| Research / Adoption / Outcome Intelligence | Cora owns agricultural interpretation and cohort models                                                        | Shared workflow, evidence, consent, policy, audit, provenance                                                        | Purpose-limited cohort and outcome read models                                            | Cora-owned agriculture-specific project/measurement interpretation through shared consent/workflow        | Research institution, sponsor, participant, or program source          | `DESIGN_ONLY`                                                                                       |
| Policy Intervention Intelligence           | Cora owns agricultural hypotheses and intervention/outcome interpretation                                      | Shared workflow, evidence, consent, policy, audit, provenance                                                        | Authorized program and outcome views                                                      | Cora-owned hypotheses/analysis only; no policy or program execution writes                                | Public authority/program owner                                         | `DESIGN_ONLY`                                                                                       |
| Foodchain Graph                            | Cora owns agricultural semantics and food-system relationship interpretation; shared graph primitive reused    | Tenant-safe graph service, identity, authorization, provenance                                                       | Authorized, purpose-limited graph projection                                              | Cora-owned relationships only through persistent authorized graph service                                 | Endpoint owners retain their source facts                              | `DESIGN_ONLY`                                                                                       |
| Food-System Intelligence                   | Cora                                                                                                           | Shared graph, evidence, provenance, methodology, aggregation policy                                                  | Multi-organization authorized analytical views                                            | Cora-owned findings/hypotheses with scoped source references                                              | Source owners and public authorities retain source/decision authority  | `DESIGN_ONLY`                                                                                       |
| Verified Value Created                     | Cora                                                                                                           | Shared evidence, provenance, methodology/versioning, audit                                                           | Baseline/forecast/realized comparisons with attribution class                             | Cora-owned verified-value result, subject to evidence and methodology checks                              | Transaction/source system owns underlying realized facts               | `DESIGN_ONLY`                                                                                       |

## Explicit framework and external-authority statuses

Farmer 360 has tested domain/service contracts, concrete Cora-owned
persistence, an org-filtered canonical producer read adapter, an authenticated
read API, and a narrow read permission. The Phase 3.5A disposable local
acceptance harness provisioned canonical-shaped org, audit, and producer
prerequisites, applied the Phase 2/3 migrations, and proved the real DB-backed
service and route handler behavior. The route test still substitutes mocked
platform authentication, and consent/policy allow decisions use explicit
test-only evaluators. Thus authenticated end-to-end acceptance is incomplete,
production write permissions remain ungranted, and capability maturity stays
`DESIGN_ONLY`.

| Item                                      | Maturity state                    | Boundary                                                                                                                                               |
| ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| National Index V2                         | `PENDING_EXTERNAL_SPEC`           | Obtain and version the authoritative specification before defining metrics, requirements, or evaluation rules. No metric definitions are created here. |
| B Corp agricultural adapter               | `DESIGN_ONLY`                     | Evidence mapping and readiness-gap architecture only. No certification logic, certification claim, B Lab endorsement, or reinterpretation.             |
| Certification decisions                   | `EXTERNAL_AUTHORITY_DO_NOT_WRITE` | Cora may show authorized evidence/readiness; a certifier alone decides certification.                                                                  |
| Underwriting and credit approval          | `DEFERRED`                        | Outside Cora’s authority; performed by regulated lenders/underwriters.                                                                                 |
| Payment execution and settlement finality | `DEFERRED`                        | External rails execute; canonical shared commerce/settlement services own their records. Cora is read/interpretation only.                             |

## Repository evidence and limitations

- Cora pages for price signals and cooperative performance are static
  placeholder UI with TODOs; they do not load data or implement the named
  analytics. They do not qualify as `PARTIAL`.
- The Cora marketing page contains feature/statistic claims, but marketing
  content is not implementation or validation evidence.
- Shared agri packages contain useful primitives and analytics-related code.
  Phase 0B found no live Cora app caller at that time; Phase 3.5A now wires
  only Farmer 360's canonical producer read. Other shared capability is not
  evidence of a delivered Cora product capability.
- `agri_forecasts`, `agri_price_signals`, and `agri_risk_scores` have
  unresolved product ownership; legacy import notes do not authorize Cora
  writes.
- Historical Agrotech roadmaps contain older platform and convergence
  assumptions. They are not a current Cora capability inventory or maturity
  source and are superseded by ADR-AGRI-001/002 for product boundaries.
- No capability is classified `IMPLEMENTED`,
  `IMPLEMENTED_PENDING_RUNTIME_VALIDATION`, or `PARTIAL`: Farmer 360's
  authenticated runtime acceptance remains blocked by the mocked auth
  boundary, and the other capabilities still lack product-connected
  implementation evidence. Revisit maturity only against executable
  implementation and acceptance evidence.

## Frozen implementation order

This sequence is architecture only; it is not a commitment or deployment
authorization. Value Opportunity must remain deferred until Farmer 360 passes
the missing authenticated route acceptance gate:

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

See [ADR-AGRI-002](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md) for
preconditions and invariants.
