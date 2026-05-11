# SEV1 Runbook

## Trigger

- Full outage on Tier 1 or Internal critical systems.
- Security event with production impact.
- Data corruption risk.

## Roles

- Incident commander: accountable for timeline and decisions.
- Scribe: records all facts and timestamps.
- Technical owner: executes mitigation steps.

## First 15 Minutes

1. Declare SEV1 and open incident channel.
2. Confirm commander, scribe, technical owner.
3. Freeze non-essential releases.
4. Capture blast radius by app, org, and region.
5. Execute safe rollback decision tree.

## Rollback Decision Tree

1. Is customer-facing impact ongoing and increasing?
2. Is a known-good artifact available?
3. Do synthetic checks fail for critical flows?
4. If yes on all, rollback immediately.

## Communications Cadence

- Internal updates every 15 minutes.
- Customer-facing status every 30 minutes.

## Exit Criteria

- Service stable for 30 minutes.
- Alert storm stopped.
- Action items captured with owners.
