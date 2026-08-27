# Operational Rollout Workflows

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

This document is the operational counterpart to
[operator-rollout-workflows.md](./operator-rollout-workflows.md). It
specifies the concrete operator journeys that have been embodied in
the rollout governance UI, and the CLI commands that wrap them.

---

## 1. Demo Preparation

**Surface:** Control Plane → Governance → Rollout · Promotion Review.
**CLI mirror:** `node tooling/scripts/validate-rollout-legitimacy.mjs` then `node tooling/scripts/record-promotion-attestation.mjs`.

Steps:
1. Confirm staging tier is attested and outside its stabilization
   window.
2. Confirm canonical sanitized snapshot is wired
   (`UE_DB_RESTORE_SNAPSHOT_URL`).
3. Confirm demo identity (topology + secret topology) on the
   Environment Legitimacy panel.
4. Record a promotion attestation `staging → demo` via the CLI.
5. Confirm the new attestation appears in the Promotion Ledger.
6. Open the demo session only after the attestation appears.

## 2. Pilot Preparation

**Surface:** Union Eyes → Pilot Governance + Control Plane → Rollout.
**CLI mirror:** `node tooling/scripts/validate-rollout-legitimacy.mjs` then `node tooling/scripts/record-promotion-attestation.mjs`.

Steps:
1. Sponsor sign-off recorded out-of-band (incident-tracker reference).
2. Per-pilot Key Vault provisioned and verified isolated.
3. Bootstrap attestation present per ORM governance.
4. Operator roster published.
5. Onboarding pacing initiated per
   [institutional-onboarding-governance.md §3](./institutional-onboarding-governance.md).
6. Promotion attestation `staging → pilot` recorded with sponsor + platform reviewer.

## 3. Rollout Review

**Surface:** Control Plane → Governance → Rollout · Rollout Readiness panel.
**CLI mirror:** `node tooling/scripts/run-rollout-readiness-review.mjs`.

Outcome is one of PASS / PASS-WITH-CONDITIONS / HOLD / REFUSE per
[rollout-legitimacy-review-system.md §3](./rollout-legitimacy-review-system.md).

## 4. Promotion Review

**Surface:** Control Plane → Governance → Rollout · Promotion Review panel.

The panel surfaces every governed promotion edge in the registry and
indicates eligibility (open continuity window blocks the edge). The
recording event is performed via CLI to preserve the operator-name +
reason audit trail.

## 5. Onboarding Review

**Surface:** Union Eyes → Pilot Governance · Onboarding Readiness section.

Reviewers verify the four onboarding phases are traversed in order
with no acceleration. Acceleration requires a recorded exception
attestation per
[institutional-onboarding-governance.md §3](./institutional-onboarding-governance.md).

## 6. Rollback Review

**Surface:** Control Plane → Governance → Rollout · Rollback Posture
panel + the per-tier rollback indicator on the Environment Legitimacy
panel.

A rollback is recorded with the same authority level as the original
promotion. Rollback CLI is to follow the first non-trivial rollback to
ensure the implementation matches real operator need.

## 7. Rollout Stabilization Review

**Surface:** Control Plane → Governance → Rollout · Continuity Window
panel and the executive briefing in Console → Rollout Readiness.

The review closes a stabilization window after the configured minutes
elapse. No additional promotion to that tier is permitted until the
window closes.

---

## Cross-cutting CLI

```bash
node tooling/scripts/validate-rollout-legitimacy.mjs         # static legitimacy of registry + docs
node tooling/scripts/run-rollout-readiness-review.mjs        # aggregate posture; records readiness attestation
node tooling/scripts/record-promotion-attestation.mjs   # record a governed promotion event
```

All CLI commands write into `proof-artifacts/rollout-attestations/`,
which is the read source for all operator surfaces above. The UI is
therefore deterministic with respect to the ledger; there is no hidden
operational state.
