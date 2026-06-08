# Platform Cognition Incident Playbook Addendum

Owner: Platform Lead
Last updated: 2026-06-08
Scope: platform-cognition-phase1

## Detection Signals

1. Core cognition inference error rate > 1% for 5 minutes.
2. P95 cognition pipeline latency > 1500ms for 10 minutes.
3. Unexpected drift in output confidence distributions.
4. Budget anomaly in cognition model usage.

## Containment

1. Set PLATFORM_COGNITION_ENABLED=false.
2. Switch to deterministic baseline fallback path.
3. Lock deployment channel to last-known-good release.

## Recovery

1. Verify fallback integrity and downstream service health.
2. Restore platform cognition after 30 minutes of green SLO signals.
3. Complete incident timeline and governance evidence update.
