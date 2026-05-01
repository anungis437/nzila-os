# Monthly Proof Cadence — May 2026

Generated: 2026-05-01
Owner: platform-ops

## Objective

Establish a repeatable monthly operational proof cycle that keeps production gate status at Grade A while surfacing drift early.

## Cadence Window

- Monthly execution window: Day 1 to Day 3 of each month
- Mid-month health verification: Day 15
- Incident-triggered re-run: within 2 hours after any P1/P2 mitigation in production

## Mandatory Monthly Steps

1. Ingest Azure runtime state:
   - pnpm proof:ingest:azure
2. Run health checks:
   - pnpm proof:health
3. Refresh security evidence:
   - pnpm proof:security
4. Generate runtime proof:
   - pnpm proof:runtime --period <YYYY-MM>
5. Enforce production gate:
   - pnpm proof:runtime:gate -- --env production
6. Export proof package:
   - pnpm proof:runtime:export

## Required Outputs

- reports/runtime/runtime-latest.json
- reports/runtime/health-latest.json
- reports/runtime/security-proof-latest.json
- reports/runtime/monthly/runtime-<YYYY-MM>.json
- period-specific operations notes in ops/outputs/

## Quality Rules

- No suppression of blocking findings without governance record.
- No period closure if unknowns are non-zero.
- All advisory findings must have owner and due date.

## Escalation Rules

- Gate fail: immediate P1 operations incident and change freeze
- Score drop below 95: P2 hardening ticket set
- Repeated advisory findings in two consecutive periods: governance review required

## Evidence Retention

- Keep monthly runtime proof JSON indefinitely in repository history.
- Keep generated operations notes and reports under ops/outputs with YYYY-MM suffix.

## Accountability

- Primary owner: platform-ops
- Approver: CTO or delegated governance authority
- Backup operator: on-call secondary
