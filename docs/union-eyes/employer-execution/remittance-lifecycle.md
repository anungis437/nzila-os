# Remittance Lifecycle

## Lifecycle Stages
1. Payroll approved: official payroll run enters approved state.
2. Package generated: employer_remittance_runs row created.
3. Remittance items grouped: employer_remittance_run_items rows persisted.
4. Artifacts written: CSV/JSON/summary artifacts with hashes.
5. Evidence sealed: evidence manifest + seal artifacts created.
6. Compliance monitored: due-date and blocking checks tracked.

## Important Distinction
- Imported remittances and reconciliation stay in existing dues/remittance architecture.
- Generated execution remittance runs are separate lifecycle records.

## Due Date Logic
Pilot default is period_end + 15 days via runtime profile.
