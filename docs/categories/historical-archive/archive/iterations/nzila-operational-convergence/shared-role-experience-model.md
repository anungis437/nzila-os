# Shared Role Experience Model

> **Status:** Canonical convergence · **Layer:** Role model · **Inherits:** [canonical-information-architecture.md](canonical-information-architecture.md)

## 1. Objective

Standardize the operational experience of every stakeholder kind across the ecosystem.

## 2. Canonical roles

| Role | Primary surface | Cognitive load | Refused content |
|---|---|---|---|
| Executive | `/governance` overview, `/priority` | ≤ 1 screen per session | Engineering jargon, telemetry density |
| Governance operator | `/governance/review`, `/governance/continuity` | ≤ 3 surfaces per session | Person-resolving content |
| Deployment operator | `/governance/legitimacy`, `/rollout` | ≤ 2 surfaces per session | Composite verdict scoring |
| Continuity reviewer | `/governance/continuity`, `/governance/stabilization` | ≤ 3 surfaces per session | Person-scoped continuity |
| Pilot operator | UE Ops `/work`, UE Ops `/governance` | ≤ 2 surfaces per session | Cross-pilot exposure |
| Administrator | `/governance`, `/attestations` | ≤ 3 surfaces per session | Audit-bypassing actions |
| Steward | `/governance/review`, `/evidence` | ≤ 2 surfaces per session | Mutation of recorded decisions |
| Reviewer | `/governance/review`, `/evidence`, `/attestations` | ≤ 3 surfaces per session | Real-time pressure cues |
| Procurement observer | `/governance` overview, `/attestations` | ≤ 1 screen per session | Operational internals |

## 3. Required content per role

Each role's experience MUST define:

- Operational priorities (what they read first).
- Review surfaces (where they decide).
- Governance surfaces (where they interpret posture).
- Rollout surfaces (where they pace change, if any).
- Continuity surfaces (where they read system continuity).
- Decision surfaces (where they record an institutional act).
- Cognitive load expectation (bounded reading, bounded actions).

## 4. Continuity-safe role transitions

Switching role between apps MUST NOT change what a role means. The procurement observer in Control Plane sees the same shape as the procurement observer in Console.

## 5. Required outputs

The role registry ships in [`@nzila/operational-convergence`](../../packages/operational-convergence) as `CANONICAL_ROLES` and `getRoleExperience(role)`.

## 6. Discipline

A role experience succeeds when the role can carry a single decision across apps without re-orientation. If the role must be retrained at every product boundary, the model has fragmented.
