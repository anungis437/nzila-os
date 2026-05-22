# Financial Service Governance Recovery

<!--
  ARTIFACT TYPE: Governance Policy
  CHANGE CLASS: Standard
  GOVERNANCE: docs/doctrine/DOCTRINE_GOVERNANCE.md
  STATUS: Active
  LAST_VALIDATED: 2026-05-22
-->

## Purpose

This policy closes a governance blind spot where Union Eyes service runtime surfaces could drift outside active validation boundaries.

The financial-service is classified as a strategic runtime surface. It must be visible to compile, lint, test, and release governance checks.

## Incident Class

The prior state created false operational confidence:

- the root Union Eyes app surface could pass while `services/**` degraded,
- financial runtime compile failures and crash paths were not release-blocking,
- contract drift in payroll/remittance/compliance could accumulate without immediate governance signal.

## Governance Rule

No production runtime surface may exist outside governance validation boundaries.

## Required Controls

1. Dedicated financial-service gate with blocking authority.
2. Required service checks: `typecheck`, `lint`, `test`.
3. Governance composite must include financial-service gate status.
4. Release readiness must fail closed when financial-service checks fail.
5. CI must run service checks on pull requests that touch Union Eyes/service surfaces.

## Runtime Survivability Expectations

1. Catch paths must never throw secondary errors.
2. Error output must be deterministic, structured, and safe.
3. Runtime boundaries must validate payload shape for all financial operations.
4. Stripe webhooks must fail closed on missing/invalid signatures.
5. Idempotency and replay handling must be explicitly tested.

## Testing Expectations

Minimum required test families:

- route integration tests for donations, payroll, remittances, arrears,
- contract tests for critical runtime payloads,
- runtime failure survivability tests,
- Stripe replay and malformed payload tests.

## Observability Expectations

1. Financial failures must emit operationally actionable events.
2. Logs must exclude sensitive financial payloads.
3. Error telemetry must preserve correlation and impact classification.

## Ownership

- Primary owner: Union Eyes platform runtime team.
- Secondary owner: Platform governance.
- Review cadence: each release cut and monthly governance audit.
