# BDC Underwriter Attack Review

**Prepared:** 2026-08-01
**Scope:** $75,000 BDC financing request — Nzila Ventures Inc.
**Method:** Six-hat review (Commercial Account Manager · Risk Officer · Credit Underwriter · Portfolio Manager · Investment Committee · External Auditor)
**Instruction:** Do not rewrite. Report only. Assume the committee is skeptical and looking for reasons to decline.

---

## Methodology

Each finding is assigned:

| Field | Values |
|---|---|
| **Severity** | Critical · High · Medium · Low |
| **Why it matters to BDC** | Repayment / collateral / management / legal / governance / commercial |
| **Document affected** | Exact file path |
| **Exact wording to correct** | Quote from source |
| **Confidence** | Verified · Documented · Inferred |

---

## PART A — Repayment Concerns

### F-R-01 — No Repayment Model Exists

**Severity:** Critical

**Why it matters to BDC:** The single most important question for a credit committee is: how and when does BDC get its money back? Not one document in the dossier provides a month-by-month cash projection showing loan proceeds flowing into commercialization activity and generating cash sufficient to service debt. No repayment schedule, no debt service coverage ratio (DSCR), no break-even month is stated anywhere.

**Document affected:** `docs/business-plan/evidence-book/Nzila-Evidence-and-Commercial-Readiness-Dossier.md` (entire package); `docs/business-plan/evidence-book/13-Timeline.md`

**Exact wording to correct:** The timeline ends at "2026-08-01 — Repository scan." No forward milestone says "Month X: first pilot invoice received; Month Y: debt service begins; Month Z: loan retired."

**Confidence:** Verified — absence confirmed across full dossier review.

---

### F-R-02 — No Use of Funds Statement for the $75,000 Request

**Severity:** Critical

**Why it matters to BDC:** BDC credit policy requires a specific use-of-funds breakdown. The dossier states the purpose is "to commercialize and scale a substantial body of founder-funded intellectual property" but does not itemize how $75,000 will be allocated (e.g., sales headcount, Azure costs, travel, legal, marketing). Without this, the committee cannot assess whether the loan is sized correctly or whether it changes the risk profile.

**Document affected:** `docs/business-plan/evidence-book/14-Founder-Investment.md`

**Exact wording to correct:** "This is a financing request to commercialize and scale a substantial body of founder-funded intellectual property — not to fund an idea." This is a positioning statement, not a use-of-funds schedule.

**Confidence:** Verified.

---

### F-R-03 — Revenue Scenarios Contain No Numbers

**Severity:** Critical

**Why it matters to BDC:** Repayment depends on revenue. The revenue-scenarios document contains scenario framework labels (Conservative / Base / Upside) and variable names, but no projected dollar amounts, no timelines, and no conversion-rate assumptions that would let a lender stress-test the repayment model.

**Document affected:** `docs/categories/stakeholders/investor/revenue-scenarios.md`

**Exact wording to correct:** "Conservative: low conversion, constrained implementation throughput / Base: moderate conversion with steady implementation execution / Upside: strong conversion plus expansion within existing accounts." No numbers, no dates, no assumptions attached to any scenario.

**Confidence:** Verified.

---

### F-R-04 — Pipeline Figures Appear to Be Seeded Illustrative Data

**Severity:** Critical

**Why it matters to BDC:** The Founder Revenue Cockpit presents a deal table with named prospects (CUPE Local 123, CAPE-ACEP, Teamsters 938, CLC National, OPSEU Local 546, PSAC Atlantic) and weighted pipeline of $368,750. The table header reads **"Current Live Calculation (as of data seed)"** — indicating these are placeholder/illustrative records, not confirmed customer conversations. If BDC treats this as a real pipeline, it materially overstates near-term revenue probability.

**Document affected:** `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`

**Exact wording to correct:** "Current Live Calculation (as of data seed)" — the phrase "data seed" indicates these are developer-inserted example records. Additionally, deal-001 (CUPE Local 123) is shown as `pilot_active` at $85,000, which does not correspond to any tier in the published pricing framework (5,000-member local = $52,000/year; $85,000 is not a documented pricing point).

**Confidence:** Verified.

---

## PART B — Collateral Concerns

### F-C-01 — No Tangible Collateral Identified

**Severity:** High

**Why it matters to BDC:** BDC loans typically require collateral or personal guarantee. The dossier identifies IP as the primary asset class. However: (a) no third-party IP valuation exists; (b) the IP is documented as held centrally by Nzila Ventures Inc. but is described in the corporate structure document as unassigned pending formal IP assignment agreements; (c) the IP is deeply embedded in a monorepo — its liquidation value in a distress scenario is effectively zero for a lender without specialist buyer access.

**Document affected:** `governance/corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md`; `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

**Exact wording to correct:** "IP Assignment Agreements: Required for all contributors, signed at onboarding." — This is a policy statement; no assignments are actually evidenced in-repo.

**Confidence:** Documented.

---

### F-C-02 — Three Patent Filings Claimed but Not Evidenced in Business Plan

**Severity:** Medium

**Why it matters to BDC:** The Government Funding Strategy document states "3 patent filings pending." The IP section of the dossier (09-IP.md) does not reference pending patent applications. If the patents exist they represent potential collateral; if they do not, the government funding document misrepresents the IP position.

**Document affected:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`; `docs/business-plan/evidence-book/09-IP.md`

**Exact wording to correct:** Government Funding Strategy: "IP development (proprietary algorithms, 3 patent filings pending)." The business plan IP section makes no reference to patent applications.

**Confidence:** Documented — inconsistency is cross-document.

---

## PART C — Management Concerns

### F-M-01 — Key-Person Risk: 100% Founder Control, Incomplete Succession

**Severity:** Critical

**Why it matters to BDC:** Lumbanzila Aubert Nungisa holds 100% Class A voting shares, is sole director, sole incorporator, and is described as the authorized governance owner of the technical repository. If Aubert becomes unable to operate, the company has no governance continuity. The succession plan document exists but its maintenance fields are incomplete and its approval status is not evidenced.

**Document affected:** `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`; `governance/corporate/governance/policy-founder-succession-continuity-plan.md`

**Exact wording to correct:** "Board of Directors: Single-director structure: Lumbanzila Aubert Nungisa." Succession plan: "maintenance fields are incomplete and approval status is not evidenced" (per dossier's own gap register).

**Confidence:** Verified.

---

### F-M-02 — Co-Founder Michel: No Surname, No Equity Position, No Verified Credentials

**Severity:** High

**Why it matters to BDC:** Michel is listed as President in the leadership registry with responsibility for Union Eyes commercialization, labour/legal pursuits, and buyer trust programs. However: his surname does not appear anywhere in-repo, his equity position is not documented (he holds no Class A shares per the shareholder summary), and no professional credential evidence is provided. BDC underwriters will ask: is this person bound to the company? What would happen if he left?

**Document affected:** `governance/corporate/leadership.json`; `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

**Exact wording to correct:** Leadership registry: "michel — President." Shareholder summary: Aubert is listed as the sole shareholder. Michel does not appear in the shareholder table at all.

**Confidence:** Verified.

---

### F-M-03 — No Broader Management Roster

**Severity:** High

**Why it matters to BDC:** Beyond Aubert and Michel, no other management personnel are identified. The dossier acknowledges: "No broader management roster is consistently evidenced in current repo artifacts." For a company requesting $75,000 to execute a commercialization plan across three products and multiple enterprise sales motions, the absence of any account management, technical, or operations staff evidence raises execution-risk concerns.

**Document affected:** `docs/business-plan/evidence-book/01-Company.md`

**Exact wording to correct:** "Principals beyond Aubert and Michel are not clearly evidenced." (Own gap register admission.)

**Confidence:** Verified.

---

## PART D — Commercialization Concerns

### F-CO-01 — No Signed Customer. No Booked Revenue.

**Severity:** Critical

**Why it matters to BDC:** The dossier repeatedly and transparently acknowledges zero booked revenue and zero signed contracts. For a $75,000 commercialization loan, BDC will assess whether the borrower can generate its first dollar before loan maturity. With no signed pilot agreement and no referenceable customer, the entire repayment case is prospective.

**Document affected:** `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

**Exact wording to correct:** "No booked revenue is claimed in this dossier." While the honesty is commendable, the committee sees a company asking for $75,000 with no demonstrated ability to close a sale.

**Confidence:** Verified.

---

### F-CO-02 — Pilot Pricing Inconsistency With Deal Pipeline Values

**Severity:** High

**Why it matters to BDC:** Published pricing for a Local Plan (up to 5,000 members) shows a 90-day pilot at $12,000 and an annual subscription of $18,000–$52,000. The seeded deal table shows deal-001 (CUPE Local 123, presumably a local) at $85,000 and deal-002 (CAPE-ACEP) at $120,000. Neither figure reconciles with the published pricing framework. This creates doubt about whether the revenue model is internally consistent.

**Document affected:** `docs/categories/stakeholders/commercial/pricing-framework.md`; `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`

**Exact wording to correct:** Pricing: "3,001–5,000 members: $52,000/year." Deal table: "deal-001 CUPE Local 123 — $85,000." The $85,000 figure does not appear in any pricing tier.

**Confidence:** Verified.

---

### F-CO-03 — CIVIC Pricing Not Published; CIVIC Pipeline Not Quantified

**Severity:** Medium

**Why it matters to BDC:** CIVIC is presented as one of three core commercialization tracks. It has no published pricing model and no quantified pipeline. If Union Eyes pilots do not convert on schedule, BDC has no secondary revenue path to point to.

**Document affected:** `docs/business-plan/evidence-book/05-Commercialization.md`; `docs/business-plan/evidence-book/11-Gap-Register.md`

**Exact wording to correct:** "CIVIC pricing model for public-sector engagements is not yet fully published." "CIVIC public-sector pilot definition is in development."

**Confidence:** Verified.

---

### F-CO-04 — SOC 2 Promised to Customers but Not Yet Achieved

**Severity:** High

**Why it matters to BDC:** The pricing framework includes "SOC 2 Type II certification (on completion, included in subscription)" as a standard feature. SOC 2 is explicitly described in the gap register as a "Critical" gap: "no completed SOC 2 examination evidenced in-repo." Selling a product that promises a compliance attestation the company has not achieved creates a contingent liability and reputational risk that could delay or prevent customer conversions.

**Document affected:** `docs/categories/stakeholders/commercial/pricing-framework.md`; `docs/business-plan/evidence-book/11-Gap-Register.md`

**Exact wording to correct:** Pricing: "SOC 2 Type II certification (on completion, included in subscription)." Gap register: "No completed SOC 2 examination evidenced in-repo. External diligence will ask for independent control assurance."

**Confidence:** Verified.

---

### F-CO-05 — No External Pentest Evidence

**Severity:** High

**Why it matters to BDC:** The target market (labour unions, public institutions) has significant data-sensitivity requirements. The dossier classifies the absence of a completed external pentest as "Critical." Selling to enterprise buyers without a pentest creates deal-blocking objections and increases the probability that early pilots do not convert.

**Document affected:** `docs/business-plan/evidence-book/11-Gap-Register.md`

**Exact wording to correct:** "No completed product-specific external pentest evidence for products in scope was found. Commercial collateral should not imply more than readiness or planned status."

**Confidence:** Verified.

---

### F-CO-06 — Government Funding Strategy Describes a Different Product Portfolio

**Severity:** Medium

**Why it matters to BDC:** The Government Funding Strategy document (Feb 2026) describes active SR&ED claims for projects including Memora healthtech, CORA AgTech, SentryIQ360 Insurance, and "15 platforms." These products do not appear in the current three-product BDC narrative (Union Eyes, CIVIC, CourtLens). A BDC underwriter reading both documents will question whether the borrower's business has materially changed, whether SR&ED claims are correctly attributed, and whether the current focus is stable.

**Document affected:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`

**Exact wording to correct:** "Nzila-Eligible Projects: 1. UnionEyes Pension Forecasting Algorithm, 2. ABR Insights Gamification Engine, 3. CORA Agricultural Supply Chain Matching, 4. SentryIQ360 Insurance Arbitrage Engine, 5. Nzila AI Backbone." None of CORA, SentryIQ360, or Memora appear in the current dossier.

**Confidence:** Verified.

---

## PART E — Legal Concerns

### F-L-01 — Entity Naming Inconsistency Across Active Documents

**Severity:** High

**Why it matters to BDC:** A loan agreement requires one legal borrower. If the operating entity name used in commercial materials differs from the incorporated entity name, BDC's legal team will require remediation before funding. Three names are in active use: **Nzila Ventures Inc.** (corporate structure), **Nzila Digital Ventures** (README.business.md), and **Nzila OS Inc.** (legacy commercial file).

**Document affected:** `README.business.md`; `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`; legacy commercial documents

**Exact wording to correct:** Dossier gap register: "Entity naming is inconsistent across the repository (Nzila Ventures Inc., Nzila Digital Ventures, and Nzila OS Inc. in one legacy commercial file)."

**Confidence:** Verified.

---

### F-L-02 — OptivaCare Inc. Is Separately Incorporated — Scope of BDC Loan Unclear

**Severity:** Medium

**Why it matters to BDC:** The corporate structure document lists OptivaCare Inc. as separately incorporated. If any of the $75,000 will flow through or benefit OptivaCare (a separate legal entity), BDC's cross-default and intra-group lending policies are triggered. This must be clarified before credit approval.

**Document affected:** `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

**Exact wording to correct:** "OptivaCare Inc.: Long-term care data ecosystem — ✅ Incorporated."

**Confidence:** Documented.

---

### F-L-03 — IP Assignment Agreements Are Policy-Stated, Not Evidenced

**Severity:** Medium

**Why it matters to BDC:** The corporate structure document states "IP Assignment Agreements: Required for all contributors, signed at onboarding." If any contributor's IP assignment is missing, the company's IP ownership is potentially contested. This is a standard BDC and investor pre-condition.

**Document affected:** `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

**Exact wording to correct:** "IP Assignment Agreements: Required for all contributors, signed at onboarding." No actual executed agreements are in-repo.

**Confidence:** Documented.

---

## PART F — Governance Concerns

### F-G-01 — Advisory Board Is Not Yet Constituted

**Severity:** Medium

**Why it matters to BDC:** The governance document describes an advisory council as "in development — clinical, AI, ethics, legal." No named advisors, no terms, no bios. For a company seeking institutional lending, the absence of any external governance oversight amplifies key-person risk.

**Document affected:** `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

**Exact wording to correct:** "Advisory Council: In development — clinical, AI, ethics, legal."

**Confidence:** Verified.

---

### F-G-02 — Board Minutes and Resolutions Not Evidenced

**Severity:** Low

**Why it matters to BDC:** Authorizing the BDC borrowing requires a board resolution. With a single-director structure, this is procedurally simple — but BDC will require evidence of authorization. No board minutes or resolutions appear in-repo.

**Document affected:** `docs/business-plan/evidence-book/01-Company.md`

**Exact wording to correct:** "Board minutes and formal governance resolutions are referenced conceptually but not surfaced as current in-repo evidence."

**Confidence:** Verified.

---

## PART G — Evidence Concerns

### F-E-01 — No User Testing Results for Union Eyes

**Severity:** High

**Why it matters to BDC:** The product readiness report explicitly states that user-testing results do not yet exist. Union Eyes is presented as the primary commercialization vehicle. Without user-testing evidence, the committee cannot verify that the product works in a real user context — not just in a controlled demo.

**Document affected:** `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`; `docs/business-plan/evidence-book/11-Gap-Register.md`

**Exact wording to correct:** Gap register: "Union Eyes readiness report explicitly says user-testing results do not yet exist. Controlled pilot may proceed, but broader commercialization proof remains incomplete without user-test outcomes."

**Confidence:** Verified.

---

### F-E-02 — No Independent Validation, Certification, or Auditor Opinion

**Severity:** High

**Why it matters to BDC:** Every technical and security claim in the dossier is self-certified. No external auditor has reviewed the platform, the security posture, or the production-readiness evidence. For a lender evaluating technology IP as the primary asset, the absence of any independent validation is a material risk.

**Document affected:** `docs/business-plan/evidence-book/08-Validation.md`

**Exact wording to correct:** "Completed independent validation, certification, or auditor opinion letters were not found in the reviewed repository."

**Confidence:** Verified.

---

### F-E-03 — README Metrics Are Stale Relative to Observed Repository State

**Severity:** Low

**Why it matters to BDC:** README.business.md states 47 workflows and 215 packages. The dossier itself records 52 workflows and 225 packages. A committee reading both sources will notice the discrepancy and question whether other external-facing data has similar drift.

**Document affected:** `README.business.md`; `docs/business-plan/evidence-book/11-Gap-Register.md`

**Exact wording to correct:** Gap register: "Published repository counts are stale relative to current repo state (e.g., 47 workflows vs. 52 observed; 215 packages vs. 225 observed)."

**Confidence:** Verified.

---

## Findings Summary Table

| ID | Category | Severity | One-Line Finding |
|---|---|---|---|
| F-R-01 | Repayment | **Critical** | No repayment model or cash flow projection exists |
| F-R-02 | Repayment | **Critical** | No use-of-funds breakdown for the $75,000 |
| F-R-03 | Repayment | **Critical** | Revenue scenarios contain no numbers or timelines |
| F-R-04 | Repayment | **Critical** | Pipeline figures appear to be illustrative seed data |
| F-C-01 | Collateral | **High** | No tangible collateral; IP has no liquidation value |
| F-C-02 | Collateral | **Medium** | 3 patent filings claimed but not evidenced in dossier |
| F-M-01 | Management | **Critical** | 100% key-person risk; succession plan incomplete |
| F-M-02 | Management | **High** | Co-founder Michel: no surname, no equity, no credential evidence |
| F-M-03 | Management | **High** | No management roster beyond two principals |
| F-CO-01 | Commercial | **Critical** | No signed customer, no booked revenue |
| F-CO-02 | Commercial | **High** | Deal pipeline values inconsistent with published pricing |
| F-CO-03 | Commercial | **Medium** | CIVIC has no pricing and no quantified pipeline |
| F-CO-04 | Commercial | **High** | SOC 2 promised to customers but not yet achieved |
| F-CO-05 | Commercial | **High** | No external pentest evidence |
| F-CO-06 | Commercial | **Medium** | Funding strategy describes a different product portfolio |
| F-L-01 | Legal | **High** | Three different entity names active across documents |
| F-L-02 | Legal | **Medium** | OptivaCare Inc. is separately incorporated — loan scope unclear |
| F-L-03 | Legal | **Medium** | IP assignment agreements are policy, not evidenced |
| F-G-01 | Governance | **Medium** | No advisory board constituted |
| F-G-02 | Governance | **Low** | No board resolutions evidenced |
| F-E-01 | Evidence | **High** | No user testing results for Union Eyes |
| F-E-02 | Evidence | **High** | No independent validation or auditor opinion |
| F-E-03 | Evidence | **Low** | README metrics stale vs. observed repository state |

---

## Critical Path to Credit Readiness

Before resubmitting to credit committee, these five items are minimum threshold:

1. **Repayment model** — month-by-month cash flow, DSCR, repayment schedule, downside scenario.
2. **Use of funds** — specific allocation of the $75,000 to named activities with timelines.
3. **Revenue scenarios with numbers** — at least Conservative and Base scenarios with dollar amounts, conversion assumptions, and first-revenue date.
4. **Legal entity normalization** — one name across all documents; confirm OptivaCare is out of scope.
5. **Co-founder documentation** — Michel's full name, role, equity position, IP assignment, and professional background.

The remaining findings are material but can be managed through conditions and covenants rather than pre-conditions.
