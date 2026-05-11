# Environment Lifecycle Governance

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-field-operations-index.md](./master-field-operations-index.md)

This document governs the operational lifecycle of every Nzila
environment tier.

---

## 1. Governed tiers

Lifecycle governance applies to:

- demo
- staging
- pilot
- prod

`local` and `dev` are operator-discretion tiers and are out of scope
for lifecycle governance.

---

## 2. Lifecycle states

| State        | Meaning                                                    |
| ------------ | ---------------------------------------------------------- |
| provisioned  | Topology + secret topology in place, no traffic             |
| attested     | Bootstrap + identity attestations recorded                  |
| promoted     | A release has been promoted into the tier                   |
| stabilizing  | Continuity window open                                      |
| observed     | Window closed, tier under cadence review                    |
| retired      | Tier removed from the registry (governed separately)        |
| restored     | Tier re-attested after a retirement or major change         |

State is derived from the registry + ledger; it is not stored.

---

## 3. Lifecycle transitions

Transitions are governed:

- provisioned → attested: bootstrap attestation
- attested → promoted: promotion attestation
- promoted → stabilizing: automatic on promotion
- stabilizing → observed: window expiry
- observed → promoted: a new promotion attestation
- any → retired: governed retirement (rare)
- retired → restored: full re-attestation chain

---

## 4. Environment review cadence

| Tier   | Cadence    |
| ------ | ---------- |
| demo   | weekly     |
| staging| weekly     |
| pilot  | weekly     |
| prod   | bi-weekly  |

Reviews are interpretive, not pass/fail.

---

## 5. Stabilization windows

Per `governance/foundations/rollout/environments.json`. Windows are monotonic
non-decreasing along the promotion path; this is enforced by the
rollout legitimacy validator.

---

## 6. Promotion pacing

A tier may not be promoted into while inside a continuity window.
This is a hard refusal in the rollout governance CLI.

---

## 7. Environment legitimacy reviews

A tier's legitimacy is reviewed against:

- registry identity intact
- attestation chain unbroken
- continuity windows respected
- rollback posture appropriate

A tier whose legitimacy is degraded enters interpretive review.

---

## 8. Retirement governance

Retirement requires:

- sponsor sign-off
- platform reviewer co-signature
- registry update + attestation
- ledger entry

Retirement is rare and is governed through the standard rollout
governance attestation surfaces.

---

## 9. Restoration governance

Restoration is a full attestation chain replay:

- bootstrap → identity → promotion → continuity attestations
- recorded as a `restoration` attestation type

---

## 10. Surfaces

Environment lifecycle posture is rendered in:

- Control Plane → Governance → Rollout · Environment Legitimacy panel
- Control Plane → Governance → Field Operations · Lifecycle dashboard
