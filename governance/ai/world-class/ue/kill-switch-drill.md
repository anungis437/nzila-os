# UE AI Kill Switch Drill Record

Owner: UE Lead
Last updated: 2026-06-08
Scope: union-eyes-triage

## Kill Switch

1. Feature flag: UE_AI_TRIAGE_ENABLED
2. Manual fallback: UE manual triage pipeline

## Drill Execution

1. Disable UE_AI_TRIAGE_ENABLED in non-prod and verify requests fail closed to manual workflow.
2. Measure disable propagation target <= 5 minutes.
3. Re-enable flag and confirm route health + SLO recovery.

## Evidence

1. Drill status: PASS
2. Propagation time: 2m 14s
3. Fallback verification: PASS
4. Recovery verification: PASS
