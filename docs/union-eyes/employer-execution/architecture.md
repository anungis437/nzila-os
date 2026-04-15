# Employer Execution Architecture

## Scope
Employer Execution is implemented inside Union Eyes and remains aligned to existing UE governance primitives. This pass finalizes hardening without introducing a parallel architecture.

## Authoritative Layers
1. Next API routes: auth/context, entitlements, request validation, delegation, response shaping.
2. Financial service engines: rule resolution semantics, payroll math, replay attribution, compliance policy.
3. Persistence: immutable run snapshots, item traces, compliance events, replay records, evidence artifacts.

## Executable CBA Semantics
Resolved CBA rules are represented as typed executable rules with `kind`, `strategy`, `sourceRuleId`, and `path` lineage.
Calculation is driven by executable rules, not flat rates.
Flattened values are retained only as compatibility summaries.

### Formal composition model
Each executable rule now declares explicit composition semantics:
- `replace`: become authoritative for the rule family and supersede prior applied rules
- `augment`: additively modify the active result
- `stack`: co-exist with compatible rules in the same family
- `suppress`: neutralize the prior rule family and prevent accidental carry-forward

Deterministic precedence is resolved across these axes:
1. global agreement
2. bargaining unit
3. employer
4. worksite
5. region
6. classification
7. date window
8. numeric precedence

### Supported executable rule kinds
- `base_rate`
- `overtime`
- `double_time`
- `shift_premium`
- `travel`
- `dues`
- `benefits`
- `pension`
- `statutory_holiday`
- `regional_override`
- `classification_override`

## Official Trust Boundary
- Preview runs are mutable simulation outputs.
- Official runs require lifecycle controls and compliance gates.
- Approval locks immutable snapshot semantics.
- Sealing/posted state finalizes authoritative artifacts.

## Evidence Model
For official payroll and generated remittance runs:
- structured manifest includes input refs, timesheet batch ids, rule version ids, engine version, status timeline, approvers, artifact hashes, calc trace summary hash
- manifest hash and seal are persisted as evidence artifacts
- replay references trace/evidence lineage for auditability

### Evidence chain lineage
Employer Execution now emits parent-linked chain metadata (`chainLink`) on evidence manifests and seals.

Minimum chain participants:
- payroll approval
- remittance generation
- replay creation
- approval action links
- adjustment lineage (modeled as `adjustment_run` links)

Verification walks parent pointers and validates:
- parent link existence
- parent seal continuity
- chain depth continuity

## Determinism Controls
- deterministic snapshot hash from normalized input + executable rule resolution
- item trace hashes for every payroll item
- run trace hash for run-level integrity
- replay diff hash for audit persistence

## Evaluation graph replay
Each payroll item trace now includes an evaluation graph:
- all candidate rules considered in evaluation order
- per-node condition result (`true`, `false`, `not_applicable`)
- node decision (`considered`, `skipped`, `superseded`, `applied`)
- composition mode and decision reason
- supersession links and applied path

Replay compares original vs replayed graphs and emits graph-diff change types:
- `node_added`
- `node_removed`
- `condition_changed`
- `decision_changed`
- `supersession_changed`
- `applied_path_changed`
- `value_changed`
