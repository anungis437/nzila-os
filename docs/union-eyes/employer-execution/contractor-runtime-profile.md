# Contractor Runtime Profile

## Purpose
Activate contractor-grade employer execution behavior inside Union Eyes for selected orgs without creating a separate product.

## Profile Definition
- Table: employer_execution_profiles
- profile_code: contractor_execution
- status: active
- jurisdiction: ontario (pilot)
- currency: CAD
- config_json:
  - timezone
  - remittanceDueOffsetDays
  - payPeriod conventions

## Required Entitlements
- employer_execution
- employer_timesheet_ingest
- employer_payroll_preview
- employer_payroll_official
- employer_remittance_generation
- employer_execution_replay
- employer_execution_compliance

## Activation Sequence
1. Insert profile for organization.
2. Grant required org_entitlements feature keys.
3. Seed employer/worksite/unit/classification/employment/CBA-rule-version.
4. Confirm dashboard access at /dashboard/employer-execution.
