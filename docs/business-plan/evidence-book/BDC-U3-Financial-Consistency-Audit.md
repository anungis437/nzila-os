# Financial Consistency Audit

**Prepared:** 2026-08-01
**Scope:** Cross-check of all financial numbers across business plan, forecasts, use of funds, pricing, revenue bridge, milestones, hiring plan, and roadmap.
**Instruction:** Do not change numbers. Only report contradictions, missing assumptions, impossible timing, duplicated revenue, unsupported hiring, unrealistic burn, or repayment issues.

---

## Method

Every financial figure appearing in the repository was located and cross-referenced. Each inconsistency or missing assumption is reported below.

---

## Section 1 — Pricing vs. Pipeline Deal Values

### Inconsistency FC-01

**Finding:** Published pilot pricing for a Local Plan (up to 5,000 members) is $12,000 CAD. Published annual subscription for a 3,001–5,000 member local is $52,000. The Founder Revenue Cockpit deal table shows:

- deal-001 (CUPE Local 123): `pilot_active` — $85,000
- deal-002 (CAPE-ACEP): `demo_completed` — $120,000

Neither figure corresponds to any published pricing tier. A 5,000-member local pilot would be $12,000. A 5,000-member annual subscription would be $52,000. The $85,000 figure for a local is unreconciled.

**Source A:** `docs/categories/stakeholders/commercial/pricing-framework.md` — "3,001–5,000 members: $52,000/year"
**Source B:** `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md` — "deal-001 CUPE Local 123: $85,000"

**Possible explanations (not verified):** multi-year contract, add-ons included, or illustrative/placeholder figures. None of these are documented.

**Impact:** If a lender uses the pipeline table to estimate revenue, the numbers overstate expected revenue by 30–60% per deal relative to published pricing.

---

### Inconsistency FC-02

**Finding:** CAPE-ACEP is a federal professional association (Canadian Association of Professional Employees), not a union local. The published pricing framework has no tier for professional associations. The $120,000 figure for CAPE-ACEP has no basis in any published pricing document.

**Source A:** `docs/categories/stakeholders/commercial/pricing-framework.md` — tiers are Local (up to 5,000), Council (5,001–25,000), Federation (25,001+)
**Source B:** `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md` — "deal-002 CAPE-ACEP: $120,000"

**Impact:** Either the pricing framework is incomplete (professional associations are not covered) or this deal value is unsupported.

---

### Inconsistency FC-03

**Finding:** CLC National is listed in the deal table as `ingestion_running` at $250,000. The Canada Labour Congress (CLC) is a federation. Federation pricing is "Custom." No custom pricing range is documented. The $250,000 figure is unanchored.

**Source A:** `docs/categories/stakeholders/commercial/pricing-framework.md` — "Federation / National: Custom pricing"
**Source B:** `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md` — "deal-004 CLC National: $250,000"

**Impact:** $250,000 × 90% (ingestion probability weight) = $225,000 of the $368,750 weighted pipeline depends on one undocumented custom deal. Remove it and weighted pipeline falls to $143,750.

---

## Section 2 — Revenue Scenarios vs. Pricing

### Missing Assumption FA-01

**Finding:** The revenue scenarios document (`docs/categories/stakeholders/investor/revenue-scenarios.md`) lists the following variables:
- Active pilots per quarter
- Pilot-to-paid conversion rate
- Average contract value by product tier
- Gross retention in first 12 months
- Implementation capacity

But provides no numerical values for any of these variables in any scenario (Conservative / Base / Upside). There is no resulting revenue projection in dollars or a repayment timeline.

**Source:** `docs/categories/stakeholders/investor/revenue-scenarios.md`

**Impact:** The entire revenue bridge is missing. No lender calculation is possible from this document.

---

## Section 3 — Hiring Plan vs. Use of Funds

### Missing Assumption FA-02

**Finding:** The Government Funding Strategy document (February 2026) states "Job creation (15+ engineers, tech talent hiring)" as a qualifying criterion for government programs. The current three-product narrative (Union Eyes, CIVIC, CourtLens) does not document any hiring plan. The business plan package contains no headcount plan, salary budget, or timeline for hiring.

**Source A:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md` — "15+ engineers"
**Source B:** `docs/business-plan/evidence-book/` — no hiring plan document exists

**Impact:** If BDC loan proceeds are intended to fund hiring, no budget is provided. If 15+ engineers are claimed for government program purposes, BDC will ask whether any of the $75,000 is for payroll.

---

## Section 4 — SR&ED Claims vs. Current Portfolio

### Inconsistency FC-04

**Finding:** The Government Funding Strategy (February 2026) documents SR&ED eligible projects including Memora healthtech, CORA AgTech, SentryIQ360 Insurance, and "Nzila AI Backbone across 15 platforms." The current BDC dossier describes a three-product portfolio: Union Eyes, CIVIC, CourtLens. The products listed in the SR&ED narrative (CORA, SentryIQ360, Memora) do not appear in the current three-product narrative.

**Source A:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md` — SR&ED project list
**Source B:** `docs/business-plan/evidence-book/00-Executive-Summary.md` — three-product narrative

**Impact:** Either (a) these products were discontinued and SR&ED claims are correct for historical R&D that is no longer active, or (b) the company has more products than presented to BDC. Both scenarios require explanation.

---

### Inconsistency FC-05

**Finding:** SR&ED projected at $220,000 for 2026 based on "$400K–$1M eligible R&D spend." If the company is spending $400,000–$1,000,000 on R&D, and this is the basis for the BDC loan at $75,000, the relative scale is inconsistent. A company with $400K–$1M in annual R&D spend does not typically need a $75,000 commercialization loan for liquidity. Either the R&D spend figure is projective/aspirational, or the loan purpose needs clearer framing.

**Source:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md` — "Annual Value: $140K-$380K (35-40% of $400K-$1M eligible R&D spend)"

**Impact:** The financial scale implied by SR&ED claims is inconsistent with the scale implied by a $75,000 loan request.

---

## Section 5 — Pilot Timing vs. Revenue Timeline

### Impossible Timing IT-01

**Finding:** The 90-day pilot offer specifies:
- Week 1: Contract signed, environment provisioned
- Week 2: Go-live
- Weeks 5–8: Active use
- Weeks 9–10: Mid-pilot review

This means the earliest a pilot can be completed and a conversion decision reached is 10–13 weeks (approximately 3 months) after contract signature. If no contract has been signed as of 2026-08-01, the earliest first subscription revenue is approximately November 2026. If loan proceeds require revenue deployment to begin debt service within 90 days, there is no path to first revenue by that date unless a contract is signed within days of funding.

**Source A:** `docs/categories/stakeholders/commercial/pilot-offer-cupe.md` — timeline table
**Source B:** Implied loan terms (90-day revenue milestone, if applicable)

**Impact:** Every day without a signed pilot contract pushes the first subscription revenue date further out. No signed contract or LOI is documented.

---

## Section 6 — SOC 2 Promise vs. Completion Timeline

### Inconsistency FC-06

**Finding:** The pricing framework promises "SOC 2 Type II certification (on completion, included in subscription)" as a standard feature. SOC 2 Type II typically requires 6–12 months of audit period evidence plus examiner engagement. No SOC 2 readiness timeline or target date is documented in the business plan.

**Source A:** `docs/categories/stakeholders/commercial/pricing-framework.md` — SOC 2 promise
**Source B:** `docs/business-plan/evidence-book/11-Gap-Register.md` — "No completed SOC 2 examination"

**Impact:** Customers may be purchasing a subscription that includes a promised deliverable with no documented delivery date. This creates a contingent liability whose value and timeline are unknown.

---

## Section 7 — Government Funding vs. Loan Sizing

### Inconsistency FC-07

**Finding:** The Government Funding Strategy claims Nzila qualifies for "$500K–$1.5M annually in non-dilutive government funding." If this is accurate, the company has access to substantially more capital than the $75,000 BDC loan. The BDC loan would represent 5–15% of available non-dilutive funding. The document does not explain why BDC debt financing is being pursued instead of or in addition to non-dilutive grants.

**Source:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`

**Impact:** Without an explanation of why this loan is needed given available grant funding, a lender may question whether this request is correctly targeted or whether grant applications have already been exhausted/rejected.

---

## Section 8 — Burn Rate vs. Azure Costs

### Missing Assumption FA-03

**Finding:** The platform runs on Azure Canada Central. Union Eyes requires dedicated Azure tenant provisioning per pilot organization. No Azure cost data is documented anywhere in the business plan package. No monthly burn rate, infrastructure cost per customer, gross margin per subscription, or FinOps summary is included.

**Source:** `docs/readiness/production-certification.md`; `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`

**Impact:** Without Azure cost per tenant, gross margin per pilot and per subscription cannot be calculated. The repayment model cannot be stress-tested. BDC will ask for this.

---

## Summary Table

| ID | Type | Finding | Documents |
|---|---|---|---|
| FC-01 | Contradiction | Deal values exceed published pricing tiers | Pricing framework vs. Revenue cockpit |
| FC-02 | Contradiction | CAPE-ACEP not in any pricing tier | Pricing framework vs. Revenue cockpit |
| FC-03 | Contradiction | CLC $250K deal anchors 61% of weighted pipeline but has no pricing basis | Pricing framework vs. Revenue cockpit |
| FA-01 | Missing assumption | Revenue scenarios have no numbers | Revenue scenarios doc |
| FA-02 | Missing assumption | No hiring plan or salary budget | Funding strategy vs. business plan |
| FC-04 | Contradiction | SR&ED products not in current BDC narrative | Funding strategy vs. dossier |
| FC-05 | Contradiction | SR&ED implies $400K–$1M R&D spend inconsistent with $75K loan | Funding strategy |
| IT-01 | Impossible timing | First revenue cannot arrive within 90 days unless contract signed today | Pilot offer timeline |
| FC-06 | Contradiction | SOC 2 promised to customers with no delivery date | Pricing framework vs. gap register |
| FC-07 | Inconsistency | $500K–$1.5M grant eligibility not reconciled with $75K loan need | Funding strategy |
| FA-03 | Missing assumption | No Azure cost or burn rate documented | Operations / pilot offer |
