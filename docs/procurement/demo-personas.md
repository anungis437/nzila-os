# Demo Personas — Union Eyes

**Purpose**: Scripted personas for product demos, pilot onboarding, and buyer evaluations.  
**Last updated**: 2026-04-22

---

## Overview

Three personas cover the full stakeholder spectrum for a typical union demo or pilot:

| Persona | Role | Demo Focus |
|---|---|---|
| **Alex Martins** | Grievance Officer / Steward | Day-to-day case management, filing, evidence |
| **Diane Okafor** | Local Executive Director | Org-level oversight, caseload analytics, decision support |
| **James Tran** | National IT / Privacy Director | Security controls, compliance, data residency |

---

## Persona 1: Alex Martins — Grievance Officer / Steward

**Title**: Grievance Officer, CUPE Local 79  
**Background**: 12 years as a city sanitation worker, elected steward 3 years ago. Handles 20–30 active cases per quarter. Uses a smartphone more than a laptop. Currently tracks grievances in a shared Google Sheet.  
**Key pain points**:
- Loses track of deadlines (response windows, hearing dates)
- Emailing documents back and forth with HR is messy
- Preparing for arbitration takes days of manual document assembly

**What Alex wants to see in the demo**:
1. **File a new grievance** — takes under 2 minutes from mobile
2. **Upload supporting documents** — photos, PDFs, voice notes
3. **Timeline view** — all deadlines visible at a glance
4. **Evidence package export** — one-click PDF bundle for arbitration prep
5. **AI case summary** — saves 45 minutes of note-taking before meetings

**Sample demo data to use**:
- Member: "David Chen, Unit 42, Public Works"
- Grievance: Article 12.3 — Unjust suspension
- Status: Response deadline in 4 days (show urgency indicator)
- Documents: Suspension letter (PDF), shift schedule (PDF), Union's reply draft

**Key demo lines**:
- "Before Union Eyes, Alex had to email HR three times before getting the suspension letter. Now it's all in one place, with a deadline clock."
- "The evidence package that used to take Alex a half-day now takes 90 seconds."

---

## Persona 2: Diane Okafor — Local Executive Director

**Title**: Executive Director, CUPE Local 4400 (School Board)  
**Background**: 20-year union administrator. Oversees 12 stewards, 3,400 members, and a caseload of 80–120 active grievances at any time. Accountable to the Local's executive board for outcomes.  
**Key pain points**:
- No visibility into caseload distribution across stewards
- Can't identify systemic employer patterns across grievances
- Board wants data-driven reporting; currently produces Word docs manually

**What Diane wants to see in the demo**:
1. **Executive dashboard** — caseload by steward, by type, by status
2. **Pattern detection** — "Are Article 12 violations clustering in one department?"
3. **Outcome tracking** — win/loss/settled rates over time
4. **Board report export** — structured summary suitable for monthly board package
5. **Access control** — stewards see their own cases; Diane sees all

**Sample demo data to use**:
- Dashboard showing: 4 stewards, 87 active cases, 12 urgent (deadline within 7 days)
- Pattern: 6 unjust suspension cases from "Food Services" department in 90 days
- Outcome stats: 68% resolved in favour of member (last 12 months)

**Key demo lines**:
- "Diane used to spend two days before each board meeting manually pulling data. Union Eyes gives her this in real time."
- "The pattern detection flagged a cluster of Article 12 violations in Food Services — that's intelligence Diane's board had never seen before."

---

## Persona 3: James Tran — National IT / Privacy Director

**Title**: Director of IT & Privacy, National Office  
**Background**: Responsible for technology decisions across 50+ locals. Reports to the National Secretary-Treasurer. Has blocked two previous software projects over data residency concerns. Has a checklist from the OPC.  
**Key pain points**:
- Vendor software sending data to U.S. servers (PIPEDA risk)
- Lack of audit trails creates exposure in arbitration
- Previous breach at a U.S.-hosted HR vendor — board is now risk-averse
- Security questionnaires from locals pile up with no standard answers

**What James wants to see in the demo**:
1. **Trust page** — live URL with controls table (residency, encryption, RLS, HMAC)
2. **Vendor questionnaire** — pre-filled responses (hand off `vendor-questionnaire.md`)
3. **DPA** — template available, reviewed by Nzila legal (hand off `dpa.md`)
4. **Audit log demo** — show an immutable log entry with cryptographic seal
5. **Role isolation** — show that Diane's account cannot see Local 79's cases

**Key demo lines**:
- "Everything in the trust table has a proof path. Canadian hosting is Azure Canada Central — here's the Azure portal screenshot."
- "The HMAC seal on audit logs means no one — not even Nzila — can quietly delete a log entry. That's what makes these evidence packs admissible."
- "The DPA is a template your legal team can redline. We expect it to take one round of edits."

**Security objection handlers**:

| Objection | Response |
|---|---|
| "You're using U.S. AI" | Azure OpenAI operates under Microsoft's no-training commitment. Member text is not retained or used for training. We can provide the Microsoft contractual reference. |
| "No SOC 2" | Correct — it's on our roadmap. We have continuous CI vulnerability scanning. We're happy to book an architectural review session with your team. |
| "No pen test" | Planned before general availability. If required for pilot sign-off, we can negotiate a delayed start date pending pen test completion. |
| "We had a breach before with a U.S. vendor" | Your data doesn't touch U.S. soil. Azure Canada Central is a separate datacenter with Canadian data residency. |

---

## Demo Environment Notes

- Demo environment URL: [to be confirmed — use staging with demo seed data]
- Demo seed script: `docs/demos/union-eyes-demo-seed.md`
- Demo account credentials: stored in Azure Key Vault `nzila-staging-kv` (ask platform team)
- Never demo with real member data — use seed personas only
