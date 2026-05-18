# UnionEyes — User Testing Plan

*Version: 1.0 | Created: 2026-05-17 | Phase: Pre-Pilot Product Validation*

---

## Purpose

This plan structures moderated usability testing of UnionEyes before the CAPE pilot goes live. The goal is to validate that all five platform roles can complete their core workflows without confusion, that permission boundaries are correctly enforced in the UI, and that the platform projects sufficient trust and credibility to a first-time union user.

**Success looks like:**

- Each tester profile completes ≥ 80% of their assigned tasks without facilitator intervention.
- No P0 blockers are outstanding before the pilot launch date.
- P1 issues are triaged and assigned within 48 hours of each session.
- At least 4 of 5 tester profiles report confidence in the platform after their session debrief.
- No tester encounters placeholder/fake data, broken pages, or cross-org data leaks.

Testing is conducted on the master seed dataset. Results are recorded in [USER_TESTING_RESULTS.md](./USER_TESTING_RESULTS.md).

---

## Test Environment

| Setting | Value |
|---------|-------|
| **Production URL** | `https://app.unioneyes.app` |
| **Local dev URL** | `http://localhost:3002` |
| **Auth method** | Entra ID SSO or magic-link fallback |
| **Seed dataset** | Master seed — `db/seeds/seed-master.sql` |
| **Demo data** | CAPE preset — seed via `/dashboard/pilot/onboarding` → **Seed Demo Data** |
| **Test password** | `NzilaTest2026!` (all test accounts unless noted) |
| **Locale** | `en-CA` (all URLs prefixed `/en-CA/`) |
| **Health check** | `GET /api/health` → `{ status: "ok" }` before each session |
| **Metrics check** | `GET /api/metrics/operational` → non-zero `active_grievance_count` |

**Pre-session checklist (facilitator runs before each session):**

1. `pnpm -C apps/union-eyes staging:seed` — confirm demo data is present
2. `curl http://localhost:3002/api/health` — confirm `status: ok`
3. `curl http://localhost:3002/api/metrics/operational` — confirm non-zero domain numbers
4. Clear browser cache / open private window for tester
5. Navigate to tester's entry URL (see each profile below)
6. Confirm the correct role is logged in (check top-right avatar / role badge)

---

## Tester Profiles

### Profile 1 — Union Executive (President / Leadership)

**System role:** `president` → Dashboard experience: `executive`

**What they CAN see:**
- Executive Overview dashboard (`/en-CA/dashboard`)
- Continuity Insights (aggregate KPI cards: active grievances, resolution rate, avg time to triage/resolution, arbitrations, overdue cases)
- Continuity Operations (casework activity, employer hotspots, LRO capacity charts)
- Governance Visibility panel
- Member Outcomes Ledger
- Leadership Continuity view
- Reports — PDF board summary, CSV detailed export
- Trust & Oversight panel

**What they CANNOT see:**
- Raw FSM / Workflow Builder
- System Status / Pilot Configuration
- Individual member personal records (beyond case context)
- Admin settings panel (`/dashboard/admin`)

**Test account:**
```
Email:    ue.qa.executive.primary@nzila.test
Password: NzilaTest2026!
User ID:  ue-qa-executive-primary
Org:      primary (CAPE-ACEP pilot org)
```

**Entry URL:** `http://localhost:3002/en-CA/dashboard`

---

### Profile 2 — Case Worker / LRO (Steward)

**System role:** `steward` → Dashboard experience: `staff`

**What they CAN see:**
- Casework Console (`/en-CA/dashboard/work`)
- Representation Cases (case queue, assigned cases, status badges)
- Commitments & Deadlines (SLA timelines)
- Members (member profiles for cases they are assigned to)
- Documents (case-linked documents)
- Communications (employer communication log for their cases)
- Institutional Reports (basic case reports)

**What they CANNOT see:**
- Executive Overview / Leadership Continuity
- Governance Visibility / Audit trail (full)
- System Status / Pilot Configuration / Admin
- Cases assigned to other stewards (unless escalated to them)
- Org-wide member roster (only case-context members)

**Test account:**
```
Email:    ue.qa.steward.primary@nzila.test
Password: NzilaTest2026!
User ID:  ue-qa-steward-primary
Org:      primary (CAPE-ACEP pilot org)
```

**Entry URL:** `http://localhost:3002/en-CA/dashboard/work`

---

### Profile 3 — Member / Intake (Self-Service)

**System role:** `member` → Dashboard experience: `member`

**What they CAN see:**
- Home (member portal landing)
- My Cases (own submissions only — no other members' cases)
- Open Representation Case (intake form: `/en-CA/grievances/new`)
- Messages (notifications for own cases)
- Documents (documents on own cases only)
- Profile & Settings

**What they CANNOT see:**
- Any other member's cases or profile
- Casework Console / Case queue
- Executive Overview / Leadership Dashboard
- Governance / Audit / Admin panels
- Navigation items: Continuity Insights, Governance Visibility, FSM, Workflow Builder, System Status

**Test account:**
```
Email:    ue.qa.member.primary@nzila.test
Password: NzilaTest2026!
User ID:  ue-qa-member-primary
Org:      primary (CAPE-ACEP pilot org)
```

**Entry URL:** `http://localhost:3002/en-CA/dashboard`

---

### Profile 4 — Governance / Compliance Auditor (Read-Only)

**System role:** `compliance_manager` → Dashboard experience: `governance`

**What they CAN see:**
- Governance Overview
- Trust & Explainability panel
- Continuity Review
- Policy Alignment
- Continuity Signals
- Audit & Evidence (read access to evidence packs, audit event log)
- Reports (export-capable if permitted by org policy)

**What they CANNOT see:**
- Raw FSM / Workflow Builder
- System Status
- Open Representation Case (cannot file grievances)
- Case mutation controls (no assign, no state transition, no note creation)
- Admin / User Management panels

**Test account:**
```
Email:    ue.qa.auditor.readonly@nzila.test
Password: NzilaTest2026!
User ID:  ue-qa-auditor-readonly
Org:      primary (CAPE-ACEP pilot org)
Metadata: readOnly: true, auditPersona: true
```

**Entry URL:** `http://localhost:3002/en-CA/dashboard/governance`

---

### Profile 5 — Procurement / Security Reviewer (External Evaluator)

**System role:** `member` (restricted, sandbox-isolated) → Dashboard experience: `member` (limited)

**Context:** This tester represents a procurement officer, security reviewer, or external stakeholder evaluating UnionEyes for institutional trust, compliance posture, and vendor credibility. They may have no prior union software context. They are given the sandboxed UX tester account.

**What they CAN see:**
- Health / status endpoint output (facilitator opens `/api/health` and `/api/metrics/operational`)
- Onboarding checklist view (`/dashboard/pilot/onboarding`) — read orientation
- Trust & Oversight indicators visible on executive dashboard (facilitator navigates)
- Amber/green status language in readiness docs
- Evidence export structural summary (`/api/evidence/export`)

**What they CANNOT see:**
- Real member data or live grievance records
- Admin or governance panels
- Any cross-org data

**Test account:**
```
Email:    ue.qa.ux.tester@nzila.test
Password: NzilaTest2026!
User ID:  ue-qa-ux-tester-001
Org:      ux-tester-isolated (sandboxed org)
Metadata: externalTester: true, monitored: true, sandboxOnly: true
```

**Entry URL:** `http://localhost:3002/en-CA/dashboard`

---

## Task Sets

Tasks are written at facilitator-instruction level. Read each task aloud to the tester exactly as written. Do not offer hints unless the tester is fully blocked for more than 90 seconds.

---

### Union Executive Tasks (Profile 1)

**Setup:** Tester is logged in as `ue.qa.executive.primary@nzila.test`. Start at `/en-CA/dashboard`.

| # | Task Instruction | Expected Outcome |
|---|-----------------|-----------------|
| 1 | "You've just logged in. Without any guidance from me, describe what you see on this screen and tell me what you think this page is for." | Lands on Executive Overview; recognises KPI cards; can name at least 3 of the 6 metrics |
| 2 | "Find all grievance cases that are currently active across the organisation and tell me how many there are." | Navigates to Continuity Operations or KPI card; identifies `active_grievance_count`; no broken data |
| 3 | "Assign the 'EC-06 Classification Dispute' case to an available LRO." | Navigates to case list or work surface; locates the case; uses Assign LRO control; assignment confirms |
| 4 | "Open the evidence timeline for the 'EC-06 Classification Dispute' case and describe the most recent event." | Opens case detail; navigates to timeline tab; reads last audit event without confusion |
| 5 | "Show me where you would look to find out if any cases are at risk of missing a deadline." | Opens Compliance Summary card or Overdue Cases KPI; identifies at-risk cases |
| 6 | "Export a PDF board summary of the current case status for a leadership meeting." | Uses Reports → Export; selects PDF; file downloads successfully; no error |
| 7 | "Change the organisation's display name or verify the current organisation settings without breaking anything." | Navigates to Admin → Organisation settings; reads/edits display field; saves without error |
| 8 | "Show me the pilot health score and tell me what it means." | Finds pilot health indicator (onboarding page or dashboard); reads score; interprets amber/green |

---

### Case Worker / LRO Tasks (Profile 2)

**Setup:** Tester is logged in as `ue.qa.steward.primary@nzila.test`. Start at `/en-CA/dashboard/work`.

| # | Task Instruction | Expected Outcome |
|---|-----------------|-----------------|
| 1 | "You've just logged in. Without any guidance from me, describe what you see and tell me what your first action would be." | Lands on Casework Console; identifies assigned work queue; understands case list |
| 2 | "Open the 'Unjust 5-Day Suspension' case and tell me its current status." | Navigates to case detail; reads status badge (Filed); no broken page |
| 3 | "Add a case note to the 'Unjust 5-Day Suspension' case that says: 'Contacted member to confirm incident date.'" | Opens case; finds Add Note control; types note; saves; note appears in timeline |
| 4 | "Advance the 'Ergonomic Assessment Refusal' case from 'Filed' to the next valid state in the workflow." | Opens case; uses state transition control; selects valid next state (Triage/Investigating); transition confirms |
| 5 | "Try to move the 'EC-06 Classification Dispute' case — currently in 'Investigating' — directly to 'Resolved' in one step." | FSM blocks the jump; system shows validation error or disabled transition; tester understands why |
| 6 | "Upload a supporting document to the 'Remote Work Accommodation Denial' case. You can use any small file on this machine." | Opens case; navigates to Documents tab; uploads file; file appears in document list |
| 7 | "Find the member profile for the person who filed the 'Unjust 5-Day Suspension' case and tell me their name." | Opens case; navigates to member profile link; reads member name; cannot access other members |
| 8 | "Check your workload — how many cases are currently assigned to you?" | Navigates to workload card or filtered case list; reads assigned case count |

---

### Member Tasks (Profile 3)

**Setup:** Tester is logged in as `ue.qa.member.primary@nzila.test`. Start at `/en-CA/dashboard`.

| # | Task Instruction | Expected Outcome |
|---|-----------------|-----------------|
| 1 | "You've just logged in. Without any guidance from me, describe what you see and tell me what this portal is for." | Lands on member home; understands this is their personal representation portal |
| 2 | "Submit a new grievance about an overtime pay calculation error that occurred on May 10, 2026. Fill in all required fields." | Navigates to Open Representation Case / `/en-CA/grievances/new`; completes form; submits; sees confirmation |
| 3 | "Find the status of the grievance you just submitted and tell me what it says." | Navigates to My Cases; locates new submission; reads status (Filed/Draft); no confusion |
| 4 | "Try to find another member's cases or the admin panel for the organisation." | Attempts navigation to forbidden areas; receives 403 / redirect / no visible nav items; cannot access |
| 5 | "Close the browser tab and re-open it. What happens to the grievance form you were filling in?" | Draft is preserved; Resume Draft modal appears on return; member can continue from where they left off |
| 6 | "Check your profile and confirm your name and contact details are correct." | Navigates to Profile & Settings; reads name and email; can identify how to edit |

---

### Auditor / Governance Reviewer Tasks (Profile 4)

**Setup:** Tester is logged in as `ue.qa.auditor.readonly@nzila.test`. Start at `/en-CA/dashboard/governance`.

| # | Task Instruction | Expected Outcome |
|---|-----------------|-----------------|
| 1 | "You've just logged in. Describe what you see and tell me what access you believe you have on this platform." | Lands on Governance Overview; understands read-only posture; can articulate governance scope |
| 2 | "Find the audit event log and tell me the last 3 events recorded in the system." | Navigates to Audit & Evidence; reads event log; no broken data; events are meaningful (not placeholders) |
| 3 | "Review the evidence pack for the most recently resolved case. Can you verify its integrity status?" | Navigates to sealed evidence; reads SHA-256 hash / HMAC status; understands sealed vs verified states |
| 4 | "Try to add a note to any open case." | Note creation control is absent or disabled; system returns 403 if attempted via direct navigation; read-only enforced |
| 5 | "Try to change the status of any case." | State transition control is absent or disabled; mutation blocked at UI level; no error shown inappropriately |
| 6 | "Export the audit event log or evidence summary for your records." | Uses export control in Audit & Evidence; file downloads (CSV or PDF); no error |
| 7 | "Show me the compliance summary — are there any cases with approaching deadlines?" | Navigates to Policy Alignment or Continuity Signals; reads deadline alerts; understands amber indicators |

---

### Procurement / Security Reviewer Tasks (Profile 5)

**Setup:** Facilitator navigates on screen; tester observes and asks questions. Tester may be given keyboard for specific tasks. Start at `/api/health` (raw JSON).

| # | Task Instruction | Expected Outcome |
|---|-----------------|-----------------|
| 1 | "This is the platform health endpoint. Tell me what you see and whether you trust it." | Reads `{ status: "ok" }` JSON; evaluates honesty of simple response; no internal error stack visible |
| 2 | "Now look at the operational metrics endpoint. What does this tell you about how the platform is being used?" | Views `/api/metrics/operational`; reads `active_grievance_count`, `sla_violations`, etc.; understands real-DB sourcing |
| 3 | "Look at the governance telemetry output. Does this platform audit its own access decisions?" | Views `/api/governance/telemetry`; reads `policy_denied_count`, `audit_event_volume`; evaluates auditability |
| 4 | "Navigate to the onboarding checklist. What does this tell you about how an organisation gets started?" | Opens `/dashboard/pilot/onboarding`; reads 7-item checklist; understands structured onboarding; identifies Demo Data Badge |
| 5 | "Here is the platform's readiness status document. Read the 'What remains amber' section aloud." | Facilitator opens `FINAL_READINESS_STATUS.md`; tester reads amber items; evaluates vendor honesty |
| 6 | "Run an evidence export and tell me whether you'd trust this output in an arbitration hearing." | Facilitator runs `evidence:all`; opens `/api/evidence/export`; tester evaluates SHA-256 hash, HMAC signature, structure |
| 7 | "Look at the organisation isolation section. How is data separated between different unions?" | Facilitator opens `ORG_SCOPE_AUDIT.md`; tester reads three enforcement layers (edge, ORM, database RLS); evaluates posture |

---

## Success Criteria

A task is considered **PASS** when all of the following are true:

| Criterion | Detail |
|-----------|--------|
| **Completion** | Tester reaches the expected outcome without facilitator intervention |
| **No broken pages** | No 500 errors, blank screens, or unhandled exceptions during the task |
| **No fake / placeholder data** | All visible data is seeded realistically; no "Lorem ipsum", test IDs exposed, or `undefined` values |
| **Correct permission enforcement** | Forbidden actions are blocked at the UI level (controls absent or disabled), not just server-side; no accidental data leaks |
| **Trust indicators present** | Sealed evidence shows hash/HMAC; audit events are present; health endpoint returns clean JSON |
| **Completion without significant confusion** | Tester hesitates for no more than 30 seconds on any single step; does not require more than one facilitator prompt |

A task is **FAIL** if:
- Tester cannot complete it after two facilitator prompts, OR
- A P0/P1 issue is encountered that blocks or significantly misleads the tester.

---

## Session Format

| Setting | Value |
|---------|-------|
| **Duration** | 30–45 minutes per tester (tasks) + 5 min debrief |
| **Protocol** | Think-aloud — tester narrates their reasoning while navigating |
| **Recording** | Screen capture + audio; verbal consent required before recording begins |
| **Observer** | One note-taker per session; records hesitation points, unexpected clicks, and verbatim quotes |
| **Facilitator script** | "Please think out loud as you work. There are no wrong answers — we're testing the software, not you. If you get stuck, keep trying for a moment before I step in." |
| **Debrief questions** | 1) What was most confusing? 2) What felt trustworthy? 3) Is there anything you expected to see that wasn't there? 4) Would you recommend this to your local? |
| **Notes format** | Capture task number, hesitation point, quote, and severity estimate in real time |

---

## Issue Severity Rubric

| Level | Label | Definition | Required Action |
|-------|-------|------------|-----------------|
| **P0** | Blocker | Tester cannot complete the task at all; crash, 500 error, or missing critical control | Fix before pilot launch |
| **P1** | Serious | Task completes but with significant confusion, wrong data displayed, or incorrect permission enforcement | Fix within 48 hours of session |
| **P2** | Improvement | Task completes; UX friction, missing context/label, or confusing terminology | Prioritise for Sprint N+1 |
| **P3** | Polish | Task completes smoothly; minor label, copy, or aesthetic issue | Backlog; address before GA |

---

## Schedule Template

| Session | Date | Tester Profile | Facilitator | Status |
|---------|------|---------------|-------------|--------|
| Session 1 | TBD | Profile 1 — Union Executive | TBD | SCHEDULED |
| Session 2 | TBD | Profile 2 — Case Worker / LRO | TBD | SCHEDULED |
| Session 3 | TBD | Profile 3 — Member / Intake | TBD | SCHEDULED |
| Session 4 | TBD | Profile 4 — Governance Auditor | TBD | SCHEDULED |
| Session 5 | TBD | Profile 5 — Procurement / Security Reviewer | TBD | SCHEDULED |

---

*Results from all sessions are recorded in [USER_TESTING_RESULTS.md](./USER_TESTING_RESULTS.md).*
*For pilot scope and success metrics, see [PILOT_SCOPE.md](./PILOT_SCOPE.md).*
*For the demo script, see [CAPE-DEMO-FLOW.md](./CAPE-DEMO-FLOW.md).*
