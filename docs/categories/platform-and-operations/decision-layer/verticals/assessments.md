# Decision Layer for Assessment Governance

## Target Buyer

| Role | Interest |
|------|----------|
| Ministry officials | National exam integrity, public confidence in certification systems |
| Certification body leadership | Assessment quality, scoring accuracy, centre compliance |
| Examination authority management | Regional variance detection, release governance, fraud prevention |
| Quality assurance / audit teams | Evidence-backed compliance, audit trail for scoring decisions |

## Top Pains

1. **Scoring anomalies are detected too late** — regional variance in results is identified after release, not before
2. **Exam integrity reviews lack structured evidence** — integrity concerns are flagged informally with no evidence chain
3. **Centre compliance follow-up is ad hoc** — non-compliant centres are tracked in spreadsheets, not governed systems
4. **Release decisions are high-risk** — holding or releasing results under pressure with no structured decision framework
5. **Regulatory scrutiny demands proof** — ministries and oversight bodies expect evidence of governance, not just claims

## Decision Use Cases

### 1. Suspicious Regional Variance Review

**Trigger:** Anomaly Engine detects scoring variance exceeding expected regional distribution
**Decision:** COMPLIANCE review request for regional scoring analysis
**Evidence:** Scoring anomaly ref, regional variance metrics, historical baseline comparison
**Approvals:** Chief examiner, quality assurance lead
**Value:** Structured review of variance before results release, with audit-ready evidence

### 2. Exam Integrity Intervention

**Trigger:** Anomaly pattern consistent with integrity compromise (scoring cluster, timing anomaly)
**Decision:** RISK escalation with hold/review recommendation
**Evidence:** Multiple anomaly refs, integrity signal pattern, centre metadata
**Approvals:** Integrity officer, certification authority director
**Value:** Evidence-backed integrity intervention instead of informal suspicion-based holds

### 3. Scoring Anomaly Review

**Trigger:** Individual or batch scoring anomaly detected (statistical outlier, marking inconsistency)
**Decision:** REVIEW_REQUEST for scoring quality assessment
**Evidence:** Scoring anomaly ref, marker performance data, cross-subject comparison
**Approvals:** Senior examiner
**Value:** Proactive scoring quality management with documented review trail

### 4. Centre Compliance Follow-Up

**Trigger:** Centre-level compliance signal breach (tardiness, irregularity pattern, previous incident record)
**Decision:** GOVERNANCE follow-up recommendation with escalation path
**Evidence:** Compliance signal refs, centre history, policy context
**Approvals:** Regional coordinator, compliance officer
**Value:** Systematic centre compliance management with follow-up tracking

### 5. Release Hold Recommendation

**Trigger:** Aggregate risk signal exceeds release threshold (multiple anomalies, unresolved integrity items)
**Decision:** ESCALATION to release governance committee
**Evidence:** Aggregate anomaly summary, unresolved decision count, risk assessment
**Approvals:** Release committee, certification authority director
**Value:** Structured release governance with documented risk assessment and approval trail

## Recommended Module Bundle

| Component | Role in Bundle |
|-----------|---------------|
| **Assessment App** | Core examination management — scoring, centre management, candidate tracking |
| **Control Plane** | Operational dashboard — decision review, governance status, anomaly overview |
| **Decision Layer** | Recommendation engine — evidence-backed scoring and integrity decisions |
| **Intelligence Layer** | Cross-app intelligence — correlation of signals across centres, regions, subjects |
| **Governance / Compliance** | Evidence and compliance — procurement proof, governance audit trail, export |

## Proof / Governance Talking Points

- "Every scoring anomaly recommendation includes evidence refs that link to the exact statistical deviation detected. Your examiners can verify the source data."
- "The confidence score tells your team how certain the engine is. A 0.75 score means review is warranted; it does not mean an integrity breach has occurred."
- "Release hold recommendations include all evidence and required approvals in a single view. No decision is made without your release committee's sign-off."
- "The audit trail captures every decision from anomaly detection through committee approval. This is the evidence regulators expect."
- "Decision export packs with integrity hashes can be submitted to oversight bodies as proof of governance."

## Pilot Entry Point

**60-day pilot: Assessment Decision Layer**

| Parameter | Value |
|-----------|-------|
| Duration | 60 days (aligned with examination cycle) |
| Decision categories | COMPLIANCE, RISK, GOVERNANCE |
| Review workflows | 2 (scoring anomaly review, release governance) |
| Proof deliverable | 1 decision export pack for ministry/regulatory review |
| Cadence | Bi-weekly decision review with quality assurance team |
| Success metric | Time from anomaly detection to reviewed decision; anomaly resolution rate |
| Exit criteria | Examination authority can independently use Decision Layer for scoring governance |
