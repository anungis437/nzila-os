# Deployment Legitimacy Experience

> **Status:** Canonical governance experience · **Layer:** Deployment · **Inherits:** [deployment-legitimacy-review-panels.md](../nzila-governance-operations/deployment-legitimacy-review-panels.md)

## 1. Objective

Provide governance-readable deployment legitimacy experiences that allow any reviewer to confirm the legitimacy of any release in under a minute.

## 2. Required implementation

- Environment legitimacy panels — environment identity + verdict + content hash.
- Release lineage views — chronological attestation chain.
- Deployment integrity summaries — release × environment × verdict.
- Topology alignment views — observed vs. expected, banded.
- Migration legitimacy summaries — schema parity vs. manifest.
- Attestation linkage panels — attestation → cited evidence cross-references.

## 3. UX posture

- Verdicts render as **text** first, colour second.
- Every verdict is paired with a one-sentence interpretation.
- `rejected` is rendered honestly; the experience refuses to silently downgrade.
- Cited content hashes are always visible.

## 4. Calmness

Deployment review must remain calm. No countdown timers. No urgency framing. No animation. The reviewer sets the pace.

## 5. Discipline

A deployment legitimacy experience succeeds when "is this release legitimate?" can be answered with confidence, including "I don't know" rendered as a visible honest answer.
