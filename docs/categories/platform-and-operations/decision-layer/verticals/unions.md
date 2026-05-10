# Decision Layer for Union Operations

## Target Buyer

| Role | Interest |
|------|----------|
| Union administration leadership | Operational efficiency, steward management, grievance throughput |
| Labour relations leadership | Employer risk monitoring, arbitration trend management |
| Executive directors | Strategic operational oversight, boardroom-ready evidence |
| Governance / risk leadership | Compliance posture, audit readiness, policy enforcement |

## Top Pains

1. **Grievance backlogs grow silently** — steward capacity constraints are invisible until backlogs become crises
2. **Employer risk escalation is reactive** — leadership learns about employer hotspots after incidents, not before
3. **Arbitration decisions lack evidence trail** — no structured link between anomaly detection and arbitration review
4. **Leadership briefings are manually assembled** — operational data is scattered across apps and reports
5. **Governance posture is hard to prove** — procurement and regulatory reviews demand evidence that is expensive to compile

## Decision Use Cases

### 1. Steward Capacity Balancing

**Trigger:** Grievance backlog anomaly detected by the Anomaly Engine
**Decision:** STAFFING recommendation to reassign stewards to high-volume regions
**Evidence:** Grievance spike anomaly ref, backlog count, regional distribution
**Approvals:** Union admin, regional coordinator
**Value:** Proactive capacity management instead of reactive crisis response

### 2. Employer Hotspot Escalation

**Trigger:** Employer risk score increase detected across multiple signals
**Decision:** RISK escalation to labour relations leadership
**Evidence:** Anomaly refs, employer risk trend data, historical grievance patterns
**Approvals:** Labour relations director
**Value:** Early intervention before employer issues become formal disputes

### 3. Arbitration Risk Review

**Trigger:** Compliance deviation detected in union-eyes
**Decision:** COMPLIANCE review request for arbitration risk assessment
**Evidence:** Compliance anomaly ref, deviation metrics, policy context
**Approvals:** Legal counsel, governance lead
**Value:** Structured arbitration risk assessment with audit-ready evidence

### 4. Grievance Backlog Prioritisation

**Trigger:** Multiple grievance-related anomalies across regions
**Decision:** OPERATIONS prioritisation of grievance processing queue
**Evidence:** Cross-app insight refs, signal trend data, steward availability
**Approvals:** Operations coordinator
**Value:** Data-driven prioritisation instead of ad-hoc queue management

### 5. Leadership Briefing Recommendation

**Trigger:** Governance state change or threshold breach
**Decision:** GOVERNANCE review request with executive summary
**Evidence:** Governance snapshot, anomaly summary, signal trends
**Approvals:** Executive director
**Value:** Boardroom-ready briefing backed by platform evidence

## Recommended Module Bundle

| Component | Role in Bundle |
|-----------|---------------|
| **UnionEyes** | Core union operations app — grievance management, steward tracking, employer monitoring |
| **Control Plane** | Operational dashboard — decision review, governance status, intelligence overview |
| **Decision Layer** | Recommendation engine — evidence-backed decisions with approval workflows |
| **Governance / Procurement Proof** | Compliance evidence — procurement packs, governance audit trail, export |
| **CFO** (optional add-on) | Financial oversight — budget variance, financial anomaly review |

## Proof / Governance Talking Points

- "Every decision recommendation includes a confidence score and evidence trail — your leadership team can see exactly why it was generated."
- "No decision executes without human approval. The system recommends; your leadership decides."
- "The audit trail captures every decision lifecycle event — generation, review, approval, rejection, execution. This is the evidence your governance team needs."
- "Decision export packs include SHA-256 integrity hashes. You can prove the content has not been tampered with."
- "The Decision Layer is deterministic. Given the same grievance data, it generates the same recommendation. This is testable, verifiable, and explainable."

## Pilot Entry Point

**30-day pilot: Union Decision Layer**

| Parameter | Value |
|-----------|-------|
| Duration | 30 days |
| Decision categories | STAFFING, COMPLIANCE, RISK |
| Review workflows | 2 (steward reassignment, arbitration review) |
| Proof deliverable | 1 decision export pack for governance review |
| Cadence | Weekly decision review meeting with leadership |
| Success metric | Grievance backlog reduction, time from anomaly to reviewed decision |
| Exit criteria | Leadership team can independently review and act on Decision Layer recommendations |
