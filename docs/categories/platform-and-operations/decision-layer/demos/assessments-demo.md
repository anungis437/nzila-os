# Assessment Governance — Demo Scenarios

## Prerequisites

Run the demo seed to populate decision records:

```bash
pnpm decision:seed-demo
```

For assessment-specific scenarios, the following seeded decisions are illustrative of the patterns used. The assessment vertical extends the same engine with domain-specific signals.

Open the Control Plane at `http://localhost:3010`.

---

## Scenario 1: Suspicious Score Variance → Review Recommendation

### Narrative

"The Anomaly Engine detected a statistical variance in scoring results for the Northern Region. Pass rates are 2.8 standard deviations above the national mean for Mathematics Level 3, which exceeds the expected regional distribution. The Decision Layer generated a COMPLIANCE review request with 74% confidence.

This is not an accusation. It is a structured recommendation to review the variance, backed by statistical evidence."

### Decision Structure

| Field | Value |
|-------|-------|
| Decision ID | DEC-2026-XXXX |
| Category | COMPLIANCE |
| Type | REVIEW_REQUEST |
| Severity | HIGH |
| Title | Suspicious score variance — Northern Region Mathematics L3 |
| Summary | Regional pass rate 2.8σ above national mean |
| Explanation | Northern Region Mathematics Level 3 shows pass rates at 87.3% vs national mean of 62.1%. Statistical variance exceeds the 2σ review threshold. Historical data shows this region typically tracks within 5% of the national mean. |
| Confidence | 0.74 |
| Evidence Refs | `anomaly`: score_variance ANO-ASM-001 (2.8σ deviation); `metric`: regional pass rate comparison SIG-ASM-001 |
| Recommended Actions | 1. Review marking samples from Northern Region Mathematics L3; 2. Compare marker assignment and performance; 3. Verify centre-level data integrity; 4. Assess whether moderation is needed before release |
| Required Approvals | Chief examiner, quality assurance lead |
| Review Required | Yes |
| Policy Context | Execution allowed after chief examiner approval |

### Pages to Open

1. **`/decisions`** — Show pending review table with the scoring variance decision
2. **`/decisions/[id]`** — Walk through:
   - Evidence: the exact anomaly detection with deviation metric
   - Recommended actions: ordered review steps
   - Required approvals: chief examiner and QA lead
   - Review required badge

### Key Points to Highlight

- "The system detected a statistical anomaly and generated a structured review recommendation. It did not accuse anyone of malpractice."
- "The 0.74 confidence means the engine believes this warrants review. The chief examiner makes the final judgment."
- "Evidence refs link directly to the statistical computation. The QA team can verify the numbers independently."
- "No results have been held or modified. This is a recommendation to review before release."

---

## Scenario 2: Exam Integrity Anomaly → Hold / Review Decision

### Narrative

"Multiple anomaly signals have been detected at Centre C-4721: answer pattern clustering, unusual timing distributions, and a prior incident record. The Decision Layer aggregated these signals and generated a RISK escalation with 82% confidence.

The policy context blocks execution because integrity decisions in the assessment domain require integrity officer sign-off."

### Decision Structure

| Field | Value |
|-------|-------|
| Category | RISK |
| Type | ESCALATION |
| Severity | CRITICAL |
| Title | Exam integrity anomaly cluster — Centre C-4721 |
| Summary | Multiple integrity signals detected at single centre |
| Explanation | Centre C-4721 shows: (1) answer pattern clustering in 3 subjects, (2) timing distribution 2.1σ from expected, (3) prior incident record on file. Combined signal strength exceeds integrity review threshold. |
| Confidence | 0.82 |
| Evidence Refs | `anomaly`: answer_pattern ANO-ASM-002; `anomaly`: timing_anomaly ANO-ASM-003; `artifact`: prior_incident ART-C4721 |
| Recommended Actions | 1. Suspend result release for Centre C-4721 pending review; 2. Assign integrity investigation officer; 3. Request CCTV and documentation from centre; 4. Prepare integrity review report |
| Required Approvals | Integrity officer, certification authority director |
| Review Required | Yes |
| Policy Context | Execution blocked — integrity decisions require integrity officer approval |

### Key Points to Highlight

- "Three separate anomaly signals converged on one centre. The Decision Layer aggregated them into a single decision with structured evidence."
- "This is a CRITICAL escalation — the most serious category. The confidence of 82% reflects the strength of multiple independent signals."
- "The policy engine blocks execution until the integrity officer approves. This prevents premature action on sensitive integrity matters."
- "Every piece of evidence is separately referenced. The investigation officer can verify each signal independently."

---

## Scenario 3: Regional Issue Cluster → Investigation Recommendation

### Narrative

"The Intelligence Layer detected a cross-app insight: three centres in the Eastern Region show correlated anomalies in scoring variance, timing, and candidate distribution. The Decision Layer generated a GOVERNANCE investigation recommendation."

### Decision Structure

| Field | Value |
|-------|-------|
| Category | GOVERNANCE |
| Type | RECOMMENDATION |
| Severity | HIGH |
| Title | Regional anomaly cluster — Eastern Region (3 centres) |
| Summary | Correlated anomalies across 3 centres in Eastern Region |
| Explanation | Cross-app intelligence detected correlated anomalies at centres C-5102, C-5108, and C-5115. Anomaly types include scoring variance, timing distribution, and candidate transfer patterns. Correlation strength is 0.78. |
| Confidence | 0.71 |
| Evidence Refs | `insight`: cross_region_correlation INS-ASM-001; `anomaly`: 3 individual centre anomaly refs |
| Recommended Actions | 1. Initiate regional investigation; 2. Compare with adjacent regions; 3. Review centre administration records; 4. Prepare report for governance committee |
| Required Approvals | Regional coordinator, compliance officer |
| Review Required | Yes |

### Key Points to Highlight

- "This decision came from the Intelligence Layer's cross-app correlation engine — it detected a pattern that individual centre reviews might miss."
- "The evidence includes both the cross-app insight reference and individual centre anomaly references. The investigation team has both the aggregate view and the detail."
- "This is a recommendation to investigate, not a finding. The governance committee reviews the investigation results."

---

## Demo Flow Summary

| Step | Duration | Page | Action |
|------|----------|------|--------|
| 1 | 1 min | `/decisions` | Show summary cards and pending decisions |
| 2 | 3 min | Detail page | Walk through scoring variance review recommendation |
| 3 | 3 min | Detail page | Show integrity escalation with policy block |
| 4 | 2 min | Discussion | Explain regional investigation scenario |
| 5 | 1 min | `/decisions` | Recap: evidence-backed, human-reviewed, audit-ready |

**Total: ~10 minutes**
