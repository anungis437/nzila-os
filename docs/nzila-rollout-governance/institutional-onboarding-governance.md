# Institutional Onboarding Governance

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Position

Onboarding is a governed operation, paced for **institutional
stabilization**, not for adoption velocity. The pace is determined by
the institution's continuity obligations, not by sales targets.

## 2. Onboarding Legitimacy

An onboarding is legitimate when:

1. The receiving environment passes a full rollout legitimacy review.
2. Sponsor has signed off on continuity obligations.
3. Operator roster is named, with accountable individuals.
4. Snapshot has been curated by the sponsor's data owner.
5. Onboarding attestation has been recorded.

## 3. Onboarding Pacing

| Phase                           | Minimum duration             |
|---------------------------------|------------------------------|
| Pre-onboarding review           | 5 business days              |
| Operator orientation            | 3 business days              |
| Shadow operations               | 5 business days              |
| Supervised live operations      | 10 business days             |
| Full live operations            | continuous                   |

Phases are not skippable. Acceleration requires sponsor + platform +
institutional authority sign-off recorded as an exception attestation.

## 4. Onboarding Stabilization

During each phase a stabilization window applies. Within the window:

- No new feature introductions.
- No additional onboardings to the same operator cohort.
- Continuous calm legitimacy observation.

## 5. Operational Readiness

Before transition to "Full live operations" the following are verified:

- Runbooks accessible and current.
- On-call rotation defined.
- Escalation paths verified per
  [pilot-governance-system.md §9](./pilot-governance-system.md).
- Incident channel established and tested.

## 6. Governance-Safe Onboarding

Onboarding may not introduce, even temporarily:

- shared production secrets,
- cross-tenant data flows,
- bypasses of attestation requirements,
- "demo-grade" surfaces in pilot or production.

## 7. Continuity-Safe Onboarding

Onboarding interacts with [continuity-safe-rollout-system.md](./continuity-safe-rollout-system.md).
A continuity window opened by onboarding behaves identically to one
opened by a release: no overlapping rollouts.

## 8. Stakeholder Onboarding Review

Stakeholder review precedes operator review. Stakeholder review covers:

- continuity expectations,
- escalation comfort,
- governance readability,
- attestation visibility expectations,
- rollback comfort.

## 9. Required UX Surfaces

- onboarding governance workflow
- onboarding readiness summary
- continuity-safe onboarding panel
- operator onboarding review flow
