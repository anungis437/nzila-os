# 00 — Executive Summary

## Objective

Provide a concise, evidence-based view of Nzila Ventures' business maturity, technology readiness, and commercial readiness using only repository-observable artifacts.

## Evidence Summary

- **Nzila operates a shared multi-product software platform rather than a single-point product codebase.** **Confidence: Verified.** Evidence: `README.md`, `README.business.md`, `ARCHITECTURE.md`, `governance/portfolio/product-catalog.json`, `apps/`, `packages/`.
- **Three sector implementations express the shared Institutional Intelligence platform: Union Eyes (labour), CIVIC (public institutions), and CourtLens (legal/access-to-justice).** **Confidence: Verified.** Evidence: `README.md`, `README.business.md`, `ARCHITECTURE.md`, `governance/portfolio/product-catalog.json`, `apps/`, `packages/`, `docs/public-service/civic-thesis.md`, `docs/CIVIC_OCI_ALIGNMENT.md`.
- **Union Eyes has the strongest repository-backed commercial readiness evidence.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/README.md`, `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `apps/union-eyes/maturity.json`, `docs/readiness/production-certification.md`.
- **CIVIC has a documented thesis, OCI-aligned methodology, market-engagement materials, and public-sector positioning; it is in the discovery and pilot-definition phase.** **Confidence: Documented.** Evidence: `docs/public-service/civic-thesis.md`, `docs/public-service/civic-one-page-brief.md`, `docs/CIVIC_OCI_ALIGNMENT.md`.
- **CourtLens is currently a planning and migration program, not a shipped commercial runtime; its ABR-reuse architecture provides proven technical foundations.** **Confidence: Verified.** Evidence: `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`, `docs/courtlens/pilot-readiness-plan.md`.
- **The shared platform shows real engineering maturity: governed packages, release gates, production certification artifacts, evidence-pack tooling, and multiple security workflows.** **Confidence: Verified.** Evidence: `README.md`, `package.json`, `ARCHITECTURE.md`, `docs/readiness/`, `.github/workflows/`.
- **Commercial documentation is extensive, but parts of it outpace hard operational proof and occasionally conflict with stronger governance artifacts.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`.

## Business Overview and Maturity

| Area | Assessment | Confidence | Basis |
|---|---|---|---|
| Corporate operating presence | Repository demonstrates sustained operating activity across governance, engineering, commercial, and product surfaces. | Verified | `README.business.md`, `governance/`, `docs/`, `apps/`, `packages/` |
| Product portfolio maturity | Three sector implementations of one platform: Union Eyes (controlled-pilot ready, strongest evidence), CIVIC (public-sector discovery/engagement phase), and CourtLens (planning/pipeline stage, ABR reuse-first). | Verified | `reports/portfolio-status.md`, `apps/union-eyes/maturity.json`, `docs/public-service/civic-thesis.md`, `docs/courtlens/` |
| Governance maturity | Strong documentation and gate architecture exist, though some governance artifacts remain aspirational or process-only. | Documented | `docs/governance/gates/gate-taxonomy.md`, `governance/README.md`, `docs/compliance/soc2/` |
| Revenue-operating discipline | Commercial packages, pricing, and pursuit systems exist; signed-customer evidence is limited in-repo. | Documented | `docs/categories/stakeholders/commercial/`, `governance/portfolio/product-catalog.json` |

## Estimated Technology Readiness Level (derived assessment)

| Scope | TRL Estimate | Rationale | Confidence |
|---|---:|---|---|
| Shared platform controls | 8 | Production certification corpus exists for live runtimes, release gates, isolation, backup, and runtime inventory. | Demonstrated |
| Union Eyes | 7 | Controlled pilot clearance, pilot evidence pack, product readiness report, and production-certified infrastructure exist; product expansion remains conditional. | Demonstrated |
| CIVIC | 4 | Canonical thesis, OCI-aligned methodology, forwardable materials, and public-sector discovery engagement exist; sector-specific runtime is not yet separately certified. | Documented |
| CourtLens | 3 | Architecture, migration, and pilot planning exist; ABR reuse foundation is proven; CourtLens implementation is intentionally deferred. | Planned |

## Commercial Readiness

- **Union Eyes:** strongest commercial dossier, pilot offer, pricing, buyer review paths, and trust artifacts. **Confidence: Demonstrated.** Evidence: `docs/categories/stakeholders/commercial/`, `docs/union-eyes/pilot-evidence-pack/`, `apps/union-eyes/maturity.json`.
- **CIVIC:** public-sector thesis, OCI-aligned methodology, forwardable briefings, and discovery engagement underway. **Confidence: Documented.** Evidence: `docs/public-service/civic-thesis.md`, `docs/public-service/civic-one-page-brief.md`, `docs/CIVIC_OCI_ALIGNMENT.md`.
- **CourtLens:** no current commercialization evidence beyond pilot-definition planning; ABR reuse architecture de-risks implementation. **Confidence: Planned.** Evidence: `docs/courtlens/pilot-readiness-plan.md`.

## Key Findings

1. **Nzila's strongest lender- and partner-ready asset is not a generic slide narrative but a repository-backed evidence culture.** **Confidence: Verified.** Evidence: `proof-artifacts/`, `reports/`, `docs/union-eyes/pilot-evidence-pack/`, `docs/readiness/`.
2. **Union Eyes is the primary documentary proof point for near-term commercialization.** **Confidence: Demonstrated.** Evidence: `apps/union-eyes/maturity.json`, `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`.
3. **CIVIC is the public-sector front door for the Institutional Intelligence platform, positioned for government and institutional audiences with a distinct methodology narrative.** **Confidence: Documented.** Evidence: `docs/public-service/civic-thesis.md`, `docs/CIVIC_OCI_ALIGNMENT.md`.
4. **CourtLens should be presented as a planned extension with a proven technical foundation, not as an implemented product.** **Confidence: Verified.** Evidence: `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`.
5. **The repository contains a strong operations and governance substrate that can support institutional diligence conversations.** **Confidence: Verified.** Evidence: `package.json`, `docs/readiness/production-certification.md`, `docs/governance/gates/gate-taxonomy.md`, `.github/workflows/`.
6. **Several commercial and governance narratives need tighter synchronization before external diligence at scale.** **Confidence: Verified.** Evidence: package/workflow count mismatches between `README.business.md` and current directory state; legal-entity naming inconsistency; SOC 2 / pentest status caveats in `docs/compliance/soc2/gap-log.md` and `docs/categories/stakeholders/commercial/claims-ledger.md`.

## Document Confidence Summary

| Section | Confidence |
|---|---|
| Company and governance facts | Verified / Documented |
| Institutional Intelligence doctrine | Verified |
| Product maturity — Union Eyes | Demonstrated |
| Product maturity — CIVIC | Documented |
| Product maturity — CourtLens | Planned |
| Shared technology platform | Verified |
| Security and operations | Verified / Documented |
| Commercialization | Documented / Demonstrated |
| Validation and traction | Demonstrated for Union Eyes pilot processes; Documented for CIVIC discovery; Planned for CourtLens |

## Supporting Artifacts

- `README.md`
- `README.business.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `governance/portfolio/product-catalog.json`
- `reports/portfolio-status.md`
- `apps/union-eyes/maturity.json`
- `docs/public-service/civic-thesis.md`
- `docs/CIVIC_OCI_ALIGNMENT.md`
- `docs/union-eyes/pilot-evidence-pack/`
- `docs/readiness/`

## Current Maturity

Nzila appears most mature as a governed shared platform with one strongly evidenced pilot-ready product family (Union Eyes), one materially documented public-sector market-engagement program (CIVIC), and one planning-stage extension (CourtLens) with proven technical foundations.

## Commercialization Relevance

This repository can credibly support diligence on platform capability, governance discipline, pilot readiness, product packaging, and sector strategy. It is weaker on signed-contract evidence, audited compliance attestations, and verified external traction.

## Narrative Summary

> **Institutional Intelligence** is the company.
> **Union Eyes** is the labour-sector implementation.
> **CIVIC** is the public-sector implementation.
> **CourtLens** is the legal and access-to-justice implementation.
> The financing request is to commercialize and scale a substantial body of founder-funded intellectual property, not to fund an idea.

## Gaps

- Signed customer contracts and booked revenue evidence are not present in-repo.
- CIVIC-specific runtime maturity file is not yet published.
- Corporate-entity naming is inconsistent across legacy artifacts.

## Next Milestone

Synchronize external-facing commercial materials with the strongest internal evidence sources, then package Union Eyes and CIVIC into consistent lender/procurement briefing sets aligned with the updated three-product narrative.
