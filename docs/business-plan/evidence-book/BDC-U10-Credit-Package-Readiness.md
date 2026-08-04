# BDC Credit Package Readiness Assessment

**Prepared:** 2026-08-01
**Scope:** $75,000 BDC financing request — Nzila Ventures Inc.
**Basis:** Findings from BDC-U1 through BDC-U8; remediation register BDC-U9
**Status:** INTERNAL WORKING DOCUMENT — not for BDC submission

---

## Verdict

> **NOT READY**

Six Critical findings remain open. No Critical finding has documentary closure. The package may not be submitted to BDC while any Critical finding remains unresolved.

The substantive basis for this verdict:

> Nzila has a credible evidence base and a defensible commercialization thesis, but the loan request is not yet credit-complete because repayment, founder investment, management records, and pipeline evidence are not fully reconciled to source documents.

That gap — and only that gap — separates this package from a submittable state.

---

## Status of Critical Findings

| ID | Finding | Status |
|---|---|---|
| REM-001 | No repayment model or cash flow projection | **Open — blocking** |
| REM-002 | No use-of-funds breakdown for $75,000 | **Open — blocking** |
| REM-003 | Revenue scenarios contain no numbers | **Open — blocking** |
| REM-004 | Pipeline figures are seeded illustrative data | **Open — blocking** |
| REM-005 | Key-person risk; succession plan incomplete | **Open — blocking** |
| REM-006 | Michel's identity and credentials unreconciled | **Open — blocking** |

---

## What the Package Gets Right

The following items are verified and require no remediation:

- **Technical foundation:** Union Eyes is production-certified, deployment-documented, and has a controlled-pilot GO clearance. The repository contains 26 application directories, 225 shared packages, and 52 CI/CD workflows — a verifiable engineering record.
- **Commercial preparation:** Pricing framework, CUPE pilot offer, 45-minute demo script, objection sheet, ROI assumptions, and a top-15 pursuit list are complete and available for review.
- **Governance discipline:** A portfolio truth system prevents estimated revenue from appearing as actuals. A claims-discipline framework governs commercial statements. An owner-operated governance model is documented.
- **Commercialization thesis:** One converted Local-tier subscription ($28,000/year) covers assumed annual debt service (~$17,400). The repayment structure is arithmetically sound once proper documentation is in place.
- **Zero existing debt:** The company has no prior debt obligations. The loan would be the first external liability.
- **Founder commitment:** Multiple years of pre-commercial investment at personal expense, documented by a large, coherent, and navigable repository.

---

## Path to CONDITIONALLY READY

The package achieves **CONDITIONALLY READY** status when all six Critical findings are closed with documentary evidence. Specifically:

### Step 1 — Remove seeded pipeline data (REM-004, REM-009)

Every lender-facing document must be reviewed and updated:

- Remove all pipeline deal records labeled "as of data seed" from any document shown to BDC.
- Remove the $368,750 weighted pipeline total and any $85,000–$250,000 opportunity values from lender-facing claims unless replaced by actual customer records with documented evidence of real engagement.
- The revenue cockpit may retain its system architecture, but the deal table must either be cleared or populated with real records only.
- If outreach has not yet been formally logged, state that explicitly: "Commercial infrastructure is fully built and the pipeline management system is operational. Outreach to identified prospects has been initiated and is being tracked."
- Any pipeline stage below a genuine proposal should carry no forecast value unless management has a documented probability methodology.

### Step 2 — Build the repayment model (REM-001, REM-003)

Obtain confirmed loan terms from BDC (or use explicitly stated assumptions pending confirmation) and build a model showing:

```
Collected revenue
less direct delivery cost (including Azure per-tenant)
less infrastructure and contractors
less operating expenses
less taxes and remittances
equals cash available before debt service
```

Produce this for:
- **Conservative case:** First significant customer closes 90–120 days later than target. One Local-tier subscription at the minimum rate. No second pilot in Year 1.
- **Base case:** First pilot signs within 60 days of funding. One conversion at mid-tier Local ($28,000/year). Second pilot initiated in Month 6.
- SR&ED refund is shown as a backstop in both cases, with a confirmed advisor letter.

### Step 3 — Document the use of funds (REM-002)

Produce a specific table allocating the $75,000 across named activities with dollar amounts and timelines. Expected categories include:
- Pentest engagement
- SOC 2 readiness initiation
- Sales and business development (founder time, travel, marketing)
- Azure provisioning for first pilot tenant
- Legal and compliance

### Step 4 — Complete Michel's documentation (REM-006)

Every document in the submission package must use consistent, verified information:
- Full legal name
- Professional name, where applicable
- Corporate title and effective date
- Ownership percentage or compensation structure
- Director/officer status
- Nungisa Law role and any support agreement
- Biography with relevant labour-sector or commercialization experience
- Percentage time commitment to Nzila Ventures
- Signing authority
- IP assignment agreement status

Corporate records, the business plan, financial statements, personal financial documents, and any Nungisa Law support agreement must reconcile exactly.

### Step 5 — Complete the succession plan (REM-005)

Aubert's succession plan must be completed, signed, and effective before BDC submission. Key elements:
- Named successor or documented continuity protocol
- Coverage of technical gate authority
- Coverage of corporate signing authority
- Board resolution authorizing the loan application (also satisfies REM-018)

### Step 6 — Normalize entity naming (REM-012)

All lender-facing documents must use the registered corporate name exclusively. README.business.md and any legacy commercial files must be updated.

---

## Path from CONDITIONALLY READY to READY FOR BDC REVIEW

The package achieves **READY FOR BDC REVIEW** status when:

1. All six Critical findings are closed.
2. High-severity findings REM-007, REM-008, REM-010, REM-011, REM-012, REM-013, and REM-014 are addressed (corrected, rewritten, or documented accurately).
3. The executive summary (BDC-U7 candidate) has been reviewed against the final remediated package for internal consistency.
4. No document submitted to BDC contains any seeded, illustrative, or synthetic pipeline values.
5. Founder investment figures in all lender-facing documents reflect only verified cash amounts supported by source documents, with sweat equity and IP described separately as non-cash contributions.

---

## Information Required Directly from Aubert or Michel

The following items cannot be resolved from repository inference. They require direct founder input before any document is finalized:

| # | Item | Needed for |
|---|---|---|
| 1 | Confirmed or assumed BDC loan terms (rate, amortization, start date, fees) | REM-001 repayment model |
| 2 | Bank statements, invoices, and credit card records supporting cash expenditure categories | REM-008 founder investment |
| 3 | SR&ED advisor letter: claim amounts, eligible expenditure basis, expected refund timing for 2025 and 2026 | REM-021 backstop credibility |
| 4 | Michel's complete profile: full legal name, credentials, equity, title, Nungisa Law arrangement | REM-006 management documentation |
| 5 | Signed pilot agreement or qualified letter of intent from any organization in active discussion | REM-007 pipeline evidence |
| 6 | Personal guarantee position: whether Aubert will provide a guarantee and on what terms | Repayment collateral |
| 7 | Confirmation that OptivaCare Inc. is outside the scope of this loan | REM-019 legal clarity |
| 8 | Patent application numbers, filing dates, and descriptions, if patent filings exist | REM-016 IP collateral |
| 9 | Current Azure monthly spend and per-tenant provisioning cost | REM-023 gross margin |
| 10 | Both founders' percentage of time committed to Nzila Ventures | REM-006 management |
| 11 | Shareholder advance and corporate-expense ledger from accounting records | REM-008 founder investment |
| 12 | Formal management decision on whether to pursue One Lab Technologies context as BDC history | Control 8 |

---

## Accounting and Legal Documents Still Required

| # | Document | Purpose |
|---|---|---|
| 1 | Most recent financial statements or management accounts for Nzila Ventures Inc. | Financial condition |
| 2 | Corporate bank account statements (minimum 6 months) | Cash position; founder cash proof |
| 3 | Certificate of incorporation (Nzila Ventures Inc.) | Entity confirmation |
| 4 | Shareholder register | Equity confirmation |
| 5 | Corporate structure chart, confirmed current | Subsidiaries; OptivaCare position |
| 6 | IP assignment agreements for all contributors (both founders; any contractors) | Collateral validity |
| 7 | Board resolution authorizing this BDC loan application | Standard BDC requirement |
| 8 | Executed or draft succession plan | Key-person risk mitigation |
| 9 | SR&ED filing documentation (2025 T661 or equivalent) | Backstop verification |
| 10 | Engagement confirmation from SR&ED advisor (Boast.AI or equivalent) | SR&ED credibility |
| 11 | BDC historical account summary for One Lab Technologies (if applicable) | Credit history context |
| 12 | Any support agreement between Nzila Ventures Inc. and Nungisa Law | Michel relationship disclosure |
| 13 | Personal net worth statements for both founders (if personal guarantee is required) | Collateral |
| 14 | Patent application documents, if patent filings are confirmed | IP collateral |
| 15 | IRAP application status documentation | Non-dilutive funding verification |

---

## What BDC Will Likely Ask

Based on the stress-test series, the following questions are predictable. Answers should be prepared before the BDC meeting:

1. **How does BDC get repaid?** — Month-by-month, with a downside scenario. (REM-001)
2. **What exactly is the $75,000 for?** — Line-item use-of-funds. (REM-002)
3. **Who is Michel and what is his commitment to the company?** — Full credentials and binding arrangement. (REM-006)
4. **What happens if you are incapacitated?** — Succession plan. (REM-005)
5. **You say the pipeline is active — can you show me a meeting log or a signed LOI?** — Actual outreach evidence. (REM-007)
6. **The deal table shows $368,750 — where does that number come from?** — Seeded data must be removed before this question is asked. (REM-004)
7. **You've invested $600,000 — can you show me receipts or accounting entries?** — Verified founder declaration. (REM-008)
8. **Your pricing promises SOC 2 — when will you have it?** — Honest timeline or revised pricing language. (REM-010)
9. **Your government funding strategy describes products that aren't in this application.** — Portfolio evolution explanation. (REM-020)
10. **Have you had any prior BDC relationship?** — One Lab Technologies history, confirmed or denied. (Control 8)

---

## Disposition of Stress-Test Documents

| Document | Disposition |
|---|---|
| BDC-U1-Underwriter-Attack-Review.md | Internal remediation register — do not submit to BDC |
| BDC-U2-Repayment-Story-Audit.md | Convert into a sourced financial schedule (feeds REM-001) |
| BDC-U3-Financial-Consistency-Audit.md | Remediate every finding before freezing the business plan |
| BDC-U4-Commercial-Evidence-Audit.md | Use to control all lender-facing commercial claims |
| BDC-U5-Founder-Investment-Ledger.md | Replace estimates with verified records from accounting |
| BDC-U6-Management-Credibility-Review.md | Apply corrections to the main business plan |
| BDC-U7-Executive-Summary-Compressed.md | Candidate lender-facing summary — valid only after financial reconciliation and removal of seeded data |
| BDC-U8-Decline-Memo-and-Rebuttal.md | Internal meeting and negotiation preparation — do not submit to BDC |
| BDC-U9-Remediation-Register.md | Internal working document — do not submit to BDC |
| BDC-U10-Credit-Package-Readiness.md | Internal working document — do not submit to BDC |

---

## Final Assessment

### What is strong

The technical foundation, governance discipline, commercial preparation infrastructure, and founder commitment are genuine and verifiable. These are not promotional claims — they are supported by artifacts that can be reviewed, audited, and reproduced. The repayment logic is arithmetically sound. The market thesis is defensible.

### What is missing

The package is not credit-complete because the financial records that would allow a lender to verify the repayment story — actual revenue projections, documented founder cash, confirmed management credentials, and a clean pipeline — have not yet been produced.

### What remains

After this register, the agent work is complete. The remaining inputs must come from actual financial records, corporate records, BDC loan history, and formal decisions by Aubert and Michel — not from further repository inference. Once those inputs are incorporated, the package should be reviewed again for internal consistency before submission.

---

## Verdict: **NOT READY**

> The package does not qualify for BDC submission while any Critical finding lacks documentary closure.
>
> It achieves **CONDITIONALLY READY** status upon closure of REM-001 through REM-006 with verified source documents.
>
> It achieves **READY FOR BDC REVIEW** upon closure of all Critical and High findings.

---

*This document is internal working material. It is not part of the BDC submission package.*
