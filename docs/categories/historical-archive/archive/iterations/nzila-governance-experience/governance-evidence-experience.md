# Governance Evidence Experience

> **Status:** Canonical governance experience · **Layer:** Evidence · **Inherits:** [governance-evidence-explorer.md](../nzila-governance-operations/governance-evidence-explorer.md)

## 1. Objective

Turn governance evidence into readable institutional experiences. Evidence must **explain**, never **flood**.

## 2. Required implementation

- Evidence review journeys — categorical filters; sparse default view.
- Attestation-linked evidence panels — evidence cross-referenced from an attestation.
- Governance event narratives — banded summaries paired with interpretation.
- Continuity evidence interpretation — system-scoped readings.
- Stabilization evidence summaries — banded threshold crossings only.

## 3. UX posture

- Evidence loads on demand. The default view is a banded summary, not a record list.
- Records expose their content hash and ledger reference.
- Filters are sparse: type, severity, scope, release. No free-text full-record search by default.
- No real-time stream of incoming events.

## 4. Anti-flood discipline

The experience refuses to display more than one screen of records without an explicit filter. If a filter would yield more than the page bound, the surface narrows the result rather than paginating endlessly.

## 5. Discipline

An evidence experience succeeds when an auditor can reconstruct a governance act in minutes, and a non-auditor never feels compelled to open it daily.
