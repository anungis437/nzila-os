# Rollout Command Center

> **Owner:** Platform Owner  
> **Updated:** 2026-04-20  
> **Source of truth** for all active pilots, pipeline, delivery status, and case study progress.  
> Keep this file current. Out-of-date pipeline data is worse than no pipeline data.  
> CRO Dashboard (Tab 0) added — update weekly alongside the pipeline tabs.

---

## Tab 0 — CRO Dashboard

*Executive-level commercial health snapshot. Update every Monday. Do not skip.*

### Pipeline Health

| Metric | This Week | Last Week | 30-Day Avg | Target |
|--------|-----------|-----------|-----------|--------|
| Active prospects (Stage 1+) | — | — | — | 15+ |
| Meetings booked (cumulative MTD) | — | — | — | 4+/mo |
| Proposals sent (cumulative MTD) | — | — | — | 2+/mo |
| Pipeline value (gross, all stages) | $— | $— | — | $500K+ |
| Pipeline value (weighted by stage prob.) | $— | $— | — | $200K+ |
| Stage 5+ (proposal or beyond) | — | — | — | 2+ active |

### Conversion Rates (rolling 90 days)

| Funnel Step | Count | Rate | Benchmark |
|-------------|-------|------|-----------|
| Outreach → Positive reply | — / — | —% | 15–25% |
| Reply → Call completed | — / — | —% | 50–70% |
| Call → Proposal sent | — / — | —% | 40–60% |
| Proposal → Pilot signed | — / — | —% | 35–65% |
| Pilot → SaaS conversion | — / — | —% | 65–85% |

### Revenue Forecast

| Metric | Current | Q End Forecast | Annual Forecast | Scenario |
|--------|---------|---------------|----------------|---------|
| Active pilot ARR pipeline | $— | $— | — | — |
| Signed pilot fees (this quarter) | $— | $— | — | — |
| MRR (SaaS only) | $— | $— | — | Conservative / Base / Aggressive |
| ARR (SaaS only) | $— | $— | — | |
| Services revenue (this quarter) | $— | $— | — | |

Reference scenarios: `docs/gtm/REVENUE_MODEL_36_MONTHS.md`

### Pilot Health Matrix

| Org | Pilot Week | KPI Trend | Exec Engagement | Expansion Signal | Churn Risk | Conversion Probability |
|-----|-----------|-----------|----------------|-----------------|-----------|----------------------|
| — | — | — | — | — | Low / Med / High | —% |

**KPI Trend:** `On Track` / `Behind` / `Ahead`  
**Exec Engagement:** `Active` (exec involved in check-ins) / `Passive` (admin only) / `Dark` (no contact since kickoff)  
**Churn Risk:** Low (KPIs strong, exec engaged) / Medium (mixed signals) / High (KPIs behind + exec dark)

### Founder Time Allocation

*Honest weekly time split. If sales is < 30%, pipeline will stagnate.*

| Activity | Hrs This Week | % | Target % |
|----------|-------------|---|---------|
| Outreach + follow-up | — | —% | 15% |
| Calls + demos | — | —% | 10% |
| Proposal writing | — | —% | 5% |
| Pilot delivery + customer success | — | —% | 20% |
| Platform / product / engineering | — | —% | 40% |
| Admin / ops / finance | — | —% | 10% |
| **Total sales-related** | — | **—%** | **≥ 30%** |

**Rule:** If total sales-related time drops below 25% for two consecutive weeks, commercial velocity will stall. This is the earliest leading indicator of a pipeline problem.

### CAC Proxy (Founder Time)

*Until a finance system is in place, use founder hours as CAC.*

| Customer | Pilot Type | Founder Hours to Sign | Pilot Fee | Year 1 ACV | CAC Efficiency |
|----------|-----------|----------------------|----------|-----------|---------------|
| — | — | — hrs | $— | $— | — |

**CAC Efficiency formula:** Year 1 ACV ÷ (Founder hours × $150/hr equivalent) = multiplier  
Target: ≥ 3× (i.e., revenue ≥ 3× the opportunity cost of founder time to close)

### Alerts and Flags

| Flag | Condition | Status |
|------|-----------|--------|
| Pipeline stall | No Stage 3+ movement in 14 days | — |
| Conversion risk | Pilot entering Week 6 with no conversion conversation started | — |
| Churn risk | SaaS customer with declining usage or exec dark for 30+ days | — |
| Outreach drought | < 3 outreach messages sent in any 7-day window | — |
| Proposal delay | Demo completed > 3 days ago, no proposal sent | — |

---

## Tab 1 — Active Pilots

*Organizations currently in a live pilot engagement.*

| Org | Tier | Pilot Start | Pilot End | Pilot Captain | Stage | Current Week | SLA Status | Expand Signal | Notes |
|-----|------|------------|----------|--------------|-------|-------------|-----------|--------------|-------|
| — | — | — | — | — | — | — | — | — | |

**Stage values:** `Provisioning` → `Onboarding` → `Live` → `Reporting` → `Pilot Close` → `Decision Pending`

**SLA Status:** `Green` (all P0/P1 SLAs met) / `Amber` (P2 breach in last 7 days) / `Red` (P0 or P1 breach unresolved)

---

## Tab 2 — Sales Pipeline

*All prospects from first contact through pilot agreement signing.*

| # | Org | Sector | Contact | Stage | Value (Est.) | Next Step | Owner | Risk | Decision Date | Last Touch |
|---|-----|--------|--------|-------|-------------|----------|-------|------|--------------|-----------|
| 1 | Canadian Labour Congress | National Labour | — | 0-RESEARCH | $50K–100K+ | Research executive contact | — | Low intent signal | — | — |
| 2 | CUPE | National Labour | — | 0-RESEARCH | $50K–100K+ | Identify regional champion | — | Long procurement cycle | — | — |
| 3 | CAPE | National Labour | — | 0-RESEARCH | $20K–40K | Draft outreach message | — | — | — | — |
| 4 | PSAC | National Labour | — | 0-RESEARCH | $50K–100K+ | Research contact | — | Public sector procurement risk | — | — |
| 5 | Unifor | National Labour | — | 0-RESEARCH | $40K–75K | Research contact | — | — | — | — |
| 6 | ONA | Healthcare Labour | — | 0-RESEARCH | $20K–40K | Research contact | — | — | — | — |
| 7 | OECTA | Education Labour | — | 0-RESEARCH | $20K–40K | Research contact | — | — | — | — |
| 8 | OPSEU | Provincial Labour | — | 0-RESEARCH | $40K–75K | Research contact | — | — | — | — |
| ... | | | | | | | | | | |

**Stage definitions:**

| Stage | Description |
|-------|-------------|
| `0-RESEARCH` | Identified; contact not yet reached |
| `1-READY` | Message drafted, not sent |
| `2-SENT` | First message sent |
| `3-REPLIED` | Positive/neutral response received |
| `4-CALL-SCHEDULED` | Readiness briefing booked |
| `5-PROPOSAL-SENT` | Pilot tier proposal shared |
| `6-NEGOTIATING` | Commercial terms under discussion |
| `7-AGREEMENT-SIGNED` | Pilot agreement signed; moves to Active Pilots tab |
| `8-DECLINED` | Passed — add reason, revisit date |
| `9-PAUSED` | Timing issue; follow-up date set |

**Risk flags to use:**

- `Long procurement cycle` — public sector / large national body
- `No champion identified` — executive contact missing
- `Competing vendor` — known existing system in place
- `Budget unclear` — no indication of availability
- `Low intent signal` — contact reached but no engagement

---

## Tab 3 — Delivery

*Active pilot delivery milestones and open issues.*

| Org | Pilot Tier | Environment | Onboarding Status | Training Status | Data Migration | Open Issues | Next Milestone | Milestone Date |
|-----|-----------|------------|------------------|----------------|---------------|------------|---------------|---------------|
| — | — | — | — | — | — | — | — | — |

**Environment status:** `Provisioning` / `Active` / `Degraded` / `Closed`

**Training status:** `Not Started` / `Admin Complete` / `End-User Complete` / `Executive Complete`

**Data migration status:** `Not Required` / `Scoping` / `In Progress` / `Complete` / `Blocked`

---

## Tab 4 — Case Studies

*Track capture progress and publishing status for each completed pilot.*

| Org | Pilot Closed | Before Complete | During Complete | After Complete | Narrative Draft | Approval Status | Published | File |
|-----|-------------|----------------|----------------|---------------|----------------|----------------|---------|------|
| — | — | — | — | — | — | — | — | — |

**Approval Status:** `Not Started` / `Draft Sent` / `Changes Requested` / `Approved` / `Rejected`

**Published:** `No` / `Internal Only` / `Yes (Anonymous)` / `Yes (Named)`

Reference: `docs/gtm/case-study-capture.md` for capture template and publishing rules.

---

## Tab 5 — Product Requests

*Feature and integration requests from real buyer conversations. For product prioritization only — not a backlog.*

| Request | Source Org | Context | Priority | Status | Linked to App | Notes |
|---------|-----------|---------|---------|--------|--------------|-------|
| — | — | — | — | — | — | — |

**Priority:** `P1-Blocker` (pilot-blocking) / `P2-High` (mentioned by multiple prospects) / `P3-Nice-to-Have` (single request, exploratory)

**Status:** `Logged` / `In Assessment` / `Committed` / `Declined` / `Shipped`

**Rule:** Only add requests that came directly from a buyer or pilot conversation. No internal feature ideas go in this table.

---

## Weekly Ops Rhythm

Every Monday morning (15 minutes):

1. **Update Tab 1** — Mark any stage changes, update SLA status, note expansion signals
2. **Update Tab 2** — Log any outreach sent or responses received since last week
3. **Update Tab 3** — Confirm no open delivery issues are stale
4. **Flag blockers** — Anything P1 or above goes into the note below

### Open Blockers (clear when resolved)

| # | Blocker | Owner | Opened | Status |
|---|---------|-------|--------|--------|
| — | — | — | — | — |

---

## Monthly Review Agenda

First Monday of every month (30 minutes):

1. Pipeline: How many prospects moved stages? What's the conversion velocity?
2. Active pilots: Are we on track for exit decisions?
3. Case studies: Is capture happening? Any blocked by approval?
4. Product requests: Any P1-Blockers that need immediate engineering attention?
5. Pricing check: Are the rates in `ue-pricing-model.md` still accurate?
6. Focus check: Are we staying Tier 1 / Union Eyes first? (see `portfolio-focus.md`)

---

## Metrics to Track (Monthly)

| Metric | This Month | Last Month | Target |
|--------|-----------|-----------|--------|
| Prospects contacted | — | — | 5+ |
| Calls completed | — | — | 2+ |
| Proposals sent | — | — | 1+ |
| Active pilots | — | — | 1+ |
| Pilots converted to SaaS | — | — | 0 (Q2), 1 (Q3) |
| Pipeline ARR (estimated) | — | — | $200K+ by Q4 |

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-20 | CRO Dashboard (Tab 0) added — pipeline health, conversion rates, revenue forecast, pilot health matrix, founder time tracking, CAC proxy, flags | Platform Owner |
| 2026-04-20 | Initial command center created | Platform Owner |
