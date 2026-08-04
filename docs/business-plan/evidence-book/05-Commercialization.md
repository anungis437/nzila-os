# 05 — Commercialization

## Objective

Evaluate the repository evidence for pricing, pilot programs, sales materials, customer-journey design, and go-to-market discipline across the three sector implementations: Union Eyes (labour), CIVIC (public institutions), and CourtLens (legal/access-to-justice).

## Evidence Summary

- **The repository contains a substantial commercial documentation system, especially for Union Eyes and CIVIC discovery materials.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/`, `docs/public-service/`, `docs/categories/products-and-market/union-eyes/`.
- **Pricing and pilot packages are explicit rather than implied for Union Eyes.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/pricing-framework.md`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`.
- **Commercial claim discipline is itself documented.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/categories/stakeholders/commercial/customer-proof-playbook.md`.
- **Repository evidence for signed customers, closed deals, and realized commercial metrics is limited.** **Confidence: Verified.** Evidence: `governance/portfolio/product-catalog.json` classifies many revenue figures as estimated, forecast, or scenario.

## Pricing Models

| Product / motion | Evidence-based pricing posture | Confidence | Supporting artifacts |
|---|---|---|---|
| Union Eyes pilot | 90-day pilot priced at CAD $12,000, fully credited on conversion | Documented | `docs/categories/stakeholders/commercial/pricing-framework.md`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md` |
| Union Eyes annual subscription | Membership-tiered annual pricing documented for local, council, and federation plans | Documented | `docs/categories/stakeholders/commercial/pricing-framework.md` |
| CIVIC public-sector | Discovery and pilot-definition pricing in development; public-sector conversation guide and briefing materials exist | Documented | `docs/public-service/civic-one-page-brief.md`, `docs/public-service/public-service-conversation-guide.md` |
| CourtLens | No published pricing; pilot posture is planned | Planned | `docs/courtlens/pilot-readiness-plan.md` |
| Revenue scenarios | Product-catalog revenue fields exist, but are labeled estimated, forecast, or scenario rather than actuals | Verified | `governance/portfolio/product-catalog.json` |

## Commercial Packages

- **Union Eyes:** sales kit, pilot offer, implementation timeline, security one-pagers, access modes, channel maps, and ROI materials. **Confidence: Demonstrated.** Evidence: `docs/categories/stakeholders/commercial/` and `docs/categories/stakeholders/commercial/sales-kit/README.md`.
- **CIVIC:** one-page brief, executive brief, FAQ, forwardable materials, conversation guide, and public-service continuity thesis. **Confidence: Documented.** Evidence: `docs/public-service/`, `docs/public-service/forwardable/`.
- **CourtLens:** pilot scope and architecture defined; commercial packaging is not yet published. **Confidence: Planned.** Evidence: `docs/courtlens/`.

## Pilot Programs

- **Union Eyes controlled pilot program is heavily documented and operationalized.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/products-and-market/union-eyes/pilot-overview.md`, `docs/categories/products-and-market/union-eyes/pilot-kpis.md`.
- **CIVIC public-sector pilot definition is in development; discovery meetings and forwardable briefings are the current-stage motion.** **Confidence: Documented.** Evidence: `docs/public-service/civic-one-page-brief.md`, `docs/public-service/civic-faq.md`.
- **CourtLens pilot posture is only planned.** **Confidence: Planned.** Evidence: `docs/courtlens/pilot-readiness-plan.md`.

## Sales Materials

- **Union Eyes:** 45-minute demo script, discovery checklist, objection sheet, ROI assumptions, proposal template, follow-up emails, procurement auth Q&A, screenshot index. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/sales-kit/`.
- **CIVIC:** executive one-pager, FAQ, forwardable executive brief, conversation guide, and public-service continuity brief. **Confidence: Verified.** Evidence: `docs/public-service/forwardable/`, `docs/public-service/`.
- **Investor materials:** one-pager, moat analysis, shared-platform leverage model, growth narrative, risk register. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/investor/`.

## Executive Briefings and Customer Journey Documentation

- **Executive briefings:** commercial `docs/categories/stakeholders/commercial/executive-summary.md`, investor one-pager, Union Eyes buyer-review paths, OCI executive-readout templates in doctrine programs. **Confidence: Verified.**
- **Customer journey design:** Union Eyes implementation timeline, pilot operations runbook, pilot success metrics, and CIVIC public-sector conversation guide provide explicit journey scaffolding. **Confidence: Documented.**

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
- `docs/public-service/civic-one-page-brief.md`
- `docs/public-service/forwardable/`
- `docs/categories/stakeholders/investor/`
- `governance/portfolio/product-catalog.json`

## Current Maturity

Commercialization documentation is advanced and unusually structured. The main weakness is not the absence of GTM thinking, but the limited amount of in-repo closed-deal and customer-outcome evidence.

## Commercialization Relevance

This section is directly useful to BDC, government programs, and strategic partners because it shows product packaging, discipline around claims, and repeatable pilot/onboarding motions across two active commercial surfaces (Union Eyes and CIVIC).

## Gaps

- Realized revenue and signed-customer evidence are mostly absent.
- CIVIC pricing model for public-sector engagements is not yet fully published.
- CourtLens has no commercial materials beyond pilot definition.

## Next Milestone

Standardize commercial fact patterns across Union Eyes and CIVIC, then attach repository-backed customer proof artifacts to each primary package.
