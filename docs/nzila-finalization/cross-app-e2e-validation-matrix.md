# Cross-App E2E Validation Matrix

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-finalization-index.md](./master-finalization-index.md)

This document records the cross-app end-to-end validation matrix
that exercises full institutional operational journeys.

---

## 1. Apps in scope

UE · Console · Control Plane · ExecutiveOS · UE Ops

---

## 2. Validation matrix

| Journey                          | UE  | Console | Control Plane | ExecutiveOS | UE Ops |
| -------------------------------- | --- | ------- | ------------- | ----------- | ------ |
| Navigation transitions           | OK  | OK      | OK            | n/a (lib)   | OK     |
| Role transitions                 | OK  | OK      | OK            | n/a         | OK     |
| Governance review flows          | OK  | OK      | OK            | n/a         | OK     |
| Rollout flows                    | OK  | OK      | OK            | n/a         | OK     |
| Continuity review flows          | OK  | OK      | OK            | n/a         | OK     |
| Onboarding flows                 | OK  | n/a     | OK            | n/a         | OK     |
| Stabilization flows              | OK  | OK      | OK            | n/a         | OK     |
| Operational cadence flows        | OK  | OK      | OK            | n/a         | OK     |

`n/a` denotes that the journey is intentionally not surfaced in that
app at this layer (ExecutiveOS is a workspace package without its
own surface; Console is intentionally not an onboarding surface).

---

## 3. E2E coverage finalization

- Per-app typecheck: clean across CP, Console, UE.
- Per-app surface render: deterministic projection of registry +
  ledger; refresh re-reads disk evidence.
- Per-journey institutional doctrine: every journey points at an
  authority doc.
- Per-journey ledger anchor: every journey closes by attestation,
  not by manual marking.

---

## 4. Posture

The matrix validates the ecosystem operationally. The institutional
operating system carries journeys end-to-end without surface
fragmentation.
