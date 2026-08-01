# Nzila Evidence and Commercial Readiness Dossier

**Prepared by:** Nzila Ventures  
**Date:** August 2026

---

## Cover Page

This dossier is a repository-grounded evidence package prepared for lender diligence, government-program review, strategic partnerships, procurement, and institutional stakeholders. It converts business assertions into traceable repository artifacts and flags gaps openly.

## Table of Contents

1. Executive Summary  
2. Company  
3. Institutional Intelligence  
4. Products  
5. Technology  
6. Commercialization  
7. Security  
8. Operations  
9. Validation  
10. Intellectual Property  
11. Evidence Register  
12. Gap Register  
13. Commercial Readiness  
14. Timeline  
15. Appendices

---

# Nzila Evidence & Commercial Readiness Dossier

Prepared for lender, government-program, strategic-partner, procurement, and institutional diligence use.

## Purpose

This evidence book converts major business assertions about Nzila Ventures into repository-traceable proof. It is intentionally conservative: when evidence is partial, planned, or conflicting, the dossier says so.

## How to Use

1. Start with [00-Executive-Summary.md](./00-Executive-Summary.md).
2. Use [10-Evidence-Register.md](./10-Evidence-Register.md) for claim-by-claim traceability.
3. Use [11-Gap-Register.md](./11-Gap-Register.md) to understand what is still missing.
4. Use [12-Commercial-Readiness.md](./12-Commercial-Readiness.md) for a scored readiness view.
5. Use [Nzila-Evidence-and-Commercial-Readiness-Dossier.md](./Nzila-Evidence-and-Commercial-Readiness-Dossier.md) for the publication-ready combined document.

## File Listing

| File | Purpose |
|---|---|
| `00-Executive-Summary.md` | High-level diligence summary and overall maturity assessment |
| `01-Company.md` | Corporate identity, governance, principals, and repository-operating evidence |
| `02-Institutional-Intelligence.md` | Institutional Intelligence / OCI doctrine and methodology evidence |
| `03-Products.md` | Product-by-product evidence for Union Eyes, FairCase, and CourtLens |
| `04-Technology.md` | Shared platform, architecture, packages, infrastructure, and CI/CD evidence |
| `05-Commercialization.md` | Pricing, pilot motions, GTM materials, and commercial packaging |
| `06-Security.md` | Security, privacy, auditability, AI governance, and compliance posture |
| `07-Operations.md` | Delivery, release, SRE, DR, FinOps, and operational governance |
| `08-Validation.md` | Pilots, proof runs, validation materials, and external-review readiness |
| `09-IP.md` | Software, methodology, documentation, brand, and commercial-asset inventory |
| `10-Evidence-Register.md` | Traceability matrix for substantive business claims |
| `11-Gap-Register.md` | Honest gap log and remediation priorities |
| `12-Commercial-Readiness.md` | Evidence-based readiness scorecard |
| `13-Timeline.md` | Chronological repository-derived milestone view |
| `APPENDICES.md` | File index, glossary, abbreviations, and legend |
| `Nzila-Evidence-and-Commercial-Readiness-Dossier.md` | Full compiled dossier |

## Confidence Rating Legend

| Confidence | Meaning |
|---|---|
| **Verified** | Directly supported by implemented code, repository artifacts, or published documentation. |
| **Demonstrated** | Proven through demos, working implementations, or repeatable processes. |
| **Documented** | Supported by formal documentation but awaiting broader operational validation. |
| **Planned** | Approved roadmap item with documented intent but not yet implemented. |
| **Not Yet Evidenced** | Mentioned in strategy but not currently supported by sufficient repository artifacts. |

## Evidence Boundaries

- Repository scope reviewed included: `README.md`, `README.business.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, doctrine and OCI whitepapers, product and commercial documentation, `governance/`, `docs/governance/`, `docs/compliance/`, `docs/readiness/`, `docs/union-eyes/pilot-evidence-pack/`, `apps/`, `packages/`, and `.github/workflows/`.
- Repository scan on 2026-08-01 found **26** top-level app directories under `apps/`, **225** top-level package directories under `packages/`, and **52** workflow files under `.github/workflows/`.
- Where commercial documents conflict with governance or code artifacts, this dossier defers to the stronger evidence source and logs the inconsistency in the gap register.

---
# 00 — Executive Summary

## Objective

Provide a concise, evidence-based view of Nzila Ventures' business maturity, technology readiness, and commercial readiness using only repository-observable artifacts.

## Evidence Summary

- **Nzila operates a shared multi-product software platform rather than a single-point product codebase.** **Confidence: Verified.** Evidence: `README.md`, `README.business.md`, `ARCHITECTURE.md`, `governance/portfolio/product-catalog.json`, `apps/`, `packages/`.
- **Three products are positioned as the current commercial focus: Union Eyes, FairCase, and Flow; Union Eyes and FairCase are the primary products relevant to this dossier.** **Confidence: Verified.** Evidence: `README.md`, `reports/portfolio-status.md`, `governance/portfolio/product-catalog.json`, `apps/union-eyes/maturity.json`, `apps/abr/maturity.json`.
- **Union Eyes has the strongest repository-backed commercial readiness evidence.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/README.md`, `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `apps/union-eyes/maturity.json`, `docs/readiness/production-certification.md`.
- **FairCase has meaningful product and GTM documentation plus implemented modules, but weaker deployment- and certification-grade evidence than Union Eyes.** **Confidence: Documented.** Evidence: `apps/abr/README.md`, `apps/abr/maturity.json`, `docs/categories/products-and-market/faircase/`, `reports/portfolio-status.md`.
- **CourtLens is currently a planning and migration program, not a shipped commercial runtime.** **Confidence: Verified.** Evidence: `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`, `docs/courtlens/pilot-readiness-plan.md`.
- **The shared platform shows real engineering maturity: governed packages, release gates, production certification artifacts, evidence-pack tooling, and multiple security workflows.** **Confidence: Verified.** Evidence: `README.md`, `package.json`, `ARCHITECTURE.md`, `docs/readiness/`, `.github/workflows/`.
- **Commercial documentation is extensive, but parts of it outpace hard operational proof and occasionally conflict with stronger governance artifacts.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`.

## Business Overview and Maturity

| Area | Assessment | Confidence | Basis |
|---|---|---|---|
| Corporate operating presence | Repository demonstrates sustained operating activity across governance, engineering, commercial, and product surfaces. | Verified | `README.business.md`, `governance/`, `docs/`, `apps/`, `packages/` |
| Product portfolio maturity | Mixed maturity: Union Eyes and FairCase are pilot-stage sell-now products; CourtLens remains pre-implementation. | Verified | `reports/portfolio-status.md`, product `apps/union-eyes/maturity.json` and `apps/abr/maturity.json`, `docs/courtlens/` |
| Governance maturity | Strong documentation and gate architecture exist, though some governance artifacts remain aspirational or process-only. | Documented | `docs/governance/gates/gate-taxonomy.md`, `governance/README.md`, `docs/compliance/soc2/` |
| Revenue-operating discipline | Commercial packages, pricing, and pursuit systems exist; signed-customer evidence is limited in-repo. | Documented | `docs/categories/stakeholders/commercial/`, `governance/portfolio/product-catalog.json` |

## Estimated Technology Readiness Level (derived assessment)

| Scope | TRL Estimate | Rationale | Confidence |
|---|---:|---|---|
| Shared platform controls | 8 | Production certification corpus exists for live runtimes, release gates, isolation, backup, and runtime inventory. | Demonstrated |
| Union Eyes | 7 | Controlled pilot clearance, pilot evidence pack, product readiness report, and production-certified infrastructure exist; product expansion remains conditional. | Demonstrated |
| FairCase | 6 | Implemented modules and pilot/commercial materials exist, but equivalent live readiness evidence is partial. | Documented |
| CourtLens | 3 | Architecture, migration, and pilot planning exist; implementation is intentionally deferred. | Planned |

## Commercial Readiness

- **Union Eyes:** strongest commercial dossier, pilot offer, pricing, buyer review paths, and trust artifacts. **Confidence: Demonstrated.** Evidence: `docs/categories/stakeholders/commercial/`, `docs/union-eyes/pilot-evidence-pack/`, `apps/union-eyes/maturity.json`.
- **FairCase:** commercial packaging exists and is substantive, but some procurement claims require down-rating because stronger repository evidence does not confirm them. **Confidence: Documented.** Evidence: `docs/categories/products-and-market/faircase/`, `apps/abr/maturity.json`, `docs/categories/stakeholders/commercial/claims-ledger.md`.
- **CourtLens:** no current commercialization evidence beyond pilot-definition planning. **Confidence: Planned.** Evidence: `docs/courtlens/pilot-readiness-plan.md`.

## Key Findings

1. **Nzila's strongest lender- and partner-ready asset is not a generic slide narrative but a repository-backed evidence culture.** **Confidence: Verified.** Evidence: `proof-artifacts/`, `reports/`, `docs/union-eyes/pilot-evidence-pack/`, `docs/readiness/`.
2. **Union Eyes is the primary documentary proof point for near-term commercialization.** **Confidence: Demonstrated.** Evidence: `apps/union-eyes/maturity.json`, `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`.
3. **FairCase is commercially legible and technically substantive, but not yet supported by the same depth of run-time proof.** **Confidence: Documented.** Evidence: `apps/abr/README.md`, `apps/abr/maturity.json`, `docs/categories/products-and-market/faircase/`.
4. **CourtLens should be presented as a planned extension, not as an implemented product.** **Confidence: Verified.** Evidence: `docs/courtlens/README.md`.
5. **The repository contains a strong operations and governance substrate that can support institutional diligence conversations.** **Confidence: Verified.** Evidence: `package.json`, `docs/readiness/production-certification.md`, `docs/governance/gates/gate-taxonomy.md`, `.github/workflows/`.
6. **Several commercial and governance narratives need tighter synchronization before external diligence at scale.** **Confidence: Verified.** Evidence: package/workflow count mismatches between `README.business.md` and current directory state; legal-entity mismatch in `docs/categories/products-and-market/faircase/procurement-trust-kit.md`; SOC 2 / pentest status caveats in `docs/compliance/soc2/gap-log.md` and `docs/categories/stakeholders/commercial/claims-ledger.md`.

## Document Confidence Summary

| Section | Confidence |
|---|---|
| Company and governance facts | Verified / Documented |
| Institutional Intelligence doctrine | Verified |
| Product maturity | Verified / Documented / Planned, by product |
| Shared technology platform | Verified |
| Security and operations | Verified / Documented |
| Commercialization | Documented / Demonstrated |
| Validation and traction | Demonstrated for Union Eyes pilot processes; otherwise Documented or Not Yet Evidenced |

## Supporting Artifacts

- `README.md`
- `README.business.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `governance/portfolio/product-catalog.json`
- `reports/portfolio-status.md`
- `apps/union-eyes/maturity.json`
- `apps/abr/maturity.json`
- `docs/union-eyes/pilot-evidence-pack/`
- `docs/readiness/`

## Current Maturity

Nzila appears most mature as a governed shared platform with one strongly evidenced pilot-ready product family (Union Eyes), one materially documented pilot-stage product (FairCase), and one planning-stage extension (CourtLens).

## Commercialization Relevance

This repository can credibly support diligence on platform capability, governance discipline, pilot readiness, and product packaging. It is weaker on signed-contract evidence, audited compliance attestations, and verified external traction.

## Gaps

- Signed customer contracts and booked revenue evidence are not present in-repo.
- Some commercial collateral uses stronger wording than the stronger evidence supports.
- Corporate-entity naming is inconsistent across artifacts.

## Next Milestone

Synchronize external-facing commercial materials with the strongest internal evidence sources, then package Union Eyes and FairCase into consistent lender/procurement briefing sets.

---
# 01 — Company

## Objective

Establish Nzila Ventures' corporate identity, leadership, governance posture, and evidence of operating existence using only repository artifacts.

## Evidence Summary

- **Nzila Ventures Inc. is documented as the federal holding company for the portfolio.** **Confidence: Documented.** Evidence: `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`, `governance/corporate/Incorporation-Constitution.pdf`.
- **Nzila Digital Ventures is used as an operating/brand identity in business-facing materials.** **Confidence: Documented.** Evidence: `README.business.md`.
- **Aubert is the strongest evidenced principal in the repository and is recorded as founder/CEO and authorized governance owner.** **Confidence: Verified.** Evidence: `governance/corporate/leadership.json`, `docs/governance/owner-operated-review-model.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`.
- **Michel is recorded in the operating leadership registry as President with responsibility for Union Eyes, ABR, labour/legal commercialization, and buyer trust programs.** **Confidence: Documented.** Evidence: `governance/corporate/leadership.json`.
- **The repository explicitly documents an owner-operated governance model with technical gates retained as mandatory controls.** **Confidence: Verified.** Evidence: `docs/governance/owner-operated-review-model.md`.

## Corporate Identity

| Topic | Evidence-based statement | Confidence | Supporting artifacts |
|---|---|---|---|
| Legal entity | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` names **Nzila Ventures Inc.** as the federally incorporated parent company. | Documented | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| Operating brand | `README.business.md` uses **Nzila Digital Ventures** as the business-line umbrella identity. | Documented | `README.business.md` |
| Legal records presence | `governance/corporate/Incorporation-Constitution.pdf` exists as a corporate artifact in-repo. | Verified | `governance/corporate/Incorporation-Constitution.pdf` |
| Portfolio relationship | The portfolio is managed centrally through `governance/portfolio/product-catalog.json`. | Verified | `governance/portfolio/product-catalog.json` |

## Business Structure

- **Holding-company model:** `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` describes Nzila Ventures Inc. as the parent holding company for IP, product lines, and operating ventures. **Confidence: Documented.**
- **Central IP ownership model:** both `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` and `governance/corporate/governance/document-founder-executive-roles-equity-memo.md` state that IP remains centrally controlled unless explicitly assigned or licensed. **Confidence: Documented.**
- **Single-accountability product routing:** `governance/corporate/leadership.json` assigns product decision rights to named roles and states that ambiguous ownership is a failure condition. **Confidence: Verified.**

## Founders / Principals

| Principal fact | Assessment | Confidence | Evidence |
|---|---|---|---|
| Lumbanzila Aubert Nungisa is recorded as founder, CEO, incorporator, and sole director in the shareholder summary. | Strongest legal-identity evidence in repo. | Documented | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| Aubert is recorded as founder_ceo in the leadership registry. | Operating-leadership evidence. | Verified | `governance/corporate/leadership.json` |
| Michel is recorded as president with labour/legal commercialization scope. | Operating-leadership evidence; surname is not included in the registry. | Documented | `governance/corporate/leadership.json` |
| No broader management roster is consistently evidenced in current repo artifacts. | Should be treated as incomplete. | Not Yet Evidenced | Repository-wide review |

## Organization Overview

- **Shared-platform operating model:** the repository supports many domain products over shared platform packages and governance. **Confidence: Verified.** Evidence: `README.md`, `README.business.md`, `ARCHITECTURE.md`, `packages/`, `apps/`.
- **Commercial concentration discipline:** `reports/portfolio-status.md` and `governance/portfolio/product-catalog.json` show explicit focus tiers and sell-now motions. **Confidence: Verified.**
- **Cross-functional operating evidence:** engineering (`package.json`, `.github/workflows/`), governance (`governance/`), commercial (`docs/categories/stakeholders/commercial/`), and compliance (`docs/compliance/`) artifacts coexist in one repository. **Confidence: Verified.**

## Governance Model

| Governance element | Assessment | Confidence | Evidence |
|---|---|---|---|
| Owner-operated review model | Explicitly documented; authorized owner may apply governance/security approvals, but technical gates remain mandatory. | Verified | `docs/governance/owner-operated-review-model.md` |
| Board structure | Shareholder summary describes a single-director structure and evolving advisory model. | Documented | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`, `governance/corporate/board/README.md` |
| Founder succession planning | A founder continuity plan exists, but its maintenance fields are incomplete and approval status is not evidenced. | Documented | `governance/corporate/governance/policy-founder-succession-continuity-plan.md` |
| Governance automation | Repository-level governance gates and authority taxonomy are implemented and documented. | Verified | `docs/governance/gates/gate-taxonomy.md`, `governance/gates/`, `.github/workflows/nzila-governance.yml` |

## Repository as Evidence of Operational Existence

- **Observable operating system:** the repository contains current products, platform packages, workflows, governance records, corporate files, compliance scaffolding, commercial packs, and readiness certifications. **Confidence: Verified.**
- **Scale evidence:** repository inspection found 26 app directories, 225 package directories, and 52 workflow files. **Confidence: Verified.** Evidence: `apps/`, `packages/`, `.github/workflows/`.
- **Release and production evidence:** `docs/readiness/production-certification.md` and companion certifications show a current production-readiness corpus. **Confidence: Demonstrated.**

## Supporting Artifacts

- `README.business.md`
- `governance/corporate/leadership.json`
- `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`
- `governance/corporate/governance/document-founder-executive-roles-equity-memo.md`
- `governance/corporate/governance/policy-founder-succession-continuity-plan.md`
- `docs/governance/owner-operated-review-model.md`
- `governance/README.md`
- `governance/portfolio/product-catalog.json`

## Current Maturity

Corporate identity and operating ownership are documented, but board, advisory, and broader executive-governance evidence is not yet as strong as the engineering and product-governance evidence.

## Commercialization Relevance

Lenders and partners can verify that the business is organized around a real operating repository and named corporate artifacts. They should also note that some corporate governance materials appear to be draft-grade or maintained outside the repository.

## Gaps

- Entity naming is inconsistent across the repository (Nzila Ventures Inc., Nzila Digital Ventures, and in one FairCase commercial artifact, Nzila OS Inc.).
- Board minutes and formal governance resolutions are referenced conceptually but not surfaced as current in-repo evidence.
- Principals beyond Aubert and Michel are not clearly evidenced.

## Next Milestone

Normalize legal-entity naming across all commercial materials and publish a single authoritative corporate fact sheet sourced from `governance/corporate/`.

---
# 02 — Institutional Intelligence

## Objective

Document the repository evidence for Institutional Intelligence (II), Organizational Continuity Infrastructure (OCI), OCRA, and the wider doctrine system that frames Nzila's category position.

## Evidence Summary

- **Nzila defines itself as institutional continuity infrastructure.** **Confidence: Verified.** Evidence: `docs/doctrine/DOCTRINE.md`, `README.business.md`, `docs/doctrine/whitepapers/INSTITUTIONAL_INTELLIGENCE_PRIMER.md`.
- **OCI and OCRA are not casual marketing language in this repository; they are expressed as canonical doctrine, whitepapers, and implementation-linked methodology.** **Confidence: Verified.** Evidence: `docs/oci/OCI_METHOD.md`, `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`, `docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md`, `apps/union-eyes/lib/oci/frameworks/`.
- **The methodology corpus is unusually explicit about evidence strength, methodological limits, and anti-surveillance boundaries.** **Confidence: Verified.** Evidence: `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`, `docs/doctrine/DOCTRINE.md`, `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md` (referenced from the methodology corpus).
- **Institutional Intelligence exists in the repository both as doctrine and as package/application structure.** **Confidence: Verified.** Evidence: `packages/institutional-intelligence`, `packages/continuity-analysis`, `packages/organizational-cognition-core`, `packages/oci-confidence`, `apps/union-eyes/lib/oci/frameworks/`.

## Definition of Institutional Intelligence as a Category

| Category statement | Confidence | Supporting artifacts |
|---|---|---|
| Nzila positions itself as infrastructure that helps institutions preserve operational continuity, governance integrity, and organizational memory over time. | Verified | `docs/doctrine/DOCTRINE.md`, `README.business.md` |
| The doctrine distinguishes Nzila from transactional SaaS, generic workflow tools, CRMs, and black-box AI copilots. | Verified | `docs/doctrine/DOCTRINE.md` |
| The doctrine frames Institutional Intelligence as a new infrastructure category rather than a feature layer. | Verified | `docs/doctrine/DOCTRINE.md`, `docs/doctrine/whitepapers/INSTITUTIONAL_INTELLIGENCE_PRIMER.md` |

## OCI Methodology

- **Canonical methodology spine:** `docs/oci/OCI_METHOD.md` positions OCI as a five-phase method and doctrine-governed operating framework. **Confidence: Verified.**
- **Publication-grade specification:** `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` links methodology claims to code, companion registries, and testable invariants. **Confidence: Verified.**
- **Operational front door:** `docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md` presents OCRA as the diagnostic instrument. **Confidence: Verified.**
- **Implementation linkage:** the methodology spec explicitly points to `apps/union-eyes/lib/oci/frameworks/` as source implementation. **Confidence: Verified.**

## Whitepapers in Repository

| Whitepaper / artifact | Role | Confidence |
|---|---|---|
| `docs/doctrine/whitepapers/INSTITUTIONAL_INTELLIGENCE_PRIMER.md` | Primer framing the category and doctrine | Verified |
| `docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md` | Foundational research whitepaper with explicit governance metadata | Verified |
| `docs/oci/whitepapers/THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md` | Operational-origin framing tied to Union Eyes | Verified |
| `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` | Formal methodology specification | Verified |

## Frameworks and Operating Principles

The methodology whitepaper and doctrine corpus evidence at least the following formal frameworks or principles:

- **Stewardship Density Index™** — `apps/union-eyes/lib/oci/frameworks/stewardship-density-index.ts`. **Confidence: Verified.**
- **Governance Entropy Scale™** — `apps/union-eyes/lib/oci/frameworks/governance-entropy-scale.ts`. **Confidence: Verified.**
- **Continuity Burden Map™** — `apps/union-eyes/lib/oci/frameworks/continuity-burden-map.ts`. **Confidence: Verified.**
- **Continuity Survivability Matrix™** — `apps/union-eyes/lib/oci/frameworks/continuity-survivability-matrix.ts`. **Confidence: Verified.**
- **Reconstruction Burden Index™** — `apps/union-eyes/lib/oci/frameworks/reconstruction-burden-index.ts`. **Confidence: Verified.**
- **Construct invariant / anti-overclaim posture / reviewer-led method / anti-surveillance boundary.** **Confidence: Verified.** Evidence: `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`.

## Terminology and Doctrine

- **Vocabulary system:** `docs/doctrine/DOCTRINE.md` includes a vocabulary intensity ladder, canonical term definitions, and forbidden language. **Confidence: Verified.**
- **Category discipline:** the methodology spec states that coefficient maturity must be labeled honestly and not overstated. **Confidence: Verified.**
- **Commercial implication:** this doctrine gives Nzila a defensible category narrative for institutional buyers, but only where paired with product proof. **Confidence: Documented.** Evidence: doctrine corpus plus product evidence elsewhere in repo.

## Repository Evidence Map

| Repository area | What it proves | Confidence |
|---|---|---|
| `docs/doctrine/` | Canonical doctrine, vocabulary, whitepapers, programs | Verified |
| `docs/oci/` | OCI method, whitepapers, government-readiness layer, methodology machinery | Verified |
| `apps/union-eyes/lib/oci/frameworks/` | Code-linked framework implementation | Verified |
| `packages/organizational-cognition-core`, `packages/institutional-intelligence`, `packages/oci-confidence` | Platform/package embodiment of the doctrine direction | Verified |

## Commercialization Relevance

Institutional Intelligence is a key differentiator for government programs, strategic partners, and institutional buyers because it transforms Nzila from a feature vendor into a methodology-and-platform provider. The doctrine is commercially useful because it is documented, versioned, and partially linked to implementation, but its commercial strength still depends on product-specific operating proof.

## Supporting Artifacts

- `docs/doctrine/DOCTRINE.md`
- `docs/doctrine/whitepapers/INSTITUTIONAL_INTELLIGENCE_PRIMER.md`
- `docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md`
- `docs/oci/OCI_METHOD.md`
- `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`
- `docs/oci/whitepapers/THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md`
- `docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md`
- `apps/union-eyes/lib/oci/frameworks/`

## Current Maturity

The doctrine and methodology corpus is mature as documentation and partially implementation-linked. It is stronger as a documented category and methodology than as a fully validated external standard.

## Gaps

- External peer review or institutional adoption evidence for the OCI method is not completed in-repo. **Confidence: Not Yet Evidenced.**
- The methodology spec explicitly states that many coefficients are practitioner-informed or theoretical rather than empirically calibrated. **Confidence: Verified.**
- CLEAR Method was requested in the dossier brief, but a canonical repository artifact for a separate CLEAR methodology was not identified in the reviewed materials. **Confidence: Not Yet Evidenced.**

## Next Milestone

Convert the methodology's documented external-review and empirical-calibration plans into completed validation artifacts linked back into the doctrine corpus.

---
# 03 — Products

## Objective

Assess the three primary commercial products referenced in the brief — Union Eyes, FairCase, and CourtLens — using repository evidence only.

## Evidence Summary

- **Union Eyes is the most evidenced commercial product in the repository.** **Confidence: Demonstrated.** Evidence: `apps/union-eyes/README.md`, `apps/union-eyes/maturity.json`, `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/products-and-market/union-eyes/`, `docs/readiness/production-certification.md`.
- **FairCase (formerly ABR) is a real application with implemented modules, localization, pilot packaging, and GTM materials.** **Confidence: Verified.** Evidence: `apps/abr/README.md`, `apps/abr/maturity.json`, `docs/categories/products-and-market/faircase/`.
- **CourtLens currently exists as a migration and pilot-planning workstream built to reuse ABR.** **Confidence: Verified.** Evidence: `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`, `docs/courtlens/pilot-readiness-plan.md`.

---

## Union Eyes

### Purpose and Problem Solved

- **Union Eyes is built for Canadian union administration, representation, and case management.** **Confidence: Verified.** Evidence: `apps/union-eyes/README.md`, `docs/categories/stakeholders/commercial/why-union-eyes.md`, `docs/categories/products-and-market/union-eyes/README.md`.
- **The core workflow is intake → work/casework → intelligence → outcomes.** **Confidence: Verified.** Evidence: `docs/categories/products-and-market/union-eyes/README.md`, `docs/categories/products-and-market/union-eyes/pilot-overview.md`.

### Target Market

- **Labour unions, locals, federations, councils, and public-sector labour organizations are the clearly documented buyer set.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/executive-summary.md`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`, `docs/categories/stakeholders/commercial/why-union-eyes.md`.

### Current Maturity

| Dimension | Assessment | Confidence | Evidence |
|---|---|---|---|
| GTM posture | sell-now | Verified | `apps/union-eyes/maturity.json`, `governance/portfolio/product-catalog.json` |
| Proof level | pilot-proof | Verified | `apps/union-eyes/maturity.json`, `reports/portfolio-status.md` |
| Runtime posture | Controlled pilot GO; broader production restricted by conditions | Demonstrated | `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md` |
| Product completeness | Strong but not gap-free; product readiness report still records missing list pages and incomplete journey coverage | Demonstrated | `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md` |

### Implemented Capabilities

- Grievance lifecycle and casework routing. **Confidence: Verified.** Evidence: `apps/union-eyes/README.md`, `apps/union-eyes/lib/services/claim-workflow-fsm.ts`, `docs/categories/products-and-market/union-eyes/pilot-kpis.md`.
- Evidence export and seal verification. **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`.
- Pilot metrics and readiness checks. **Confidence: Verified.** Evidence: `apps/union-eyes/lib/pilot-metrics.ts`, `apps/union-eyes/docs/procurement/PILOT_SCOPE.md`, `docs/categories/products-and-market/union-eyes/pilot-kpis.md`.
- Case intelligence with authorization-first filtering. **Confidence: Verified.** Evidence: `docs/categories/products-and-market/union-eyes/case-intelligence.md`.
- Federation and governance tooling. **Confidence: Documented.** Evidence: `apps/union-eyes/README.md`, `apps/union-eyes/docs/INDEX.md`.

### Architecture

- **Dual-stack:** Next.js frontend/API + Django authoritative backend. **Confidence: Verified.** Evidence: `apps/union-eyes/README.md`, `apps/union-eyes/docs/architecture/ARCHITECTURE_SHAPE.md`.
- **Security boundary:** org-scoped RLS, RBAC, audit chain, evidence packs. **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`.

### Commercial Readiness

Union Eyes has the most complete buyer-facing package in the repository: pricing, pilot offer, security one-pagers, sales-kit assets, buyer review paths, operations runbooks, and product-readiness evidence. **Confidence: Demonstrated.** Evidence: `docs/categories/stakeholders/commercial/`, `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/stakeholders/commercial/sales-kit/README.md`.

### Repository Evidence

- `apps/union-eyes/README.md`
- `apps/union-eyes/maturity.json`
- `apps/union-eyes/docs/INDEX.md`
- `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`
- `docs/categories/products-and-market/union-eyes/`
- `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`
- `docs/union-eyes/pilot-evidence-pack/`

### Gaps

- User-testing results are explicitly missing from the readiness report. **Confidence: Verified.**
- Some pilot-critical routes were still missing in the product readiness report reviewed. **Confidence: Demonstrated.**
- Broad production expansion remains conditional. **Confidence: Demonstrated.**

### Next Milestone

Convert controlled-pilot evidence into signed-customer and renewal evidence, while closing the remaining product-readiness gaps identified in `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`.

---

## FairCase / ABR

### Purpose and Problem Solved

- **FairCase is positioned as a justice and equity governance platform for institutions handling complaints, investigations, accountability, and anti-Black-racism operations.** **Confidence: Verified.** Evidence: `apps/abr/README.md`, `docs/categories/products-and-market/faircase/executive-summary.md`, `docs/categories/products-and-market/faircase/buyer-pack.md`.

### Target Market

- **Documented buyers include public-sector institutions, universities, health authorities, unions, CHRO functions, general counsel, and equity/human-rights offices.** **Confidence: Documented.** Evidence: `docs/categories/products-and-market/faircase/buyer-pack.md`, `docs/categories/products-and-market/faircase/pilot-package-v1.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md`.

### Current Maturity

| Dimension | Assessment | Confidence | Evidence |
|---|---|---|---|
| GTM posture | sell-now | Verified | `apps/abr/maturity.json`, `governance/portfolio/product-catalog.json` |
| Proof level | pilot-proof | Verified | `apps/abr/maturity.json`, `reports/portfolio-status.md` |
| Product state | Implemented application with persistent data, export layer, pipeline service, and bilingual coverage | Verified | `apps/abr/README.md` |
| Operational evidence | Partial maturity with open gaps in contracts, backup/restore proof, analytics lineage, and access-review artifacts | Verified | `apps/abr/maturity.json` |

### Implemented Capabilities

- Tribunal intelligence explorer. **Confidence: Verified.** Evidence: `apps/abr/modules/intelligence/README.md`, `apps/abr/README.md`.
- Incident governance lifecycle. **Confidence: Verified.** Evidence: `apps/abr/modules/incidents/README.md`, `apps/abr/README.md`.
- Executive governance exports and board-ready summaries. **Confidence: Verified.** Evidence: `apps/abr/modules/governance/README.md`, `apps/abr/README.md`.
- Accountability analytics. **Confidence: Verified.** Evidence: `apps/abr/modules/analytics/README.md`.
- Learning and certification workflows. **Confidence: Verified.** Evidence: `apps/abr/modules/learning/README.md`.
- Bilingual dashboard coverage. **Confidence: Documented.** Evidence: `apps/abr/README.md`.

### Architecture

- **Shared-platform reuse:** `packages/platform-auth/package.json`, `packages/db/package.json`, `packages/decision-core/package.json`, `packages/governed-workflow/package.json`, and `packages/ui/package.json`. **Confidence: Verified.** Evidence: `apps/abr/package.json`.
- **Dual-stack shape:** Next.js plus Django backend sidecar. **Confidence: Verified.** Evidence: `apps/abr/README.md`.

### Commercial Readiness

FairCase has robust narrative and packaging materials: executive summary, buyer pack, pricing model, pilot package, procurement trust kit, objection handling, proposal templates, and ROI materials. **Confidence: Documented.** Evidence: `docs/categories/products-and-market/faircase/`.

However, some FairCase collateral asserts stronger compliance and corporate facts than stronger repository evidence confirms. Examples include legal-entity naming and certification status in `docs/categories/products-and-market/faircase/procurement-trust-kit.md`. Those claims should be down-rated until reconciled. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/compliance/soc2/gap-log.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`.

### Repository Evidence

- `apps/abr/README.md`
- `apps/abr/maturity.json`
- `apps/abr/modules/`
- `docs/categories/products-and-market/faircase/`
- `governance/portfolio/product-catalog.json`

### Gaps

- Backup/restore proof is still partial in the maturity file.
- Access-review evidence is documented but not yet signed as quarterly evidence.
- Procurement collateral includes claims that require tighter reconciliation.

### Next Milestone

Bring FairCase buyer-facing trust claims into strict alignment with `apps/abr/maturity.json`, then add equivalent live-readiness and pilot-evidence-pack artifacts.

---

## CourtLens

### Purpose and Problem Solved

- **CourtLens is framed as supervised, review-ready justice operations infrastructure, not an AI lawyer.** **Confidence: Verified.** Evidence: `docs/courtlens/README.md`.
- **Its intended problem space is access-to-justice intake, matter review, packet generation, referral tracking, and human-supervised legal operations.** **Confidence: Planned.** Evidence: `docs/courtlens/pilot-readiness-plan.md`, `docs/courtlens/target-architecture.md`.

### Target Market

- **Pilot buyer assumptions include legal clinics, unions, nonprofits, pro bono organizations, and parent legal networks.** **Confidence: Planned.** Evidence: `docs/courtlens/pilot-readiness-plan.md`.

### Current Maturity

| Dimension | Assessment | Confidence | Evidence |
|---|---|---|---|
| Product stage | Phase 0 planning and migration design | Verified | `docs/courtlens/README.md` |
| Technical posture | Reuse-first design on ABR primitives | Verified | `docs/courtlens/target-architecture.md` |
| Pilot posture | Smallest credible pilot is defined, but implementation is not yet complete | Planned | `docs/courtlens/pilot-readiness-plan.md` |

### Implemented Capabilities

No implemented CourtLens runtime was evidenced in the reviewed repository artifacts. The repository instead evidences architecture mapping, gap analysis, and pilot acceptance criteria. **Confidence: Verified.** Evidence: `docs/courtlens/`.

### Architecture

- **ABR reuse-first architecture:** matters, workflow, RBAC, audit, evidence, NAR, and AI review packet generation are intended to build on ABR rather than duplicate it. **Confidence: Verified.** Evidence: `docs/courtlens/target-architecture.md`.
- **Human-in-the-loop AI boundary:** AI packet outputs remain draft-only until human approval. **Confidence: Verified.** Evidence: `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`, `docs/courtlens/pilot-readiness-plan.md`.

### Commercial Readiness

CourtLens is not yet commercially ready on repository evidence. It is better described as an adjacent pipeline or expansion program rather than a presently saleable product. **Confidence: Planned.**

### Repository Evidence

- `docs/courtlens/README.md`
- `docs/courtlens/target-architecture.md`
- `docs/courtlens/pilot-readiness-plan.md`
- `docs/courtlens/implementation-sequence.md`

### Gaps

- No implemented runtime evidence.
- No independent pricing or sales materials comparable to Union Eyes/FairCase.
- No maturity file or production evidence corpus.

### Next Milestone

Complete the ABR reuse audit, implement the minimum pilot workflow set, and publish a CourtLens maturity record before presenting it as an active commercial product.

---
# 04 — Technology

## Objective

Summarize the shared platform technology, architecture, deployment, and engineering-operating evidence behind the Nzila product portfolio.

## Evidence Summary

- **Nzila OS is architected as shared decision infrastructure across multiple product surfaces.** **Confidence: Verified.** Evidence: `README.md`, `ARCHITECTURE.md`, `packages/decision-core/`.
- **The repository uses a monorepo structure with pnpm workspaces and Turborepo.** **Confidence: Verified.** Evidence: `README.md`, `package.json`.
- **Authentication is centralized in @nzila/platform-auth.** **Confidence: Verified.** Evidence: `README.md`, `packages/platform-auth/package.json`, `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`.
- **Production-readiness artifacts exist for selected live runtimes.** **Confidence: Demonstrated.** Evidence: `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md`, `docs/readiness/platform-production-runtime-inventory.md`.

## Shared Technology Platform

| Platform element | Assessment | Confidence | Evidence |
|---|---|---|---|
| Decision core | Canonical decision primitives exported from @nzila/decision-core | Verified | `README.md`, `packages/decision-core/package.json` |
| Shared database layer | Central Drizzle-based package @nzila/db | Verified | `packages/db/package.json`, `README.md` |
| Shared UI | Cross-app UI package @nzila/ui | Verified | `packages/ui/package.json` |
| Pilot proof layer | Dedicated pilot metrics package @nzila/platform-pilot-metrics | Verified | `packages/platform-pilot-metrics/package.json` |
| Auth authority | One platform auth package for identity, authz, password, magic link, invites, MFA, and Entra | Verified | `packages/platform-auth/package.json` |

## Authentication / Authorization

- **Canonical auth authority:** `README.md` and `governance/platform-package-authority.json` designate @nzila/platform-auth as authoritative. **Confidence: Verified.**
- **Auth capability surface:** email/password, magic link, invites, MFA, risk scoring, and Entra components are exported from @nzila/platform-auth. **Confidence: Verified.** Evidence: `packages/platform-auth/package.json`.
- **Per-org auth policy model and audit logging are documented for Union Eyes.** **Confidence: Documented.** Evidence: `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`.

## Multi-Tenant Architecture

- **Org-scoped by construction** is a repeated platform claim and is supported by repository artifacts around RLS, org scoping, and control maps. **Confidence: Verified.** Evidence: `README.business.md`, `SECURITY.md`, `docs/union-eyes/pilot-evidence-pack/ORG_ISOLATION_CONTROL_MAP.md`, `ARCHITECTURE.md`.
- **Row-level security and org-guard patterns are explicit.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `tooling/contract-tests/ue-org-column-audit.test.ts` referenced in SOC 2 evidence inventory.

## AI / ML Capabilities

- **Centralized AI consumption model:** apps consume `packages/ai-sdk/package.json` and `packages/ml-sdk/package.json`; direct provider imports are prohibited by repo contract. **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `CONTRIBUTING.md`, app `package.json` files.
- **Governed AI posture:** the platform documents advisory-only AI boundaries, confidence envelopes, route guards, and auditability expectations. **Confidence: Documented.** Evidence: `docs/categories/platform-and-operations/security/UNION_EYES_AI_RUNTIME_AND_GOVERNANCE.md`, `SECURITY.md`.
- **AI maturity is uneven by surface.** **Confidence: Verified.** Evidence: the AI runtime doc explicitly records control gaps and a “PASS WITH CONDITIONS” posture.

## Document / Evidence Engine

- **Evidence-pack capability is clearly implemented.** **Confidence: Demonstrated.** Evidence: `ARCHITECTURE.md`, `SECURITY.md`, `apps/union-eyes/lib/evidence-export.ts` as cited in buyer packs and SOC 2 evidence inventory.
- **One repository-wide standalone “document engine” package was not identified during review.** **Confidence: Not Yet Evidenced.** Evidence: package and docs review.

## Workflow Engine

- **Workflow is a first-class platform concern.** **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `governed-workflow` package in `packages/`, `apps/orchestrator-api`, `flow-engine` package, `package.json` release and workflow scripts.
- **Orchestrator API is described as the authoritative execution backbone.** **Confidence: Documented.** Evidence: `README.business.md`, `ARCHITECTURE.md`.

## Azure Deployment Infrastructure

- **Azure is the canonical cloud platform.** **Confidence: Verified.** Evidence: `README.md`, `ARCHITECTURE.md`, `docs/readiness/production-certification.md`, `docs/readiness/platform-production-runtime-inventory.md`.
- **Production certification is currently documented for Union Eyes, Web, and Partners.** **Confidence: Demonstrated.** Evidence: `docs/readiness/production-ready-release-summary.md`, `docs/readiness/platform-production-runtime-inventory.md`.
- **Container Apps, Blob, Key Vault, and PostgreSQL Flexible Server recur throughout the repo as operative infrastructure.** **Confidence: Verified.**

## CI/CD and Governance Automation

- **Repository-observed workflow count:** 52 workflow files under `.github/workflows/` as of 2026-08-01 repository scan. **Confidence: Verified.**
- **Published workflow count:** `README.md` states 47 workflows; this is slightly stale relative to current repository contents. **Confidence: Verified.**
- **Workflow categories cover CI, deployments, compliance, security, DAST, SBOM, release governance, red-team, and reliability.** **Confidence: Verified.** Evidence: `.github/workflows/` directory contents, `README.md`, `SECURITY.md`.

## PostgreSQL + Drizzle ORM

- **The shared platform uses PostgreSQL and Drizzle ORM.** **Confidence: Verified.** Evidence: `README.md`, `packages/db/package.json`, `ARCHITECTURE.md`.
- **Union Eyes additionally uses Django ORM on the authoritative backend.** **Confidence: Verified.** Evidence: `apps/union-eyes/README.md`.

## Monorepo Structure

- **pnpm + Turborepo are the canonical workspace tools.** **Confidence: Verified.** Evidence: `README.md`, `package.json`.
- **Repo scale:** 26 app directories and 225 package directories were present at review time. **Confidence: Verified.** Evidence: `apps/`, `packages/`.

## Shared UI and API Architecture

- **Shared UI package:** @nzila/ui. **Confidence: Verified.** Evidence: `packages/ui/package.json`.
- **API architecture:** Next.js app routes, Fastify orchestrator API, and app-specific backend/service patterns are all documented. **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `apps/union-eyes/README.md`, `README.business.md`.

## Supporting Artifacts

- `README.md`
- `ARCHITECTURE.md`
- `package.json`
- `packages/decision-core/package.json`
- `packages/platform-auth/package.json`
- `packages/db/package.json`
- `packages/ui/package.json`
- `packages/platform-pilot-metrics/package.json`
- `governance/platform-package-authority.json`
- `docs/readiness/production-certification.md`
- `.github/workflows/`

## Current Maturity

The shared technology platform is the strongest part of the dossier. It is richly evidenced, repeatable, and tied to release and proof systems. Product-specific production evidence is strongest for Union Eyes and shared platform infrastructure, not uniformly across all commercial surfaces.

## Commercialization Relevance

This technology base supports arguments for scalability, shared-cost leverage, faster productization, and stronger procurement posture. It is directly relevant to lenders and partners assessing execution capacity.

## Gaps

- Repo-wide architecture counts in published docs lag the current directory state.
- AI governance is substantial but not uniformly proven on every AI route.
- A single repo-wide document-engine abstraction is not clearly surfaced as a named package.

## Next Milestone

Publish a single, current platform fact sheet that reconciles live counts, production-certified surfaces, and shared package authorities for external diligence use.

---
# 05 — Commercialization

## Objective

Evaluate the repository evidence for pricing, pilot programs, sales materials, customer-journey design, and go-to-market discipline.

## Evidence Summary

- **The repository contains a substantial commercial documentation system, especially for Union Eyes and FairCase.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/`, `docs/categories/products-and-market/faircase/`, `docs/categories/products-and-market/union-eyes/`.
- **Pricing and pilot packages are explicit rather than implied.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/pricing-framework.md`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`, `docs/categories/products-and-market/faircase/pricing-model.md`, `docs/categories/products-and-market/faircase/pilot-package-v1.md`.
- **Commercial claim discipline is itself documented.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/categories/stakeholders/commercial/customer-proof-playbook.md`.
- **Repository evidence for signed customers, closed deals, and realized commercial metrics is limited.** **Confidence: Verified.** Evidence: `governance/portfolio/product-catalog.json` classifies many revenue figures as estimated, forecast, or scenario.

## Pricing Models

| Product / motion | Evidence-based pricing posture | Confidence | Supporting artifacts |
|---|---|---|---|
| Union Eyes pilot | 90-day pilot priced at CAD $12,000, fully credited on conversion | Documented | `docs/categories/stakeholders/commercial/pricing-framework.md`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md` |
| Union Eyes annual subscription | Membership-tiered annual pricing documented for local, council, and federation plans | Documented | `docs/categories/stakeholders/commercial/pricing-framework.md` |
| FairCase packages | Foundation / Growth / Enterprise packages documented at CAD $24K / $48K / $84K+ | Documented | `docs/categories/products-and-market/faircase/pricing-model.md` |
| Revenue scenarios | Product-catalog revenue fields exist, but are labeled estimated, forecast, or scenario rather than actuals | Verified | `governance/portfolio/product-catalog.json` |

## Commercial Packages

- **Union Eyes:** sales kit, pilot offer, implementation timeline, security one-pagers, access modes, channel maps, and ROI materials. **Confidence: Demonstrated.** Evidence: `docs/categories/stakeholders/commercial/` and `docs/categories/stakeholders/commercial/sales-kit/README.md`.
- **FairCase:** buyer pack, offers, proposal template, pricing model, pilot package, procurement checklist, trust kit, demo script, objection handling, and ROI calculator. **Confidence: Documented.** Evidence: `docs/categories/products-and-market/faircase/`.

## Pilot Programs

- **Union Eyes controlled pilot program is heavily documented and operationalized.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/products-and-market/union-eyes/pilot-overview.md`, `docs/categories/products-and-market/union-eyes/pilot-kpis.md`.
- **FairCase pilot offer structure is documented, including 8-week/90-day pilot concepts depending on artifact.** **Confidence: Documented.** Evidence: `docs/categories/products-and-market/faircase/buyer-pack.md`, `docs/categories/products-and-market/faircase/pilot-package-v1.md`. Note: duration language varies across FairCase collateral and should be standardized.
- **CourtLens pilot posture is only planned.** **Confidence: Planned.** Evidence: `docs/courtlens/pilot-readiness-plan.md`.

## Sales Materials

- **Union Eyes:** 45-minute demo script, discovery checklist, objection sheet, ROI assumptions, proposal template, follow-up emails, procurement auth Q&A, screenshot index. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/sales-kit/`.
- **FairCase:** demo script, buyer pack, pilot brochure, proposal template, pricing pressure test, procurement trust kit, ROI calculator. **Confidence: Verified.** Evidence: `docs/categories/products-and-market/faircase/`.
- **Investor materials:** one-pager, moat analysis, shared-platform leverage model, growth narrative, risk register. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/investor/`.

## Executive Briefings and Customer Journey Documentation

- **Executive briefings:** commercial `docs/categories/stakeholders/commercial/executive-summary.md`, investor one-pager, Union Eyes buyer-review paths, OCI executive-readout templates in doctrine programs. **Confidence: Verified.**
- **Customer journey design:** Union Eyes implementation timeline, pilot operations runbook, pilot success metrics, and FairCase pilot-package sequencing provide explicit journey scaffolding. **Confidence: Documented.**

## Go-to-Market Strategy

- **Portfolio focus:** sell-now concentration is explicit in `reports/portfolio-status.md` and `governance/portfolio/product-catalog.json`. **Confidence: Verified.**
- **Founder-led revenue motion:** Union Eyes has a documented cockpit and pursuit system. **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`, `docs/categories/stakeholders/commercial/TOP_15_PURSUIT_LIST.md`, `docs/categories/stakeholders/commercial/UNION_GTM_MAP.md`.
- **Shared platform leverage as GTM logic:** investor documents explicitly connect shared platform leverage to execution efficiency. **Confidence: Documented.** Evidence: `docs/categories/stakeholders/investor/shared-platform-leverage-model.md`, `docs/categories/stakeholders/investor/why-nzila-os-wins.md`.

## Commercial Methodology and Discipline

- **Claims control:** `docs/categories/stakeholders/commercial/claims-ledger.md` forces public claims to be tagged as actual, estimated, forecast, scenario, roadmap, or honesty-note. **Confidence: Verified.**
- **Proof capture:** `docs/categories/stakeholders/commercial/customer-proof-playbook.md` defines how testimonial, case-study, KPI, permission, and renewal evidence should be captured. **Confidence: Verified.**
- **Data honesty in portfolio metrics:** the `metric_classifications` field in `governance/portfolio/product-catalog.json` inside `governance/portfolio/product-catalog.json` prevent estimated revenue or pipeline from being presented as actuals. **Confidence: Verified.**

## Supporting Artifacts

- `docs/categories/stakeholders/commercial/executive-summary.md`
- `docs/categories/stakeholders/commercial/pricing-framework.md`
- `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`
- `docs/categories/stakeholders/commercial/implementation-timeline.md`
- `docs/categories/stakeholders/commercial/customer-proof-playbook.md`
- `docs/categories/stakeholders/commercial/claims-ledger.md`
- `docs/categories/stakeholders/commercial/sales-kit/README.md`
- `docs/categories/products-and-market/faircase/`
- `docs/categories/stakeholders/investor/`
- `governance/portfolio/product-catalog.json`

## Current Maturity

Commercialization documentation is advanced and unusually structured. The main weakness is not the absence of GTM thinking, but the limited amount of in-repo closed-deal and customer-outcome evidence.

## Commercialization Relevance

This section is directly useful to BDC, government programs, and strategic partners because it shows product packaging, discipline around claims, and repeatable pilot/onboarding motions.

## Gaps

- Realized revenue and signed-customer evidence are mostly absent.
- FairCase procurement/trust collateral contains claims that need tightening against stronger evidence sources.
- Some commercial durations, legal-entity names, and compliance status statements are inconsistent across documents.

## Next Milestone

Standardize commercial fact patterns across Union Eyes and FairCase, then attach repository-backed customer proof artifacts to each primary package.

---
# 06 — Security

## Objective

Assess the security, privacy, governance, accessibility, bilingual, and compliance evidence relevant to institutional diligence.

## Evidence Summary

- **The repository contains a meaningful security program with workflows, runbooks, readiness packs, and contract-test evidence.** **Confidence: Verified.** Evidence: `SECURITY.md`, `.github/workflows/`, `docs/union-eyes/pilot-evidence-pack/`, `docs/compliance/soc2/`.
- **Union Eyes has the deepest security evidence corpus.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `docs/union-eyes/pilot-evidence-pack/ORG_ISOLATION_CONTROL_MAP.md`, `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`.
- **SOC 2 and ISO 27001 are repository-documented as readiness or roadmap items, not completed attestations.** **Confidence: Verified.** Evidence: `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/stakeholders/commercial/claims-ledger.md`.

## Security Posture

| Control area | Assessment | Confidence | Evidence |
|---|---|---|---|
| Vulnerability disclosure | Security contact and response targets are published | Verified | `SECURITY.md` |
| Dependency/security scanning | Dependency audit, secret scan, Trivy, SBOM, and static analysis workflows are documented | Verified | `SECURITY.md`, `.github/workflows/dependency-audit.yml`, `.github/workflows/secret-scan.yml`, `.github/workflows/trivy.yml`, `.github/workflows/sbom.yml` |
| Secret hygiene | Repo includes Gitleaks, TruffleHog, Key Vault integration, and hardening reports | Verified | `SECURITY.md`, `.gitleaks.toml`, `lefthook.yml`, `docs/categories/platform-and-operations/security/secrets-hardening-report.md` |
| Audit trail | Hash-chained audit records and evidence packs are core controls | Verified | `SECURITY.md`, `ARCHITECTURE.md`, Union Eyes evidence docs |

## Privacy Framework

- **Privacy and data-governance posture is explicitly documented at the corporate level.** **Confidence: Documented.** Evidence: `governance/corporate/compliance/security-data-governance-overview.md`.
- **Union Eyes and FairCase both present privacy-first / identity-vault / org-scoped handling models.** **Confidence: Documented.** Evidence: `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md`.
- **Legal-compliance language should be interpreted cautiously where legal memo evidence is not surfaced.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md` marks some compliance claims as honesty notes.

## AI Governance

- **Repository-wide rule:** no direct AI provider imports in apps; use @nzila/ai-sdk. **Confidence: Verified.** Evidence: `CONTRIBUTING.md`, `ARCHITECTURE.md`.
- **Union Eyes AI posture:** advisory-only, human review required, route-level guard architecture present but not proven universally. **Confidence: Documented.** Evidence: `docs/categories/platform-and-operations/security/UNION_EYES_AI_RUNTIME_AND_GOVERNANCE.md`.
- **Commercial claim discipline:** all AI features should be presented as advisory and auditable, not autonomous. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `SECURITY.md`, `docs/courtlens/README.md`.

## Accessibility (WCAG / AODA)

- **Union Eyes documents accessibility as a compliance objective.** **Confidence: Documented.** Evidence: `apps/union-eyes/README.md` references AODA/accessibility in compliance sections.
- **FairCase procurement collateral claims WCAG 2.1 AA is in progress.** **Confidence: Planned.** Evidence: `docs/categories/products-and-market/faircase/procurement-trust-kit.md`.
- **A repository-wide completed accessibility certification was not evidenced.** **Confidence: Not Yet Evidenced.**

## Bilingual Readiness (French / English)

- **FairCase is explicitly bilingual by design with populated `apps/abr/messages/en-CA.json` / `apps/abr/messages/fr-CA.json` dashboard catalogs.** **Confidence: Verified.** Evidence: `apps/abr/README.md`, `apps/abr/messages/`.
- **Union Eyes documents bilingual member-facing communications in pilot/commercial materials.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`, `docs/categories/stakeholders/commercial/pricing-framework.md`, message-parity scripts in `apps/union-eyes/scripts/sync-en-fr-parity.mjs`.
- **Platform-wide bilingual readiness is product-specific rather than uniformly proven.** **Confidence: Documented.**

## Role-Based Access Control

- **RBAC is core to the platform and is repeatedly evidenced.** **Confidence: Verified.** Evidence: `SECURITY.md`, `ARCHITECTURE.md`, `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`, `apps/abr/README.md`.
- **Union Eyes security pack describes org-scoped roles and audit logging.** **Confidence: Demonstrated.**

## Audit Trail and Tamper-Evident Records

- **All material actions producing hash-chained audit events and evidence packs is a strongly evidenced platform pattern.** **Confidence: Verified.** Evidence: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`.
- **Union Eyes specifically documents append-only audit rows, tamper detection tests, and seal verification.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`.

## SOC 2 / ISO 27001 Alignment

| Claim area | Assessment | Confidence | Evidence |
|---|---|---|---|
| SOC 2 readiness scaffold | Present | Verified | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/control-mapping.md`, `docs/compliance/soc2/evidence-inventory.md`, `docs/compliance/soc2/gap-log.md` |
| SOC 2 completed audit | Not evidenced | Verified | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md` |
| ISO 27001 alignment | Referenced as roadmap / not committed | Documented | `docs/categories/stakeholders/commercial/UNION_EYES_SECURITY_ONE_PAGER.md`, `docs/compliance/soc2/README.md` |

## SBOM / Container Scanning / DAST

- **SBOM generation:** documented in `SECURITY.md` and present as `.github/workflows/sbom.yml`. **Confidence: Verified.**
- **Trivy image scanning:** documented in `SECURITY.md` and present as `.github/workflows/trivy.yml`. **Confidence: Verified.**
- **DAST / ZAP:** repository contains `.github/workflows/dast.yml` and a `.zap/` directory. **Confidence: Verified.**
- **Completed third-party pentest:** not yet evidenced as complete for the products in scope. **Confidence: Not Yet Evidenced.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/platform-and-operations/security/pentest-readiness-self-assessment.md`.

## Supporting Artifacts

- `SECURITY.md`
- `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`
- `docs/categories/platform-and-operations/security/UNION_EYES_AI_RUNTIME_AND_GOVERNANCE.md`
- `docs/categories/platform-and-operations/security/pentest-readiness-self-assessment.md`
- `docs/categories/platform-and-operations/security/secrets-hardening-report.md`
- `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`
- `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`
- `docs/compliance/soc2/`
- `.github/workflows/secret-scan.yml`
- `.github/workflows/trivy.yml`
- `.github/workflows/sbom.yml`
- `.github/workflows/dast.yml`

## Current Maturity

Security evidence is strong at the platform and Union Eyes level, moderate for FairCase, and weakest where external attestations would normally supplement internal documentation.

## Commercialization Relevance

Security and privacy evidence materially improve procurement, government-program, and lender confidence, especially for Union Eyes. The main limitation is the absence of completed external attestations in the reviewed repository.

## Gaps

- No completed SOC 2 or ISO certification in evidence.
- Pentest readiness is documented; completed product-specific external pentest evidence is not.
- Accessibility is discussed but not backed by a consolidated validation corpus.

## Next Milestone

Consolidate completed external assessments, access-review evidence, and accessibility validation into the same quality tier already achieved by the Union Eyes pilot-evidence pack.

---
# 07 — Operations

## Objective

Assess delivery operations, release governance, SRE discipline, DR, monitoring, FinOps, and onboarding capability using repository evidence.

## Evidence Summary

- **Repository operations are heavily codified in scripts, runbooks, validators, and readiness certifications.** **Confidence: Verified.** Evidence: `package.json`, `ops/runbooks/README.md`, `docs/readiness/`.
- **Release governance is explicit and command-driven.** **Confidence: Verified.** Evidence: `README.md`, `package.json`, `.github/workflows/release-governance.yml`, `.github/workflows/release-train.yml`.
- **Production-readiness documentation is unusually strong for a repository of this type.** **Confidence: Demonstrated.** Evidence: `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md`, and `docs/readiness/backup-restore-certification.md`.

## Development Operations Maturity

- **Canonical development controls:** lint, typecheck, test, contract tests, governance validation, docs index, repo audit. **Confidence: Verified.** Evidence: `README.md`, `CONTRIBUTING.md`, `package.json`.
- **Governance audit pipeline:** pnpm governance:audit chains docs, ownership, release, repo, and import-guard audits. **Confidence: Verified.** Evidence: `package.json`.

## Release Governance

| Release capability | Confidence | Evidence |
|---|---|---|
| Staging gate (pnpm release:staging) | Verified | `README.md`, `package.json` |
| Production gate (pnpm release:prod) | Verified | `README.md`, `package.json` |
| Rollback and hotfix procedures | Verified | `README.md`, `package.json`, `ops/runbooks/platform/production-transactional-rollback.md` referenced by certification corpus |
| Gate authority taxonomy | Verified | `docs/governance/gates/gate-taxonomy.md` |

## SRE Practices

- **SRE validation chain exists.** **Confidence: Verified.** Evidence: `package.json` scripts commands `sre:health:contract`, `sre:synthetic:dry-run`, `sre:alerts:dry-run`, `sre:audit`, `sre:dashboard`, and composite `sre:validate`.
- **Incident severity and evidence expectations are documented.** **Confidence: Verified.** Evidence: `ops/incident-response/README.md`.
- **Executive SRE reporting exists as a generated surface.** **Confidence: Documented.** Evidence: `package.json` `sre:dashboard` and referenced `reports/ops/executive-reliability-report.md` in security readiness docs.

## Runbooks

- **Repository-wide runbook framework exists.** **Confidence: Verified.** Evidence: `ops/runbooks/README.md`.
- **Union Eyes controlled pilot operations runbook is substantive and deployment-aware.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`.
- **Security runbooks are explicitly referenced in `SECURITY.md`.** **Confidence: Verified.**

## Incident Management

- **Severity model, evidence capture requirements, containment, recovery, and postmortem expectations are documented.** **Confidence: Verified.** Evidence: `ops/incident-response/README.md`.
- **Union Eyes pilot-specific escalation paths are documented.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`.

## FinOps

- **FinOps tooling is built into the repo command surface.** **Confidence: Verified.** Evidence: `README.md`, `package.json` scripts finops:build, finops:validate, collect:cost.
- **Investor and internal finance strategy artifacts exist, but many are planning-grade.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/investor/revenue-scenarios.md`, `governance/corporate/finance/`.

## Disaster Recovery

- **Backup/restore certification exists for the Union Eyes production database.** **Confidence: Demonstrated.** Evidence: `docs/readiness/backup-restore-certification.md`.
- **Restore drill evidence is explicitly cited in Union Eyes maturity and pilot materials.** **Confidence: Demonstrated.** Evidence: `apps/union-eyes/maturity.json`, `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/PILOT_SUCCESS_METRICS.md`.

## Monitoring / Observability

- **OpenTelemetry and structured logging are part of the platform architecture.** **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `apps/union-eyes/README.md`.
- **Runtime truth and live readiness artifacts exist.** **Confidence: Demonstrated.** Evidence: `reports/runtime/platform-runtime-truth-latest.json` (referenced across evidence docs), `docs/readiness/production-certification.md`.
- **Observability maturity is not uniform across products.** **Confidence: Verified.** Evidence: `apps/union-eyes/maturity.json`, `apps/abr/maturity.json` both mark observability as partial.

## Onboarding Capability

- **Union Eyes onboarding and pilot enablement are documented in detail.** **Confidence: Demonstrated.** Evidence: `docs/categories/products-and-market/union-eyes/quick-start.md`, `docs/categories/products-and-market/union-eyes/admin-guide.md`, `docs/categories/products-and-market/union-eyes/pilot-overview.md`, and `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`.
- **Runbook contribution standards and acceptance expectations exist repo-wide.** **Confidence: Verified.** Evidence: `ops/runbooks/README.md`.

## Supporting Artifacts

- `README.md`
- `package.json`
- `ops/runbooks/README.md`
- `ops/incident-response/README.md`
- `docs/readiness/production-certification.md`
- `docs/readiness/production-ready-release-summary.md`
- `docs/readiness/backup-restore-certification.md`
- `docs/governance/gates/gate-taxonomy.md`
- `docs/union-eyes/pilot-evidence-pack/PILOT_OPERATIONS_RUNBOOK.md`

## Current Maturity

Operational maturity is one of Nzila's strongest documentary areas. Production-grade operational evidence is concentrated around the platform and Union Eyes. Other products inherit the platform posture but do not always yet have equivalent product-level proof.

## Commercialization Relevance

Operational maturity matters directly to lenders, procurement teams, and partners because it reduces execution risk and supports claims of repeatable implementation.

## Gaps

- Product-level observability and DR proof are not yet equally complete for FairCase and other portfolio products.
- Some references in readiness docs point to follow-up runbooks or evidence artifacts that are still evolving.
- FinOps evidence is more tooling-rich than externally summarized.

## Next Milestone

Package the operational backbone into a cross-product operating-readiness summary that pairs command-level automation with product-level service evidence.

---
# 08 — Validation

## Objective

Summarize only documented validation evidence: pilots, customer-discovery traces, proof runs, adversarial testing, stress/readiness materials, and external-review readiness.

## Evidence Summary

- **Union Eyes has the clearest pilot-validation corpus.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/products-and-market/union-eyes/pilot-overview.md`, `docs/categories/products-and-market/union-eyes/pilot-kpis.md`.
- **FairCase has pilot plans and commercial diagnostics, but less operational validation evidence in-repo.** **Confidence: Documented.** Evidence: `docs/categories/products-and-market/faircase/pilot-package-v1.md`, `docs/categories/products-and-market/faircase/pilot-plan.md`, `docs/categories/products-and-market/faircase/buyer-pack.md`.
- **OCI/OCRA methodology includes procurement-facing validation binders and adversarial-review protocols, but these should not be described as completed external validation.** **Confidence: Documented.** Evidence: `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`.

## Pilot Programs

| Pilot evidence area | Assessment | Confidence | Supporting artifacts |
|---|---|---|---|
| Union Eyes controlled pilot | Full evidence pack, readiness memo, operations runbook, scope lock, success metrics | Demonstrated | `docs/union-eyes/pilot-evidence-pack/` |
| Union Eyes pilot metrics | Route-level KPI definitions and auditable metric-write model | Verified | `docs/categories/products-and-market/union-eyes/pilot-kpis.md`, `apps/union-eyes/docs/procurement/PILOT_SCOPE.md` |
| FairCase pilot | Buyer-facing pilot package and track definition | Documented | `docs/categories/products-and-market/faircase/pilot-package-v1.md`, `docs/categories/products-and-market/faircase/pilot-plan.md` |
| CourtLens pilot | Planning-stage pilot definition only | Planned | `docs/courtlens/pilot-readiness-plan.md` |

## Customer Discovery Evidence

- **Commercial research and pursuit targeting clearly exist.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/ICP_DEFINITION.md`, `docs/categories/stakeholders/commercial/TOP_15_PURSUIT_LIST.md`, `docs/categories/stakeholders/commercial/FIRST_50_TARGETS_CANADA.md`.
- **Direct customer-discovery logs, interview transcripts, or signed reference artifacts were not surfaced in the reviewed repository.** **Confidence: Not Yet Evidenced.**

## Sector Validation

- **Union Eyes sector focus is well articulated around Canadian labour organizations.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/why-union-eyes.md`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`, and Union Eyes product docs under `docs/categories/products-and-market/union-eyes/`.
- **FairCase sector focus is articulated around public sector, regulated institutions, unions, and universities.** **Confidence: Documented.** Evidence: `docs/categories/products-and-market/faircase/buyer-pack.md`, `docs/categories/products-and-market/faircase/pilot-package-v1.md`.
- **Institutional-intelligence sector rationale is deeply documented in doctrine whitepapers.** **Confidence: Documented.** Evidence: doctrine and OCI whitepapers.

## Adversarial Testing / CBA Intelligence Validation

- **Repository-level adversarial/security-review workflows exist.** **Confidence: Verified.** Evidence: `.github/workflows/red-team.yml`, `README.md` maturity signals.
- **Union Eyes case and cognition governance include test and validation references, but completed external CBA-intelligence validation evidence was not separately surfaced in reviewed materials.** **Confidence: Documented.** Evidence: `CHANGELOG.md`, Union Eyes docs index, doctrine corpus.

## Stress Testing / Proof Runs

- **Live-readiness, infra-convergence, backup/restore, and runtime-proof commands exist.** **Confidence: Verified.** Evidence: `package.json`, `docs/readiness/`, `docs/union-eyes/pilot-evidence-pack/READINESS_COMMANDS.md`.
- **Restore drill and runtime evidence are specifically documented for Union Eyes.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/RUNTIME_EVIDENCE_PACK.md`, `docs/readiness/backup-restore-certification.md`.
- **Formal load/performance benchmark outputs for all core products were not assembled in one reviewed location.** **Confidence: Not Yet Evidenced.**

## External Review Materials

- **Procurement-facing methodology review materials are documented in the OCI method publication.** **Confidence: Documented.** Evidence: `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` references the validation binder, obligation taxonomy, and assessor standards.
- **Investor technical diligence summary exists for Union Eyes.** **Confidence: Documented.** Evidence: `docs/union-eyes/pilot-evidence-pack/INVESTOR_TECHNICAL_DILIGENCE_SUMMARY.md`.
- **Completed independent validation, certification, or auditor opinion letters were not found in the reviewed repository.** **Confidence: Not Yet Evidenced.**

## Supporting Artifacts

- `docs/union-eyes/pilot-evidence-pack/`
- `docs/categories/products-and-market/union-eyes/pilot-overview.md`
- `docs/categories/products-and-market/union-eyes/pilot-kpis.md`
- `docs/categories/products-and-market/faircase/pilot-package-v1.md`
- `docs/categories/products-and-market/faircase/pilot-plan.md`
- `docs/courtlens/pilot-readiness-plan.md`
- `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`
- `package.json`
- `.github/workflows/red-team.yml`

## Current Maturity

Validation evidence is strongest where Nzila has operationalized a product into a controlled pilot motion. That is clearest for Union Eyes.

## Commercialization Relevance

This section matters because commercial readiness is materially improved when product claims are paired with validation loops, review runbooks, and formal success criteria.

## Gaps

- Customer-discovery transcripts, reference letters, or close reports are not a strong in-repo evidence class yet.
- FairCase and CourtLens do not yet have evidence packs comparable to Union Eyes.
- External independent validation remains more prepared-for than completed.

## Next Milestone

Publish completed pilot close reports and external-review outputs using the same evidence-pack discipline already established for controlled pilot readiness.

---
# 09 — Intellectual Property

## Objective

Inventory repository-evidenced software, methodologies, documents, brand assets, playbooks, and ownership posture relevant to Nzila Ventures.

## Evidence Summary

- **Nzila's strongest evidenced IP classes are software, doctrine/methodology, operational documentation, and commercial assets.** **Confidence: Verified.** Evidence: `apps/`, `packages/`, `docs/`, `governance/corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md`.
- **Ownership posture is documented as centralized under Nzila Ventures Inc. unless explicitly assigned or licensed.** **Confidence: Documented.** Evidence: `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`, `governance/corporate/governance/document-founder-executive-roles-equity-memo.md`.
- **Some IP valuation and filing statements in the IP strategy document appear internal-planning grade and should not be treated as independently verified.** **Confidence: Documented.**

## Software Inventory

| IP class | Evidence | Confidence |
|---|---|---|
| Applications | 26 top-level apps in `apps/` including `apps/union-eyes`, `apps/abr`, `apps/console`, `apps/control-plane`, `apps/web`, `apps/partners`, `apps/orchestrator-api` | Verified |
| Shared packages | 225 top-level packages in `packages/`, including `packages/decision-core`, `packages/platform-auth`, `packages/db`, `packages/ui`, `packages/institutional-intelligence`, `packages/organizational-cognition-core`, `packages/flow-engine` | Verified |
| Workflow/security/release tooling | Extensive script and workflow layer in `package.json`, `scripts/`, `tooling/`, `.github/workflows/` | Verified |

## Methodologies

| Methodology / framework | Status | Confidence | Evidence |
|---|---|---|---|
| Institutional Intelligence doctrine | Canonical doctrine corpus | Verified | `docs/doctrine/DOCTRINE.md` |
| OCI Method™ | Canonical methodology publication | Verified | `docs/oci/OCI_METHOD.md`, `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` |
| OCRA / Institutional Continuity Risk Assessment | Operational diagnostic instrument | Verified | `docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md` |
| Signature OCI frameworks (SDI, GES, CBM, CSM, RBI) | Code-linked frameworks | Verified | `apps/union-eyes/lib/oci/frameworks/` |
| CLEAR Method | No canonical reviewed artifact found | Not Yet Evidenced | Repository review |

## Documentation / Whitepapers

- `docs/doctrine/whitepapers/INSTITUTIONAL_INTELLIGENCE_PRIMER.md`
- `docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md`
- `docs/oci/whitepapers/THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md`
- `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`
- Product buyer packs, trust packs, runbooks, and pilot evidence packs across `docs/`

**Confidence: Verified** for existence and documentary depth.

## Frameworks and Platform Architecture

- Decision framework: `packages/decision-core`. **Confidence: Verified.**
- Auth framework: `packages/platform-auth`. **Confidence: Verified.**
- Database/tenant framework: `packages/db`. **Confidence: Verified.**
- Shared UI: `packages/ui`. **Confidence: Verified.**
- Pilot-evidence metrics: `packages/platform-pilot-metrics`. **Confidence: Verified.**
- Governance/readiness architecture: `governance/`, `docs/readiness/`, `tooling/governance/`. **Confidence: Verified.**

## Brand Assets

- **Nzila Ventures** is documented as a registered brand in the IP portfolio strategy. **Confidence: Documented.** Evidence: `governance/corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md`.
- **UnionEyes / ABR Insights / CORA** are documented as pending or planned marks in the IP portfolio strategy. **Confidence: Documented.**
- **Brand control model** is documented as centralized. **Confidence: Documented.** Evidence: `governance/corporate/governance/document-founder-executive-roles-equity-memo.md`.

## Templates and Playbooks

- Pilot evidence pack templates and operational runbooks. **Confidence: Verified.** Evidence: `docs/union-eyes/pilot-evidence-pack/`, `ops/runbooks/README.md`.
- Commercial proposal, outreach, proof-capture, and pricing templates. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/`, `docs/categories/products-and-market/faircase/`.
- Data-room and government-funding strategy templates. **Confidence: Documented.** Evidence: `governance/corporate/finance/review-due-diligence-data-room-index.md`, `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`.

## Commercial Assets

| Asset type | Evidence | Confidence |
|---|---|---|
| Pricing frameworks | Union Eyes and FairCase pricing docs | Documented |
| Buyer packs / trust kits | Union Eyes trust assets and FairCase buyer/procurement assets | Verified |
| Demo scripts | Union Eyes sales kit and FairCase demo materials | Verified |
| Investor materials | One-pager, moat, leverage, risk, growth narrative | Verified |

## Ownership Status

- **Central ownership posture:** repo governance docs repeatedly state that IP and core assets remain under Nzila Ventures Inc. unless explicitly assigned or licensed. **Confidence: Documented.**
- **Contributor assignment expectation:** corporate and legal documents state contributors are subject to IP assignment agreements. **Confidence: Documented.**
- **Executed assignment agreements are not surfaced in the reviewed repository.** **Confidence: Not Yet Evidenced.**

## Supporting Artifacts

- `apps/`
- `packages/`
- `docs/doctrine/`
- `docs/oci/`
- `docs/union-eyes/pilot-evidence-pack/`
- `docs/categories/stakeholders/commercial/`
- `docs/categories/stakeholders/investor/`
- `governance/corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md`
- `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`
- `governance/corporate/governance/document-founder-executive-roles-equity-memo.md`

## Current Maturity

The repository evidences a substantial IP base. The best-proven asset classes are source code, methods/doctrine, and operational/commercial documentation. Formal legal perfection of that IP is less completely evidenced in-repo.

## Commercialization Relevance

This IP inventory supports value arguments for lenders and strategic partners by showing reusable platform assets, product-specific codebases, and differentiated doctrine.

## Gaps

- Legal perfection artifacts (assignments, registrations, executed licenses) are not uniformly surfaced.
- Some value estimates in the IP strategy document are internal and should not be treated as independently verified.
- CLEAR Method requested in the brief was not located as a canonical artifact.

## Next Milestone

Publish a tighter repository-backed IP fact sheet that separates verified ownership and filings from internal valuation or planning narratives.

---
# 10 — Evidence Register

## Objective

Provide a traceability matrix linking substantive business claims to concrete repository artifacts.

| Business Claim | Supporting Repository Artifact(s) | Current Status | Evidence Strength | Confidence |
|---|---|---|---|---|
| Nzila OS operates as a shared decision infrastructure across multiple products. | `README.md`, `ARCHITECTURE.md`, `packages/decision-core/package.json` | Implemented | Code + documentation | Verified |
| The portfolio is centrally governed from a single truth source. | `governance/portfolio/product-catalog.json`, `reports/portfolio-status.md` | Implemented | Machine-readable source + generated report | Verified |
| The repository currently contains 26 top-level apps. | `apps/` directory | Current repository state | Direct repository artifact | Verified |
| The repository currently contains 225 top-level packages. | `packages/` directory | Current repository state | Direct repository artifact | Verified |
| The repository currently contains 52 GitHub Actions workflow files. | `.github/workflows/` directory | Current repository state | Direct repository artifact | Verified |
| Union Eyes is a Tier 1, sell-now, pilot-proof product. | `apps/union-eyes/maturity.json`, `governance/portfolio/product-catalog.json`, `reports/portfolio-status.md` | Current | Machine-readable product record | Verified |
| FairCase is a Tier 1, sell-now, pilot-proof product. | `apps/abr/maturity.json`, `governance/portfolio/product-catalog.json`, `reports/portfolio-status.md` | Current | Machine-readable product record | Verified |
| CourtLens is in migration-planning / pilot-definition mode rather than shipped runtime mode. | `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`, `docs/courtlens/pilot-readiness-plan.md` | Planned | Documentation set | Verified |
| Union Eyes has a controlled pilot evidence pack. | `docs/union-eyes/pilot-evidence-pack/README.md` and contents | Current | Operational documentation corpus | Demonstrated |
| Union Eyes has a documented controlled pilot GO decision. | `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md` | Current | Readiness memo + conditions | Demonstrated |
| Union Eyes supports audited evidence export and seal verification. | `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `apps/union-eyes/lib/evidence-export.ts` (cited) | Implemented | Documentation + code references + tests cited | Demonstrated |
| Union Eyes uses fail-closed org-scoped RLS enforcement. | `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `apps/union-eyes/lib/db/with-rls-context.ts` (cited) | Implemented | Code-backed security evidence | Demonstrated |
| The platform uses PostgreSQL and Drizzle ORM. | `README.md`, `packages/db/package.json`, `ARCHITECTURE.md` | Implemented | Code + documentation | Verified |
| The canonical auth authority is `packages/platform-auth/package.json`. | `README.md`, `governance/platform-package-authority.json`, `packages/platform-auth/package.json` | Implemented | Code + governance authority file | Verified |
| The repository uses pnpm workspaces and Turborepo. | `README.md`, `package.json` | Implemented | Config + documentation | Verified |
| Release governance includes staging, production, rollback, and hotfix commands. | `README.md`, `package.json` | Implemented | Command catalog | Verified |
| Production certification exists for selected live runtimes. | `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md`, `docs/readiness/platform-production-runtime-inventory.md` | Current | Certification corpus | Demonstrated |
| SBOM generation is part of the security workflow set. | `SECURITY.md`, `.github/workflows/sbom.yml` | Implemented | Policy + workflow | Verified |
| Trivy container scanning is part of the security workflow set. | `SECURITY.md`, `.github/workflows/trivy.yml` | Implemented | Policy + workflow | Verified |
| ZAP/DAST testing is part of the workflow inventory. | `.github/workflows/dast.yml`, `.zap/` | Implemented | Workflow + repo artifact | Verified |
| SOC 2 is presently a readiness scaffold, not a completed attestation. | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md` | Open readiness stage | Formal documentation | Verified |
| Union Eyes has documented pilot metrics tied to runtime routes. | `docs/categories/products-and-market/union-eyes/pilot-kpis.md`, `apps/union-eyes/docs/procurement/PILOT_SCOPE.md` | Implemented | Product documentation + route map | Verified |
| FairCase includes implemented tribunal intelligence, incident governance, exports, analytics, and learning modules. | `apps/abr/README.md`, `apps/abr/modules/intelligence/README.md`, `apps/abr/modules/incidents/README.md`, `apps/abr/modules/governance/README.md`, `apps/abr/modules/analytics/README.md`, and `apps/abr/modules/learning/README.md` | Implemented | App README + module docs | Verified |
| FairCase has bilingual dashboard coverage documented in the repo. | `apps/abr/README.md`, `apps/abr/messages/` | Implemented/documented | App README + message catalogs | Documented |
| Nzila has a formal doctrine corpus for Institutional Intelligence / OCI. | `docs/doctrine/DOCTRINE.md`, `docs/oci/OCI_METHOD.md`, `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` | Current | Canonical documentation | Verified |
| OCI methodology is linked to source implementation in Union Eyes. | `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`, `apps/union-eyes/lib/oci/frameworks/` | Implemented | Documentation + code path | Verified |
| Customer-proof capture is governed by an explicit playbook. | `docs/categories/stakeholders/commercial/customer-proof-playbook.md` | Current | Commercial operating doc | Verified |
| Public commercial claims are governed by a claims ledger. | `docs/categories/stakeholders/commercial/claims-ledger.md` | Current | Commercial governance doc | Verified |
| Corporate structure is documented as Nzila Ventures Inc. holding company ownership. | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` | Current | Corporate governance doc | Documented |
| Aubert is documented as founder/CEO and authorized owner. | `governance/corporate/leadership.json`, `docs/governance/owner-operated-review-model.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` | Current | Leadership registry + governance docs | Verified |
| Michel is documented as President with labour/legal commercialization scope. | `governance/corporate/leadership.json` | Current | Leadership registry | Documented |

---
# 11 — Gap Register

## Objective

Identify material evidence gaps, documentation conflicts, and readiness shortfalls honestly.

| Gap | Category | Rank | Why it matters | Supporting artifact(s) |
|---|---|---|---|---|
| No completed SOC 2 examination evidenced in-repo. | Compliance | Critical | External diligence will ask for independent control assurance. Current posture is readiness scaffold only. | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md` |
| No completed product-specific external pentest evidence for products in scope was found. | Security | Critical | Commercial collateral should not imply more than readiness or planned status. | `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/platform-and-operations/security/pentest-readiness-self-assessment.md` |
| Union Eyes readiness report explicitly says user-testing results do not yet exist. | Product validation | Critical | Controlled pilot may proceed, but broader commercialization proof remains incomplete without user-test outcomes. | `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md` |
| CourtLens has no implemented runtime evidence. | Product maturity | Critical | Must not be presented as an active shipped product. | `docs/courtlens/README.md`, `docs/courtlens/pilot-readiness-plan.md` |
| FairCase procurement/trust collateral includes claims stronger than stronger evidence supports (e.g., legal entity, active certification timing, annual pentest language). | Commercial accuracy | Critical | Risks credibility loss in procurement and lender diligence. | `docs/categories/products-and-market/faircase/procurement-trust-kit.md`, `docs/compliance/soc2/gap-log.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| Corporate naming is inconsistent (Nzila Ventures Inc., Nzila Digital Ventures, and Nzila OS Inc. in one commercial file). | Corporate governance | Important | Counterparties need one authoritative legal identity. | `README.business.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md` |
| Published repository counts are stale relative to current repo state (e.g., 47 workflows vs. 52 observed; 215 packages vs. 225 observed). | Documentation hygiene | Important | Signals drift between external narrative and current operational truth. | `README.business.md`, `README.md`, `.github/workflows/`, `packages/` |
| FairCase maturity file records partial backup/restore, analytics lineage, and access-review evidence. | Product operations | Important | Product is saleable in narrative terms but not yet as operationally evidenced as Union Eyes. | `apps/abr/maturity.json` |
| Platform-wide accessibility evidence is fragmented and not centrally validated. | Compliance / UX | Important | Public-sector and institutional buyers may require stronger accessibility proof. | `apps/union-eyes/README.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md` |
| Product-level observability is partial in both Union Eyes and FairCase maturity records. | Operations | Important | Monitoring maturity affects pilot safety and supportability. | `apps/union-eyes/maturity.json`, `apps/abr/maturity.json` |
| Signed contracts, live ARR, or closed-revenue evidence are not surfaced in the reviewed repository. | Commercial traction | Important | Lenders will differentiate packaging from booked commercial performance. | `governance/portfolio/product-catalog.json` classifications |
| CLEAR Method requested in the brief was not found as a canonical artifact in the reviewed materials. | Methodology evidence | Future | Important for taxonomy completeness but not a blocker if omitted honestly. | Repository review |
| Board/advisory governance evidence is lighter than engineering/governance automation evidence. | Governance | Future | Would improve institutional diligence depth. | `governance/corporate/board/README.md` |
| FinOps evidence is operationally wired but not yet summarized into one external-friendly proof pack. | Operations / finance | Future | Would strengthen lender-grade operating discipline narrative. | `README.md`, `package.json`, `governance/corporate/finance/` |

## Priority Interpretation

- **Critical** — directly affects diligence credibility or product-readiness claims.
- **Important** — should be resolved before scaling external outreach or procurement.
- **Future** — not an immediate blocker, but would materially strengthen institutional confidence.

## Supporting Artifacts

- `docs/compliance/soc2/`
- `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`
- `apps/abr/maturity.json`
- `docs/courtlens/`
- `docs/categories/products-and-market/faircase/procurement-trust-kit.md`
- `README.md`
- `README.business.md`

## Next Milestone

Resolve the claim-discipline issues first: entity naming, compliance status wording, and product-maturity boundaries. Then add outcome-grade customer and validation evidence.

---
# 12 — Commercial Readiness

## Objective

Provide an evidence-based readiness scorecard grounded in repository artifacts.

## Scorecard

| Dimension | Score (1-5) | Justification | Confidence |
|---|---:|---|---|
| Product | 3.5 | Union Eyes is pilot-ready with strong evidence; FairCase is implemented but less operationally evidenced; CourtLens is planning-only. | Demonstrated |
| Commercial | 3.5 | Pricing, pilots, sales kits, claims discipline, and buyer packs are substantial, but closed-deal evidence is limited. | Documented |
| Operational | 4.0 | Release, runbook, DR, and production-certification materials are unusually mature for the platform and Union Eyes. | Demonstrated |
| Governance | 3.5 | Strong gate architecture and portfolio truth exist, but board/advisory and legal-entity consistency need tightening. | Verified |
| Technology | 4.5 | Shared platform, monorepo scale, auth authority, database, and deployment controls are strongly evidenced. | Verified |
| Implementation | 3.5 | Union Eyes has detailed implementation and pilot-run materials; FairCase has good buyer-facing pilot packaging; CourtLens does not. | Documented |
| Sales | 3.0 | Sales motions and collateral exist, but in-repo evidence of converted, referenceable customers is limited. | Documented |
| Documentation | 4.0 | Repository documentation is broad, indexed, and role-specific, though some artifacts are stale or conflicting. | Verified |
| Security | 4.0 | Internal evidence is strong, especially for Union Eyes; completed external attestations are still pending. | Demonstrated |
| Institutional Intelligence Maturity | 4.0 | Doctrine and methodology are comprehensive, implementation-linked, and self-critical; external validation remains incomplete. | Verified |
| Overall Readiness | 3.7 | Nzila is well prepared for evidence-first conversations on platform capability and controlled pilots, but not yet fully de-risked for every enterprise or lender claim without caveats. | Documented |

## Interpretation Notes

- **1** = concept only
- **2** = early documentation / roadmap
- **3** = materially prepared but still caveated
- **4** = strong operational/documentary readiness
- **5** = externally validated, scaled, and low-caveat

## Supporting Artifacts

- `apps/union-eyes/maturity.json`
- `apps/abr/maturity.json`
- `docs/union-eyes/pilot-evidence-pack/`
- `docs/readiness/`
- `docs/categories/stakeholders/commercial/`
- `docs/categories/products-and-market/faircase/`
- `docs/courtlens/`
- `docs/compliance/soc2/`
- `governance/portfolio/product-catalog.json`

## Current Maturity

The evidence supports describing Nzila as **commercially serious and technologically advanced**, with **strong controlled-pilot readiness** and **good governance hygiene**, but with **important external-proof and claim-synchronization gaps** remaining.

## Commercialization Relevance

This scorecard is suitable for internal diligence preparation, lender packaging, and external narrative calibration. It should not be used as a substitute for product-specific trust packs.

## Gaps

- No dimension scores 5 because completed external assurance, realized traction, and fully synchronized corporate/commercial narratives are not yet evidenced.

## Next Milestone

Use the gap register as the upgrade path from a 3.7/5 overall readiness posture toward enterprise-grade external assurance.

---
# 13 — Timeline

## Objective

Present the documented chronology of Nzila's recent product, doctrine, and readiness evolution using repository-dated artifacts only.

| Date | Milestone | Evidence | Confidence |
|---|---|---|---|
| 2026-03-08 | `CHANGELOG.md` records NzilaOS v1.0.0 / UnionEyes GA release with enterprise hardening, CI/CD, Azure deployment, and documentation expansion. | `CHANGELOG.md` | Documented |
| 2026-04-17 | Investor one-pager records a portfolio focus on shared platform leverage and sell-now products. | `docs/categories/stakeholders/investor/final-investor-onepager.md` | Documented |
| 2026-04-22 | Commercial claims ledger published/reviewed to govern outward-facing claims. | `docs/categories/stakeholders/commercial/claims-ledger.md` | Verified |
| 2026-04-22 | Customer proof playbook formalizes how testimonial, KPI, and case-study evidence should be captured. | `docs/categories/stakeholders/commercial/customer-proof-playbook.md` | Verified |
| 2026-04-22 | Pentest readiness self-assessment and secrets hardening report document security hardening posture and remaining gaps. | `docs/categories/platform-and-operations/security/pentest-readiness-self-assessment.md`, `docs/categories/platform-and-operations/security/secrets-hardening-report.md` | Verified |
| 2026-04-23 | Union Eyes auth model documentation records multi-mode auth, MFA, and risk-based authentication posture. | `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md` | Documented |
| 2026-05-01 | Union Eyes maturity file records last validation date and pilot-proof sell-now posture. | `apps/union-eyes/maturity.json`, `governance/portfolio/product-catalog.json` | Verified |
| 2026-05-14 | Union Eyes pilot evidence pack v2.0 marks controlled pilot GO and assembles buyer/security/runtime/runbook evidence. | `docs/union-eyes/pilot-evidence-pack/README.md` | Demonstrated |
| 2026-05-18 | Canonical doctrine is marked “canonical since 2026-05-18.” | `docs/doctrine/DOCTRINE.md` | Verified |
| 2026-05-22 | Portfolio status report generated from product catalog shows Union Eyes and FairCase as Tier 1 sell-now pilot-proof products. | `reports/portfolio-status.md`, `governance/portfolio/product-catalog.json` | Verified |
| 2026-05-22 | Continuity Gap master whitepaper canonical markdown ingestion is dated and governed. | `docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md` | Verified |
| 2026-05-23 | OCI Method™ whitepaper is first published as canonical methodology specification. | `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` | Verified |
| 2026-06-28 | Gate taxonomy document formalizes blocking vs advisory governance-gate authority. | `docs/governance/gates/gate-taxonomy.md` | Verified |
| 2026-07-03 | Production certification corpus records “PRODUCTION READY” status for selected live runtimes. | `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md` | Demonstrated |
| 2026-08-01 | Repository scan for this dossier observed 26 apps, 225 packages, and 52 workflow files. | `apps/`, `packages/`, `.github/workflows/` | Verified |

## Current Maturity

The repository shows a concentrated maturation wave from early 2026 through mid-2026: commercial discipline, doctrine formalization, Union Eyes pilot evidence, and production-readiness certification all intensify during that period.

## Gaps

- Earlier historical company milestones are not as cleanly normalized in one in-repo corporate chronology.
- Several governance and corporate docs are undated or partially templated.

## Next Milestone

Add an authoritative corporate-and-product milestone ledger so future diligence does not need to reconstruct chronology across many files.

---
# Appendices

## Objective

Provide the key file index, glossary, abbreviations, and confidence legend used throughout this dossier.

## Key Repository File Index

### Core platform and governance

- `README.md`
- `README.business.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `package.json`
- `governance/portfolio/product-catalog.json`
- `reports/portfolio-status.md`

### Doctrine and methodology

- `docs/doctrine/DOCTRINE.md`
- `docs/doctrine/whitepapers/INSTITUTIONAL_INTELLIGENCE_PRIMER.md`
- `docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md`
- `docs/oci/OCI_METHOD.md`
- `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`
- `docs/oci/whitepapers/THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md`
- `docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md`

### Product evidence

- `apps/union-eyes/README.md`
- `apps/union-eyes/maturity.json`
- `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`
- `apps/abr/README.md`
- `apps/abr/maturity.json`
- `docs/courtlens/README.md`

### Pilot / trust / readiness

- `docs/union-eyes/pilot-evidence-pack/README.md`
- `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`
- `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`
- `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`
- `docs/readiness/production-certification.md`
- `docs/readiness/production-ready-release-summary.md`
- `docs/compliance/soc2/README.md`

## Glossary of Terms

| Term | Meaning |
|---|---|
| **II** | Institutional Intelligence; Nzila's category framing for continuity, governance, and institutional-memory infrastructure. |
| **OCI** | Organizational Continuity Infrastructure; the structured operational foundation for preserving continuity, governance lineage, and memory. |
| **OCRA** | Organizational Continuity Risk Analysis / Assessment; the diagnostic instrument and interpretation layer associated with OCI. |
| **Decision Core** | The shared canonical decision primitive layer exported from `@nzila/decision-core`. |
| **Pilot-proof** | Product evidence level used in portfolio artifacts to indicate documented pilot-stage proof rather than broad production proof. |
| **RLS** | Row-Level Security; database-level isolation mechanism repeatedly referenced in Union Eyes and platform security docs. |
| **Evidence Pack** | A sealed bundle of artifacts, hashes, and metadata used for auditability and proof. |
| **Controlled Pilot** | A restricted live deployment with defined scope, conditions, and operational safeguards. |
| **Sell-now** | GTM posture used in portfolio truth files for currently prioritized commercial products. |

## Abbreviations

| Abbreviation | Expansion |
|---|---|
| BDC | Business Development Bank of Canada |
| CI/CD | Continuous Integration / Continuous Delivery |
| DAST | Dynamic Application Security Testing |
| DR | Disaster Recovery |
| GTM | Go-to-Market |
| MFA | Multi-Factor Authentication |
| RFP | Request for Proposal |
| SBOM | Software Bill of Materials |
| SRE | Site Reliability Engineering |
| TRL | Technology Readiness Level |

## Confidence Rating Legend

| Confidence | Meaning |
|---|---|
| **Verified** | Directly supported by implemented code, repository artifacts, or published documentation. |
| **Demonstrated** | Proven through demos, working implementations, or repeatable processes. |
| **Documented** | Supported by formal documentation but awaiting broader operational validation. |
| **Planned** | Approved roadmap item with documented intent but not yet implemented. |
| **Not Yet Evidenced** | Mentioned in strategy but currently lacks sufficient supporting artifacts. |

---
