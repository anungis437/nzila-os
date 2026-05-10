# Employer Execution Evidence Chain

## Purpose

Evidence chain links provide parent-child lineage across payroll approvals, remittance generation, replay audits, and adjustment runs. The chain ensures artifacts are tamper-evident and traceable through operational lifecycle events.

## Entity types

- `payroll_run`
- `remittance_run`
- `replay`
- `approval`
- `adjustment_run`

## Link contract

Each link captures:

- `linkId`: deterministic identifier for chain node
- `organizationId`
- `entityType` and `entityId`
- `manifestHash`
- `sealHash`
- `chainDepth`
- optional parent pointers: `parentLinkId`, `parentSealHash`

## Persistence

- Evidence manifests and seals are persisted in employer execution artifacts.
- Chain lineage metadata is persisted in `employer_execution_evidence_links` for structural traversal and verification.

## Verification rules

Chain verification evaluates the following invariants:

1. every parent link exists
2. parent seal hash matches parent node seal
3. chain depth increments from parent to child
4. root nodes have no parent

## Failure examples

- Parent link missing
- Parent seal mismatch
- Child depth not greater than parent depth
- Circular or disconnected lineage

## Operational usage

- Payroll approval creates a root payroll evidence link and an approval child link.
- Remittance generation links to the approved payroll link.
- Replay records link to source payroll evidence.
- Adjustment runs should link to original approved payroll lineage.
