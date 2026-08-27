# Live Rollback Proving

**Status:** Active · Proven 2026-05-09
**Authority:** [master-operational-proving-index.md](./master-operational-proving-index.md)

This document records the real, governed rollback rehearsal on the
pilot tier.

---

## 1. Posture

Rollback is **continuity-preserving**, not failure-oriented. A
rollback is recorded with the same authority level as the promotion
it reverses.

---

## 2. Rollback performed

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Tier             | pilot                                                |
| Release          | `R-2026-05-09-PROVE`                                 |
| Reviewer         | aubert                                               |
| Attestation ID   | `d9ff190a-77d4-437d-b8dc-fc9f4861e8d9`               |
| Rollback policy  | governed-with-sponsor-notification                   |
| Continuity window| 240 minutes                                          |
| Log              | `proof-artifacts/operational-proving/rollback-pilot.log` |

Recorded via `node tooling/scripts/record-rollback-attestation.mjs`.

---

## 3. Validations

| Validation                                | Result |
| ----------------------------------------- | ------ |
| Lineage continuity (release id preserved) | PASS   |
| Promotion chain integrity (chain visible) | PASS   |
| Environment identity restoration          | PASS   |
| Stabilization posture after rollback      | PASS   |
| Operational readability (calm refusal-aware UI) | PASS |

---

## 4. CLI legitimacy

The rollback CLI:

- Refuses unknown tiers.
- Requires a non-trivial reason (>= 16 chars).
- Records git SHA automatically.
- Writes to `rollbacks-YYYY-MM.jsonl` (separate ledger from promotions).
- Records `rollback_policy` from the registry.

---

## 5. Posture

A rollback is a continuity-preserving institutional act. The
ecosystem renders it as a calm fact, not as an alarm.
