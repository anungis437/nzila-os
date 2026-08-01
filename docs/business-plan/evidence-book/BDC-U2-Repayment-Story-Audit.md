# BDC Repayment Story Audit

**Prepared:** 2026-08-01
**Scope:** $75,000 BDC financing request — Nzila Ventures Inc.
**Instruction:** Ignore technology. Explain exactly how BDC gets repaid. Month by month. Show first customers, first invoices, first pilots, first subscriptions, cash generation, debt servicing, downside scenario, covenant risks, and liquidity risks.

---

## Preliminary Note

The current dossier contains **no repayment narrative**. This document constructs what the repayment story *must* look like for the committee to approve, identifies every gap between the dossier's current state and that story, and defines the minimum evidence required to close each gap.

---

## What BDC Needs to Approve Repayment

A BDC credit committee reviewing a $75,000 commercialization loan needs to trace a credible path from:

> **Loan proceeds → commercialization activity → first customer invoice → recurring revenue → debt service → loan retirement**

That path must survive a downside scenario.

---

## Assumed Loan Structure (Not Yet Documented)

The dossier does not state the proposed loan terms. For this audit, the following are assumed as a baseline scenario — these must be confirmed or replaced with actual terms:

| Parameter | Assumed value | Status |
|---|---|---|
| Principal | $75,000 CAD | Stated in problem statement |
| Interest rate | ~6–8% (BDC SME range) | Assumed — not documented |
| Amortization | 5 years | Assumed — not documented |
| Monthly payment | ~$1,450–$1,550 | Derived — not documented |
| Total interest cost | ~$12,000–$17,000 over term | Derived — not documented |
| Collateral | IP / personal guarantee | Unknown — not documented |

**Gap:** Actual loan terms are not in the dossier. The repayment story cannot be completed without them.

---

## The Revenue Model (From Published Pricing)

The only documented revenue source is Union Eyes. CIVIC has no pricing. CourtLens has no commercial program.

| Product | Entry price | Recurring revenue | Time to first invoice |
|---|---|---|---|
| Union Eyes Local pilot | $12,000 CAD | N/A | 90 days after contract signature |
| Union Eyes Local annual subscription | $18,000–$52,000/yr | Monthly or annual | After 90-day pilot |
| Union Eyes Council pilot | $24,000 CAD | N/A | 90 days after contract signature |
| Union Eyes Council annual | $72,000–$96,000/yr | Monthly or annual | After 90-day pilot |

**One pilot at the entry tier ($12,000) covers approximately 8 months of assumed debt service.**
**One converted Local subscription at mid-tier ($28,000/yr) covers approximately 18 months of debt service.**

---

## Month-by-Month Repayment Trace

The following is the minimum credible Base Case path. Each row identifies the *activity that must happen* and the *evidence gap* that currently prevents verification.

### Pre-Month 1: Loan Proceeds Received

**Activity:** $75,000 received. Funds allocated to specific commercialization activities.

**Evidence gap:** No use-of-funds statement exists. BDC cannot verify the money will be deployed toward revenue-generating activities rather than operating costs.

---

### Month 1–2: Sales Activation

**Activity:** Founder contacts Union Eyes prospects. Discovery calls scheduled. Proposals sent to the top 3 identified targets from the pursuit list.

**What the dossier shows:** TOP_15_PURSUIT_LIST exists. UNION_GTM_MAP exists. Sales kit exists. ICP_DEFINITION exists.

**What is missing:** No evidence that any of these contacts have been initiated. The revenue cockpit shows "Awaiting activity data" as the null state for all activity KPIs. The deal table is explicitly labeled "as of data seed."

**Evidence gap:** No confirmed outreach activity, no meeting log, no prospect responses.

---

### Month 2–3: First Demo Delivered

**Activity:** At least one qualified prospect receives a live demo of Union Eyes.

**What the dossier shows:** Demo environment exists. 45-minute demo script exists. Controlled pilot GO clearance is documented.

**What is missing:** No demo has been documented as delivered to a real external prospect.

**Evidence gap:** Demo has not happened with a real prospect.

---

### Month 3–4: First Pilot Agreement Signed

**Activity:** One organization signs a 90-day pilot agreement at $12,000 CAD + HST.

**What the dossier shows:** Pilot offer document (CUPE edition) is published and ready. Pricing is explicit. Azure provisioning procedures are documented. 14-day go-live timeline is defined.

**What is missing:** No signed agreement. This is the single most critical threshold event for the entire repayment story.

**Cash impact:** $12,000 + HST invoice issued. HST flows through; net: $12,000 against receivables.

**Evidence gap:** No signed pilot agreement exists.

---

### Month 4: First Invoice Issued

**Activity:** Azure environment provisioned. Pilot goes live. Invoice issued for $12,000 + HST. HST remitted. Net $12,000 in cash.

**Cash flow at this point:**
- Inflow: $12,000
- Outflow: Azure (~$500–$1,500/month estimated; not documented), sales time (founder-funded), operations
- Debt service begins: ~$1,450/month

**Note:** Pilot fee alone does not cover ongoing debt service beyond Month 7–8. A conversion to subscription is required to sustain repayment.

**Evidence gap:** Azure operating cost per pilot tenant is not documented. Gross margin per pilot is not calculable.

---

### Month 5–7: Pilot Runs

**Activity:** Pilot customer uses Union Eyes. Weekly check-ins, issue resolution. Mid-pilot review at Month 9–10 (measured from contract, not loan date).

**Cash flow:** No additional revenue during pilot period (assuming no add-ons).

**Debt service:** ~$1,450/month continues from loan proceeds.

---

### Month 7–8: Pilot Conversion Decision

**Activity:** Pilot customer decides whether to convert to annual subscription. Target: $18,000–$52,000/year for a Local-tier customer.

**What the dossier shows:** Conversion credit mechanism ($12,000 fully credited to Year 1 subscription). Pricing is published.

**What is missing:** No documented conversion rate assumption. Industry benchmarks for pilot-to-paid in this segment are not cited.

**Cash flow on conversion (mid-tier Local, $28,000/yr):**
- Year 1 net: $28,000 − $12,000 credit = $16,000 incremental receivable
- If paid monthly: ~$2,333/month
- Covers debt service of ~$1,450/month. **Positive cash after Month 8 if one conversion occurs.**

---

### Month 8 Onward: Recurring Revenue

**Activity:** Converted customer paying annual or monthly subscription. Second pilot launched.

**What must happen for BDC to be repaid in full:**

| Scenario | Pilots needed | Conversion rate | Annual subscriptions needed | Months to full repayment |
|---|---|---|---|---|
| Conservative (Local only, $18K/yr) | 2 | 50% | 1 | ~60 months (at term) |
| Base (Local mix, $28K/yr avg) | 2 | 75% | 2 | ~42 months |
| Upside (Council conversion, $72K/yr) | 1 | 100% | 1 | ~20 months |

**Evidence gap:** No documented conversion rate assumption. No second-pilot pipeline is confirmed.

---

## Downside Scenario

### What happens if the first pilot does not convert?

- $12,000 collected at Month 4.
- No additional revenue.
- Debt service continues from loan proceeds (exhausted by Month ~52 at $1,450/month).
- Net cash position at Month 12: +$12,000 − $17,400 (12 × $1,450) = −$5,400.
- The company would be unable to service debt from revenue alone.

**BDC's downside question:** If Union Eyes generates zero conversion revenue in Year 1, can Nzila service the loan from other sources? The dossier does not answer this question.

### What secondary revenue sources exist in the downside?

| Source | Amount | Certainty |
|---|---|---|
| SR&ED tax credit (2026) | $220,000 projected | Projected only; depends on eligible spend |
| IRAP grants | Amount not specified | Applications pending, not approved |
| Ontario Innovation Tax Credit | ~$50,000 projected | Projected only |
| CIVIC first engagement | Unknown | No pricing exists |
| CourtLens | Not commercialized | N/A |

**SR&ED is the most credible backstop, but it is a tax refund (not cash revenue), filed 18 months after fiscal year-end, and depends on eligible R&D expenditures that may be reduced if the $75,000 is classified as commercial (not R&D) activity.**

---

## Covenant Risks

| Covenant risk | Description |
|---|---|
| Revenue milestone covenant | If BDC requires a minimum revenue milestone (e.g., first invoice within 90 days), Nzila has no confirmed deals to point to. |
| Minimum cash balance | If a minimum cash covenant is set, BDC needs to know what other cash/credit is available. No bank statement or cash position is documented. |
| SR&ED refund assignment | BDC may ask Nzila to assign the SR&ED refund as partial security. This requires CRA confirmation of filing status. |
| Personal guarantee | Single-director structure means any personal guarantee is concentrated on Aubert alone. |

---

## Liquidity Risks

| Liquidity risk | Description |
|---|---|
| Long sales cycle | Union sector sales cycle is 60–90 days per the revenue cockpit. First revenue cannot arrive before Month 3–4 even in the best case. |
| Azure provisioning cost | Each pilot tenant requires dedicated Azure provisioning. Cost is not documented. If Azure costs are $2,000–$3,000 per tenant setup, gross margin on the $12,000 pilot fee is significantly compressed. |
| Founder time concentration | Both revenue generation and product delivery depend on the same two individuals. A single distraction event delays both pipeline and delivery. |
| No bridge facility | No line of credit or alternative facility is documented. If first pilot is delayed by 60 days, debt service draws directly from loan principal. |

---

## Minimum Evidence Required to Close the Repayment Story

| Item | Why required | Current status |
|---|---|---|
| Actual loan terms | Required to calculate debt service | Missing |
| Use of funds schedule | Required to show $75K generates revenue | Missing |
| Revenue scenario with numbers | Required to project repayment timeline | Missing |
| Confirmed outreach activity | Required to show first revenue is plausible | Missing |
| Signed pilot agreement (or LOI) | Required to show first invoice is imminent | Missing |
| Azure per-tenant cost estimate | Required to calculate gross margin | Missing |
| Cash position statement | Required to assess liquidity gap | Missing |
| SR&ED filing confirmation | Required to validate backstop | Not in-repo |
| Personal guarantee position | Required for downside collateral | Not documented |

---

## Assessment

The underlying commercial logic of the repayment story is sound:

- One mid-tier Local subscription ($28,000/yr) covers debt service.
- One pilot ($12,000) covers 8 months of debt service.
- SR&ED refunds provide a backstop even in a zero-revenue scenario.
- The product is documented as deployable within 14 days of contract signature.

**The story is structurally viable. It is not yet documented.**

The committee is being asked to approve $75,000 on the premise that the first customer is imminent — but the dossier contains no evidence that any customer conversation is actually in progress. That gap is the single most material barrier to approval.
