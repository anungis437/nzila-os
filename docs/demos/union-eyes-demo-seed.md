# Union Eyes Demo Seed Script

**Purpose**: Scripted demo flow for buyer evaluations and pilot onboarding.  
**Audience**: Sales team, platform team, pilot onboarding lead  
**Personas**: Alex Martins (Grievance Officer), Diane Okafor (Executive Director), James Tran (IT Director) — see [docs/procurement/demo-personas.md](../procurement/demo-personas.md)  
**Environment**: Staging with demo seed data only — **never use real member data**  
**Last updated**: 2026-04-22

---

## Pre-Demo Checklist

- [ ] Log in to staging with demo steward account (Alex)
- [ ] Confirm seed data is loaded (check: "David Chen" case exists in "CUPE Demo Local")
- [ ] Open trust page (`/trust`) in a separate tab
- [ ] Have vendor-questionnaire.md and dpa.md ready to share
- [ ] Demo environment URL confirmed and accessible
- [ ] Screen share running and audio checked

---

## Seed Data Manifest

### Organization: CUPE Demo Local 99

| Field | Value |
|---|---|
| Name | CUPE Demo Local 99 |
| Type | Municipal Services |
| Membership count | 340 (demo) |
| Active stewards | 4 |
| Active cases | 12 |

### Members (Demo)

| Name | Employee ID | Department | Status |
|---|---|---|---|
| David Chen | DEM-001 | Public Works | Active |
| Maria Santos | DEM-002 | Parks & Recreation | Active |
| Robert Kim | DEM-003 | Transit | Active (suspended — active grievance) |
| Patricia Osei | DEM-004 | Administration | Active |

### Grievance Cases (Demo)

| Case ID | Member | Article | Type | Status | Urgency |
|---|---|---|---|---|---|
| GRV-2026-001 | Robert Kim | Art. 12.3 | Unjust Suspension | Response Due (3 days) | 🔴 URGENT |
| GRV-2026-002 | David Chen | Art. 15.1 | Overtime Denial | Employer Response Received | 🟡 Active |
| GRV-2026-003 | Maria Santos | Art. 9.4 | Scheduling Violation | Investigation | 🟡 Active |
| GRV-2026-004 | Patricia Osei | Art. 18.2 | Accommodation Request | Mediation Scheduled | 🟢 On Track |
| GRV-2026-005 | David Chen | Art. 12.3 | Unjust Suspension | Arbitration Prep | 🔴 URGENT |

### Documents (Pre-loaded per Case)

**GRV-2026-001 (Robert Kim — Suspension)**:
- `suspension-letter-kim-2026-03-15.pdf` — employer suspension letter
- `shift-schedule-march-2026.pdf` — shows Kim's shifts before incident
- `witness-statement-santos.pdf` — witness account from Maria Santos

**GRV-2026-005 (David Chen — Arbitration)**:
- `employer-response-chen.pdf`
- `evidence-package-chen-v2.pdf` — HMAC-sealed export (show this as the outcome)

---

## Demo Script (25 minutes)

### Opening (2 min)

> "I'm going to show you a day in the life of a grievance officer, then zoom out to what an executive director sees, and then we'll walk through the security controls. Feel free to stop me with questions at any time."

---

### Act 1: Alex the Steward (8 min)

**Step 1**: Log in as Alex Martins (steward account)

**Step 2**: Show the case dashboard  
- Point out: 12 active cases, 2 urgent (red deadline indicators)
- **Key line**: "Before Union Eyes, Alex had a shared Google Sheet. Deadlines were missed. Now the dashboard is the first thing Alex checks every morning."

**Step 3**: Open GRV-2026-001 (Robert Kim — Suspension, 3-day deadline)
- Show the case timeline: filed → employer notified → response window ticking
- Show uploaded documents (suspension letter, shift schedule)
- **Key line**: "All documents are in one place. No more emailing back and forth with HR."

**Step 4**: Generate an evidence package for GRV-2026-005 (Arbitration prep)
- Click "Export Evidence Package"
- Show the PDF bundle preview: sealed with HMAC hash, case timeline, all documents
- **Key line**: "What used to take Alex a half-day — pulling documents, writing a summary, printing everything — now takes 90 seconds. And the PDF includes a cryptographic seal that proves the logs haven't been tampered with."

**Step 5**: Show the AI case summary (if enabled in demo env)
- Open GRV-2026-001 → "Summarize Case"
- Show the AI output with confidence indicators
- **Key line**: "The AI summarizes the key facts and flags risks. It's advisory — Alex still makes the call. But it cuts meeting prep time by 45 minutes."

---

### Act 2: Diane the Executive Director (7 min)

**Step 6**: Switch to Diane Okafor account (executive director)

**Step 7**: Show executive dashboard
- Caseload by steward: Alex (5 cases), Steward B (3), Steward C (4)
- Type breakdown: 6 unjust suspension, 3 scheduling, 2 overtime, 1 accommodation
- **Key line**: "Diane has 12 stewards and 87 cases in a real local. This view replaces a manual report that took two days to compile before every board meeting."

**Step 8**: Show the pattern alert  
- "6 Article 12.3 cases in the last 90 days — all from Public Works"
- **Key line**: "This is intelligence. Diane's board had never seen a pattern like this before. It changes negotiation strategy."

**Step 9**: Show role isolation  
- "Diane sees all cases for CUPE Demo Local 99. But she cannot see cases from any other local."
- Open browser devtools → show network request returns only org-scoped results
- **Key line**: "Row-Level Security at the database level. Not just an application rule — a database enforced rule. One organization cannot see another's data, even on shared infrastructure."

---

### Act 3: James the IT Director (8 min)

**Step 10**: Open the Trust page (`/trust`)
- Walk through the controls table row by row
- Point at: Data residency ✅ Canadian, Encryption ✅ AES-256, Audit logging ✅ HMAC-sealed
- **Key line**: "Every row in this table has a proof path. We're not just saying it — we can show you the infrastructure."

**Step 11**: Show the HMAC-sealed audit log entry
- Navigate to audit log for GRV-2026-001
- Show the hash, timestamp, and event chain
- **Key line**: "Even Nzila can't delete a log entry without breaking the chain. That's what makes these admissible in arbitration."

**Step 12**: Share the vendor questionnaire
- "Here's our pre-filled security questionnaire. Your IT team can validate each answer."
- Hand off `docs/procurement/vendor-questionnaire.md`

**Step 13**: Handle SOC 2 / pen test question
- "We don't have SOC 2 yet — it's on our roadmap, and I won't pretend otherwise. We have continuous CI vulnerability scanning, but we're a startup and we're being honest with you. We're happy to book an architectural review with your team."

**Step 14**: Share the DPA  
- "The Data Processing Agreement is ready for your legal team to redline. One round of edits is typical."
- Hand off `docs/procurement/dpa.md`

---

### Closing (2 min)

> "What we've just seen: a steward filing and managing grievances 10× faster; an executive director with real-time caseload intelligence; and a security model designed for organizations that cannot afford a data breach. The pilot is 90 days, $12,000 CAD, and we handle onboarding. What questions do you have?"

---

## Common Objections During Demo

| Objection | Response |
|---|---|
| "We already use [competitor]" | "What does their data residency look like? Most labour software hosts in the U.S. Canadian data stays in Azure Canada Central here." |
| "We can't afford to change systems" | "The 90-day pilot is designed to fit alongside your current process. You don't have to commit to replacing anything on day one." |
| "Our stewards aren't tech-savvy" | "Alex's persona is based on real feedback. The mobile-first design was built for people who track grievances on their phone, not a laptop." |
| "We need to get board approval" | "Diane's board report export is designed exactly for that. You'll have data to bring to the board before the pilot ends." |

---

## After the Demo

1. Send the demo follow-up package:
   - `docs/commercial/pilot-offer-cupe.md` — pilot terms
   - `docs/procurement/vendor-questionnaire.md` — security questionnaire
   - `docs/procurement/dpa.md` — data processing agreement template
   - `docs/buyers/union-eyes-buyer-pack.md` — buyer pack

2. Schedule: IT security review session (James persona)
3. Schedule: Pilot kickoff call (Diane + Alex personas)
4. Log lead in CRM: source, org, contact, stage = "Demo Complete"
