# Remittance Lifecycle

## Stage Model

1. Payroll calculated.
2. Official payroll approved (critical clear + error acknowledged).
3. Remittance generated from approved payroll only.
4. Remittance items and package artifacts persisted.
5. Evidence manifest + seal persisted.
6. Remittance evidence is chain-linked to parent payroll approval lineage.
7. Compliance monitoring continues until operational closeout.

## Status Policy

- Payroll lifecycle: `draft` -> `calculated` -> `approved` -> `posted`
- Remittance lifecycle: generated package remains immutable and traceable
- Replay lifecycle: audit record only; no mutation of authoritative payroll/remittance rows

## Invariants

- Remittance generation is rejected for non-approved payroll runs.
- Replay does not mutate source run data.
- Adjustments must produce explicit new runs rather than mutating approved runs.
- Approval actions and downstream artifacts must preserve evidence chain continuity.
- Adjustment runs should link to parent approved payroll lineage as `adjustment_run` evidence entities.

## Evidence Semantics

Remittance evidence manifest captures:

- input refs (payroll run / source batch)
- rule version references
- engine version
- status timeline
- approver context from payroll
- artifact hashes
- calc trace summary hash linkage

The evidence seal is derived from manifest hash and run identity for tamper-evident verification.

## Replay and remittance interplay

- Replay runs are audit-only and produce standalone evidence manifests.
- Replay evidence is parent-linked to source payroll evidence for forensic continuity.
- Remittance evidence and replay evidence can co-exist on the same payroll lineage branch.
