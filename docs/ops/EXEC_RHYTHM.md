# Execution Rhythm — Daily / Weekly / Monthly Review Cadence

## Purpose

A structured operating cadence prevents the CEO/COO from operating in reactive mode. This document defines what to review, what decisions to make, who attends, and what output is expected at each cadence level.

**Route**: `/weekly-review`  
**File**: `apps/console/app/(dashboard)/weekly-review/page.tsx`

---

## The Three Cadences

### 1. Daily Ops (15 minutes, solo)

**When**: Every morning before 9 AM  
**Who**: Founder / CEO only  
**Format**: Stand-alone review — no meeting required

#### What to Review

| Item | Source | Action If Off |
|------|--------|---------------|
| Open critical alerts | `/command-center` Section B | Intervene same day |
| Urgent client items | Team ops queue | Assign + unblock |
| Overloaded team members | `/command-center` Section F | Redistribute tickets |
| Blocked initiatives | `/execution` page | Unblock by EOD |

#### Output
- Top 3 decisions or unblocks logged in Founder Priorities
- Any critical alerts marked resolved or escalated

---

### 2. Weekly Exec Review (60 minutes)

**When**: Every Monday 9 AM  
**Who**: CEO + COO + Product Lead (optional: Finance Lead)  
**Format**: Structured agenda, action items logged

#### What to Review

| Section | Metric Focus | Question to Answer |
|---------|-------------|---------------------|
| WoW Revenue | MRR change, new bookings | Are we growing this week? |
| Pipeline Movement | Deals advanced, proposals sent | What's moving toward close? |
| Churn Risk Watch | At-risk clients, missed check-ins | Who could churn this quarter? |
| Product Reliability | Incidents, open bugs, deploys | What's breaking and what shipped? |
| Team Load | Overloaded vs idle members | Do we need to rebalance? |

#### Output
- Written summary of weekly movement (WoW metrics captured)
- Renewal calls booked for any client within 60-day window
- Product reliability issues assigned to product owner with deadline
- Updated Founder Priorities for the week ahead

---

### 3. Monthly Board Review (90 minutes)

**When**: First Thursday of each month  
**Who**: CEO + COO + Finance Lead + Advisory Board members  
**Format**: Prepared deck + data from console; async read + 30-min live discussion

#### What to Review

| Section | Metric Focus | Benchmark |
|---------|-------------|-----------|
| Revenue & Retention | MRR, ARR, Churn Rate, NRR | MoM growth ≥ 5% |
| Client Health Cohort | Healthy vs At-Risk split | Healthy ≥ 75% |
| Monthly Wins | Deals closed, products shipped | ≥ 2 client wins |
| Key Risks | Active threats to revenue, product, or talent | Documented with mitigation |
| Roadmap Delivery | % of committed roadmap items shipped | ≥ 70% delivery rate |

#### Output
- Board update email sent ≤ 48 hours after session
- Risks logged with owners and deadlines
- Roadmap items updated in Execution tracker
- Rolling 90-day forecast refreshed in `/forecast`

---

## Cadence Health Signals

| Signal | Meaning | Action |
|--------|---------|--------|
| Daily ops skipped 3+ days | Team is reactive | Restore routine, clear urgent backlog |
| Weekly review < 45 min | Review is too shallow | Add product + financial depth |
| Monthly review postponed | Governance drift | Reschedule within 72 hours |
| No priorities logged for 5+ days | Founder bottleneck | Clear unblocks, add delegation |

---

## Implementation Notes

The `/weekly-review` page is a `'use client'` component because it uses `useState` for cadence tab switching:
- `'daily'` → DailyOpsView
- `'weekly'` → WeeklyExecView
- `'monthly'` → MonthlyBoardView

All data sections use placeholder patterns consistent with Command Center. Auth is enforced at the layout level (`apps/console/app/(dashboard)/layout.tsx`), so no explicit auth guard is needed in the client component.

---

## Related Links

| Link | Purpose |
|------|---------|
| [Command Center](/command-center) | Executive home — start here |
| [Execution](/execution) | Initiative and blocker tracking |
| [Portfolio](/portfolio) | Venture and product allocation |
| [Capital](/capital) | Burn + runway |
| [Client List](/itsm/clients) | Full client roster |
