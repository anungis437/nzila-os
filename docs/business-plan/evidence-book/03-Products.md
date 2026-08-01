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
