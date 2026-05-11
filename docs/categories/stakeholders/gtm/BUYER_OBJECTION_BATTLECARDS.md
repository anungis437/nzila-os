# Buyer Objection Battlecards — NzilaOS

> **Authority:** `docs/gtm/GTM_MASTER_OPERATING_SYSTEM.md`  
> **Owner:** Platform Owner  
> **Updated:** 2026-04-20  
> Ten objections. Each with a diagnosis, a response, evidence to show, and a repositioning angle.

---

## How to Use These Battlecards

Every objection has a real meaning underneath it. The surface objection is rarely the real blocker. Diagnose the real blocker first, then respond.

**Two-step rule:**

1. Acknowledge — "That's fair / I hear you / That's a common concern."
2. Reframe — Pivot to value, evidence, or scope reduction. Never capitulate on price first.

---

## Battlecard 1: "You're too early"

**What they actually mean:**
> "You don't have enough reference customers to justify the risk of going first."

**Best response:**
> "That's exactly why the pilot is structured the way it is — it's not a full commitment, it's a controlled test with a defined exit. If Union Eyes doesn't produce the outcomes we scope together, you stop. There's no long-term contract until you've seen real results. The risk is bounded by design."

**Evidence to show:**

- Pilot tier overview (`docs/gtm/ue-pilot-tiers.md`) — show the defined exit gates
- Deployment model (`docs/buyers/deployment-models.md`) — show the 5-day provisioning standard
- Security and governance pack (`docs/buyers/SECURITY_SUMMARY.md`) — show this is production-hardened infrastructure, not a startup prototype

**Repositioning angle:**
> "Early-stage doesn't mean unproven infrastructure. The platform is running on Azure Container Apps with full DR, SOC2-aligned controls, and nightly security scans. What's 'early' is the number of reference customers — and a design-partner pilot is how you become one of the first, with a discount built in."

**When to walk away:**
> If they need 3+ named enterprise references before they'll consider it and won't accept any other form of proof. This is not a fit for Year 1.

---

## Battlecard 2: "Budget is frozen"

**What they actually mean:**
> "This isn't a priority right now" OR "I don't have authority to approve this" OR "We literally have no budget."

**Diagnosis step:** Ask: "Is it that there's no budget at all, or that it hasn't been approved yet?"

**Best response (no budget at all):**
> "Understood. When does your next budget cycle open? I'd like to stay in touch so we can get into that cycle early. The organizations that are most successful with us plan the pilot in the current cycle so it starts the day the budget opens."

**Best response (not yet approved):**
> "Who would need to approve this? Is there anything I can prepare that would help make the case internally — a scoped proposal, a ROI estimate, a vendor brief?"

**Evidence to show:**

- ROI indicators (`docs/gtm/ue-executive-one-pager.md` — ROI section) — SLA breach avoidance, arbitration evidence quality, staff time recovery
- Pricing tiers — the Discovery Sprint at $7K–15K is a low-barrier entry

**Repositioning angle:**
> "The Discovery Sprint is specifically designed to fit within discretionary spend limits at most organizations. It doesn't require a full procurement process — it's a scoped professional services engagement."

**When to walk away:**
> Budget is frozen for 12+ months with no path to fast-track, and no internal champion willing to make a case. Log as long-cycle and re-engage at the right point in their cycle.

---

## Battlecard 3: "We already use spreadsheets / email and it works"

**What they actually mean:**
> "The pain isn't acute enough yet" OR "I underestimate how much this costs us in hidden time and risk."

**Best response:**
> "Spreadsheets work until they don't. The risk with grievance management specifically is that the failure shows up at the worst possible moment — when you're in front of an arbitrator and you can't produce a clean timeline or a complete evidence trail. Has that happened? Or do you have an upcoming arbitration cycle where you'd rather not find out?"

**Evidence to show:**

- Pilot KPIs (`docs/union-eyes/pilot-kpis.md`) — "Evidence pack exports" and "response time SLA compliance" are things you can't get from spreadsheets
- Executive one-pager (`docs/gtm/ue-executive-one-pager.md`) — "Why now" section

**Repositioning angle:**
> "The issue isn't whether spreadsheets are functional today. It's whether they're defensible under audit or in arbitration. Union Eyes generates an audit-ready evidence pack automatically. That's not possible with a spreadsheet."

**When to walk away:**
> If they have no active arbitration risk and no governance accountability pressure, the urgency isn't there yet. Stay in touch. Re-engage when a triggering event occurs.

---

## Battlecard 4: "We already have a vendor / system"

**What they actually mean:**
> "I'm not sure switching costs are worth it" OR "I have political sunk cost in an existing decision."

**Best response:**
> "What does your current system do well? And where does it fall short on the governance and audit side — specifically, can it produce a case evidence pack automatically, and can leadership see SLA status in real time?"

**Evidence to show:**

- Product capability matrix (`docs/buyers/product-capability-matrix.md`) — show what Union Eyes does that generic systems don't
- Deployment model — show no massive migration required to pilot

**Repositioning angle:**
> "We're not asking you to replace it before you've seen the alternative. A 30-day Discovery Sprint doesn't touch your current system — it runs in parallel on new cases and you compare outcomes directly."

**When to walk away:**
> If the incumbent vendor is deeply embedded, has a long-term contract, and the internal champion is also the person who bought the incumbent system. Not a near-term win.

---

## Battlecard 5: "We have security and compliance concerns"

**What they actually mean:**
> "I need proof this is safe to put production data in" OR "IT/Legal will block this without proper documentation."

**Best response:**
> "Great — this is exactly where we've invested heavily. Let me send you our full vendor qualification package. It covers infrastructure, access controls, data residency, breach response, audit logging, and our third-party testing posture."

**Evidence to show (immediately):**

- Security summary (`docs/buyers/SECURITY_SUMMARY.md`) — Argon2id, Trivy, OWASP ZAP, Gitleaks, SBOM, SOC2-aligned controls
- Deployment model (`docs/buyers/deployment-models.md`) — Azure Canada Central, org isolation, no cross-tenant data, automated backups
- SLA + support model (`docs/buyers/sla-support-model.md`) — DR, RTO/RPO commitments

**Repositioning angle:**
> "We're a Canadian SaaS platform hosted in Azure Canada Central. Data never leaves Canadian jurisdiction. The security posture is designed for governance-sensitive organizations — not just privacy compliance, but audit accountability."

**When to walk away:**
> Never walk away on a security concern — it's always addressable with documentation. If after providing all documentation they still won't engage, the issue is either politics or a different unstated concern.

---

## Battlecard 6: "Migration will be too complex / disruptive"

**What they actually mean:**
> "I don't want to own a failed implementation" OR "We've had a bad vendor migration experience before."

**Best response:**
> "Let's scope the migration before we price it. In almost every case, we start new cases in Union Eyes from day one and migrate historical data in a second phase, after the team is comfortable. The Controlled Pilot is designed exactly for this — no historical migration required, just new cases from go-live."

**Evidence to show:**

- Pilot tiers (`docs/gtm/ue-pilot-tiers.md`) — "Included: new cases from go-live date OR scoped historical import" — framing that makes this feel controllable
- Deployment model — 5-day provisioning means they can start without any migration at all

**Repositioning angle:**
> "The question isn't 'can we migrate everything at once' — it's 'can we run Union Eyes on new cases while keeping your existing system in read-only for historical lookups?' That's not a migration risk. That's a low-friction parallel deployment."

**When to walk away:**
> If they have a very old proprietary system with no export capability and a large caseload. This is a services engagement, not a SaaS pilot. Scope it properly.

---

## Battlecard 7: "We need board approval / committee sign-off"

**What they actually mean:**
> "The decision is above my level and I can't commit without governance process."

**Best response:**
> "That makes complete sense. Let me help you make the internal case. I can prepare a board-ready summary, a scoped pilot proposal, and a vendor brief that answers the questions your board will have — security, cost, risk, and outcomes. What does your approval timeline look like?"

**Evidence to show:**

- All of `docs/buyers/` — this is your complete vendor qualification package
- Pilot proposal template with explicit scope, fixed fee, defined exit gate

**Repositioning angle:**
> "Board approval is standard for any new vendor. The goal is to make the approval motion as easy as possible. What I've seen work is a pilot proposal with a fixed fee, defined success criteria, and a commitment that there's no long-term contract until the board reviews pilot outcomes."

**When to walk away:**
> Never walk away on governance process — this is normal. Set a realistic timeline (4–8 weeks for local unions, 8–16 weeks for provincial/national) and stay in close contact with your champion throughout.

---

## Battlecard 8: "We don't have the internal bandwidth"

**What they actually mean:**
> "Implementation will land on our team and we're already overwhelmed."

**Best response:**
> "That's the most common concern we hear, and it's the reason we run the pilot as a managed delivery, not a self-serve installation. We handle provisioning, training, and weekly reporting. Your team runs cases — we handle the platform."

**Evidence to show:**

- Deployment model (`docs/buyers/deployment-models.md`) — 5-day provisioning, no internal IT required
- SLA support model (`docs/buyers/sla-support-model.md`) — ongoing support included
- Pilot deliverables in offer stack — "training included, weekly KPI reports delivered by us"

**Repositioning angle:**
> "The Discovery Sprint is the lightest-touch entry. It's 3 stakeholder walkthroughs and a workflow mapping report — no live production usage, no staff training, no change management. That's the right starting point if bandwidth is the real constraint."

**When to walk away:**
> If the organization has zero administrative capacity for anything new right now (major campaign, contract negotiations underway, restructuring). Offer to re-engage after the capacity constraint lifts.

---

## Battlecard 9: "I'm skeptical pilots ever lead to real change"

**What they actually mean:**
> "I've run pilots before that produced a report and nothing changed" OR "I'm not sure we'll actually use this long-term."

**Best response:**
> "That's a real risk. Most pilots fail because the KPIs aren't locked at the start and there's no executive accountability for acting on the outcome. We build that in by design — KPIs agreed at kickoff, weekly reports, and a formal outcome report with a conversion proposal in the final week. The pilot is designed to force a decision, not defer one."

**Evidence to show:**

- Pilot KPIs (`docs/union-eyes/pilot-kpis.md`) — show them the specific metrics that get tracked
- Pilot-to-paid playbook framework (`docs/gtm/PILOT_TO_PAID_CONVERSION_PLAYBOOK.md`) — show the conversion sequence is built in, not bolted on

**Repositioning angle:**
> "You're right to be skeptical of pilots that just produce a slide deck. We produce an outcome report with real data — cases processed, response times, SLA compliance, evidence pack quality. If that report doesn't show material improvement, you have written evidence not to buy. That's a fair deal."

**When to walk away:**
> If they've been burned so many times by failed software pilots that they won't run any pilot regardless of structure. This is a trust barrier, not a feature or price problem. It requires a different kind of reference — a peer at another organization they trust who can validate.

---

## Battlecard 10: "Your price is too high"

**What they actually mean:**
> "I don't yet see the value at this price" OR "I need to justify this to someone else" OR "I'm fishing for a discount."

**Best response:**
> "Let me understand what's driving that. Is it the absolute number, or uncertainty about what you'd get for it? If it's the value, let me walk you through what's included and what the typical outcomes look like for an organization your size. If it's the absolute number, we have entry points starting at $7K for a Discovery Sprint."

**Evidence to show:**

- Year 1 total value summary (from `docs/gtm/PRICING_STRATEGY_V2.md`) — what they get for the money
- ROI indicators (`docs/gtm/ue-executive-one-pager.md`) — SLA breach cost, arbitration preparation time, staff hours recovered
- Competitor context: no purpose-built alternative exists — the comparison is "spreadsheets + legal exposure" vs. "governed platform + evidence trail"

**Repositioning angle:**
> "The right comparison isn't platform cost vs. zero. It's platform cost vs. the cost of one avoidable arbitration loss, one steward dropped caseload, or one governance audit that produces a damaging finding. One arbitration case can cost more than an annual subscription."

**When to walk away:**
> If they're anchoring on a price 50%+ below your floor and won't consider scope reduction or phasing. Don't chase deals that can't sustain delivery. A customer paying below cost is a support liability.

---

## Quick Reference Card

| Objection | Real Concern | First Move |
|-----------|-------------|-----------|
| Too early | No references | Show governed pilot structure + proof assets |
| Budget frozen | No authority or no budget | Find the budget cycle, offer internal advocacy support |
| Spreadsheets work | Low urgency | Name the risk — arbitration failure, audit gap |
| Have a vendor | Switching cost fear | Offer parallel pilot, no replacement required |
| Security concern | IT/Legal block | Send full vendor qualification pack immediately |
| Migration fear | Implementation risk | Pivot to Controlled Pilot, new-cases-only model |
| Board approval | Above their authority | Make the internal case easy, prepare board pack |
| No bandwidth | Overwhelmed team | Show managed delivery, zero IT required |
| Pilot skepticism | Past vendor failures | Show locked KPIs + forced-decision outcome report |
| Too expensive | Value not established | ROI reframe before any discount conversation |
