# Union Eyes Cognition — Commercial ROI

> Audience: union executives (President, Secretary-Treasurer, Director of Operations) evaluating Union Eyes for their local. Buyer narrative — every claim is backed by a measurable KPI in the product.

## The Problem We Solve

Unions today run their grievance, steward, and member-engagement work on top of email, spreadsheets, and tribal knowledge. The result is **predictable, expensive failure**:

- **Missed contractual deadlines** because nobody noticed a step-2 response window expired
- **Steward burnout** because the busiest 20% of stewards carry 60% of the work
- **Members quietly drift away** between contract cycles because nobody saw the silence
- **Precedent buried in old PDFs** so the same case gets re-litigated from scratch
- **No defensible numbers** to bring to the executive board, the membership, or arbitration

These are not technology problems. They are **operational visibility** problems. Union Eyes Cognition makes the invisible visible, with hard math.

## What Union Eyes Cognition Delivers (5 Modules, 10 KPIs)

### 1. Grievance Trajectory Intelligence
For every active grievance, a transparent **risk score** (low / medium / high / critical) plus **top-3 contributing factors** plus **one recommended next action** (hold steady, request status update, reassign to specialist, escalate to chief steward, prepare arbitration, request documentation).

| KPI | Formula |
|---|---|
| **Avg cycle time reduction %** | `(baseline − current) / baseline × 100` over rolling 30-day window |
| **Cases saved from SLA breach** | Operator-confirmed count of cases the early-warning surfaced before the deadline |
| **High-risk cases surfaced early** | Cases scored ≥0.6 probability while still within SLA |

### 2. Steward Workload Balancer
For every active steward, a **utilisation ratio**, a **status pill** (idle / balanced / busy / overloaded), an **at-risk-case count**, and an **SLA-risk score**. At the team level, a **fairness score** (1 − coefficient-of-variation of utilisation).

| KPI | Formula |
|---|---|
| **Steward utilisation balance improved %** | `(current_fairness − baseline_fairness) / baseline_fairness × 100` |
| **Cases reassigned before overload** | Operator-accepted reassignment recommendations |

### 3. Member Disengagement Risk
For every member with recent activity, a **disengagement probability**, an **engagement tier** (engaged / at-risk / disengaged / lost), a **recommended outreach channel** (member preference honoured first), and a **timing window**.

| KPI | Formula |
|---|---|
| **Member engagement recovery %** | `(disengaged_start − disengaged_end) / disengaged_start × 100` |
| **Disengaged member count** | Snapshot count of tier ∈ {disengaged, lost} |

### 4. Precedent Memory Engine
Given a new case, surfaces the **top-N similar past cases** (jaccard tag overlap × 0.6 + type match × 0.25 + successful-resolution bonus × 0.15) — **org-scoped only**; cross-org leakage is a runtime error.

| KPI | Formula |
|---|---|
| **Similar-case retrieval time saved (hours)** | `precedent_retrievals × 1.5h` (assumption surfaced to operator) |

### 5. Executive Health Summary
One screen for the executive board: backlog by tier, fairness score, disengaged count, top recommended interventions.

| KPI | Formula |
|---|---|
| **Backlog risk reduced %** | `(baseline − current) / baseline × 100` of mean grievance risk probability |
| **Estimated admin hours saved / month** | Sum of precedent + reassignment + early-warning hours |
| **Estimated ROI (CAD)** | `admin_hours_saved × loaded_hourly_rate ($65 default, configurable)` |

## Why Buyers Sign

1. **Defensible numbers.** Every KPI has a published formula and surfaces its assumptions. No "AI magic" — auditable arithmetic.
2. **No replacement of human judgement.** Every recommendation is advisory; every action requires a human override. This is non-negotiable in unionised environments.
3. **Org-scoped by construction.** Precedents, signals, and recommendations never leak across locals. The engine refuses cross-org reads at the type-system level.
4. **Honest nulls.** When source data is missing, KPI fields are `null` — not zero, not inferred. Operators see exactly what they have.
5. **Pilot-ready in 30 days.** Phase-1 ships read-only dashboards + KPI snapshots; the operator runs their normal workflow and the engine observes.

## Pricing & ROI Break-Even

Default loaded hourly rate: **CAD $65/hour** (representative of a mid-size local's blended steward + admin cost). Adjustable per buyer.

A typical local with **15 stewards** and **800 active members**:

- 4 precedent retrievals/week × 1.5h × 4w = **24h/month saved**
- 6 early-warning interventions/week × 0.75h × 4w = **18h/month saved**
- 2 accepted reassignments/week × 1.0h × 4w = **8h/month saved**
- **Total: 50h/month → CAD $3,250/month at $65/h**

A licence priced at < CAD $3,000/month/local is **immediately ROI-positive on hours alone**, before counting the avoided-arbitration and member-retention upside.

## What's Not in Phase 1 (Honest Roadmap)

- No automated outreach dispatch (advisory only)
- No automated reassignment writes (recommendation only)
- No member sentiment NLP (signals come from concrete behavioural events: response time, attendance, channel usage)
- No cross-org benchmarking (Phase 2, opt-in, anonymised)
