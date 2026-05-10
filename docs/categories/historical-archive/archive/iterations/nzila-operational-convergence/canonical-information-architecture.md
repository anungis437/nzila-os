# Canonical Information Architecture

> **Status:** Canonical convergence · **Layer:** Information architecture · **Inherits:** [canonical-operational-architecture.md](canonical-operational-architecture.md)

## 1. Objective

Standardize the operational IA across all Nzila apps so the same concept lives at the same address.

## 2. Canonical groupings

| Group | Meaning | Required across all apps |
|---|---|---|
| Work | The operator's outstanding institutional acts | Yes |
| Priority | Bounded, ordered focus for the cycle | Yes |
| Outcomes | What the operator is accountable for | Yes |
| Intelligence | Read-only interpretive surfaces | Yes |
| Governance | Posture, doctrine, cited decisions | Yes |
| Review | Append-only decision ledger | Yes |
| Continuity | System-scoped continuity posture | Yes |
| Rollout | Pacing-bounded change | Yes |
| Legitimacy | Release × environment × verdict | Yes |
| Evidence | Read-only, content-hash citable | Yes |
| Stabilization | Banded signal readings | Yes |
| Attestations | Content-hash anchored proof | Yes |

## 3. Canonical route segments

Every app SHOULD expose these segments under its operational route group:

- `/work`, `/priority`, `/outcomes`
- `/intelligence`
- `/governance`, `/governance/review`, `/governance/continuity`, `/governance/legitimacy`, `/governance/stabilization`
- `/rollout`
- `/evidence`
- `/attestations`

Apps MAY omit a segment when the concept is structurally absent (e.g., a surface-only app without rollout authority); MUST NOT redefine it.

## 4. Canonical operational pathways

The operator pathway is always: **read posture → interpret continuity → review legitimacy → record decision → return**. Pathways MUST NOT branch into composite scoring or telemetry sidetracks.

## 5. Required outputs

This corpus ships:

- A canonical IA tree exported by [`@nzila/operational-convergence`](../../packages/operational-convergence) (`getCanonicalIATree`).
- A canonical route grouping list (`CANONICAL_ROUTE_SEGMENTS`).
- A canonical operational pathway descriptor (`getCanonicalOperatorPathway`).

## 6. Discipline

A concept that means one thing in Control Plane and another in Console is a convergence regression. It is reverted, or promoted into the canonical IA by a cited change to this document.
