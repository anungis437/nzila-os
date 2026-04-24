# Enterprise Close Sequence — Union Eyes

> The 10-business-day cadence from a successful demo to a signed pilot. Every step ties to a specific document in the close package.

**Goal:** signature by Day 10. Pilot kickoff by Day 14. Go-live by Day 28 (Day +14 from signature).

**Pre-condition:** the buyer attended the [45-minute demo](../sales-kit/02-45-minute-demo-script.md) and asked at least one substantive question.

---

## Day 0 — Same day as the demo

**Send within 5 hours of the meeting ending.**

| Asset | Purpose |
|---|---|
| [`UNION_EYES_BUYER_DECK.md`](./UNION_EYES_BUYER_DECK.md) (PDF export) | Boardroom-ready summary — answers "who else needs to see this?" |
| [`TRUST_VISUAL_PACK.md`](./TRUST_VISUAL_PACK.md) (1-page summary) | Pre-empts the IT-pings-procurement chain |
| Pilot outline (1-pager from [`pilot-offer-cupe.md`](../pilot-offer-cupe.md)) | Concrete scope, timeline, fee, conversion credit |
| Two-line meeting recap | Three things they said, one specific commitment from us, one ask from them |

**Email template:**

```
Subject: Union Eyes — pilot package and 3 things from today

Hi [name],

Three things you said that we want to make sure we deliver on:
1. [their pain]
2. [their KPI question]
3. [their procurement constraint]

Attached:
- Buyer deck (13 slides — built for your exec board)
- Trust pack (one-page IT/procurement summary + 5-slide appendix)
- 90-day pilot outline ($12K, fully credited on conversion)

Two asks from us:
- Procurement contact name + email so we can pre-clear vendor onboarding
- Calendar slot for the Day 7 stakeholder call (suggested options below)

Day 2 you'll receive the procurement checklist.
Day 5 you'll receive the ROI calculator with your numbers plugged in.
Day 7 we hold the stakeholder follow-up call.
Day 10 target signature.

[signature]
```

**Internal:** log meeting outcomes in CRM. Tag the deal `close-sequence-day-0`.

---

## Day 2 — Procurement Checklist

**Send to:** the procurement / operations contact named in Day 0 reply.

| Asset | Purpose |
|---|---|
| [`PROCUREMENT_CHECKLIST.md`](./PROCUREMENT_CHECKLIST.md) | Frictionless across Legal, IT, Ops, Finance |
| Vendor onboarding form (their template) | Pre-fill our half before they ask |
| Pre-filled VSQ (if they have one) | Cite [trust-center/](../trust-center/) sections inline |
| DPA + subprocessor list | From [vendor-risk-pack/](../vendor-risk-pack/) |

**Email template:**

```
Subject: Union Eyes — procurement pre-pack (most boxes pre-checked)

Hi [procurement lead],

[Sponsor] looped me in. Attached is our procurement checklist with
"who provides what" mapped across Legal / IT / Ops / Finance.

Pre-packaged from our side:
- Pilot agreement (2 pages)
- DPA (signature-ready)
- Subprocessor list (Azure CA + Resend)
- VSQ answers cross-referenced to our trust center
- Vendor info package (WSIB, GST/HST, banking)

Items needing your input are flagged with 🟡. Most teams clear those
in 3-5 business days.

Happy to jump on a 20-minute call to walk through anything ambiguous.

[signature]
```

---

## Day 5 — ROI Calculator

**Send to:** pilot sponsor + COO / Director of Operations.

| Asset | Purpose |
|---|---|
| [`PILOT_ROI_CALCULATOR.md`](./PILOT_ROI_CALCULATOR.md) + [`pilot-roi-calculator.csv`](./pilot-roi-calculator.csv) | Editable model with their inputs pre-filled |
| 1-paragraph plain-English summary | "At your numbers, payback is X months and year-1 ROI is Y%" |
| Honesty footnote | Conservative vs. expected vs. high — show the range |

**Email template:**

```
Subject: Union Eyes — your pilot ROI numbers

Hi [sponsor],

I plugged your inputs (membership: [I1], stewards: [I3], etc.) into
our ROI model. Conservative end:
- Pilot payback: ~[X] months
- Year-1 dollar value: ~$[Y] CAD
- Year-1 ROI vs. subscription: ~[Z]%

Spreadsheet attached so you can change any input. Methodology source
is in our cognition ROI doc — every multiplier has a published formula.

We deliberately use conservative numbers. If your team wants to push
back on the assumptions, we'll happily defend each one.

Day 7 stakeholder call still on?

[signature]
```

---

## Day 7 — Stakeholder Follow-Up Call

**Attendees:** pilot sponsor, COO/Director of Operations, IT lead, procurement lead.

**Length:** 45 minutes. **Owner:** account executive. **Co-pilot:** solutions engineer.

**Agenda:**

| Time | Topic | Who |
|---|---|---|
| 0:00 | Recap commitments + state of the pre-pack | AE |
| 0:05 | IT walkthrough — answer outstanding security questions | SE |
| 0:15 | Procurement — confirm timeline + open items | AE + procurement |
| 0:25 | ROI numbers — sign off on the inputs | Sponsor + COO |
| 0:35 | Pilot kickoff date + go-live target | Joint |
| 0:40 | Confirm signature path + Day 10 target | Sponsor + AE |

**Outcomes to capture (mandatory):**

- Confirmed signature target date
- Named pilot coordinator on customer side
- Confirmed go-live date
- Two outstanding objections (if any) — owned, time-boxed answers committed

**If the call slips past Day 7:** see "Slip recovery" below.

---

## Day 10 — Close Call (signature)

**Goal:** signature on the pilot agreement.

**Pre-call (1 hour before):**

- Send updated pilot agreement reflecting any commercial nuances from Day 7
- Confirm the buyer's e-signature platform (DocuSign, Adobe Sign, internal tool)
- Reconfirm the meeting attendees are decision-makers

**Call structure (30 minutes):**

| Time | Topic |
|---|---|
| 0:00 | Confirm everyone is on, recap path to here |
| 0:05 | Walk the agreement page-by-page (it's only 2 pages) |
| 0:15 | Address last-minute objections (have answers from Days 0–7 ready) |
| 0:20 | E-sign in real time |
| 0:25 | Confirm kickoff: tenant provisioning starts today, data-import template sent today, go-live in 14 days |

**Post-call (within 1 hour):**

- Send signed agreement to all parties
- Email kickoff plan with Day +1 / Day +5 / Day +14 milestones
- Internal: kick off Azure tenant provisioning runbook

---

## Slip recovery — what to do if a step misses

| Slip | Diagnostic question | Recovery action |
|---|---|---|
| Day 0 follow-up didn't trigger a reply by Day 2 | Did the demo land? | Brief check-in: "Anything I should rework before sending the procurement pack?" |
| Day 2 procurement contact not provided | Sponsor doesn't have authority to bring in procurement | Offer to draft an internal note for the sponsor to forward |
| Day 5 ROI calc inputs not provided | Sponsor doesn't have the numbers | Schedule a 30-min "build it together" working session |
| Day 7 stakeholder call doesn't happen | Pre-clearing one of Legal / IT / Procurement is blocked | Identify the blocker, offer a 1:1 to that stakeholder, push close call to Day 12–14 |
| Day 10 signature slips | Internal approval cycle longer than expected | Stay-warm cadence: weekly 5-min check-ins, no new asks. Do not re-pitch. |

---

## Anti-patterns — do not do these

- ❌ Re-pitching the product after Day 0. The deck has already been sent. Subsequent emails answer questions.
- ❌ Sending a discount before the customer has objected on price. The pilot fee is already credit-back.
- ❌ Promising features that aren't shipped. Honest gap list is in the buyer deck appendix.
- ❌ Pressuring on the Day 10 signature. If the buyer needs a 2-week extension, give it. The deal closes when their procurement clock allows.
- ❌ Sending more than one CTA per email. Each day's email has exactly one ask.

---

## Internal scoreboard

| Metric | Target | Source |
|---|---|---|
| Demo → Day 0 follow-up time | < 5 hours | CRM timestamp |
| Demo → signed pilot | ≤ 14 calendar days | Contract date |
| Pilot signed → go-live | ≤ 14 calendar days | [pilot-offer-cupe.md](../pilot-offer-cupe.md) |
| Win rate on demos that reach Day 7 stakeholder call | Target ≥ 60% | CRM stage report |
| Pilot → annual subscription conversion | Target ≥ 70% | Renewal log |

These targets get updated quarterly with actual cohort data once we have ≥10 closed pilots.
