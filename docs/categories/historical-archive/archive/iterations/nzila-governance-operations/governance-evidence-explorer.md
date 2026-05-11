# Governance Evidence Explorer

> **Status:** Canonical governance operations · **Layer:** Evidence review · **Inherits:** [governance-evidence-emission.md](../nzila-runtime-integration/governance-evidence-emission.md)

## 1. Objective

Make governance evidence reviewable as institutional record — calmly, without telemetry overload, and without becoming a SOC-style panic console.

## 2. Required review capabilities

Operators must be able to review:

- Governance events (banded by type + severity).
- Doctrine enforcement events (cited policy + decision + reason).
- Deployment legitimacy evidence (release + environment + verdict).
- Continuity evidence (system-scoped posture observations).
- AI governance evidence (capability invocation outcomes).
- Stabilization evidence (operational calmness threshold crossings).

## 3. UX principles

- **Readable.** Each evidence record renders as a short, scannable summary.
- **Citable.** Every record exposes its content hash and ledger reference.
- **Filterable.** Filters are sparse: by type, severity, scope, release. No free-text full-record search by default.
- **Interpretive.** Each record is paired with a one-sentence governance interpretation.
- **Audit-supporting.** Records can be exported as a calm summary bundle for procurement / audit.

## 4. Prohibited patterns

The evidence explorer MUST NOT resemble:

- A SOC panic console.
- A surveillance dashboard.
- A raw telemetry wall.
- A behavioral analytics surface.
- A vanity counter of evidence volume.

## 5. Retention discipline

The explorer respects retention classes (`short` / `standard` / `extended` / `archival`). Records past their window are visible only as redacted summaries with the original content hash preserved for audit.

## 6. Discipline

A governance evidence explorer succeeds when an auditor can reconstruct a governance act in minutes and a non-auditor never feels compelled to open it. Evidence is not for daily browsing; it is for review.
