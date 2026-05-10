# Governance Safety & Anti-Surveillance Posture

Institutional Operating Intelligence is **organizational cognition**, not
employee monitoring. This document is normative.

## Forbidden Cognition Modes

- Workforce surveillance.
- Individual employee scoring, ranking, or monitoring.
- Predictive discipline or retention targeting.
- Personality / sentiment profiling of identified individuals.
- Any analysis whose unit-of-observation is a single person.

## Allowed Cognition Modes

- Organizational, departmental, role-cohort, or process-level analysis.
- Institutional learning, governance reasoning, continuity forecasting.
- Aggregated, anonymized signals about systemic dynamics.

## Runtime Enforcement

`assertLaborSafe(ctx)` is invoked automatically by `defineCognitionEngine`.
It throws `CognitionGovernanceViolation` for any of:

- Missing `organizationId`.
- `scopeOfObservation: 'individual'`.
- `ranksIndividuals: true`.
- `predictsDisciplineOrRetention: true`.
- `usesIdentifiedSentiment: true`.

## Build-Time Enforcement

A repo-wide ESLint rule (`tooling/eslint-rules/cognition-architecture.cjs`)
prevents:

- Importing cognition primitives from anywhere other than
  `@nzila/institutional-cognition-core`.
- Defining `interface ...Profile` engines that bypass the kernel SDK.

## Review Process for Exceptions

There are no exceptions. If a use case appears to require individual-level
analysis, the correct path is to redesign the question at organizational
scope. Domain owners cannot waive this constraint locally.
