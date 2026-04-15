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

## Determinism Controls
- deterministic snapshot hash from normalized input + executable rule resolution
- item trace hashes for every payroll item
- run trace hash for run-level integrity
- replay diff hash for audit persistence
