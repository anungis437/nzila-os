# Cross-App Operational Convergence Proving

**Status:** Active · Proven 2026-05-09
**Authority:** [master-operational-proving-index.md](./master-operational-proving-index.md)

This document records the cross-app convergence audit performed
across Nzila operator-facing surfaces.

---

## 1. Apps audited

| App                | Surfaces                                                              |
| ------------------ | --------------------------------------------------------------------- |
| Control Plane      | Governance → Rollout, Governance → Field Operations                   |
| Console            | Rollout Readiness, Field Operations Briefing                          |
| Union Eyes (UE)    | Pilot Governance, Field Operations                                    |
| ExecutiveOS        | Workspace package consumed by Console (no standalone surface)         |
| UE Ops             | Pilot operator surface within Union Eyes                              |

---

## 2. Convergence validations

| Validation                                  | Result |
| ------------------------------------------- | ------ |
| Navigation continuity (no orphaned links)   | PASS   |
| Governance continuity (same authority docs) | PASS   |
| Stabilization continuity (same vocabulary)  | PASS   |
| Rollout continuity (same data source)       | PASS   |
| Operational language consistency            | PASS   |
| Continuity posture consistency              | PASS   |
| Review workflow continuity                  | PASS   |

---

## 3. Vocabulary parity audit

The five canonical postures
(`READY` / `STABILIZING` / `REVIEWING` / `WAITING` / `NOT_PROVISIONED`)
appear identically in:

- Control Plane field-operations panels
- Union Eyes field-operations page
- Console field-operations briefing (interpretive prose)

No app introduces a competing posture vocabulary.

---

## 4. Deterministic projection invariant

All three apps project the same source:

- `governance/foundations/rollout/environments.json`
- `proof-artifacts/rollout-attestations/*.jsonl`

There is no per-app cache. Refreshing any surface re-reads the
ledger. The same release id surfaces in identical posture across
all apps.

Verified during the May 2026 traversal: release
`R-2026-05-09-PROVE` is visible in identical posture across
Control Plane, Console, and Union Eyes.

---

## 5. Posture

The ecosystem behaves as one operating system. The convergence
audit re-runs as part of `node tooling/scripts/validate-operational-proving.mjs`.
