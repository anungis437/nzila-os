# Replay Audit Model

## Replay Intent
Replay is an audit control, not a mutating operation. It explains drift in deterministic execution and captures cause attribution.

## Replay Diff Contract
Each diff entry uses:
- `scope`: `run` | `employee_item` | `remittance_item`
- `entityId`
- `field`
- `originalValue`
- `replayValue`
- `causeType`: `input_change` | `rule_change` | `engine_change` | `derived_change`
- `causeDetail`
- `originalRulePath` / `replayRulePath` (when available)

## Cause Attribution
- `rule_change`: replay uses different resolved rules or rule version lineage.
- `engine_change`: replay engine version differs from source execution.
- `input_change`: source vs replay input snapshot differs.
- `derived_change`: downstream variance where direct root signal is not explicit.

## Persistence
1. Source run context and replay context are materialized.
2. Structured diff is stored in `employer_execution_replays.diff_json`.
3. Diff hash is persisted for tamper detection.
4. Replay artifact is attached to evidence artifacts for operator inspection.

## Operator UX Requirements
Replay views prioritize changed items by default and expose:
- totals delta
- entity-level changed fields
- cause type + detail
- rule path lineage
- source/replay engine + rule context
