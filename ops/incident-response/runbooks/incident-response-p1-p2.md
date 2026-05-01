# Incident Response Playbook — P1/P2

Version: 2026-05
Owner: platform-ops

## Severity Definitions

- P1: Critical outage or severe functional loss affecting production users or core operations.
- P2: Significant degradation with partial workaround available.

## Roles

- Incident Commander (IC): owns decisions and cadence
- Operations Lead: executes infra/runtime actions
- Application Lead: executes service-specific fixes
- Communications Lead: stakeholder updates
- Scribe: timeline and evidence capture

## P1 Workflow

1. Declare incident and assign roles immediately.
2. Freeze all non-incident changes.
3. Validate blast radius:
   - affected domains
   - affected services
   - dependency impact
4. Execute fastest safe stabilization:
   - scale adjustment
   - config rollback
   - release rollback
5. Verify recovery via health and business-critical paths.
6. Re-run runtime proof gate after stabilization.
7. Maintain 15-minute comms cadence until resolved.

## P2 Workflow

1. Declare incident and assign IC + operators.
2. Confirm degradation metrics and user impact.
3. Apply targeted fix with minimal blast radius.
4. Validate service restoration via endpoint probes.
5. Re-run runtime proof gate if production behavior changed.
6. Maintain 30-minute updates until normal.

## Escalation Triggers

Escalate P2 to P1 if any condition occurs:
- degradation worsens to outage
- customer-facing error rate spikes persist beyond 30 minutes
- data integrity risk is detected
- mitigation attempts fail twice

## Evidence to Capture

- affected URLs and time window
- command outputs used for mitigation
- release identifiers before/after mitigation
- health check results
- runtime gate result snapshot

## Closure Checklist

1. User impact ended and verified.
2. Service health checks pass.
3. Runtime gate PASSED (no new blocking findings).
4. Root cause hypothesis documented.
5. Corrective and preventive actions created with due dates.
