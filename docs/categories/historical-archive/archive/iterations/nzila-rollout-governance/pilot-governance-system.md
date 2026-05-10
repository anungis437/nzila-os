# Pilot Governance System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Position

Pilots at Nzila are **live institutional operations**. They carry real
operator workload, real continuity obligations, and real reputational
consequence. Pilots are not betas, not experiments, and not
demo extensions.

## 2. Pilot Legitimacy Criteria

A pilot is legitimate when all of the following hold:

1. Promotion attestation exists with `to=pilot` and reviewer signature
   from both platform and institutional sponsor.
2. Schema legitimacy is established per ORM governance, with
   `bootstrap_attestation_ref` available and `legacy_replay_override =
   false`.
3. Snapshot source is operator-curated (not synthetic).
4. Per-pilot Key Vault is in use (`per-pilot-kv`); no shared secrets
   with other pilots or production.
5. Pilot operators have completed onboarding governance per
   [institutional-onboarding-governance.md](./institutional-onboarding-governance.md).

## 3. Pilot Isolation

| Resource         | Sharing rule                                          |
|------------------|-------------------------------------------------------|
| Database         | One PG flexible server per pilot.                     |
| Key Vault        | One KV per pilot.                                     |
| Storage account  | One per pilot for institutional artifacts.            |
| Identity         | System-assigned managed identity per pilot ACA.       |

Pilot-to-pilot or pilot-to-prod sharing is prohibited at infrastructure
level, not merely at policy level.

## 4. Pilot Review Cadence

| Cadence    | Review                                                          |
|------------|-----------------------------------------------------------------|
| Daily      | Continuity posture; alert noise; legitimacy summary.            |
| Weekly     | Operational readiness; sponsor check-in.                        |
| Per release| Full rollout legitimacy review per                              |
|            | [rollout-legitimacy-review-system.md](./rollout-legitimacy-review-system.md). |
| Quarterly  | Pilot-to-prod readiness assessment.                             |

## 5. Pilot Onboarding Governance

Onboarding a new pilot requires:

1. Sponsor agreement on continuity obligations and stabilization
   windows.
2. Operator roster with named accountable individuals.
3. Pre-pilot legitimacy review (full).
4. Snapshot curation by sponsor's data owner.
5. Recorded onboarding attestation.

## 6. Pilot Attestation

Every pilot bears continuous attestation surfaces:

- `pilot_identity_attestation` (advertised by the running app).
- `pilot_promotion_attestation` (one per release).
- `pilot_session_attestation` (one per high-risk operator action,
  e.g., bulk import, mass notification).

## 7. Pilot Continuity Governance

Pilots operate under a `continuity_window_minutes = 240` posture.
During an open continuity window:

- No new promotion is permitted.
- No optional schema changes are permitted.
- Operator-facing UX displays calm continuity banners; no alert spam.

## 8. Pilot Rollback Governance

Pilot rollbacks are governed events per
[governed-rollback-system.md](./governed-rollback-system.md).
Sponsor notification is required, not optional.

## 9. Pilot Operational Escalation

Escalation paths are explicit:

| Severity | Action                                                  |
|----------|---------------------------------------------------------|
| L1       | Operator triage; no sponsor notification.               |
| L2       | Platform on-call; sponsor notification within 1 hour.   |
| L3       | Platform + sponsor + institutional authority; immediate.|

## 10. Required UX Surfaces

- pilot governance panel
- pilot legitimacy summary
- pilot readiness workflow
- pilot attestation view
- pilot review interface
