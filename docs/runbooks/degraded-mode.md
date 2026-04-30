# Degraded Mode Runbook

## Objective
Maintain critical customer operations when dependencies are partially unavailable.

## Degradation Controls
- Enforce read-only mode for non-essential writes.
- Queue asynchronous operations for replay.
- Disable non-critical integrations.
- Expose operator-visible banner with expected behavior.

## Activation Criteria
- External provider outage.
- Persistent dependency timeout > 2x SLO threshold.
- Policy engine or evidence store unavailable.

## Recovery Steps
1. Stabilize with feature flags and rate limits.
2. Backfill queued operations once dependencies recover.
3. Re-run policy checks for deferred operations.
4. Emit evidence events for each replayed decision.

## Exit Conditions
- Dependency health stable for 30 minutes.
- Backlog drained.
- Audit event stream reconciled.
