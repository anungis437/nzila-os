# Union Operations — Demo Scenarios

## Prerequisites

Run the demo seed to populate decision records:

```bash
pnpm decision:seed-demo
```

This creates 5 decision records in `ops/decisions/`. The union-relevant decisions are:

| # | Decision ID | Title | Scenario |
|---|-------------|-------|----------|
| 1 | DEC-2026-0001 | Grievance backlog spike in union-eyes | Steward reassignment |
| 5 | DEC-2026-0005 | High-risk deployment: Deploy union-eyes v3.0 to production | Deployment review |

For this demo, open the Control Plane at `http://localhost:3010`.

---

## Scenario 1: Grievance Backlog Spike → Steward Reassignment Recommendation

### Narrative

"The platform detected a 320% spike in grievance submissions compared to the baseline. The Anomaly Engine flagged this as a `grievance_spike` anomaly. The Decision Layer evaluated the signal through the Grievance Backlog Rule and generated a STAFFING recommendation with 78% confidence.

This recommendation is now pending review in the Control Plane. Let me walk you through how a union admin would review and act on this."

### Pages to Open

1. **`/decisions`** — Decision list page
   - Show *Decision Summary Cards* — note the "Pending Review" count
   - Scroll to "Pending Review" table — locate "Grievance backlog spike in union-eyes"
   - Point out: severity badge (HIGH, amber), status badge (PENDING_REVIEW, yellow), confidence (78%)

2. **`/decisions/DEC-2026-0001`** — Decision detail page
   - **Summary section:** Read the summary — "Detected 3.2x above expected for grievance_backlog_count"
   - **Evidence panel:** Show 2 evidence refs:
     - `anomaly` → ANO-001: "grievance_spike: 3.2x deviation on grievance_backlog_count"
     - `metric` → SIG-001: "spike on grievance_backlog in union-eyes (220% deviation)"
   - **Recommended Actions:** Show the 3 ordered actions:
     1. Allocate additional grievance handlers from reserve pool
     2. Review grievance queue for patterns
     3. Consider temporary staff allocation
   - **Policy Context:** Execution allowed = Yes (no policy blocks)
   - **Review Required:** Yes badge — this decision requires human review before action
   - **Metadata:** Category = STAFFING, Type = RECOMMENDATION, Environment = STAGING (protected)

### Key Points to Highlight

- "Notice the evidence refs — every recommendation links to the exact anomaly that triggered it. The union admin can verify the source data."
- "The confidence score of 78% means the engine is reasonably confident but acknowledges uncertainty. This is not presented as fact."
- "The recommended actions are suggestions, not commands. The admin chooses what to do."
- "No action has been taken automatically. The system recommended; the human decides."

### Final Human Action

The union admin reviews the evidence, confirms the grievance spike is real (not a data artefact), and approves the recommendation. They allocate 2 additional stewards from the reserve pool and mark the decision as EXECUTED with notes.

---

## Scenario 2: Financial Irregularity → Escalation Recommendation

### Narrative

"A critical financial anomaly was detected — revenue variance deviated 4.1x from expected values across multiple cost centres. The Decision Layer generated a CRITICAL escalation with 92% confidence. This requires both finance-admin and platform-admin approval before any action can be taken.

Notice the policy context: execution is blocked because this is a protected production environment and the severity is critical."

### Pages to Open

1. **`/decisions`** — Decision list page
   - Locate "Financial irregularity in cfo" in the "Critical Decisions" table
   - Point out: severity badge (CRITICAL, red), status badge (GENERATED, grey), confidence (92%)

2. **`/decisions/DEC-2026-0002`** — Decision detail page
   - **Evidence:** 1 anomaly ref — "financial_irregularity: 4.1x deviation on revenue_variance"
   - **Required Approvals:** Show both `finance-admin` and `platform-admin` listed
   - **Policy Context:** Execution allowed = **No**
     - Reason: "Protected environment"
     - Reason: "Critical severity — escalation required"
   - **Recommended Actions:** 4 escalation steps including CFO review

### Key Points to Highlight

- "This decision cannot be executed even if someone wanted to — the Policy Engine blocks it until both required approvals are obtained."
- "The 92% confidence score reflects the strength of the revenue variance signal. Multiple cost centres showed deviations."
- "This is an escalation, not a recommendation to act. The system is saying: leadership needs to look at this."

---

## Scenario 3: Arbitration Trend → Leadership Review Recommendation

### Narrative

"For this scenario, imagine the Decision Layer has detected a compliance deviation pattern in union-eyes consistent with rising arbitration risk. The Arbitration Risk Rule evaluates compliance anomalies and generates a COMPLIANCE review request.

This demonstrates how the Decision Layer connects anomaly detection to structured governance review."

### Decision Structure (Illustrative)

| Field | Value |
|-------|-------|
| Category | COMPLIANCE |
| Type | REVIEW_REQUEST |
| Severity | HIGH |
| Title | Arbitration risk increase in union-eyes |
| Confidence | 0.75 |
| Evidence | Compliance deviation anomaly, historical arbitration trend |
| Required Approvals | Legal counsel, governance lead |
| Review Required | Yes |
| Policy Context | Execution allowed after legal counsel approves |

### Key Points to Highlight

- "The arbitration risk rule specifically watches for `compliance_deviation` signals in union-eyes. This is a domain-specific rule, not a generic alerting mechanism."
- "The required approvals include legal counsel — the system knows that arbitration decisions require legal input."
- "The evidence trail connects the compliance deviation to the recommendation, giving legal counsel the context they need to make an informed decision."

---

## Demo Flow Summary

| Step | Duration | Page | Action |
|------|----------|------|--------|
| 1 | 1 min | `/decisions` | Show summary cards and pending decisions |
| 2 | 3 min | `/decisions/DEC-2026-0001` | Walk through grievance backlog decision |
| 3 | 2 min | `/decisions/DEC-2026-0002` | Show critical escalation with policy blocks |
| 4 | 2 min | Discussion | Explain arbitration review scenario |
| 5 | 2 min | `/decisions` | Recap: recommendation-first, evidence-backed, human-reviewed |

**Total: ~10 minutes**
