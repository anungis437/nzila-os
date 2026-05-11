# Live Governance Review Panels

> **Status:** Canonical governance operations · **Layer:** Embedded review · **Inherits:** [governance-native-dashboard-embedding.md](../nzila-runtime-integration/governance-native-dashboard-embedding.md)

## 1. Objective

Embed real, runtime-bound governance review surfaces into the operational products so review is not a separate ritual but a continuously available read.

## 2. Embedded surfaces

| Host | Embedded panels |
|---|---|
| Control Plane | Posture cards, attestation status, deployment legitimacy summary, governance-safe timeline |
| ExecutiveOS | Continuity posture band, modernization pacing, executive review workflow entry |
| UE Ops | Pilot posture, pilot legitimacy, pilot deployment verdicts |
| Deployment review flows | Release lineage, environment integrity, migration parity |
| Pilot governance review | Pilot scope evidence, pilot attestation lineage, pilot stabilization signals |

## 3. Required capabilities

Each embedded panel MUST support:

- Live read of the relevant banded posture or verdict.
- One-click open of the underlying attestation or evidence record.
- Calm refresh (default 60s).
- Read-only by default; write requires the role model's explicit grant.

## 4. Posture

Embedded panels MUST NOT compete with host-app content for attention. They render at the periphery of the screen, in the ledger register, and never animate.

## 5. Discipline

A live governance review panel succeeds when operators stop seeking out separate dashboards because the panel itself answers the question. If operators feel they must leave the host app to "see the truth", the embedding has failed.
