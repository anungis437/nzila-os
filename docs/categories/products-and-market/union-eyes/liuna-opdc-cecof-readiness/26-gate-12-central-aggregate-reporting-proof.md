# 26 - Gate 12 Central Aggregate Reporting Proof

## Gate Decision

`LIUNA_GATE_12_CENTRAL_AGGREGATE_REPORTING = CLOSED_FOR_AGGREGATE_API`

The cross-organization analytics route now exposes aggregate-only metric summaries instead of raw local analytics rows.

## Implementation Boundary

`/api/analytics/cross-org` now returns:

- `dataClass: aggregate_only`;
- grouped metric summaries by metric type;
- source row count;
- contributing organization count;
- numeric total, average, min, and max values;
- period range and latest trend;
- `rawRowsExposed: false`.

It does not return raw row IDs, organization IDs, local names, metadata, member IDs, case IDs, or local record payloads.

## Validation

Source and test:

- `apps/union-eyes/app/api/analytics/cross-org/route.ts`
- `apps/union-eyes/app/api/__tests__/analytics-cross-org.route.test.ts`

Focused validation:

`pnpm --filter @nzila/union-eyes test -- app/api/__tests__/analytics-cross-org.route.test.ts`

Result: PASS, 1 file / 1 test.

Compilation validation:

`pnpm --filter @nzila/union-eyes typecheck`

Result: PASS.

## Claim Boundary

This gate supports a truthful claim that central or platform-level analytics can be exposed as aggregate reporting without disclosing raw affiliated-local analytics rows.

It does not prove a complete OPDC/CECOF dashboard workflow, local opt-in consent workflow, suppression thresholds, or a live LIUNA taxonomy. Those remain discovery and pilot-hardening work.

## Sensitive-Pilot Implication

The central-reporting risk is reduced because the API boundary no longer emits raw local analytics records. Sensitive legal pilot readiness still needs a configured central dashboard journey and real LIUNA reporting requirements before central oversight can be represented as complete.
