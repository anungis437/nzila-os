# Case Study Template System — Union Eyes

> Repeatable templates for documenting pilot outcomes once first pilots land. Designed to be filled in 60 minutes after a pilot review meeting.

**Status:** templates only. **No case studies have been published yet.** Pilots in flight; first published case study expected after the first pilot's 90-day review concludes.

**Use these formats only with explicit written customer approval and an anonymisation option on file.**

---

## A. One-Page Quick Proof

**Use:** sales follow-ups, conference handouts, pilot-request landing page proof bar.

**Length:** ≤ 350 words on a single side.

```
[Customer logo or "Anonymised — Mid-Size CUPE Local"]

UNION EYES — PROOF POINT

Customer profile
- Type: [Local / Council / Federation]
- Membership: [count]
- Stewards: [count]
- Sector: [Healthcare / Municipal / Post-secondary / Federal / Other]
- Pilot start: [Month YYYY]

What changed (one sentence)
[Single concrete operational change. Example: "Cut the time to assemble an arbitration evidence bundle from 6 hours to 35 minutes."]

The numbers (3 max — only KPIs measured by the product)
- KPI 1: [baseline → current, e.g., "Cycle time: 62d → 49d (−21%)"]
- KPI 2: [baseline → current]
- KPI 3: [baseline → current]

In their words (≤ 30 words)
"[Direct quote from a named or titled spokesperson.]"
— [Name + title, OR "Director of Operations, [sector] Local"]

What's next
[1 sentence on Phase-2 expansion or renewal.]
```

---

## B. Three-Page Executive Case Study

**Use:** procurement leave-behind, pilot-sponsor reference, board reading material.

**Length:** ~1,500 words across three pages with one chart per page.

### Page 1 — The Situation

**Sections:**
1. **Customer profile** (5 bullets: type, membership, stewards, sector, prior tooling)
2. **Operational pain** (3 specific failures the customer chose to solve — quote the customer)
3. **Why they evaluated Union Eyes** (3 reasons — the bullets that landed in the demo)
4. **Decision drivers** (3 procurement signals: hosting, AI governance, reversibility)

**Chart:** baseline KPIs at pilot start (timestamped table from product analytics).

### Page 2 — The Implementation

**Sections:**
1. **Timeline actually delivered** (compare planned vs. actual — be honest about delays)
2. **What we provisioned** (Azure tenant, modules turned on, integrations)
3. **What the buyer provided** (data, users, decisions)
4. **Adoption ramp** (week 1–4 active users, week 5–8 active users, plateau)
5. **One thing that surprised us** (a real lesson — increases credibility)

**Chart:** 12-week adoption curve (DAU, cases entered, KPIs activated).

### Page 3 — The Outcome

**Sections:**
1. **Quantified outcomes** (3–5 KPIs from the buyer's success criteria — show baseline → current)
2. **Operational impact** (the human consequence — burned-out stewards, missed deadlines, etc.)
3. **Procurement / IT impact** (audit-log usage, MFA enrolment %, SSO uptake)
4. **Renewal decision** (renewed Y/N, expansion details, contract band)
5. **Customer-approved quote** (40–80 words, named where permitted)

**Chart:** outcome KPIs (delta from baseline).

**Footer:** approval timestamp, anonymisation status, last-updated date.

---

## C. Quote / Testimonial Format

**Use:** marketing site, slide T-12 of buyer deck, RFP responses.

```
"[20–60 word quote, edited for clarity but not for substance.
Approved verbatim by spokesperson on YYYY-MM-DD.]"

— [Spokesperson Name], [Title], [Customer Name]
   OR
— [Title], [Sector] [Local / Council], [Province]   (anonymised)

Approval source: [email reference / signed approval form]
Anonymisation level: [Named / Title-only / Sector-only]
Permitted uses: [Website / Sales deck / RFP / All]
Expires: [date or "indefinite until withdrawn"]
```

**Quote selection rules:**
- Must reference a specific operational outcome, not a vague feeling
- Must be sourceable to a named role inside the customer org
- Must not contain claims the product cannot defend
- Must not name third parties (employers, opposing counsel, individual members)

---

## D. Metrics Proof Format

**Use:** procurement reviews, board cases, RFP technical responses, public proof bar.

```
UNION EYES — MEASURED OUTCOMES

[Customer name or "Anonymised pool of N customers"]
Reporting window: [YYYY-MM-DD to YYYY-MM-DD]

| KPI | Formula source | Baseline | Current | Δ | Conservative Δ | Methodology note |
|-----|----------------|----------|---------|---|---------------|------------------|
| Cycle time (days) | UNION_EYES_COGNITION_ROI §1 | … | … | … | … | … |
| Steward fairness score | UNION_EYES_COGNITION_ROI §2 | … | … | … | … | … |
| Disengaged member count | UNION_EYES_COGNITION_ROI §3 | … | … | … | … | … |
| Backlog (≥30d) | UNION_EYES_COGNITION_ROI §5 | … | … | … | … | … |
| Admin hours saved / month | PILOT_ROI_CALCULATOR §B.1 | … | … | … | … | … |

Honest disclosures
- [Any caveat about the measurement window]
- [Any KPI that is operator-confirmed vs. system-measured]
- [Any baseline that is buyer-asserted vs. system-measured]
- [Any KPI excluded because data was insufficient]

Independent verification
- Audit log evidence available on customer request
- Methodology pre-published in UNION_EYES_COGNITION_ROI.md
```

---

## Approval Workflow (mandatory)

> No case study, quote, or metric is published without completing this workflow.

| Step | Owner | Output | SLA |
|---|---|---|---|
| 1. Draft prepared | Account owner | Draft document | T+5 days from pilot review |
| 2. Internal review | Pilot sponsor (customer side) | Track-changes feedback | T+10 days |
| 3. Quote sign-off | Named spokesperson | Email approval (verbatim quote, scope, expiry) | T+12 days |
| 4. Legal review | Customer's General Counsel (if required by org policy) | Sign-off email | T+15 days |
| 5. Anonymisation review | Account owner + customer | Confirm anonymisation level | T+15 days |
| 6. Final publish | Marketing | Published doc + reciprocal sharing rights confirmed | T+20 days |

### Anonymisation levels

- **Level 0 — Fully named.** Customer name + spokesperson name + role. Highest credibility, highest customer effort to approve.
- **Level 1 — Title-only.** Customer name + role title (no individual name). Default for most procurement reviews.
- **Level 2 — Sector-only.** "Healthcare local in Ontario" — no customer name, no individual name. Used when customer wants reference value but not public attribution.
- **Level 3 — Aggregated.** "Across N pilots" — no individual customer identifiable. Used for proof bars and benchmark statements once N ≥ 5.

### Quote permission template (email)

```
Subject: Union Eyes — quote approval for [asset name]

Hi [spokesperson],

Following up from our pilot review on [date]. Below is the quote we
would like to use, attributed to you, in [list of channels].

Quote (verbatim):
"[quote]"

Attribution:
[Name], [Title], [Customer]

Permitted uses: [list]
Expiry: [date or "until withdrawn by you"]
Anonymisation level: [0/1/2/3]

Reply "approved" to confirm. We will not use the quote until your
written approval is on file.

Thanks,
[Account owner]
```

---

## Filing & retention

- All approvals filed in `docs/commercial/case-studies/_approvals/<customer-slug>.md` (gitignored if customer requests).
- Quote expiry tracked in a single index file; quotes expire silently if not refreshed.
- Customer can request takedown at any time; takedown SLA: 5 business days from email.

---

## When the first case study exists

1. Replace this template's "no case studies published yet" disclaimer
2. Move the published asset under `docs/commercial/case-studies/`
3. Update the buyer deck slide 12 ("Why choose us now") with a real customer logo or anonymised proof bar
4. Add a one-line link from the public marketing site (`apps/web/app/security/page.tsx` or a future `/customers` page)
5. Update [`PILOT_ROI_CALCULATOR.md`](./PILOT_ROI_CALCULATOR.md) section F changelog: replace assumption multipliers with pilot-measured ranges
