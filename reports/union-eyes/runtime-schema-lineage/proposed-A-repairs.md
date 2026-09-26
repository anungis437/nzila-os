# Proposed A repairs — final

Generated: 2026-09-23T14:14:30.958Z

## Implemented (19/19)
- **billing_subscriptions** → `apps/union-eyes/db/migrations-platform/0001_billing_subscriptions.sql` (PLATFORM_SQL_OWNED)
- **cba_rule_versions** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **cba_rule_set_items** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_execution_profiles** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_timesheet_batches** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_timesheet_entries** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_payroll_runs** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_payroll_run_items** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_remittance_runs** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_remittance_run_items** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_execution_artifacts** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_execution_replays** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_execution_evidence_links** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **employer_execution_compliance_events** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **break_policies** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **member_breaks** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **satisfaction_surveys** → `apps/union-eyes/db/migrations-platform/0002_employer_execution_and_related_a.sql` (PLATFORM_SQL_OWNED)
- **integration_partners** → `apps/union-eyes/db/migrations-platform/0003_integration_partners_and_security_posture.sql` (PLATFORM_SQL_OWNED)
- **security_posture_checks** → `apps/union-eyes/db/migrations-platform/0003_integration_partners_and_security_posture.sql` (PLATFORM_SQL_OWNED)

## Still BLOCKED: 0

## Resolution of final 2
- integration_partners → PLATFORM_SQL via 0003 (evidence: no Django; dashboard SELECT; TENANT_RLS_REQUIRED)
- security_posture_checks → PLATFORM_SQL via 0003 (evidence: no Django; dashboard SELECT; TENANT_RLS_REQUIRED; external writer acknowledged in authority)