# Production Support Runbook

Version: 2026-05
Owner: platform-ops

## Purpose

Standard operating procedure for responding to production issues while preserving runtime proof gate integrity.

## Scope

Applies to production-approved services and internal control surfaces:
- web
- partners
- union-eyes
- console
- control-plane

## Intake Checklist

1. Capture incident ID, reporter, timestamp (UTC), and impacted URL/path.
2. Classify severity (P1/P2/P3).
3. Confirm whether issue is active, intermittent, or historical.
4. Open incident channel and assign incident commander.

## Initial Triage

1. Validate endpoint status using health/root URLs.
2. Check recent release ledger entries for relevant deployments.
3. Confirm DNS/TLS health for impacted domain.
4. Check known dependencies (DB availability, auth, storage).

## Decision Tree

- If service unavailable or repeated 5xx on production URL:
  - escalate as P1
  - freeze non-critical deployments
  - prepare rollback path

- If degradation but service still available:
  - classify P2
  - apply targeted mitigation (scale/config correction)

- If no user impact and only advisory telemetry:
  - classify P3
  - queue corrective action in standard backlog

## Response Actions

1. Apply least-risk mitigation first (configuration, restart, scale).
2. If unresolved, trigger controlled rollback to last known good release.
3. Validate:
   - root path returns expected status
   - health endpoint returns 200
4. Re-run proof checks after mitigation:
   - pnpm proof:health
   - pnpm proof:runtime --period 2026-05
   - pnpm proof:runtime:gate -- --env production

## Communications

- P1: update every 15 minutes
- P2: update every 30 minutes
- P3: update at key milestones only

Each update should include:
- current impact
- mitigation action in progress
- next checkpoint time

## Resolution Criteria

Incident is resolved when:
- production endpoint behavior normalizes
- no active blocking findings
- runtime gate remains PASSED
- post-incident action items captured

## Post-Incident Requirements

Within 24 hours:
- publish timeline and root cause summary
- link evidence artifacts
- document preventive actions with owners and due dates
