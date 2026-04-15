# Remittance Lifecycle

## Stage Model
1. Payroll calculated.
2. Official payroll approved (critical clear + error acknowledged).
3. Remittance generated from approved payroll only.
4. Remittance items and package artifacts persisted.
5. Evidence manifest + seal persisted.
6. Compliance monitoring continues until operational closeout.

## Status Policy
- Payroll lifecycle: `draft` -> `calculated` -> `approved` -> `posted`
- Remittance lifecycle: generated package remains immutable and traceable
- Replay lifecycle: audit record only; no mutation of authoritative payroll/remittance rows

## Invariants
- Remittance generation is rejected for non-approved payroll runs.
- Replay does not mutate source run data.
- Adjustments must produce explicit new runs rather than mutating approved runs.

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
