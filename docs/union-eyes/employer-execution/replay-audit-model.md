# Replay Audit Model

## Replay Intent

Replay is an audit control, not a mutating operation. It explains drift in deterministic execution and captures cause attribution.

## Replay Diff Contract

Each diff entry uses:

- `scope`: `run` | `employee_item` | `remittance_item`
- `subjectId`
- `field`
- `originalValue`
- `replayValue`
- `causeType`: `input_change` | `rule_change` | `engine_change` | `derived_change`
- `causeDetail`
- `originalRulePath` / `replayRulePath` (when available)

Replay also emits `graphDifferences` for evaluation-graph divergence:

- `node_added`
- `node_removed`
- `condition_changed`
- `decision_changed`
- `supersession_changed`
- `applied_path_changed`
- `value_changed`

## Cause Attribution

- `rule_change`: replay uses different resolved rules or rule version lineage.
- `engine_change`: replay engine version differs from source execution.
- `input_change`: source vs replay input snapshot differs.
- `derived_change`: downstream variance where direct root signal is not explicit.

## Persistence

1. Source run context and replay context are materialized.
2. Structured diff is stored in `employer_execution_replays.diff_json`.
3. Evaluation graph divergence is persisted in replay diff payload.
4. Diff hash is persisted for tamper detection.
5. Replay artifact is attached to evidence artifacts for operator inspection.
6. Replay evidence manifests are chain-linked to source payroll evidence lineage.

## Evaluation graph baseline

Each item trace captures a rule evaluation graph with:

- candidate nodes in deterministic order
- condition outcomes
- composition mode (`replace`, `augment`, `stack`, `suppress`)
- supersession links
- final applied path

Replay attribution is evaluated against this graph, not only totals.

## Operator UX Requirements

Replay views prioritize changed items by default and expose:

- totals delta
- entity-level changed fields
- evaluation graph changes (nodes, decisions, supersession, applied path)
- cause type + detail
- rule path lineage
- source/replay engine + rule context
