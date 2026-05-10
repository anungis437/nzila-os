# Disaster Recovery Playbook: Azure Region Loss

## Trigger Conditions

- Prolonged outage of primary region services (compute, storage, control plane).
- Critical degradation where SLA/SLO recovery in-region is not feasible.

## Immediate Actions (0-30 min)

1. Declare Sev 1 disaster event and activate incident bridge.
2. Freeze non-essential deployments and traffic changes.
3. Confirm blast radius across compute, data, secrets, and AI endpoints.
4. Publish internal and external status communications.

## Containment and Failover

1. Activate secondary-region recovery sequence by service priority tier.
2. Restore secrets and configuration in secondary environment.
3. Validate data consistency and RPO/RTO conformance.
4. Shift traffic progressively with health and error-rate guards.

## Recovery

1. Maintain degraded-mode policy until full verification passes.
2. Reconcile data deltas and replay required event streams.
3. Conduct post-event review with corrective actions and timeline.

## Evidence Requirements

- failover start and completion timestamps
- service-by-service recovery status
- RTO/RPO measurements
- communication timeline
- corrective action register
