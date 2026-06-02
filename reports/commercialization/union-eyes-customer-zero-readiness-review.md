# Union Eyes — Customer Zero Readiness Review

Date: 2026-06-02
Scope: Customer Zero journey from pilot application through pilot activation and expansion readiness.
Primary question: What still depends on founder knowledge, manual intervention, undocumented process, or missing capability?

---

## 1. Current Commercial Flow

### 1. Demo
1. Demo motion is still founder-led and manually scheduled.
2. No dedicated self-serve demo request flow is currently used as the primary commercial entry point.

### 2. Qualification
1. Pilot opportunity scoring and tiering are systemized (fit, risk, readiness, revenue, strategic, overall tier).
2. Qualification can be generated consistently from pilot intake and commercial state.

### 3. Pilot Application
1. Public pilot intake path is active and supports structured submission.
2. Application persistence and readiness signals are system-backed.

### 4. Review
1. Admin pilot review surface exists and supports status progression and commercial state movement.
2. Operator can view scoring, proposal outputs, and conversion-adjacent controls.

### 5. Proposal
1. Proposal, SOW, success metrics, and pilot plan are generated from one engine.
2. Artifacts are persistable and versioned.

### 6. Pilot
1. Pilot lifecycle transitions are server-validated.
2. Operational memory captures intelligence and event timeline.

### 7. Expansion
1. Reference profile, case study, and benchmark dataset generation is available.
2. Reference outputs can now be persisted and included in timeline history.

---

## 2. Manual Steps Remaining

### What still requires Aubert
1. Demo discovery framing and objection handling strategy per prospect.
2. Commercial narrative adaptation for executive buyers (especially first reference close).
3. Final negotiation calls and non-standard term decisions.

### What still requires engineering
1. No single end-to-end "Activate Pilot" orchestration endpoint that chains all required checks and side effects.
2. No deterministic, signed handoff payload specifically packaged for Brandon-facing close workflow.
3. No automated policy guard preventing non-Customer-Zero feature expansion in this phase.

### What still requires operator intervention
1. Pilot review decisions (approve/decline/escalate) still require human judgment.
2. Quality control on generated artifacts before sending externally.
3. Weekly pilot execution cadence (stakeholder check-ins, issue triage, decision gate facilitation).

---

## 3. Brandon Readiness

### What package would be sent today
1. Intake summary.
2. Proposal.
3. Statement of Work.
4. Success metrics.
5. Pilot plan.
6. CUPE-style pilot package export bundle.

### What onboarding would occur
1. Scope lock and pilot kickoff.
2. Checklist-driven onboarding.
3. Weekly execution and intervention cadence.

### What success metrics would be used
1. Pilot fit score.
2. Pilot readiness score.
3. Pilot revenue score.
4. Pilot strategic value score.
5. Pilot risk score.
6. Overall opportunity score and tier.
7. Adoption/activity/champion/risk operational signals.

### What timeline would be proposed
1. Week 0: scope lock and kickoff.
2. Weeks 1-2: mobilize and setup.
3. Weeks 3-8: operational pilot and mid-pilot correction.
4. Weeks 9-12: outcome review and conversion decision.

---

## 4. Pilot Delivery Readiness

### Green
1. Qualification system is objective and repeatable.
2. Commercial state progression is controlled server-side.
3. Proposal artifacts are generated from standardized inputs.
4. Artifact versioning and diffing are operational.
5. Timeline unifies transitions, intelligence, artifacts, and references.
6. Package export enables consistent outbound deliverables.

### Yellow
1. Demo entry is still founder-heavy.
2. Human review remains required for outbound artifact quality.
3. Some conversion steps still rely on operator sequencing instead of a single orchestration command.

### Red
1. None that block Customer Zero immediately.
2. Main risk is execution drift, not missing core commercial infrastructure.

---

## 5. Top 10 Risks To First Pilot

1. Founder bandwidth bottleneck during negotiation window.
2. Over-customization pressure from first buyer before pilot scope lock.
3. Manual operator sequencing errors between review, transition, and billing handoff.
4. Misinterpretation of generated outputs without human QA pass.
5. Timeline slippage if stakeholder availability is not locked early.
6. Inconsistent objection handling if responses are not codified from first calls.
7. Intelligence capture quality variance across operators.
8. Conversion momentum loss after pilot success review if next-step owner is unclear.
9. Unplanned requests diverting team into non-Customer-Zero builds.
10. Overconfidence in infrastructure maturity without proving a full real-customer cycle.

---

## 6. Recommendation

### Ready to pursue pilot
1. Yes, with controlled execution discipline.
2. The system is sufficiently mature to support Customer Zero.

### Needs hardening
1. Add one explicit Customer Zero runbook checkpoint before each commercial state move.
2. Add one outbound artifact QA checklist for operator signoff.
3. Add one close-motion handoff packet template for Brandon-style decision calls.

### Needs operational validation
1. Run one real Customer Zero from application through activation and capture full timeline evidence.
2. Perform after-action review and only then decide what to build next.

---

## 7. Customer Zero Audit Findings (Dependency Lens)

### Founder knowledge dependencies
1. Executive narrative and negotiation framing.
2. Priority objection responses not yet fully codified as reusable playbook snippets.

### Manual intervention dependencies
1. Operator decision checkpoints in review and conversion.
2. Human quality gate before sending generated artifacts externally.

### Undocumented process dependencies
1. Prospect-specific escalation logic when objections conflict with scope lock.
2. Exact owner handoff between pilot completion and subscription conversion call.

### Unavailable system capability dependencies
1. One-click end-to-end pilot activation orchestration.
2. One-click close-motion package tuned for specific buyer persona (for example Brandon packet).

---

## 8. Customer Zero Sprint Rule

For the next sprint, every backlog item should pass this test:
1. Does this directly increase probability of converting Brandon or the next real pilot?
2. If no, defer.

This phase is conversion proof, not architecture expansion.
