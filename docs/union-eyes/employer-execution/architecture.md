# Employer Execution Architecture

## Scope
Employer Execution is a first-class capability inside Union Eyes. It extends the existing UE financial/compliance architecture and does not replace imported remittance reconciliation.

## Core Flow
1. Runtime profile + entitlements enable contractor execution mode for an organization.
2. Operator uploads timesheet CSV.
3. Timesheet rows normalize into execution tables with validation summary.
4. Payroll engine performs deterministic staged calculation.
5. Official run locks immutable snapshot and trace.
6. Remittance engine generates package outputs and due date.
7. Compliance engine emits actionable and blocking events.
8. Replay engine compares original and replayed outcomes.
9. Evidence artifacts are hashed and sealed.

## Bounded Contexts
- Schema domain: apps/union-eyes/db/schema/domains/employer-execution
- Service engines: apps/union-eyes/services/financial-service/src/services/employer-execution
- Next APIs: apps/union-eyes/app/api/employer-execution
- Dashboard workspace: apps/union-eyes/app/[locale]/dashboard/employer-execution
- Worker jobs: apps/union-eyes/lib/workers/employer-execution

## Data Separation
- Existing employer remittance import/reconciliation remains unchanged.
- Generated remittance runs are persisted in dedicated employer_execution remittance tables.

## Determinism Controls
- Input snapshot persisted before official calc.
- Rule-version resolution trace persisted with source hash.
- Per-run engineVersion persisted.
- Item-level trace and trace hash persisted.
- Replay diff persisted for audit explainability.
