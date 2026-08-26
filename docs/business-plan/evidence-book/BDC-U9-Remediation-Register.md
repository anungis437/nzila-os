# BDC Credit Remediation Register

**Prepared:** 2026-08-01
**Source material:** BDC-U1 through BDC-U8 (internal stress-test series)
**Scope:** $75,000 BDC financing request — Nzila Ventures Inc.
**Status:** INTERNAL WORKING DOCUMENT — not for BDC submission

**Instruction applied:** The eight stress-test documents are treated as internal underwriting findings. This register consolidates every finding across all eight documents into a single authoritative remediation tracking instrument. No business narrative has been expanded and no new strategy has been created.

---

## Controls Applied to This Register

The following controls govern this register and all lender-facing documents derived from it:

1. All seeded, illustrative, or synthetic pipeline values are removed from lender-facing claims.
2. Estimated founder cash contributions are not presented as verified.
3. Documented cash, shareholder advances, unpaid founder effort, and internally created IP are separated.
4. No financial value is assigned to founder time or internally developed IP without an identified methodology and explicit management approval.
5. Every revenue, pricing, customer, hiring, use-of-funds, and repayment number must be reconciled across the business plan before lender submission.
6. Union Eyes, CIVIC, and CourtLens maturity boundaries are preserved as documented in the product catalog.
7. Michel Nungisa's legal identity, titles, ownership, responsibilities, and Nungisa Law relationship must be reconciled across all documents.
8. One Lab Technologies is treated only as historical BDC and entrepreneurial context.
9. SR&ED refunds are not relied upon as primary repayment capacity unless eligibility, qualifying expenditures, timing, and expected refund are documented by a qualified advisor.
10. Lender covenant recommendations are not made; risks are identified and BDC is allowed to structure its own credit conditions.

---

## Register

### REM-001 — No Repayment Model or Cash Flow Projection

| Field | Detail |
|---|---|
| **Unique ID** | REM-001 |
| **Severity** | Critical |
| **Source stress-test** | U1 (F-R-01), U2, U3 |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/13-Timeline.md`; `docs/categories/stakeholders/investor/revenue-scenarios.md`; full dossier |
| **Exact claim or inconsistency** | No document in the dossier provides a month-by-month cash projection showing loan proceeds flowing into commercialization activity and generating cash sufficient to service debt. No repayment schedule, no debt service coverage ratio (DSCR), and no break-even month is stated anywhere. |
| **Required source evidence** | Actual loan terms from BDC (principal, rate, amortization, start date); revenue scenario projections with dollar amounts; use-of-funds schedule; cash available for debt service calculation per scenario |
| **Responsible owner** | Aubert Nungisa (primary); BDC loan officer (for term confirmation) |
| **Disposition** | Quantify — build a sourced month-by-month debt-service model for Conservative and Base scenarios |
| **Remediation status** | Open |
| **Closure evidence** | Signed or confirmed BDC term sheet; revenue scenario spreadsheet with collected revenue, direct costs, operating expenses, taxes, and cash available for debt service; downside scenario assuming first significant customer closes 90–120 days later than target |
| **Lender-facing impact** | The credit committee cannot approve without a credible repayment path. This is the primary blocking finding. |

---

### REM-002 — No Use-of-Funds Statement for the $75,000 Request

| Field | Detail |
|---|---|
| **Unique ID** | REM-002 |
| **Severity** | Critical |
| **Source stress-test** | U1 (F-R-02), U2 |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/14-Founder-Investment.md`; executive summary |
| **Exact claim or inconsistency** | The dossier states the purpose of the loan is "to commercialize and scale a substantial body of founder-funded intellectual property" but provides no itemized breakdown of how the $75,000 will be allocated. |
| **Required source evidence** | Specific named line items with dollar amounts and timelines (e.g., pentest engagement, SOC 2 readiness, sales activities, Azure provisioning, travel, legal) |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Document — produce a specific use-of-funds schedule before BDC submission |
| **Remediation status** | Open |
| **Closure evidence** | Written use-of-funds table with line items totalling $75,000, linked to specific commercialization activities and timelines |
| **Lender-facing impact** | BDC credit policy requires use-of-funds detail. Without it, the committee cannot assess whether the loan is sized correctly or whether the risk profile is acceptable. |

---

### REM-003 — Revenue Scenarios Contain No Numbers

| Field | Detail |
|---|---|
| **Unique ID** | REM-003 |
| **Severity** | Critical |
| **Source stress-test** | U1 (F-R-03), U2, U3 (FA-01) |
| **Affected lender-facing document** | `docs/categories/stakeholders/investor/revenue-scenarios.md` |
| **Exact claim or inconsistency** | The revenue scenarios document lists Conservative, Base, and Upside labels and scenario variables but contains no projected dollar amounts, no conversion-rate assumptions, and no repayment timelines. No lender calculation is possible from this document. |
| **Required source evidence** | Numerical values for each scenario: pilots per quarter, conversion rate, average contract value, first-revenue date, annual recurring revenue at Years 1–3, cash available for debt service |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Quantify — populate the revenue scenarios document with actual numbers, clearly labelled as projections with stated assumptions |
| **Remediation status** | Open |
| **Closure evidence** | Updated revenue scenarios document with numerical projections; assumptions stated explicitly; Conservative scenario includes a 90–120 day sales delay assumption |
| **Lender-facing impact** | Without a repayment model there is no analytical basis for credit approval. Directly related to REM-001. |

---

### REM-004 — Pipeline Figures Are Seeded Illustrative Data

| Field | Detail |
|---|---|
| **Unique ID** | REM-004 |
| **Severity** | Critical |
| **Source stress-test** | U1 (F-R-04), U3 (FC-01, FC-02, FC-03), U4 (CEA-05, CEA-06), U8 |
| **Affected lender-facing document** | `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`; `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md` |
| **Exact claim or inconsistency** | The Founder Revenue Cockpit deal table presents named organizations (CUPE Local 123 at `pilot_active` / $85,000; CAPE-ACEP at $120,000; CLC National at `ingestion_running` / $250,000) with a total weighted pipeline of $368,750. The table header reads "Current Live Calculation (as of data seed)" — indicating developer-inserted illustrative records, not actual customer conversations. $225,000 of the $368,750 weighted figure is a single undocumented CLC National deal. No deal value reconciles with the published pricing framework. |
| **Required source evidence** | Actual customer records documenting real outreach, responses, and pipeline stage for each named organization — or explicit removal of all seeded data from lender-facing materials |
| **Responsible owner** | Aubert Nungisa; Michel Nungisa (commercial execution) |
| **Disposition** | Remove — all seeded deal records and derived totals ($368,750 weighted pipeline; $85,000–$250,000 opportunity values) must be removed from every lender-facing document until replaced by actual customer records with documented evidence |
| **Remediation status** | Open |
| **Closure evidence** | Updated pipeline with real records only, each showing: organization name, outreach date, contact name, meeting log, current stage, and evidence artifact; OR explicit "no active pipeline" disclosure in lender-facing documents |
| **Lender-facing impact** | Presenting seeded data as commercial activity is a material misrepresentation. It is the most urgent lender-facing correction required. |

---

### REM-005 — Key-Person Risk: Sole Director, Incomplete Succession Plan

| Field | Detail |
|---|---|
| **Unique ID** | REM-005 |
| **Severity** | Critical |
| **Source stress-test** | U1 (F-M-01), U6, U8 |
| **Affected lender-facing document** | `governance/corporate/governance/policy-founder-succession-continuity-plan.md`; `docs/business-plan/evidence-book/01-Company.md` |
| **Exact claim or inconsistency** | Aubert holds 100% Class A voting shares, is sole director, sole incorporator, and authorized governance owner. The succession plan document exists but its maintenance fields are incomplete and its approval status is not evidenced. |
| **Required source evidence** | Completed, signed succession plan; completed key-person insurance documentation if required by BDC |
| **Responsible owner** | Aubert Nungisa; legal counsel |
| **Disposition** | Document — complete and sign the succession plan before BDC submission |
| **Remediation status** | Open |
| **Closure evidence** | Signed succession plan with effective date, named successor or continuity protocol, and board resolution (see REM-018) |
| **Lender-facing impact** | BDC will likely require a completed succession plan or key-person insurance as a condition of approval. Incomplete documentation amplifies the credit risk. |

---

### REM-006 — Michel Nungisa: Identity, Credentials, and Role Not Reconciled

| Field | Detail |
|---|---|
| **Unique ID** | REM-006 |
| **Severity** | Critical |
| **Source stress-test** | U1 (F-M-02), U6, U8 |
| **Affected lender-facing document** | `governance/corporate/leadership.json`; `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`; executive summary; `docs/business-plan/evidence-book/01-Company.md` |
| **Exact claim or inconsistency** | Michel is listed as President with commercial responsibility for Union Eyes, ABR, and buyer trust programs. However: his surname does not appear in the repository; his equity position is not documented (he does not appear in the shareholder table); no professional credentials are provided; his Nungisa Law relationship is referenced in the problem statement but not documented in corporate records; his time commitment, signing authority, and director/officer status are absent. |
| **Required source evidence** | Full legal name; professional name if applicable; corporate title and effective date; ownership percentage; director/officer status; Nungisa Law role and any support agreement; biography with relevant experience; time commitment percentage; signing authority; IP assignment agreement status |
| **Responsible owner** | Michel Nungisa (primary); Aubert Nungisa; legal counsel |
| **Disposition** | Document — every lender-facing document must use consistent, verified information for Michel drawn from corporate records |
| **Remediation status** | Open |
| **Closure evidence** | Completed management profile for Michel consistent across: corporate records, business plan, financial statements, personal financial documents, and Nungisa Law support agreement (if applicable) |
| **Lender-facing impact** | BDC cannot approve a commercialization loan whose primary commercial execution depends on an unverifiable individual. This is the most correctable management risk and must be resolved completely before submission. |

---

### REM-007 — No Confirmed Commercial Outreach Activity

| Field | Detail |
|---|---|
| **Unique ID** | REM-007 |
| **Severity** | High |
| **Source stress-test** | U1 (F-CO-01), U2, U4 (CEA-01 through CEA-04), U8 |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md` |
| **Exact claim or inconsistency** | The dossier states "commercialization has begun" and lists "active commercial motions" including executive discovery meetings, union demonstrations, and pilot discussions. The revenue cockpit shows "Awaiting activity data" as the null state for all activity KPIs. No meeting dates, counterparty names, outcomes, or follow-up evidence are documented in-repository. |
| **Required source evidence** | Meeting logs with dates, organization, contact name, and outcome; OR explicit restatement that commercial infrastructure is built and ready but outreach has not yet been formally logged |
| **Responsible owner** | Aubert Nungisa; Michel Nungisa |
| **Disposition** | Correct — rewrite the commercial traction section to accurately reflect preparation-complete status, not activity-in-progress status; remove or downgrade all claims of active commercial motions until evidence is in place |
| **Remediation status** | Open |
| **Closure evidence** | Updated commercial traction document; for any activity claim, a corresponding log entry in the revenue cockpit with date, contact, and outcome |
| **Lender-facing impact** | The entire repayment case depends on near-term commercial conversions. If the committee understands that no outreach has been initiated, it will heavily discount the repayment timeline. |

---

### REM-008 — Founder Investment Figures Are Estimates, Not Verified Records

| Field | Detail |
|---|---|
| **Unique ID** | REM-008 |
| **Severity** | High |
| **Source stress-test** | U5, U7 |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/14-Founder-Investment.md`; executive summary (BDC-U7) |
| **Exact claim or inconsistency** | The founder investment ledger (U5) and executive summary state that founders have invested approximately $48,700–$99,100 in cash and approximately $550,000 in sweat equity, for a total of $600,000–$650,000. These are estimates derived from repository artifacts and market-rate assumptions. The ledger itself states "All figures are estimates pending a formal founder declaration." The executive summary presents these figures without this qualification. Sweat equity valuations are particularly problematic for a lender without an identified methodology. |
| **Required source evidence** | For cash: bank statements, credit card records, invoices, and accounting entries supporting each category. For shareholder advances: reconciliation to corporate accounting records. For unpaid founder work: hours reported separately without cash conversion. For internally developed IP: asset description only, no unsupported valuation. |
| **Responsible owner** | Aubert Nungisa; Michel Nungisa; accountant |
| **Disposition** | Correct — replace estimated figures with a verified founder declaration using the table structure below; present sweat equity and IP separately as non-cash contributions without a dollar total |
| **Remediation status** | Open |
| **Closure evidence** | Signed founder declaration with exact cash amounts supported by source documents; table separating: (a) documented founder cash paid, (b) shareholder advances reconciled to corporate records, (c) corporate expenses paid personally, (d) unpaid founder hours reported as time only, (e) IP described as assets without unsupported valuation, (f) third-party services with invoices |
| **Lender-facing impact** | Unverified estimates appearing as investment facts can undermine lender confidence. The safer lender statement is: "The founders have personally funded the company's documented cash expenses and contributed substantial uncompensated development and commercialization effort." |

---

### REM-009 — Pipeline Deal Values Do Not Match Published Pricing

| Field | Detail |
|---|---|
| **Unique ID** | REM-009 |
| **Severity** | High |
| **Source stress-test** | U1 (F-CO-02), U3 (FC-01, FC-02, FC-03), U4 (CEA-05, CEA-06) |
| **Affected lender-facing document** | `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`; `docs/categories/stakeholders/commercial/pricing-framework.md` |
| **Exact claim or inconsistency** | Three separate deal values in the pipeline table exceed or are unanchored to published pricing: CUPE Local 123 at $85,000 (pricing shows max $52,000/year for a 5,000-member local); CAPE-ACEP at $120,000 (professional associations have no published tier); CLC National at $250,000 (federation pricing is "Custom" with no documented range). |
| **Required source evidence** | Either: published pricing tiers that account for multi-year contracts, add-ons, and professional associations; or removal of all seeded deal records |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Remove (seeded data — see REM-004); if real deals exist at these values, document the pricing methodology and source |
| **Remediation status** | Open |
| **Closure evidence** | Seeded data removed from lender-facing documents; real deal records entered with documented pricing basis; or pricing framework updated to cover professional associations and multi-year scenarios |
| **Lender-facing impact** | If BDC uses pipeline totals to stress-test repayment, overstated deal values will create expectations the company cannot meet. |

---

### REM-010 — SOC 2 Promised to Customers Without Delivery Timeline

| Field | Detail |
|---|---|
| **Unique ID** | REM-010 |
| **Severity** | High |
| **Source stress-test** | U1 (F-CO-04), U3 (FC-06), U4 (CEA-10) |
| **Affected lender-facing document** | `docs/categories/stakeholders/commercial/pricing-framework.md` |
| **Exact claim or inconsistency** | The pricing framework includes "SOC 2 Type II certification (on completion, included in subscription)" as a standard feature. The gap register classifies this as a Critical gap: "No completed SOC 2 examination evidenced in-repo." No SOC 2 readiness timeline or target date is documented. |
| **Required source evidence** | SOC 2 readiness assessment; engagement with a qualified auditor; target certification date with documented methodology |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Rewrite — change "included in subscription" language to "SOC 2 Type II readiness program is underway; certification is targeted for completion on a schedule to be confirmed." Remove SOC 2 from the "always included" features list until a completion date is documented. |
| **Remediation status** | Open |
| **Closure evidence** | Updated pricing framework without SOC 2 as a current inclusion; separate document stating current readiness status and target date |
| **Lender-facing impact** | Promising a certification not yet achieved creates a contingent liability and may block commercial conversions on which repayment depends. |

---

### REM-011 — No External Penetration Test Completed

| Field | Detail |
|---|---|
| **Unique ID** | REM-011 |
| **Severity** | High |
| **Source stress-test** | U1 (F-CO-05), U8 |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/11-Gap-Register.md`; `docs/business-plan/evidence-book/12-Commercial-Readiness.md` |
| **Exact claim or inconsistency** | No external penetration test has been completed for Union Eyes or any other product. The gap register classifies this as Critical. The target market (labour unions, public institutions) has significant data-sensitivity requirements; enterprise buyers routinely require pentest evidence. |
| **Required source evidence** | Engagement confirmation from a qualified third-party security testing firm; pentest report upon completion |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Document — pentest engagement is a planned use-of-funds item; include a confirmed timeline in the use-of-funds schedule (REM-002); update commercial readiness score and gap register |
| **Remediation status** | Open |
| **Closure evidence** | Signed engagement letter with pentest firm; pentest report; updated gap register |
| **Lender-facing impact** | Absence of a pentest creates deal-blocking objections and increases the probability that early pilots do not convert. |

---

### REM-012 — Three Entity Names Active Across Documents

| Field | Detail |
|---|---|
| **Unique ID** | REM-012 |
| **Severity** | High |
| **Source stress-test** | U1 (F-L-01) |
| **Affected lender-facing document** | `README.business.md`; `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`; legacy commercial documents |
| **Exact claim or inconsistency** | Three entity names are in active use across the repository: "Nzila Ventures Inc." (corporate structure), "Nzila Digital Ventures" (README.business.md), and "Nzila OS Inc." (legacy commercial file). A loan agreement requires one legal borrower name. |
| **Required source evidence** | Certificate of incorporation; authoritative confirmation that "Nzila Ventures Inc." is the correct registered name for all lender-facing documents |
| **Responsible owner** | Aubert Nungisa; legal counsel |
| **Disposition** | Correct — normalize all lender-facing and commercial documents to the registered corporate name; update README.business.md and any legacy files |
| **Remediation status** | Open |
| **Closure evidence** | Updated documents using only the registered corporate name; certificate of incorporation on file |
| **Lender-facing impact** | BDC's legal team will require one name before funding. Inconsistency flags document control risk. |

---

### REM-013 — No User Testing Results for Union Eyes

| Field | Detail |
|---|---|
| **Unique ID** | REM-013 |
| **Severity** | High |
| **Source stress-test** | U1 (F-E-01) |
| **Affected lender-facing document** | `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`; `docs/business-plan/evidence-book/11-Gap-Register.md` |
| **Exact claim or inconsistency** | The product readiness report states that user-testing results do not yet exist. Union Eyes is the primary commercialization vehicle. Without user-testing evidence, the product's real-world usability is unverified. |
| **Required source evidence** | User testing protocol; results of at least one structured usability session; or explicit disclosure that user testing has not yet been conducted |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Document — disclose honestly in lender-facing materials; include user testing in use-of-funds timeline if applicable |
| **Remediation status** | Open |
| **Closure evidence** | User testing session documented with date, participants, and findings; updated product readiness report |
| **Lender-facing impact** | Enterprise buyers expect product validation. Absence of user testing evidence increases conversion risk. |

---

### REM-014 — No Independent Validation or External Certification

| Field | Detail |
|---|---|
| **Unique ID** | REM-014 |
| **Severity** | High |
| **Source stress-test** | U1 (F-E-02) |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/08-Validation.md` |
| **Exact claim or inconsistency** | Every technical and security claim in the dossier is self-certified. No external auditor has reviewed the platform, security posture, or production-readiness evidence. |
| **Required source evidence** | At minimum: a third-party security assessment or penetration test (see REM-011); ideally: an independent technical review of the production certification claims |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Document — rewrite validation section to state clearly that all current certifications are internal and that external validation is planned; do not present internal certification as equivalent to external attestation |
| **Remediation status** | Open |
| **Closure evidence** | Updated validation document with accurate certification status; engagement with at least one external assessor |
| **Lender-facing impact** | Lender evaluating IP as collateral will expect some form of independent technical validation. Self-certification alone is insufficient for institutional lending. |

---

### REM-015 — IP Assignment Agreements Are Policy, Not Evidenced

| Field | Detail |
|---|---|
| **Unique ID** | REM-015 |
| **Severity** | Medium |
| **Source stress-test** | U1 (F-L-03) |
| **Affected lender-facing document** | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| **Exact claim or inconsistency** | The corporate structure states "IP Assignment Agreements: Required for all contributors, signed at onboarding." No executed agreements are in-repository. If any contributor IP is unassigned, the company's IP ownership is potentially contested. |
| **Required source evidence** | Executed IP assignment agreements for all contributors, including both founders |
| **Responsible owner** | Aubert Nungisa; legal counsel |
| **Disposition** | Document — confirm execution status of all IP assignment agreements; produce executed agreements for BDC due diligence if requested |
| **Remediation status** | Open |
| **Closure evidence** | Executed IP assignment agreements on file; updated corporate structure document confirming completion |
| **Lender-facing impact** | If IP is the primary collateral, unassigned contributor IP creates a cloud on title that BDC may require cleared before funding. |

---

### REM-016 — Patent Filings Claimed but Not Evidenced in the Business Plan

| Field | Detail |
|---|---|
| **Unique ID** | REM-016 |
| **Severity** | Medium |
| **Source stress-test** | U1 (F-C-02), U4 (CEA-14) |
| **Affected lender-facing document** | `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`; `docs/business-plan/evidence-book/09-IP.md` |
| **Exact claim or inconsistency** | The Government Funding Strategy states "3 patent filings pending." The IP section of the dossier contains no reference to patent applications, filing numbers, or dates. |
| **Required source evidence** | Patent application numbers, filing dates, and a brief description of each application; or retraction of the patent filing claim from the Government Funding Strategy |
| **Responsible owner** | Aubert Nungisa; patent agent or legal counsel |
| **Disposition** | Verify — confirm patent filing status with legal counsel; add to IP section if confirmed; remove claim if not confirmed |
| **Remediation status** | Open |
| **Closure evidence** | Patent application numbers on file; IP section updated; or Government Funding Strategy corrected |
| **Lender-facing impact** | Inconsistency between external claims and the dossier raises document-control concerns. Patents, if real, are potentially valuable collateral to note. |

---

### REM-017 — CIVIC Has No Published Pricing and No Quantified Pipeline

| Field | Detail |
|---|---|
| **Unique ID** | REM-017 |
| **Severity** | Medium |
| **Source stress-test** | U1 (F-CO-03) |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/05-Commercialization.md`; `docs/business-plan/evidence-book/11-Gap-Register.md` |
| **Exact claim or inconsistency** | CIVIC is presented as one of three core commercialization tracks. It has no published pricing model and no quantified pipeline. If Union Eyes pilots do not convert on schedule, there is no documented secondary revenue path. |
| **Required source evidence** | CIVIC pricing model with documented assumptions; or explicit statement that CIVIC is pre-revenue with no near-term pipeline |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Document — either develop and publish CIVIC pricing for lender-facing materials, or restate CIVIC's maturity boundary clearly (market development stage, no pricing, no pipeline) |
| **Remediation status** | Open |
| **Closure evidence** | CIVIC pricing document published; or business plan updated with clear CIVIC maturity boundary |
| **Lender-facing impact** | Without a secondary revenue path, the repayment case is entirely dependent on Union Eyes conversion velocity. |

---

### REM-018 — No Board Resolutions or Minutes Evidenced

| Field | Detail |
|---|---|
| **Unique ID** | REM-018 |
| **Severity** | Medium |
| **Source stress-test** | U1 (F-G-02) |
| **Affected lender-facing document** | `docs/business-plan/evidence-book/01-Company.md` |
| **Exact claim or inconsistency** | Authorizing the BDC borrowing requires a board resolution. No board minutes or resolutions appear in-repository. With a single-director structure this is procedurally simple, but BDC will require evidence of authorization. |
| **Required source evidence** | Board resolution authorizing the BDC loan application; signed by sole director Aubert Nungisa |
| **Responsible owner** | Aubert Nungisa; legal counsel |
| **Disposition** | Document — prepare and execute a board resolution authorizing the loan application before BDC submission |
| **Remediation status** | Open |
| **Closure evidence** | Executed board resolution on file |
| **Lender-facing impact** | Standard procedural requirement. Simple to resolve but cannot be omitted. |

---

### REM-019 — OptivaCare Inc. Scope Unclear Relative to BDC Loan

| Field | Detail |
|---|---|
| **Unique ID** | REM-019 |
| **Severity** | Medium |
| **Source stress-test** | U1 (F-L-02) |
| **Affected lender-facing document** | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| **Exact claim or inconsistency** | OptivaCare Inc. is separately incorporated and appears in the corporate structure. If any of the $75,000 will flow through or benefit OptivaCare, BDC's cross-default and intra-group lending policies are triggered. |
| **Required source evidence** | Explicit statement confirming OptivaCare Inc. is out of scope for this loan request; description of the relationship between Nzila Ventures Inc. and OptivaCare Inc. |
| **Responsible owner** | Aubert Nungisa; legal counsel |
| **Disposition** | Document — confirm OptivaCare is out of scope; describe the corporate structure relationship in the business plan |
| **Remediation status** | Open |
| **Closure evidence** | Written statement in business plan confirming OptivaCare is a separate entity outside the scope of this loan application |
| **Lender-facing impact** | BDC will ask. Advance disclosure prevents delay at underwriting. |

---

### REM-020 — SR&ED Portfolio Description Inconsistent with Current Product Narrative

| Field | Detail |
|---|---|
| **Unique ID** | REM-020 |
| **Severity** | Medium |
| **Source stress-test** | U1 (F-CO-06), U3 (FC-04) |
| **Affected lender-facing document** | `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`; `docs/business-plan/evidence-book/00-Executive-Summary.md` |
| **Exact claim or inconsistency** | The Government Funding Strategy (Feb 2026) describes SR&ED claims for Memora healthtech, CORA AgTech, SentryIQ360 Insurance, and "15 platforms." The current BDC narrative presents three products: Union Eyes, CIVIC, CourtLens. The discrepancy will prompt BDC to ask whether the business has changed materially or whether SR&ED claims are correctly attributed. |
| **Required source evidence** | An explanation reconciling the SR&ED project list with the current product portfolio: whether discontinued products are correctly classified as historical R&D; whether active SR&ED claims correspond to current products |
| **Responsible owner** | Aubert Nungisa; SR&ED advisor |
| **Disposition** | Document — add a brief explanation in the business plan noting that the SR&ED project list reflects historical R&D activity; confirm that the current three-product focus is the result of deliberate portfolio prioritization |
| **Remediation status** | Open |
| **Closure evidence** | Business plan updated with portfolio evolution explanation; SR&ED claim documentation reconciled to current product scope |
| **Lender-facing impact** | Unexplained product-portfolio changes raise strategic-consistency questions. A brief explanation converts a concern into a credibility-positive demonstration of focus. |

---

### REM-021 — SR&ED Scale Inconsistent with Loan Size and Current Operating Reality

| Field | Detail |
|---|---|
| **Unique ID** | REM-021 |
| **Severity** | Medium |
| **Source stress-test** | U3 (FC-05), U2 |
| **Affected lender-facing document** | `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`; executive summary |
| **Exact claim or inconsistency** | The Government Funding Strategy claims $400K–$1M in annual eligible R&D spend as the basis for SR&ED projections. A company with $400K–$1M in current R&D spend does not typically need a $75,000 commercialization bridge. Separately, SR&ED refunds are retrospective tax refunds, not current cash, and should not be presented as primary repayment capacity without advisor documentation of eligibility, timing, and amount. |
| **Required source evidence** | Confirmation from a qualified SR&ED advisor of the 2025 and 2026 claim amounts, eligible expenditure basis, and expected refund timing; explanation of why $75,000 is needed given claimed grant eligibility |
| **Responsible owner** | Aubert Nungisa; SR&ED advisor |
| **Disposition** | Correct — reframe SR&ED as a backstop, not primary repayment; clarify whether R&D spend figures are historical actuals or prospective targets; obtain advisor confirmation |
| **Remediation status** | Open |
| **Closure evidence** | SR&ED advisor letter confirming claim status, eligible expenditure basis, and expected refund timeline; executive summary updated to present SR&ED as a documented backstop only |
| **Lender-facing impact** | Overstating SR&ED certainty as primary repayment capacity is misleading. Presenting it as a documented backstop with advisor confirmation is credible. |

---

### REM-022 — No Hiring Plan or Salary Budget

| Field | Detail |
|---|---|
| **Unique ID** | REM-022 |
| **Severity** | Medium |
| **Source stress-test** | U3 (FA-02) |
| **Affected lender-facing document** | `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`; business plan |
| **Exact claim or inconsistency** | The Government Funding Strategy states "Job creation (15+ engineers, tech talent hiring)" as a qualifying criterion for government programs. The business plan contains no headcount plan, salary budget, or hiring timeline. If any of the $75,000 is for payroll, no budget is provided. |
| **Required source evidence** | Clarification of whether any loan proceeds are intended for payroll; if yes, a headcount plan with salaries; if no, explicit statement that the 15+ engineers reference is a government program positioning claim for a future funding round |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Document — clarify the hiring plan scope; if the 15+ engineers are a future aspiration for government programs, state that clearly and separate it from the $75,000 use-of-funds |
| **Remediation status** | Open |
| **Closure evidence** | Business plan updated with clear distinction between near-term (loan-funded) activities and medium-term (grant-funded) hiring plans |
| **Lender-facing impact** | A lender seeing "15+ engineers" hiring combined with a $75,000 loan request will question whether the loan is sized correctly. |

---

### REM-023 — Azure Infrastructure Cost Not Documented

| Field | Detail |
|---|---|
| **Unique ID** | REM-023 |
| **Severity** | Medium |
| **Source stress-test** | U2, U3 (FA-03) |
| **Affected lender-facing document** | Business plan; repayment model (REM-001) |
| **Exact claim or inconsistency** | The platform runs on Azure Canada Central. Union Eyes requires dedicated tenant provisioning per pilot organization. No Azure cost per tenant, monthly burn rate, infrastructure cost per customer, or gross margin per subscription is documented. Without these figures, the repayment model (REM-001) cannot be stress-tested. |
| **Required source evidence** | Azure cost estimate per pilot tenant; ongoing monthly Azure costs; gross margin per pilot and per subscription |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Quantify — document Azure cost per tenant and derive gross margin per pricing tier; include in the repayment model (REM-001) |
| **Remediation status** | Open |
| **Closure evidence** | Azure cost documentation (invoice or estimate); gross margin table included in repayment model |
| **Lender-facing impact** | Without gross margin, the debt service coverage model is incomplete. BDC will ask for it. |

---

### REM-024 — Advisory Board Not Constituted

| Field | Detail |
|---|---|
| **Unique ID** | REM-024 |
| **Severity** | Low |
| **Source stress-test** | U1 (F-G-01), U6 |
| **Affected lender-facing document** | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| **Exact claim or inconsistency** | The governance document describes an advisory council as "in development — clinical, AI, ethics, legal." No named advisors, terms, or biographies are documented. |
| **Required source evidence** | Named advisors with biographies and engagement terms; or accurate disclosure that the advisory council is not yet constituted |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Correct — restate honestly in lender-facing materials: "Nzila is governed by a founder-led single-director board. An advisory council is planned but has not yet been formally constituted." |
| **Remediation status** | Open |
| **Closure evidence** | Updated governance section with accurate advisory council status |
| **Lender-facing impact** | Overstating governance structure is a minor credibility risk. Honest disclosure is preferable. |

---

### REM-025 — README Metrics Stale Relative to Repository State

| Field | Detail |
|---|---|
| **Unique ID** | REM-025 |
| **Severity** | Low |
| **Source stress-test** | U1 (F-E-03) |
| **Affected lender-facing document** | `README.business.md` |
| **Exact claim or inconsistency** | README.business.md states 47 workflows and 215 packages. The dossier records 52 workflows and 225 packages. A committee reading both sources will notice the discrepancy. |
| **Required source evidence** | Updated repository metrics from a current scan |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Correct — update README.business.md to reflect current repository state |
| **Remediation status** | Open |
| **Closure evidence** | Updated README.business.md with current verified counts |
| **Lender-facing impact** | Minor. Demonstrates attention to detail when corrected. |

---

### REM-026 — Competitive Pricing Benchmarks Unattributed

| Field | Detail |
|---|---|
| **Unique ID** | REM-026 |
| **Severity** | Low |
| **Source stress-test** | U4 (CEA-11) |
| **Affected lender-facing document** | `docs/categories/stakeholders/commercial/pricing-framework.md` |
| **Exact claim or inconsistency** | Competitive pricing comparisons for LaborSoft ($60,000–$80,000) and UnionTrack ($45,000–$65,000) have no source citations. |
| **Required source evidence** | Public pricing pages, industry research citations, or removal of specific dollar figures |
| **Responsible owner** | Aubert Nungisa |
| **Disposition** | Downgrade — add "estimated competitive pricing benchmarks, not independently verified" or replace with cited sources |
| **Remediation status** | Open |
| **Closure evidence** | Updated pricing framework with source citations or appropriate caveat language |
| **Lender-facing impact** | Minor. Unsourced competitive figures are a credibility risk if challenged. |

---

## Summary Register Table

| ID | Severity | Category | One-Line Finding | Disposition | Status |
|---|---|---|---|---|---|
| REM-001 | **Critical** | Repayment | No repayment model or cash flow projection | Quantify | Open |
| REM-002 | **Critical** | Repayment | No use-of-funds breakdown for $75,000 | Document | Open |
| REM-003 | **Critical** | Repayment | Revenue scenarios contain no numbers | Quantify | Open |
| REM-004 | **Critical** | Commercial | Pipeline figures are seeded illustrative data | Remove | Open |
| REM-005 | **Critical** | Management | 100% key-person; succession plan incomplete | Document | Open |
| REM-006 | **Critical** | Management | Michel's identity, credentials, role unreconciled | Document | Open |
| REM-007 | **High** | Commercial | No confirmed commercial outreach activity | Correct | Open |
| REM-008 | **High** | Finance | Founder investment figures are estimates only | Correct | Open |
| REM-009 | **High** | Commercial | Pipeline deal values exceed published pricing | Remove | Open |
| REM-010 | **High** | Commercial | SOC 2 promised without delivery timeline | Rewrite | Open |
| REM-011 | **High** | Security | No external penetration test completed | Document | Open |
| REM-012 | **High** | Legal | Three entity names active across documents | Correct | Open |
| REM-013 | **High** | Evidence | No user testing results for Union Eyes | Document | Open |
| REM-014 | **High** | Evidence | No independent validation or external certification | Document | Open |
| REM-015 | **Medium** | Legal | IP assignment agreements not evidenced | Document | Open |
| REM-016 | **Medium** | Legal | Patent filings claimed but not evidenced | Verify | Open |
| REM-017 | **Medium** | Commercial | CIVIC has no pricing and no quantified pipeline | Document | Open |
| REM-018 | **Medium** | Governance | No board resolutions evidenced | Document | Open |
| REM-019 | **Medium** | Legal | OptivaCare Inc. scope unclear | Document | Open |
| REM-020 | **Medium** | Finance | SR&ED portfolio inconsistent with current narrative | Document | Open |
| REM-021 | **Medium** | Finance | SR&ED scale inconsistent with loan request | Correct | Open |
| REM-022 | **Medium** | Finance | No hiring plan or salary budget | Document | Open |
| REM-023 | **Medium** | Finance | Azure infrastructure cost not documented | Quantify | Open |
| REM-024 | **Low** | Governance | Advisory board not constituted; overstated | Correct | Open |
| REM-025 | **Low** | Evidence | README metrics stale | Correct | Open |
| REM-026 | **Low** | Commercial | Competitive pricing benchmarks unattributed | Downgrade | Open |

---

## Counts by Severity

| Severity | Count |
|---|---|
| Critical | 6 |
| High | 8 |
| Medium | 9 |
| Low | 3 |
| **Total** | **26** |

---

## Counts by Disposition

| Disposition | Count |
|---|---|
| Document | 12 |
| Quantify | 4 |
| Correct | 5 |
| Remove | 2 |
| Rewrite | 1 |
| Downgrade | 1 |
| Verify | 1 |

---

## Critical Path — Minimum Threshold Before BDC Submission

The following six items must be closed before any document is submitted to BDC. No Critical finding may remain open at submission.

| Priority | ID | Item |
|---|---|---|
| 1 | REM-001 + REM-003 | Repayment model and revenue scenarios with numbers |
| 2 | REM-002 | Use-of-funds schedule for $75,000 |
| 3 | REM-004 + REM-009 | Remove all seeded pipeline data from lender-facing materials |
| 4 | REM-005 | Completed and signed succession plan |
| 5 | REM-006 | Michel Nungisa identity, credentials, and role fully documented and consistent across all documents |
| 6 | REM-012 | Entity name normalized to one registered corporate name |

---

## Information That Must Come Directly from Aubert or Michel

The following items cannot be resolved from repository inference. They require direct input from the founders:

1. **Actual loan terms** — principal confirmed with BDC (interest rate, amortization, repayment start date, interest-only period if any, fees).
2. **Verified cash expenditures** — bank statements, credit card records, and invoices supporting each category in the founder investment schedule.
3. **SR&ED filing confirmation** — advisor letter confirming claim amounts, eligible expenditure basis, and expected refund timing for 2025 and 2026.
4. **Michel's complete profile** — full legal name; professional name; corporate title; ownership percentage; director/officer status; Nungisa Law role and any support agreement; biography; time commitment; signing authority; IP assignment status.
5. **Signed pilot agreement or qualified letter of intent** — from any organization in active discussion.
6. **Personal guarantee position** — whether Aubert will provide a personal guarantee, and if so, its terms.
7. **OptivaCare relationship** — confirmation that OptivaCare is outside the scope of this loan.
8. **Patent filing status** — patent application numbers, dates, and descriptions, if filings exist.
9. **Actual Azure costs** — current monthly spend and per-tenant provisioning costs.
10. **Founder time commitment statement** — both founders' percentage of time committed to Nzila Ventures.

---

*This register is internal working material. It is not part of the BDC submission package.*
