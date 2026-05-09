# Deployment Legitimacy Review Panels

> **Status:** Canonical governance operations · **Layer:** Deployment review · **Inherits:** [live-deployment-legitimacy-validation.md](../nzila-runtime-integration/live-deployment-legitimacy-validation.md)

## 1. Objective

Provide governance-readable surfaces that allow reviewers to confirm the legitimacy of any release, environment, or topology in minutes.

## 2. Required reviews

| Review object | What is exposed |
|---|---|
| Environment identity | Environment class + provenance + manifest binding |
| Release lineage | Release id → commit → manifest hash → built-at |
| Deployment metadata | Issuer + verdict + cited evidence |
| Migration parity | Current schema version vs. manifest schema version |
| Topology alignment | Observed topology vs. manifest topology |
| Environment isolation | Pilot ↔ production isolation invariants |
| Pilot separation integrity | Pilot scope partition keys + feature profiles |

## 3. Required panels

- **Legitimacy summary** — one banded verdict per environment.
- **Release lineage panel** — chronological release attestation chain.
- **Environment integrity card** — environment identity binding + verdict.
- **Topology review view** — observed vs. expected topology, banded.
- **Deployment governance timeline** — sparse timeline of deploys + verdicts.

## 4. Posture

Panels MUST:

- Render `verified` / `partial` / `rejected` as text, not colour-only signals.
- Pair every verdict with a one-sentence interpretation.
- Cite the underlying attestation by content hash.
- Refuse to silently downgrade `rejected` into `partial`.

## 5. Discipline

A deployment legitimacy review panel succeeds when the reviewer can answer "is this release legitimate?" with confidence in under sixty seconds, and when "I don't know" is itself a visible, honest answer rather than an empty cell.
