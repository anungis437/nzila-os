# Pipeline Engine — NzilaOS Sales Process

> **Authority:** `docs/gtm/GTM_MASTER_OPERATING_SYSTEM.md`  
> **Owner:** Platform Owner  
> **Updated:** 2026-04-20  
> The 10-stage commercial pipeline. Every deal lives somewhere on this map. If a deal has no stage, it doesn't exist.

---

## Pipeline Overview

```
[0-Target] → [1-Intro] → [2-First Meeting] → [3-Discovery] → [4-Demo] → [5-Proposal] → [6-Pilot Negotiation] → [7-Signed] → [8-Onboarding] → [9-Expansion]
```

Deals move forward by meeting exit criteria. Deals that don't meet exit criteria within the expected window get a **stage stall flag** and require active intervention.

Tracking location: `docs/gtm/rollout-command-center.md` → Sales Pipeline tab.

---

## Stage Definitions

---

### Stage 0 — Target Identified

**What it means:** This organization fits the ICP (`docs/gtm/IDEAL_CUSTOMER_PROFILE_MATRIX.md`) and has been logged as a prospect.

**Entry criteria:**

- Named organization
- Fits a defined ICP segment
- At least one known contact or entry path

**Exit criteria:**

- Outreach has been sent (email, LinkedIn, warm intro request, or conference contact)
- Contact has been logged

**Close probability:** 0% (no relationship yet)  
**Avg days in stage:** 0–7  
**Founder action:** Research organization, identify decision-maker, draft outreach, send.  
**Tool:** `docs/gtm/OUTREACH_SYSTEM.md` — cold email or warm intro template

---

### Stage 1 — Intro Requested / Outreach Sent

**What it means:** We have reached out. We are waiting for a response.

**Entry criteria:** Outreach message delivered

**Exit criteria:**

- Positive response received (they want to learn more)
- OR 3 follow-ups sent with no response → Stage 0-Paused (log reason)

**Close probability:** 5–10%  
**Avg days in stage:** 3–21  
**Founder action:** Follow up if no response after 5 days. Second follow-up at Day 10. Third at Day 17. If Day 21 and no response, pause.  
**Watch for:** Any signal of interest (email open acknowledgment, LinkedIn view, referral from a mutual contact)

---

### Stage 2 — First Meeting Booked

**What it means:** They've agreed to a call. A meeting is scheduled.

**Entry criteria:** Calendar invite accepted

**Exit criteria:**

- Meeting completed
- Notes logged (their operation, pain, team, timeline, decision process)

**Close probability:** 15–25%  
**Avg days in stage:** 3–10  
**Founder action:**

1. Send pre-meeting brief (1-pager or link to `docs/gtm/ue-executive-one-pager.md`)
2. Prepare 5 discovery questions (see Stage 3)
3. Do NOT demo at first meeting

**First meeting agenda (30 min):**

1. 2 min — intro and agenda
2. 10 min — their current workflow, team, pain
3. 8 min — brief context on what NzilaOS is (NOT a demo)
4. 5 min — open Q&A
5. 5 min — next step (agree on a demo or discovery session)

---

### Stage 3 — Discovery Complete

**What it means:** We've had at least one conversation where we understand their operation. We know: their workflow, their team size, their current tools, their pain, their decision process, and their timeline.

**Entry criteria:** First meeting completed, notes logged

**Exit criteria:**

- We can write a proposal without asking clarifying questions
- Internal champion identified
- Decision process and timeline understood

**Close probability:** 30–45%  
**Avg days in stage:** 3–14  
**Founder action:**

1. Complete discovery call or async questionnaire
2. Map to ICP segment and identify correct offer
3. Confirm budget conversation ("Is there a budget allocated for this?")
4. Identify internal champion vs. decision-maker (they may be different people)

**Discovery questions:**

1. "Walk me through how you handle a grievance today — from filing to resolution."
2. "Where does that process break down most often?"
3. "How do you know if a case is at risk of SLA breach?"
4. "Who else would be part of an evaluation decision?"
5. "Is there a budget allocated for this, or would that need to be approved?"

---

### Stage 4 — Demo Delivered

**What it means:** We've run a tailored demo showing Union Eyes or Flow against their specific workflow. Not a product walkthrough — a workflow walkthrough using their scenario.

**Entry criteria:** Discovery complete. We know enough to tailor the demo.

**Exit criteria:**

- Demo completed
- Their reaction captured (positive, hesitant, specific objections)
- Next step agreed (proposal, reference check, additional stakeholder meeting)

**Close probability:** 45–65%  
**Avg days in stage:** 1–7 (demo itself is same-week from discovery)  
**Founder action:**

1. Build demo scenario using their terminology, not generic
2. Show only what's relevant to their pain (don't show everything)
3. Address the one specific concern they raised in discovery
4. End with: "Does this solve the problem you described?"
5. Send proposal within 24 hours of demo

---

### Stage 5 — Proposal Sent

**What it means:** A written pilot scope agreement has been sent. Not a slide deck. Not a verbal quote.

**Entry criteria:** Demo completed, positive signal received

**Exit criteria:**

- Proposal reviewed by buyer
- Verbal agreement or countersignature requested
- OR rejection received (log reason, move to Stage 0-Paused)

**Close probability:** 55–70%  
**Avg days in stage:** 3–14  
**Founder action:**

1. Proposal sent within 24 hours of demo
2. Follow up if no response in 3 days
3. Book a "proposal review" call if there are questions
4. Be prepared for: price objection, scope question, procurement process trigger

**Proposal must contain:**

- Selected offer (from `docs/gtm/OFFER_STACK_AND_PACKAGING.md`)
- Specific pilot scope (dates, users, KPIs)
- Deliverables list
- Fee
- What success looks like
- Next steps

---

### Stage 6 — Pilot Negotiation

**What it means:** Proposal received positive response. We're discussing terms, scope, or legal review.

**Entry criteria:** Buyer verbally indicated they want to proceed

**Exit criteria:**

- Signed pilot agreement
- Invoiced (or purchase order issued)

**Close probability:** 75–90%  
**Avg days in stage:** 5–21  
**Founder action:**

1. Move fast — momentum is at its peak here
2. Have MSA template ready (`docs/governance/` or legal template)
3. Do not discount scope or price unless the buyer's need is genuinely different
4. If procurement is involved, provide a vendor qualification package (point to `docs/buyers/`)
5. Legal review flag: budget 2–3 weeks for national orgs; budget 1 week for local unions

---

### Stage 7 — Signed and Invoiced

**What it means:** Agreement is signed. Invoice sent or PO received. Pilot is live.

**Entry criteria:** Executed agreement + invoice issued

**Exit criteria:**

- Pilot is provisioned (`docs/buyers/deployment-models.md` — 5-step provisioning)
- Kickoff meeting complete
- KPIs locked (per `docs/union-eyes/pilot-kpis.md`)
- First invoice paid or payment confirmed

**Close probability:** 100% (committed)  
**Avg days in stage:** 3–7 (provisioning)  
**Founder action:**

1. Provision org environment
2. Run kickoff meeting: review KPIs, set reporting cadence, confirm executive sponsor
3. Hand off to delivery process (`docs/gtm/PILOT_TO_PAID_CONVERSION_PLAYBOOK.md`)
4. Begin tracking in Tab 1 (Active Pilots) of command center

---

### Stage 8 — Active Pilot / Onboarding

**What it means:** Pilot is live. Delivery is happening. This stage is also tracked in the Active Pilots tab.

**Entry criteria:** Provisioned, KPIs locked, kickoff done

**Exit criteria:**

- Pilot end date reached
- Outcome report delivered
- Conversion proposal sent (≥ 2 weeks before pilot end date)

**Close probability:** 70–85% conversion to SaaS (if pilot is executed well)  
**Avg days in stage:** 30–90 (per pilot type)  
**Founder action:** See `docs/gtm/PILOT_TO_PAID_CONVERSION_PLAYBOOK.md` for full cadence

---

### Stage 9 — Expansion / Renewal

**What it means:** Customer is on SaaS. This stage covers renewal and expansion motions.

**Entry criteria:** SaaS contract active

**Exit criteria (renewal):** Renewal signed ≥ 30 days before contract expiry  
**Exit criteria (expansion):** Add-on module or second-location pilot signed

**Avg days in stage:** Ongoing  
**Founder action:**

1. Renewal conversation starts 60 days before expiry
2. Expansion conversation starts at quarterly business review
3. Reference customer ask: confirm willingness to speak with prospects at 3-month mark

---

## Stage Stall Flags

| Condition | Flag | Founder Action |
|-----------|------|----------------|
| Stage 0–1 for > 21 days, no response | Cold — retry or pause | Try a new contact or different channel |
| Stage 2 booked but meeting keeps rescheduling | Low urgency | Qualify harder; consider pausing |
| Stage 3 complete but no demo scheduled for > 14 days | Momentum risk | Send demo scheduling note: "I want to make sure we keep this moving" |
| Stage 4 complete but no proposal sent in > 3 days | Founder discipline issue | Send proposal same-day if possible |
| Stage 5 sent but no response in > 14 days | Stalled | Run 3-follow-up sequence then pause |
| Stage 6 negotiation dragging > 30 days | Procurement delay or cold | Escalate contact to executive level |
| Stage 7 signed but provisioning > 7 days | Delivery risk | Prioritize immediately |
| Stage 8 pilot entering final 2 weeks with no conversion convo | Conversion risk | Immediate: schedule conversion meeting |

---

## Pipeline Velocity Targets

By quarter, the following pipeline stage counts are minimum indicators of commercial health:

| Metric | Q2 2026 Min | Q3 2026 Min |
|--------|------------|------------|
| Stage 0 (active targets) | 10 | 15 |
| Stage 1 (outreach sent) | 10 | 15 |
| Stage 2 (meetings booked) | 4 | 6 |
| Stage 3 (discovery complete) | 2 | 4 |
| Stage 4 (demo delivered) | 2 | 4 |
| Stage 5+ (proposal or beyond) | 1 | 3 |
| Stage 7 (signed, active) | 1 | 2 |

A pipeline that is heavy at Stage 0–1 and empty at Stage 3–5 means the discovery process is broken or the demo is not being booked.

---

## Pipeline Value Calculation

Weighted pipeline = sum of (deal value × stage close probability)

| Deal | Stage | Est. ACV | Weight | Weighted Value |
|------|-------|---------|--------|---------------|
| Example: OECTA | Stage 3 | $72K | 40% | $28.8K |
| Example: ONA | Stage 4 | $96K | 55% | $52.8K |
| Example: BCGEU | Stage 5 | $96K | 65% | $62.4K |

Track this monthly in `docs/gtm/rollout-command-center.md`.
