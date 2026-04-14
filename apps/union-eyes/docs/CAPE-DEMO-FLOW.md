# CAPE Demo Flow

**Duration:** ~7 minutes
**Audience:** CAPE leadership, prospective pilot teams
**Presenter:** Nzila sales / solutions engineer

---

## Pre-Demo Setup

1. Seed demo data via `/dashboard/pilot/onboarding` → **Seed Demo Data**
2. Verify LRO-led representation protocol is active
3. Open browser tabs:
   - Tab 1: `/grievances/new` (intake form)
   - Tab 2: `/dashboard/work` (active casework surface)
   - Tab 3: `/dashboard/leadership` (leadership dashboard)
   - Tab 4: `/dashboard/pilot/onboarding` (onboarding checklist)

---

## Demo Sequence

### Beat 1 — Pilot Onboarding (1 min)

**Show Tab 4:** `/dashboard/pilot/onboarding`

> "When CAPE starts a pilot, this is the first screen your team sees. A 7-step guided checklist walks you through setup — organization seeded, users invited, roles assigned, agreements uploaded, employers imported, integrations configured, and export verified."

- Point out the progress bar ("3 of 7 steps completed")
- Show the Demo Data Badge — "One click to seed realistic demo data"
- Show the Training Links Panel — "Built-in training resources for LROs"

---

### Beat 2 — Filing a Grievance (2 min)

**Show Tab 1:** `/grievances/new`

> "An LRO files a grievance in under 2 minutes. The form captures everything — member, case type, priority, title, description, incident date, witnesses, desired outcome."

- Fill in the form with a demo grievance (EC-06 Classification Dispute)
- Point out the **auto-save**: "If the LRO closes their browser mid-form, the draft is preserved. When they return, a Resume Draft modal lets them pick up exactly where they left off."
- Submit the intake / filing flow
- Show the confirmation / redirect to case detail

---

### Beat 3 — Case Queue & Assignment (1 min)

**Show Tab 2:** `/dashboard/work`

> "Official casework is managed in the Work surface. Notice the labels say 'Assign LRO' — not 'Assign Steward.' CAPE's LRO-led representation model is configured at the organization level. The system adapts terminology, assignment rules, and escalation paths automatically."

- Show the case we just filed in the queue
- Point out status badges (Filed, Investigating, Mediation, Arbitration)
- Show the LRO workload cards — "Leadership can see at a glance who has capacity"

---

### Beat 4 — Leadership Dashboard (2 min)

**Show Tab 3:** `/dashboard/leadership`

> "CAPE officers see real-time KPIs without asking anyone for a report."

Walk through the 6 KPI cards:

1. **Active Grievances** — "8 active grievance files across all statuses"
2. **Resolved This Month** — "1 case resolved with trend indicator"
3. **Avg. Time to Triage** — "3.2 days from filing to first action"
4. **Avg. Time to Resolution** — "45 days average"
5. **Arbitrations** — "1 case currently in arbitration"
6. **Overdue Cases** — "Cases where deadlines are at risk"

> "Below the KPIs, you see employer hotspots — which employers generate the most grievances — and LRO capacity charts showing who has room for additional casework."

- Show the **Employer Hotspots Table** — Treasury Board, CRA, PSPC, Statistics Canada
- Show the **Compliance Summary Card** — alerts for approaching deadlines
- Show **Export** — "One click to generate a PDF board summary or CSV for detailed analysis"

---

### Beat 5 — Evidence & Audit Trail (1 min)

> "Every action in UnionEyes is audited. Grievance filed, draft saved, case assigned, communication logged — 14 distinct event types are captured with full metadata."
>
> "When a case is resolved, the system generates a sealed evidence pack — SHA-256 hash, HMAC signature, Azure Blob storage. This is the kind of audit trail that holds up in arbitration."

- Reference the compliance summary card for audit visibility
- Mention evidence lifecycle: draft → sealed → verified

---

### Beat 6 — Closing & Next Steps (30 sec)

> "This is a live platform, not a slide deck. Everything you just saw is how your team would actually use it. The pilot playbook gives you a 4-week plan — Week 0 for setup, Weeks 1–3 for real-world use, Week 4 for evaluation."

- Point back at the onboarding checklist as the starting point
- Mention the health scoring system — "The platform monitors pilot health automatically and flags if adoption drops"

---

## Demo Data Cleanup

After the demo:

1. Navigate to `/dashboard/pilot/onboarding`
2. Click **Purge Demo Data** on the Demo Data Badge
3. Confirm purge

---

## Key Talking Points

| Question | Answer |
|----------|--------|
| "How does this handle CAPE's LRO model?" | Representation protocol is configurable — CAPE uses the LRO-led preset (auto-assigns to LROs, uses LRO terminology, escalates to Senior LRO → Director) |
| "Can officers see data across units?" | Organization isolation is enforced at 3 layers — edge, ORM, and database RLS. Officers see only their org's data. |
| "What about mobile?" | The web app is responsive. No dedicated mobile app currently, but all workflows work on mobile browsers. |
| "How long does setup take?" | The 7-item onboarding checklist typically takes 2–3 days. Nzila provides hands-on support. |
| "What happens after the pilot?" | Week 4 go/no-go evaluation. If go: purge demo data, import real members, scale to full org. |

---

*For technical details, see the [CAPE Pilot Audit Report](./CAPE-PILOT-AUDIT-REPORT.md). For the full pilot plan, see the [CAPE Pilot Playbook](./CAPE-PILOT-PLAYBOOK.md).*
