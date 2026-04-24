# Metrics Dictionary — Command Center

> Every metric on the Command Center screen is listed here with its formula, data source, why it matters, and the decision it drives.

---

## Revenue Pulse Metrics

### Active Clients

- **Display**: Count of active client accounts
- **Formula**: `COUNT(opsClients) WHERE onboardingStage = 'live'`
- **Data Source**: `opsClients.onboardingStage`
- **Why It Matters**: The base denominator for all ARR, churn, and NRR calculations
- **Decision It Drives**: Is the active book growing MoM? Triggers investor update cadence

---

### ARR Proxy

- **Display**: ZAR annual sum (e.g., R 1.2M)
- **Formula**: `SUM(opsClients.contractValue)` across active clients
- **Data Source**: `opsClients.contractValue`
- **Why It Matters**: Single-number revenue health signal without a formal billing system
- **Decision It Drives**: Burn vs runway calculation; fundraising readiness

---

### MRR Proxy

- **Display**: ZAR monthly equivalent
- **Formula**: `ARR_Proxy / 12`
- **Data Source**: Derived from `opsClients.contractValue`
- **Why It Matters**: Monthly cash inflow estimate for operational planning
- **Decision It Drives**: Hiring decisions, sprint budget, vendor commitments

---

### Renewals (90 Days)

- **Display**: Count of clients with renewal in next 90 days
- **Formula**: `COUNT(opsClients) WHERE renewalDate BETWEEN NOW() AND NOW() + INTERVAL '90 days'`
- **Data Source**: `opsClients.renewalDate`
- **Why It Matters**: 90-day window is the minimum lead time for renewal negotiation
- **Decision It Drives**: Which clients to call this week; which deals need proposals now

---

### Churn Risk

- **Display**: Count of at-risk clients
- **Formula**: `COUNT(opsClients) WHERE health IN ('at_risk', 'churned')`
- **Data Source**: `opsClients.health`
- **Why It Matters**: Real-time retention signal — high churn risk erodes ARR within the quarter
- **Decision It Drives**: Triggers CSM intervention; may flag product quality issues

---

### Open Tickets

- **Display**: Count of unresolved support tickets
- **Formula**: `COUNT(itsmTickets) WHERE resolvedAt IS NULL`
- **Data Source**: `itsmTickets.resolvedAt`
- **Why It Matters**: Team load proxy and client experience signal
- **Decision It Drives**: Team resourcing; SLA breach prevention

---

## Smart Alert Metrics

### Alert Volume by Type

- **Display**: Grouped count of active (unresolved) alerts
- **Formula**: `COUNT(commandAlerts) WHERE resolvedAt IS NULL GROUP BY type`
- **Data Source**: `commandAlerts`
- **Why It Matters**: Surfacing the pattern of alerts (e.g., all renewal risk vs all onboarding stall) changes the response type
- **Decision It Drives**: Whether this is a product problem, a sales problem, or a CS process problem

---

### Alert Severity Breakdown

- **Display**: Count by severity (critical / high / medium)
- **Data Source**: `commandAlerts.severity`
- **Why It Matters**: Severity determines urgency of response — critical = same day, high = 48h, medium = weekly review
- **Decision It Drives**: Determines agenda priority for daily ops review

---

## Client Health Metrics

### Health Score (per client)

- **Display**: 0–100 composite score
- **Formula**: Internal scoring from `opsClients.healthScore` (set by CS team or automated rule)
- **Data Source**: `opsClients.healthScore`
- **Why It Matters**: Leading indicator — declining score precedes churn by 30–60 days
- **Decision It Drives**: When to escalate to founder-led relationship

---

### Health Status

- **Display**: Label (Healthy / Needs Attention / At Risk / Churned)
- **Formula**: Thresholds: Healthy ≥ 80, Needs Attention 60–79, At Risk < 60
- **Data Source**: `opsClients.health`
- **Why It Matters**: Categorical label enables portfolio-level health reporting
- **Decision It Drives**: CSM weekly agenda; renewal strategy adjustment

---

### Open Ticket Count (per client)

- **Display**: Integer count per client card
- **Formula**: `COUNT(itsmTickets) WHERE clientId = :clientId AND resolvedAt IS NULL`
- **Data Source**: `itsmTickets`
- **Why It Matters**: High open count on a single client is a churn risk signal
- **Decision It Drives**: Whether to trigger a "white glove" support session

---

## Product Health Metrics

### Incidents This Month

- **Display**: Integer per product
- **Source**: `productHealthSnapshots.incidentsThisMonth`
- **Why It Matters**: Direct product quality signal. SLA compliance is at risk if incidents ≥ 3/month
- **Decision It Drives**: Release freeze consideration; P1 engineering allocation
- **Alert Threshold**: ≥ 3 → red indicator

---

### Support Load (Open Tickets per Product)

- **Display**: Integer per product
- **Source**: `productHealthSnapshots.supportLoad`
- **Why It Matters**: High support load signals product UX gaps or missing documentation
- **Decision It Drives**: Whether to prioritize bug fixes over new features
- **Alert Threshold**: ≥ 4 → amber indicator

---

### Deployments Shipped

- **Display**: Integer per product
- **Source**: `productHealthSnapshots.deploymentsShipped`
- **Why It Matters**: Positive velocity signal — are we shipping improvements to clients?
- **Decision It Drives**: Demonstrates product momentum in renewal conversations

---

### Open Bugs

- **Display**: Integer per product
- **Source**: `productHealthSnapshots.openBugs`
- **Why It Matters**: Accumulating tech debt erodes client trust and increases support load
- **Decision It Drives**: Sprint planning priority; engineering allocation
- **Alert Threshold**: ≥ 5 → red indicator

---

## Founder Priority Metrics

### Priority Type Distribution

- **Display**: Icon + label per item (Renewal / Incident / Proposal / Risk / Ops)
- **Source**: `founderPriorities.type`
- **Why It Matters**: Mix of priority types reveals where the founder's time is being spent
- **Decision It Drives**: If too many "Ops" items → delegation opportunity; if too many "Incident" → product investment decision

---

### Priority Due Date

- **Display**: Relative date ("today", "3 days", "overdue")
- **Source**: `founderPriorities.dueDate`
- **Why It Matters**: Time pressure on CEO actions can delay client value delivery
- **Decision It Drives**: Daily ops sequencing

---

## Team Load Metrics

### Open Ticket Count (per team member)

- **Display**: Integer + visual load bar per member
- **Formula**: `COUNT(itsmTickets) WHERE assignedTo = :memberId AND resolvedAt IS NULL`
- **Data Source**: `itsmTickets.assignedTo`
- **Why It Matters**: Identifies overloaded vs idle team members in real time
- **Decision It Drives**: Same-day rebalancing; sprint capacity planning

---

### Overloaded Threshold

- **Display**: "Overloaded" badge on member card
- **Threshold**: ≥ 10 open tickets
- **Decision It Drives**: Immediate redistribution or escalation

---

### Overdue Tickets (per team member)

- **Display**: "X overdue" badge
- **Formula**: `COUNT(itsmTickets) WHERE assignedTo = :memberId AND dueDate < NOW() AND resolvedAt IS NULL`
- **Data Source**: `itsmTickets.dueDate`
- **Why It Matters**: Overdue tickets indicate either poor estimates, blockers, or capacity issues
- **Decision It Drives**: 1-on-1 conversation to unblock; re-assign if capacity-blocked

---

## Portfolio Allocation Metrics (7-Dimension Scoring)

All sourced from `productHealthSnapshots` and internal scoring in the portfolio page.

| Dimension | Direction | Threshold (Double Down) |
|-----------|-----------|------------------------|
| Revenue Potential | Higher = better | ≥ 75 |
| Client Demand | Higher = better | ≥ 70 |
| Product Maturity | Higher = better | ≥ 60 |
| Market Differentiation | Higher = better | ≥ 65 |
| Support Burden | Lower = better (inverted in display) | ≤ 30 |
| Founder Energy | Higher = better | ≥ 70 |
| Strategic Fit | Higher = better | ≥ 80 |

**Recommendation Engine**:

- `double_down`: All key dimensions strong, high strategic fit
- `maintain`: Stable but not prioritized for heavy investment
- `incubate`: Early-stage, high upside, needs structured milestones
- `wind_down`: Negative ROI trend, low demand, founder energy depleted

---

## Weekly Review Metrics

### WoW MRR Change

- **Formula**: `(currentMonthMRR - previousMonthMRR) / previousMonthMRR * 100`
- **Decision**: Is the business growing week-over-week?

### WoW Active Client Change

- **Formula**: `currentActiveClients - previousWeekActiveClients`
- **Decision**: Gross adds vs churns this week

### Pipeline Movement

- **Display**: Count of deals advanced + proposals sent this week
- **Decision**: Is the sales process moving?

### Churn Risk Watch

- **Display**: Clients with health declining + no engagement in 14 days
- **Decision**: Which clients need a founder call this week?

### Product Reliability Score

- **Formula**: `100 - (incidents * 10) - (openBugs * 2)`
- **Decision**: Gate to deploy new features; signals investment priority

---

## Metric Naming Conventions

| Term | Meaning |
|------|---------|
| Proxy | Estimated value (no formal billing system yet) |
| Snapshot | Point-in-time capture (not live aggregation) |
| ZAR | South African Rand — all financial values |
| WoW | Week-over-week |
| MoM | Month-over-month |
| ARR | Annual Recurring Revenue |
| MRR | Monthly Recurring Revenue |
| NRR | Net Revenue Retention |
| CSM | Customer Success Manager |
| P1 | Priority 1 (production-down incident) |
