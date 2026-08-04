# 03 — Products

## Objective

Assess the three active commercial implementations of the Institutional Intelligence platform — Union Eyes (labour sector), CIVIC (public sector), and CourtLens (legal and access-to-justice) — using repository evidence only.

## Product Architecture

Nzila operates one company with a shared Institutional Intelligence platform expressed through three sector implementations:

| Product | Sector | Stage |
|---|---|---|
| **Union Eyes** | Labour | Controlled pilot GO — strongest commercial evidence |
| **CIVIC** | Public institutions | Market engagement and discovery phase |
| **CourtLens** | Legal / access-to-justice | Planning and pipeline — ABR reuse-first architecture |

> **Note on FairCase:** FairCase (ABR) was an earlier naming and framing for what became the justice and institutional-governance platform. Its implemented codebase (`apps/abr/`) now serves as the reuse-first technical foundation for CourtLens. FairCase is retained here as historical lineage and technical context only — it is not an active commercial offering.

## Evidence Summary

- **Union Eyes is the most evidenced commercial product in the repository.** **Confidence: Demonstrated.** Evidence: `apps/union-eyes/README.md`, `apps/union-eyes/maturity.json`, `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/products-and-market/union-eyes/`, `docs/readiness/production-certification.md`.
- **CIVIC is the public-sector implementation of the Institutional Intelligence platform, with documented thesis, market-engagement materials, and a distinct front-door narrative for government and institutional audiences.** **Confidence: Documented.** Evidence: `docs/public-service/civic-thesis.md`, `docs/public-service/civic-one-page-brief.md`, `docs/public-service/civic-faq.md`, `docs/CIVIC_OCI_ALIGNMENT.md`.
- **CourtLens currently exists as a migration and pilot-planning workstream built to reuse the ABR codebase.** **Confidence: Verified.** Evidence: `docs/courtlens/README.md`, `docs/courtlens/target-architecture.md`, `docs/courtlens/pilot-readiness-plan.md`.

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

## CIVIC

### Purpose and Problem Solved

- **CIVIC is the public-sector implementation of the Institutional Intelligence platform — the front door through which federal and provincial institutions engage with Nzila's continuity, governance, and accountability methodology.** **Confidence: Verified.** Evidence: `docs/public-service/civic-thesis.md`, `docs/public-service/civic-one-page-brief.md`, `docs/CIVIC_OCI_ALIGNMENT.md`.
- **CIVIC = Continuity, Implementation, Visibility, Integrity, and Capacity.** These five pillars directly map to the OCI scoring dimensions and the CLEAR evidence framework. **Confidence: Verified.** Evidence: `docs/public-service/civic-thesis.md`, `docs/CIVIC_OCI_ALIGNMENT.md`.
- **CIVIC exists to serve public-service leaders navigating workforce transition, modernization pressure, evidence fragmentation, accountability risk, and institutional-memory loss simultaneously.** **Confidence: Documented.** Evidence: `docs/public-service/civic-thesis.md`, `docs/public-service/the-public-service-continuity-problem.md`.

### Target Market

- **Federal and provincial public institutions, government agencies, public authorities, and public-service leadership.** **Confidence: Documented.** Evidence: `docs/public-service/civic-one-page-brief.md`, `docs/public-service/target-institutions/`, `docs/public-service/public-service-conversation-guide.md`.
- **CIVIC is purposefully differentiated from Union Eyes so federal contacts can evaluate continuity framing without being routed through labour-sector branding.** **Confidence: Verified.** Evidence: `docs/public-service/civic-thesis.md`.

### Current Maturity

| Dimension | Assessment | Confidence | Evidence |
|---|---|---|---|
| Thesis and methodology | Canonical thesis, OCI alignment, and CIVIC ↔ OCI Rosetta table documented | Verified | `docs/public-service/civic-thesis.md`, `docs/CIVIC_OCI_ALIGNMENT.md` |
| Market-facing materials | One-page brief, FAQ, executive brief, conversation guide, and forwardable materials exist | Documented | `docs/public-service/civic-one-page-brief.md`, `docs/public-service/civic-faq.md`, `docs/public-service/forwardable/` |
| Discovery engagement | Executive discovery meetings and public-sector discussions documented in commercial pipeline | Documented | Commercial pipeline artifacts |
| Platform runtime | CIVIC reuses the shared Institutional Intelligence platform; sector-specific configurations are in progress | Planned | `docs/public-service/civic-thesis.md`, `docs/CIVIC_OCI_ALIGNMENT.md` |

### Positioning

CIVIC is introduced as a public-service initiative and briefing series first. The sequencing is:

1. **CIVIC** as the public-service continuity front door and thought-leadership entry point
2. **CLEAR** as the evidence-discipline methodology presented to public-service readers
3. **OCI / OCRA** as the underlying operational methodology and diagnostic instrument
4. **SAGE** as a future governance-evidence workspace for organizations ready for ongoing operations

### Architecture

- **Shared-platform foundation:** CIVIC reuses the same Institutional Intelligence platform infrastructure that powers Union Eyes — shared auth, database, decision-core, and governance tooling. **Confidence: Verified.** Evidence: `docs/CIVIC_OCI_ALIGNMENT.md`, `packages/institutional-intelligence/`, `packages/organizational-cognition-core/`.
- **OCI alignment:** CIVIC is not a separate product or scoring system. When CIVIC and OCI/OCRA doctrine appear to disagree, OCI/OCRA is authoritative. **Confidence: Verified.** Evidence: `docs/CIVIC_OCI_ALIGNMENT.md`.

### Commercial Readiness

CIVIC has a documented public-service thesis, market-engagement materials, and a distinct positioning strategy for government audiences. It is in the discovery and pilot-definition phase, not yet at signed-contract stage. **Confidence: Documented.** Evidence: `docs/public-service/`.

### Repository Evidence

- `docs/public-service/civic-thesis.md`
- `docs/public-service/civic-one-page-brief.md`
- `docs/public-service/civic-faq.md`
- `docs/public-service/forwardable/`
- `docs/public-service/public-service-conversation-guide.md`
- `docs/CIVIC_OCI_ALIGNMENT.md`
- `docs/public-service/target-institutions/`

### Gaps

- No CIVIC-specific runtime maturity file equivalent to `apps/union-eyes/maturity.json` yet published.
- Signed pilot or engagement commitments from public-sector institutions are not yet in-repo.
- CLEAR Method canonical artifact was not located in the reviewed repository.

### Next Milestone

Publish a CIVIC discovery report from executive engagements and open a formal CIVIC pilot definition with at least one target institution.

---

## FairCase — Historical Lineage

> **This section documents FairCase as historical lineage only. FairCase is not an active commercial offering.**

FairCase (internally coded as ABR) was the earlier product framing for Nzila's justice, equity-governance, and accountability platform. The implemented codebase (`apps/abr/`) — including tribunal intelligence, incident governance, executive exports, analytics, learning workflows, and bilingual coverage — now serves as the technical reuse foundation for CourtLens.

**Why FairCase is not an active product:**

- The strategic decision has been made to route institutional and equity-governance use cases through CourtLens (legal/access-to-justice sector) rather than maintaining FairCase as a separate commercial brand.
- Public-sector institutions, equity offices, and CHRO functions are now addressed through the CIVIC public-sector implementation of the platform.
- Union Eyes continues to serve labour-sector complaints and casework.

**Technical heritage value:**

The `apps/abr/` codebase provides CourtLens with a proven implementation of: tribunal intelligence, matter workflows, RBAC, audit chains, evidence handling, governance exports, and bilingual coverage. This reuse-first architecture materially reduces CourtLens implementation risk.

**Repository Evidence:**

- `apps/abr/README.md` — technical reference
- `apps/abr/maturity.json` — maturity record
- `apps/abr/modules/` — implemented capabilities
- `docs/courtlens/target-architecture.md` — documents CourtLens reuse of ABR primitives

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
- No independent pricing or sales materials comparable to Union Eyes/CIVIC.
- No maturity file or production evidence corpus.

### Next Milestone

Complete the ABR reuse audit, implement the minimum pilot workflow set, and publish a CourtLens maturity record before presenting it as an active commercial product.
