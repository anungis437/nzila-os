# Governance Review Experience

> **Status:** Canonical governance experience · **Layer:** Review · **Inherits:** [real-operational-workflows.md](real-operational-workflows.md)

## 1. Objective

Build the governance-grade interface around `@nzila/governance-review` `DecisionLedger` so operators can review decisions, stabilization guidance, continuity posture, deployment legitimacy, and attestation lineage as institutional record.

## 2. Required capabilities

Operators must be able to:

- Read prior governance decisions in append-only chronological order.
- Inspect stabilization guidance per signal.
- Inspect continuity posture per dimension.
- Review deployment legitimacy per release × environment.
- Review attestation lineage chronologically.
- Review evidence trails by content hash.

## 3. UX posture

The experience must feel **governance-grade** — comparable to a regulator's review portal, not developer tooling. No feature flags. No experimental toggles. No telemetry charts.

## 4. Required surfaces

- Decision ledger panel (append-only, supersession-aware).
- Stabilization guidance reader.
- Continuity posture reader.
- Deployment legitimacy reader.
- Attestation lineage reader.
- Evidence trail reader (read-only summaries with content hash).

## 5. Discipline

A review experience succeeds when a reviewer can reconstruct the institution's governance posture from the surface alone, without consulting engineering or operators.
