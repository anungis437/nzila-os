# Employer Execution Domain Model

## Primary Tables
- employer_execution_profiles
- employer_timesheet_batches
- employer_timesheet_entries
- cba_rule_versions
- cba_rule_set_items
- employer_payroll_runs
- employer_payroll_run_items
- employer_payroll_adjustments
- employer_remittance_runs
- employer_remittance_run_items
- employer_execution_compliance_events
- employer_execution_artifacts
- employer_execution_replays

## Foreign Key Anchors
- organization_id on all tables for strict org scoping.
- member_employment_id, job_classification_id for labor context reuse.
- collective_agreement_id + cba_rule_version_id for executable CBA lineage.
- employer/worksite/bargaining_unit references for operational scoping.

## Immutability Pattern
- Official payroll and remittance runs set immutable_snapshot_locked=true.
- Snapshots/traces/artifacts are append-only and hash-addressed.

## Hashes
- source_file_hash on batches.
- source_row_hash on entries.
- calc_trace_hash on payroll runs.
- trace_hash on payroll run items.
- artifact_hash on all artifacts.
- diff_hash on replays.
