# Decline Memo and Rebuttal

**Prepared:** 2026-08-01
**Scope:** $75,000 BDC financing request — Nzila Ventures Inc.
**Instruction:** Build the strongest possible decline memo, quoting exact business plan sections. Then build the strongest rebuttal using only evidence already contained in the repository. Do not invent evidence.

---

## PART 1 — THE DECLINE MEMO

*Assumes the committee wants to decline. Uses only evidence from the dossier itself.*

---

### Recommended Decision: Decline

**Reason summary:** The application presents a technically sophisticated but pre-revenue company with no signed customers, an unverifiable pipeline, a missing repayment model, significant key-person risk, and multiple cross-document inconsistencies. The evidence package is unusually thorough in demonstrating product and governance maturity but fails to address the lender's core question: how and when will BDC be repaid?

---

#### Decline Ground 1 — No Revenue and No Confirmed Customer Activity

> "No booked revenue is claimed in this dossier."
> — `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

The applicant explicitly acknowledges zero booked revenue and zero signed contracts. The commercial pipeline is the only basis for repayment, and that pipeline is documented as:

> "The pipeline is active... Active market engagement with qualified prospects"
> — `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

However, the actual pipeline data system shows:

> "Null state rule: unknown metric with no recorded activity shows 'Awaiting activity data' — never zero, never estimated."
> — `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`

The deal table — which is the only pipeline quantity presented — is explicitly labeled:

> "Current Live Calculation (as of data seed)"
> — `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`

"Data seed" indicates illustrative developer records, not actual customer conversations. The application presents a $368,750 weighted pipeline that does not reflect any confirmed commercial activity.

**Conclusion:** The repayment case rests entirely on future customer activity that has not been initiated or documented.

---

#### Decline Ground 2 — No Repayment Model

The dossier contains no month-by-month cash flow, no debt service coverage ratio, no breakeven analysis, and no repayment schedule. The loan terms themselves are not stated. The revenue scenarios document, which would normally provide projection support, contains no numbers:

> "Conservative: low conversion, constrained implementation throughput / Base: moderate conversion with steady implementation execution / Upside: strong conversion plus expansion within existing accounts."
> — `docs/categories/stakeholders/investor/revenue-scenarios.md`

Without a repayment model, the committee has no analytical basis to approve the loan.

---

#### Decline Ground 3 — Critical Key-Person Risk

> "Board of Directors: Single-director structure: Lumbanzila Aubert Nungisa"
> — `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

> "Lumbanzila Aubert Nungisa: Class A Common — 100% (pre-dilution) — Incorporator and sole director"
> — `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

> "maintenance fields are incomplete and approval status is not evidenced"
> — `docs/business-plan/evidence-book/01-Company.md` (re: succession plan)

100% of corporate authority and technical gate authority reside in one individual. The succession plan is documented but incomplete. If Aubert is unable to operate, the company has no documented continuity mechanism.

---

#### Decline Ground 4 — Co-Founder Cannot Be Verified

> "Michel is recorded in the operating leadership registry as President with responsibility for Union Eyes, ABR, labour/legal commercialization, and buyer trust programs."
> — `docs/business-plan/evidence-book/01-Company.md`

> "Michel is recorded as president with labour/legal commercialization scope. Surname is not included in the registry."
> — `docs/business-plan/evidence-book/01-Company.md`

The commercial plan depends substantially on Michel executing the Union Eyes sales motion. His full name, professional background, equity position, and legal relationship to the company are entirely undocumented. BDC cannot approve a commercialization loan whose execution depends on an unverifiable individual.

---

#### Decline Ground 5 — Internal Financial Inconsistencies

The pricing framework states a 5,000-member local subscription is $52,000/year. The pipeline deal table shows a local union (CUPE Local 123) at $85,000. The deal table shows CLC National at $250,000 with no pricing basis (federation pricing is "Custom"). $225,000 of the $368,750 weighted pipeline is a single undocumented deal.

Additionally, the Government Funding Strategy claims $500K–$1.5M in annual non-dilutive funding eligibility and $400K–$1M in annual R&D spend. These figures are inconsistent with the need for a $75,000 commercialization loan.

---

#### Decline Ground 6 — Critical Commercial Compliance Gaps

The product pricing explicitly promises:

> "SOC 2 Type II certification (on completion, included in subscription)"
> — `docs/categories/stakeholders/commercial/pricing-framework.md`

But the gap register states:

> "No completed SOC 2 examination evidenced in-repo. External diligence will ask for independent control assurance. Current posture is readiness scaffold only."
> — `docs/business-plan/evidence-book/11-Gap-Register.md` (ranked Critical)

Similarly:

> "No completed product-specific external pentest evidence for products in scope was found."
> — `docs/business-plan/evidence-book/11-Gap-Register.md` (ranked Critical)

A product that promises SOC 2 to customers without achieving it creates contingent liability and deal-blocking objections that will prevent the commercial conversions on which repayment depends.

---

**Recommended Decline Summary:**

The applicant has produced a technically impressive and unusually self-aware evidence dossier. However, the credit committee's fundamental question — how and when will BDC be repaid — cannot be answered from the materials provided. Zero confirmed pipeline, no repayment model, no use-of-funds schedule, an unverifiable co-founder, and multiple critical commercial gaps collectively make this application unsuitable for approval at this time.

---

## PART 2 — THE REBUTTAL

*Uses only evidence already contained in the repository. Does not invent evidence.*

---

### Rebuttal to Decline Ground 1 — No Revenue

**Concede:** Correct. No revenue has been booked.

**Rebuttal:** This is a pre-revenue commercialization loan. BDC's own SME mandate explicitly covers early-commercialization financing. The question is not "does revenue exist?" but "is first revenue credibly achievable with this loan?"

The product is not pre-build. It is deployed, production-certified, and priced:

> "Production certification exists for selected live runtimes."
> — `docs/readiness/production-certification.md`

> "The pilot fee is $12,000 CAD + HST. Exit terms: Full data export within 5 business days. No lock-in."
> — `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`

The 14-day go-live commitment is documented. The sales materials are complete. The pricing is published. The CUPE pilot offer is a specific, actionable document targeting a real named organization. First revenue does not require building anything — it requires signing one contract.

---

### Rebuttal to Decline Ground 2 — No Repayment Model

**Concede:** Correct. A formal month-by-month repayment model is missing and must be added.

**Rebuttal:** The structural inputs exist:

- Annual subscription for one mid-tier Local (3,001–5,000 members): $52,000/year
- Estimated loan service at 5 years / ~6%: ~$17,400/year
- One account covers debt service with $34,600/year remaining

SR&ED provides a documented backstop:

> "Status: ACTIVE — 2025 claim $140K, 2026 projected $220K"
> — `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`

Even if zero customers are acquired in Year 1, the projected SR&ED refund exceeds the annual debt service. The repayment story is structurally sound. It requires formalization, not invention.

---

### Rebuttal to Decline Ground 3 — Key-Person Risk

**Concede:** Key-person concentration is real. The succession plan requires completion.

**Rebuttal:** Key-person risk is inherent to founder-led early-stage companies. BDC regularly funds these situations. The risk is managed through:

1. A documented succession plan that can be completed and signed before funding.
2. An owner-operated governance model that is explicitly designed for this situation:

> "The repository explicitly documents an owner-operated governance model with technical gates retained as mandatory controls."
> — `docs/business-plan/evidence-book/01-Company.md`

3. The company's IP and commercial materials are entirely in the repository — a replacement operator could access all documentation, pricing, sales materials, and operational procedures without Aubert's direct involvement.

BDC can require a completed succession plan and key-person insurance as conditions precedent to funding.

---

### Rebuttal to Decline Ground 4 — Co-Founder Cannot Be Verified

**Concede:** Michel's credentials must be documented before submission.

**Rebuttal:** This is a correctable gap, not a fundamental business risk. The commercial system that Michel is operating was designed and built by Aubert and is entirely documented in-repository. The revenue cockpit, the pursuit list, the sales kit, and the pilot offer are complete independent of any individual executing them. A co-founder credential filing supplement can be added before BDC submission.

---

### Rebuttal to Decline Ground 5 — Internal Financial Inconsistencies

**Concede:** The pipeline deal table uses seeded/illustrative data that should not be cited as evidence. The pricing inconsistencies are real.

**Rebuttal:** The deal table is a **system demonstration**, not a commercial claim. The dossier's own claims-discipline infrastructure — which is the strongest evidence of management credibility in this package — is designed precisely to prevent this confusion:

> "Claims Ledger forces every external claim to be tagged as: actual, estimated, forecast, scenario, roadmap, or honesty-note."
> — `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

The seeded deal records should be removed from any BDC submission. The published pricing framework is the authoritative pricing document and it is internally consistent.

Regarding the SR&ED/loan-scale inconsistency: SR&ED claims are retrospective tax refunds on past R&D expenditure, not current liquidity. A company with substantial past R&D spend and no current revenue is exactly the profile that needs a commercialization bridge loan.

---

### Rebuttal to Decline Ground 6 — SOC 2 and Pentest Gaps

**Concede:** SOC 2 is not complete and external pentest has not been done. These are genuine risks.

**Rebuttal:** The $75,000 loan is partly intended to fund exactly these gaps. Pentest and SOC 2 completion are documented as use-of-funds targets. The gap register's own analysis shows these are readiness gaps, not architectural failures:

> "Security: 4.0 — Internal evidence is strong, especially for Union Eyes; completed external attestations are still pending."
> — `docs/business-plan/evidence-book/12-Commercial-Readiness.md`

The internal security architecture is fully implemented:

> "Row-level security, RBAC, audit chains, CI/CD security scans, SBOM, and DAST integration"
> — `docs/business-plan/evidence-book/14-Founder-Investment.md`

BDC can structure the loan with a condition that pentest and SOC 2 engagement are initiated within 90 days of funding and completed within 12 months. This converts a decline ground into a condition of approval.

---

## OUTCOME ANALYSIS

| Decline ground | Correctable before submission? | Manageable by condition? |
|---|---|---|
| No confirmed pipeline activity | Partially — cannot manufacture deals | Yes — milestone covenant |
| No repayment model | Yes — requires 1–2 days to draft | — |
| Key-person risk | Partially — requires succession plan completion | Yes — key-person insurance |
| Co-founder undocumented | Yes — requires credential supplement | — |
| Financial inconsistencies | Yes — remove seeded data, fix SR&ED framing | — |
| SOC 2 and pentest gaps | Not before approval | Yes — conditions of funding |

**Assessment:** Five of the six decline grounds are correctable before submission or manageable by conditions of approval. The one that is not — absence of confirmed pipeline activity — is the legitimate underwriting risk in this application. The committee's decision should turn on whether the company's documented commercial preparation justifies the risk that first revenue is 60–120 days away rather than already realized.

The evidence in the dossier argues that it does: the product exists, the pricing is specific, the materials are ready, and the founders have demonstrated $600,000+ of pre-commercial commitment. The loan is small relative to the demonstrated investment and the potential first-year subscription value.

**A conditional approval with revenue milestone covenant is more appropriate than a decline.**
