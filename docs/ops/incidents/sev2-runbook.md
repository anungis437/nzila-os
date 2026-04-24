# SEV2 Runbook

## Trigger

- Major feature unavailable for a subset of users.
- Significant latency degradation without full outage.

## Roles

- Incident commander.
- Scribe.
- Technical owner.

## First 30 Minutes

1. Declare SEV2 and open incident thread.
2. Confirm owner and scope.
3. Validate current error budget burn.
4. Apply mitigation or feature flag fallback.

## Communications Cadence

- Internal updates every 30 minutes.
- Customer updates every 60 minutes when needed.

## Escalation

- Escalate to SEV1 if blast radius grows or data integrity risk appears.

## Exit Criteria

- Critical user path restored.
- Error/latency trends return to baseline.
- Follow-up tasks captured.
