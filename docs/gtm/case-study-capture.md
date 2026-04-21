# Union Eyes — Case Study Capture System

> **Purpose:** Systematic capture of pilot evidence for use in commercial outreach, investor briefings, and product validation.
> **When to start:** Day 1 of every pilot. Do not wait until the pilot is over.
> **Owner:** Customer Success + Pilot Captain

---

## How to Use This System

One file per pilot organization. Copy the template below to:

```
docs/gtm/case-studies/[org-slug]-[year].md
```

Example: `docs/gtm/case-studies/cupe-local-2026.md`

Fill in each section progressively:
- **Before** section: completed during Week 1 intake call
- **During** section: updated weekly throughout the pilot
- **After** section: completed within 5 days of pilot close

No section should be left blank. If data is unavailable for a field, write "Not captured" so the gap is visible.

---

## Evidence Sources (per pilot)

All quantitative data in case studies must be traceable to a system source:

| Data Point | Source |
|-----------|--------|
| Case volume | `POST /api/cases` — `cases_created` metric |
| Time to first response | `POST /api/workflow/transition` — `avg_time_to_first_response` |
| Case resolution time | `POST /api/workflow/transition` — `avg_time_to_resolution` |
| SLA compliance rate | `POST /api/cron/sla-watchdog` — `sla_compliance_rate` |
| Evidence packs exported | `GET /api/cases/[caseId]/export` — `evidence_pack_exports` |
| Workflow completion | `POST /api/workflow/transition` — `workflow_transition_success_rate` |
| Rep workload | Platform metrics — `per_rep_case_load` |
| Active user count | Platform admin metrics — session log |

Reference: `docs/union-eyes/pilot-kpis.md` for full instrumentation spec.

Qualitative data (stakeholder quotes, satisfaction scores) must be collected via structured calls — not inferred.

---

## Case Study Template

---

### [ORG NAME] — Pilot Case Study

**Status:** `IN-PROGRESS` | `COMPLETE` | `EMBARGOED`
**Pilot tier:** Discovery / Controlled / Production
**Duration:** [Start Date] → [End Date]
**Pilot contact:** [Name, Role]
**Nzila pilot captain:** [Name]
**Publishable?:** Yes / No / With approval / Anonymous only

---

#### Before — Baseline State

*Capture during Week 1 intake call. This is the "before" story.*

**Current workflow:**
- How does a grievance enter the system today? (email, paper form, verbal, other)
- Who receives it first? (steward, admin, officer?)
- Where is it tracked? (spreadsheet, shared drive, email thread, system name?)
- How is it assigned to a rep?
- How does a member find out the status of their case?

**Pain points (in their own words):**
- Primary complaint #1:
- Primary complaint #2:
- Primary complaint #3:

**Quantified baseline (if known — estimate is acceptable):**

| Metric | Current Value | Source / Confidence |
|--------|--------------|---------------------|
| Active open cases at pilot start | — | Admin count / estimate |
| Average time to first response (days) | — | Estimate from staff |
| Average time to case resolution (days) | — | Estimate from staff |
| % cases lost or undocumented per year | — | Estimate |
| Hours per week spent on case admin | — | Staff estimate |
| Hours per arbitration to prep evidence | — | LRO estimate |

**Reported frustrations:**
- Executive perspective:
- Rep/steward perspective:
- Admin perspective:
- Member perspective (if available):

**Data fragmentation:**
- Where does case data currently live? (list all systems and tools)
- Are there cases with no digital record?
- Is evidence stored in a defensible, retrievable way?

**Reporting gaps:**
- Can the executive team see case status in real time?
- Is SLA compliance tracked?
- Is there a process for escalation that leaves a traceable record?

---

#### During — Adoption Metrics

*Updated weekly throughout the pilot. Do not wait until the end.*

**Week-by-week snapshot:**

| Week | Cases Created | Active Users | SLA Compliance | Evidence Packs | Notes |
|------|-------------|-------------|----------------|---------------|-------|
| 1 | — | — | — | — | |
| 2 | — | — | — | — | |
| 3 | — | — | — | — | |
| 4 | — | — | — | — | |
| ... | | | | | |
| Final | — | — | — | — | |

**Adoption observations:**

- Which user roles adopted earliest?
- Which features had the most engagement?
- Which features had the least engagement?
- Were there confusion points that required extra support?
- What support requests were opened (count and category)?

**Workflow completion:**
- % of cases progressing through full lifecycle:
- % of cases stalled at which stage:

**Stakeholder feedback (collected mid-pilot — Week 3–4 call):**
- Executive sponsor: "..."
- Lead steward/rep: "..."
- Admin: "..."
- Member (if accessible): "..."

**Issues / incidents:**
| Date | Issue | Severity | Resolution | Time to Resolve |
|------|-------|---------|-----------|----------------|
| — | — | — | — | — |

---

#### After — Outcomes

*Completed within 5 business days of pilot close.*

**KPI Summary:**

| Metric | Before (Baseline) | After (Pilot End) | Delta | % Change |
|--------|------------------|------------------|-------|---------|
| Avg time to first response | — | — | — | — |
| Avg case resolution time | — | — | — | — |
| SLA compliance rate | — | — | — | — |
| Open cases with documented trail | — | — | — | — |
| Evidence packs generated | — | — | — | — |
| Rep hours per week on admin | — | — | — | — |
| Hours to prep for one arbitration | — | — | — | — |

**Leadership visibility:**
- Before: [Description of executive visibility into case status]
- After: [Description of executive access during pilot — real-time dashboard, weekly reports, etc.]

**Time saved:**
- Total estimated rep-hours saved during pilot period:
- Methodology: [how calculated]

**Incidents reduced:**
- Were any governance failures, escalation failures, or compliance risks surfaced and addressed?
- Were any cases that would have been lost documented and resolved?

**Readiness to expand:**
- Is the organization ready to move to SaaS?
- What modules or features were not included in the pilot that would add additional value?
- What integrations would unlock additional workflow improvement?

**Conversion decision:**
- Outcome: Converted to SaaS / Extended pilot / Paused / Declined
- If converted: SaaS tier selected, contract value, start date
- If paused or declined: reason noted, follow-up date set

**Publishable quote (with permission):**
> "[Quote in their words — exact, not paraphrased]"
> — [Name, Role, Organization] (if permission to attribute; otherwise "a [sector] union representing [X] members")

---

#### Case Study Narrative Draft

*Written after "After" section is complete. Used for outreach, pitch materials, and product validation.*

**Headline (fill in):**
> How [ORG TYPE] modernized [KEY OUTCOME] in [DURATION]

**Example:**
> How a provincial public sector union reduced grievance response time by 40% in 60 days

**Narrative structure (200–300 words):**

1. **Context** — one paragraph: who they are, scale, and what they needed
2. **Challenge** — one paragraph: what was broken and what was at risk
3. **Engagement** — one sentence: what tier they chose and why
4. **Outcome** — one paragraph: what changed, with specific numbers
5. **Quote** — one attributed quote from executive or pilot champion
6. **What's next** — one sentence: expansion or conversion decision

---

## Publishing Rules

Before any case study content is used externally:

- [ ] Written sign-off from pilot organization contact
- [ ] Agreement on attribution level (named, sector-anonymous, or fully anonymous)
- [ ] Review by Platform Owner
- [ ] Version stored in `docs/gtm/case-studies/[org-slug]-[year].md`

Do not publish KPI numbers that cannot be traced to instrumentation data.
Do not attribute quotes without explicit written permission.

---

## Case Study Index

| Organization | Tier | Status | Publishable | File |
|-------------|------|--------|------------|------|
| — | — | — | — | — |

*Update this table as pilots complete.*
