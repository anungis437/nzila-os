# Promotion Refusal Proving

**Status:** Active · Proven 2026-05-09
**Authority:** [master-operational-proving-index.md](./master-operational-proving-index.md)

This document records refusal contract execution under real
conditions. Each refusal is governance-safe — visible, interpretive,
non-punitive.

---

## 1. Refusal scenarios performed

Recorded in `proof-artifacts/operational-proving/refusals.log`.

| # | Scenario                                | Expected | Actual   | Refusal message                                                                 |
| - | --------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------- |
| 1 | out-of-graph: dev → prod                | REFUSED  | REFUSED  | "promotion dev → prod is not in the governed promotion graph (allowed: staging)" |
| 2 | continuity-window: staging → pilot reentry | REFUSED | REFUSED  | "tier pilot is inside open continuity window (240m, last promotion ...). Refused per continuity-safe-rollout-system.md." |
| 3 | demo isolation: demo → pilot            | REFUSED  | REFUSED  | "promotion demo → pilot is not in the governed promotion graph (allowed: none)" |
| 4 | trivial reason                          | REFUSED  | REFUSED  | "--reason must be a non-trivial string (>= 8 chars)"                            |

All four refusals returned exit code `1`. None of them produced a
ledger entry. The ledger is therefore unaffected by refused
attempts.

---

## 2. Refusal contracts validated

| Contract                  | Authority                                                            | Status |
| ------------------------- | -------------------------------------------------------------------- | ------ |
| Out-of-graph refusal      | environment-promotion-governance.md                                  | PASS   |
| Continuity-window refusal | continuity-safe-rollout-system.md                                    | PASS   |
| Demo isolation refusal    | demo-governance-system.md                                            | PASS   |
| Reason discipline         | rollout-attestation-fabric.md                                        | PASS   |

The remaining refusal contracts (invalid attestation, unauthorized
promotion, topology mismatch, stale readiness) are doctrinal
refusals enforced by surrounding systems (ORM governance, secret
topology validation, readiness review) and are validated in their
respective layers.

---

## 3. Refusal posture

Every refusal:

- names the rule that fired
- references the authority document
- avoids accusatory language
- can be re-attempted after the underlying condition changes

A refusal is institutional feedback, not an operator failing.

---

## 4. Operator readability

The CLI surfaces the refusal in the operator's own terminal context.
The control-plane Field Operations dashboard renders the same
refusal posture as `STABILIZING` or `WAITING` rather than as an
error.

The Console executive briefing never surfaces a refusal as an
alarm.
