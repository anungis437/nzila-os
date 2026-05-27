# Master Rollout Governance Index

**Status:** Active
**Effective:** 2026-05-09
**Owner:** Platform / Rollout Governance

This is the canonical entry point to the Nzila Institutional Rollout
Governance program. Read this first; descend into the topical document
for the question at hand.

---

## 1. Constitutional Rules

> Rollout governance optimizes for **legitimacy**, not deployment speed.
>
> Demos are governed institutional environments, not throwaway sales fixtures.
>
> Pilots are live institutional operations, not experimental zones.
>
> Production is reached by promotion, never by accident.
>
> Rollback is legitimacy-preserving, never panic-triggered.

---

## 2. Document Map

### Environment authority
- [environment-promotion-governance.md](./environment-promotion-governance.md)
- [environment-legitimacy-visibility.md](./environment-legitimacy-visibility.md)
- [cross-environment-governance-fabric.md](./cross-environment-governance-fabric.md)

### Tiered governance
- [demo-governance-system.md](./demo-governance-system.md)
- [pilot-governance-system.md](./pilot-governance-system.md)

### Cadence & sequencing
- [release-governance-cadence.md](./release-governance-cadence.md)
- [continuity-safe-rollout-system.md](./continuity-safe-rollout-system.md)

### Review & attestation
- [rollout-legitimacy-review-system.md](./rollout-legitimacy-review-system.md)
- [rollout-attestation-fabric.md](./rollout-attestation-fabric.md)

### Operator surfaces
- [operator-rollout-workflows.md](./operator-rollout-workflows.md)
- [operational-rollout-workflows.md](./operational-rollout-workflows.md)

### Onboarding
- [institutional-onboarding-governance.md](./institutional-onboarding-governance.md)

### Rollback
- [governed-rollback-system.md](./governed-rollback-system.md)

### Readiness
- [rollout-governance-readiness-review.md](./rollout-governance-readiness-review.md)

---

## 3. Implementation Surface

| Area                              | Location                                                   |
|-----------------------------------|------------------------------------------------------------|
| Environment registry              | `governance/foundations/rollout/environments.json`                     |
| Rollout legitimacy validator      | `tooling/scripts/validate-rollout-legitimacy.mjs`          |
| Promotion attestation recorder    | `tooling/scripts/record-promotion-attestation.mjs`         |
| Readiness review aggregator       | `tooling/scripts/run-rollout-readiness-review.mjs`         |
| Rollout attestation ledger        | `proof-artifacts/rollout-attestations/*.jsonl`             |
| pnpm wiring                       | `package.json` → `rollout:validate`, `rollout:promote:attest`, `rollout:readiness` |

---

## 4. Operator Quick Reference

```bash
# Static rollout legitimacy check (registry + topology + promotion graph)
node tooling/scripts/validate-rollout-legitimacy.mjs

# Record a promotion attestation (governs the act of promoting)
node tooling/scripts/record-promotion-attestation.mjs -- \
  --from staging --to demo --release-id R-2026-05-09-01 \
  --reviewer alice --reason "Phase A complete; demo schema legitimacy pending snapshot wiring"

# Aggregate readiness across environments (calm, sparse summary)
node tooling/scripts/run-rollout-readiness-review.mjs
```

---

## 5. Decision Tree

> "We want to demo to a prospect this week."
> → demo-governance-system.md. Demos are governed environments; rollout
>   review applies even to demos.

> "We're ready to launch a pilot."
> → pilot-governance-system.md + institutional-onboarding-governance.md.
>   Sponsor review is mandatory.

> "We want to promote staging → demo."
> → environment-promotion-governance.md + record promotion attestation.

> "We need to roll back."
> → governed-rollback-system.md. Rollback is a governed event.

> "We want to ship faster."
> → continuity-safe-rollout-system.md. Speed is not the optimization
>   target.
