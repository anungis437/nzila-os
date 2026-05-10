# Decision Layer for Agri / Trade Operations

## Target Buyer

| Role | Interest |
|------|----------|
| Export managers | Shipment risk management, trade documentation, margin protection |
| Cooperative leadership | Partner performance, commodity price monitoring, member operations |
| Trade operators | Real-time operational decision support, finance coordination |
| Agricultural analytics buyers | Data-driven commodity insights, anomaly-responsive operations |
| CFO / finance teams | Margin analysis, pricing anomaly review, financial governance |

## Top Pains

1. **Shipment risk is discovered too late** — logistic and compliance risks surface after shipment, not before
2. **Trade margin erosion is invisible** — pricing anomalies and cost variances accumulate without structured review
3. **Partner underperformance is tolerated** — SLA breaches and delivery failures lack structured follow-up mechanisms
4. **Commodity anomalies require fast coordination** — price swings and supply disruptions need cross-functional response
5. **Finance and export decisions are siloed** — CFO and trade operations lack a shared decision framework

## Decision Use Cases

### 1. Shipment Risk Review

**Trigger:** Anomaly Engine detects risk signal in shipment pipeline (compliance gap, documentation issue, route risk)
**Decision:** OPERATIONS review request for shipment risk assessment
**Evidence:** Shipment anomaly ref, compliance signal, route risk metrics
**Approvals:** Export manager, compliance officer
**Value:** Pre-shipment risk review with evidence trail instead of post-incident investigation

### 2. Trade Margin Warning

**Trigger:** Financial anomaly detected — pricing variance, cost escalation, margin compression
**Decision:** FINANCIAL review request for margin analysis
**Evidence:** Pricing anomaly ref, margin metrics, historical comparison
**Approvals:** CFO, trade operations lead
**Value:** Proactive margin management with structured CFO review

### 3. Partner Underperformance Action

**Trigger:** Partner performance drop detected — SLA breach, delivery failure, quality deviation
**Decision:** PARTNER follow-up recommendation with escalation path
**Evidence:** Partner performance anomaly ref, SLA metrics, delivery history
**Approvals:** Operations coordinator, partnership manager
**Value:** Systematic partner management with documented follow-up and escalation

### 4. Commodity Anomaly Response

**Trigger:** Commodity price or supply anomaly detected — price spike, supply disruption, quality variance
**Decision:** RISK escalation for cross-functional coordination
**Evidence:** Commodity anomaly refs, price trend data, supply chain signals
**Approvals:** Trade operations lead, procurement manager
**Value:** Coordinated cross-functional response to commodity disruptions with evidence trail

### 5. Finance / Export Coordination Decision

**Trigger:** Cross-app insight linking financial and export signals — currency risk, payment delay, documentation gap
**Decision:** OPERATIONS coordination recommendation
**Evidence:** Cross-app insight ref, financial signal, export signal
**Approvals:** CFO, export manager
**Value:** Unified finance-export decision view instead of siloed departmental responses

## Recommended Module Bundle

| Component | Role in Bundle |
|-----------|---------------|
| **Cora / Agrimo / Trade** | Core trade operations — commodity management, shipment tracking, partner management |
| **CFO** | Financial oversight — margin analysis, budget variance, financial anomaly review |
| **Control Plane** | Operational dashboard — decision review, anomaly overview, governance status |
| **Decision Layer** | Recommendation engine — evidence-backed trade and financial decisions |

## Proof / Governance Talking Points

- "Every shipment risk recommendation links to the exact anomaly detected — your export managers can verify the source data before acting."
- "Trade margin decisions include confidence scores. A 0.90 score means high confidence in the margin anomaly; your CFO reviews the evidence before any action."
- "Partner performance decisions include SLA breach evidence and historical trends. Follow-up actions are documented with timestamps."
- "The audit trail tracks every decision from commodity anomaly detection through operational response. This is the governance trail your auditors need."
- "Decision export packs can be included in trade compliance documentation and partner review packages."

## Pilot Entry Point

**45-day pilot: Agri/Trade Decision Layer**

| Parameter | Value |
|-----------|-------|
| Duration | 45 days |
| Decision categories | FINANCIAL, PARTNER, OPERATIONS |
| Review workflows | 2 (margin review, partner follow-up) |
| Proof deliverable | 1 decision export pack for trade compliance review |
| Cadence | Weekly decision review with operations and finance teams |
| Success metric | Time from anomaly to decision review; partner follow-up completion rate |
| Exit criteria | Trade operations team can independently review and act on Decision Layer recommendations |
