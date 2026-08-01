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
- `docs/public-service/civic-thesis.md`
- `docs/public-service/civic-one-page-brief.md`
- `docs/CIVIC_OCI_ALIGNMENT.md`
- `docs/courtlens/README.md`
- `apps/abr/README.md` (FairCase historical lineage — CourtLens technical foundation)

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

## Appendix A — Institutional Assets

Nzila is building more than software. The company has created a body of institutional assets — methodologies, frameworks, playbooks, doctrine, and commercial infrastructure — that have real commercial value as IP and differentiate Nzila from pure-software vendors.

### Methodology and Doctrine

| Asset | Path | Description |
|---|---|---|
| Institutional Intelligence doctrine | `docs/doctrine/DOCTRINE.md` | The canonical framework connecting continuity, governance, and institutional-memory infrastructure |
| OCI Method™ | `docs/oci/OCI_METHOD.md`, `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` | Structured operational methodology for preserving continuity, governance lineage, and institutional memory |
| OCRA (Organizational Continuity Risk Analysis) | `docs/doctrine/programs/INSTITUTIONAL_CONTINUITY_RISK_ASSESSMENT.md` | Diagnostic instrument and interpretation layer for OCI assessments |
| CIVIC thesis | `docs/public-service/civic-thesis.md` | Public-sector front door for OCI methodology; canonical positioning for government audiences |
| CIVIC ↔ OCI Alignment | `docs/CIVIC_OCI_ALIGNMENT.md` | Rosetta table mapping CIVIC pillars to OCI dimensions and CLEAR evidence framework |
| CLEAR Method | `docs/public-service/clear-method-canonical.md` | Public-service articulation of the evidence discipline behind CIVIC |

### Whitepapers

| Asset | Path |
|---|---|
| Institutional Intelligence Primer | `docs/doctrine/whitepapers/INSTITUTIONAL_INTELLIGENCE_PRIMER.md` |
| Continuity Gap Master Whitepaper | `docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md` |
| The Continuity Gap (Operational Reality Edition) | `docs/oci/whitepapers/THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md` |
| OCI Method Whitepaper v1 | `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` |

### Playbooks and Frameworks

| Asset | Path | Description |
|---|---|---|
| Commercialization framework | `docs/categories/stakeholders/commercial/` | Structured commercial system including claims discipline, pricing, pilot motions, and GTM |
| Security buyer packs | `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md` | Buyer-facing security evidence and trust documentation |
| Governance doctrine | `docs/governance/`, `governance/` | Gate taxonomy, owner-operated review model, authority framework |
| Evidence methodology | `docs/union-eyes/pilot-evidence-pack/`, `docs/governance/` | Evidence-first operating model connecting code to claims |
| Diagnostic models | `docs/doctrine/programs/` | OCRA and institutional continuity risk assessment models |
| Assessment framework | `docs/oci/OCI_METHOD.md` | OCI scoring dimensions and assessment protocols |
| Implementation framework | `docs/categories/products-and-market/union-eyes/`, `docs/public-service/` | Sector-specific implementation playbooks for Union Eyes and CIVIC |
| Proof-run methodology | `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md` | Controlled-pilot operating methodology with evidence capture |

### Commercial and Market Assets

| Asset | Path | Description |
|---|---|---|
| Pricing frameworks | `docs/categories/stakeholders/commercial/pricing-framework.md` | Tiered subscription and pilot pricing models |
| Buyer packs | `docs/categories/stakeholders/commercial/`, `docs/union-eyes/pilot-evidence-pack/` | Procurement-ready evidence and trust documentation |
| Sales kits | `docs/categories/stakeholders/commercial/sales-kit/` | Objection handling, demo scripts, ROI models, and proposal templates |
| Evidence books | `docs/union-eyes/pilot-evidence-pack/` | Sealed, hash-verified pilot evidence bundles |
| Investor materials | `docs/categories/stakeholders/investor/` | One-pager, moat analysis, shared-platform leverage model |
| Claims ledger | `docs/categories/stakeholders/commercial/claims-ledger.md` | Commercial integrity system for evidence-tagged claims |
| Customer proof playbook | `docs/categories/stakeholders/commercial/customer-proof-playbook.md` | Protocol for capturing and publishing customer evidence |

### Documentation Corpus

| Asset | Description |
|---|---|
| Architecture documentation | Platform, product, and infrastructure architecture across `docs/architecture/`, `ARCHITECTURE.md`, and per-product `docs/` directories |
| Operations runbooks | `ops/runbooks/` — production runbook corpus for Union Eyes and platform operations |
| Governance records | `governance/` — corporate structure, IP strategy, gate records, and portfolio truth |
| Compliance scaffolding | `docs/compliance/` — SOC 2 gap log, privacy framework, and policy registry |

### IP Ownership Posture

All institutional assets documented in this appendix are owned by Nzila Ventures Inc. as the centrally controlled IP holder. **Confidence: Documented.** Evidence: `governance/corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`.
