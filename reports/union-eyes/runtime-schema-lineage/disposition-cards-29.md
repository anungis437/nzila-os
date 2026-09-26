# Runtime schema no-lineage disposition cards (29)

Generated: 2026-09-23T13:55:34.748Z
Legend source: USER_BRIEF

## Disposition legend (A–G)

- **A** — GENUINE_MISSING_CREATION_LINEAGE
- **B** — STALE/RETIRED_RUNTIME_AUTHORITY
- **C** — EXTERNAL/NONLOCAL_STORAGE
- **D** — VIEW/DERIVED/NON-TABLE OBJECT
- **E** — RENAMED/REPLACED PHYSICAL TABLE
- **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- **G** — OTHER EXPLICITLY EVIDENCED DISPOSITION

## Remap from prior local legend

- local-C → A: GENUINE_MISSING_CREATION_LINEAGE (19)
- local-B → G: OTHER EXPLICITLY EVIDENCED (staging non-governed DDL; 2)
- local-D → F: INTENTIONALLY_OPTIONAL FEATURE STORAGE (8)

## Summary

- Cards: 29
- By disposition: {"F":8,"A":19,"G":2}
- UNADJUDICATED_NO_LINEAGE_TABLES: 0

## Cards

### anti_scab_violations

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/cnesst-schema
- DRIZZLE_PROJECTION: domains/health-safety/cnesst-schema.antiScabViolations
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\cnesst-schema.ts:387:export const antiScabViolations = pgTable("anti_scab_violations", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### billing_subscriptions

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (1): apps/union-eyes/app/api/dues/billing-cycle/route.ts
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/finance/platform-billing
- DRIZZLE_PROJECTION: domains/finance/platform-billing.billingSubscriptions
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\finance\platform-billing.ts:371:export const billingSubscriptions = pgTable('billing_subscriptions', {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### break_policies

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/member/member-breaks
- DRIZZLE_PROJECTION: domains/member/member-breaks.breakPolicies
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":1,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\member\member-breaks.ts:74:export const breakPolicies = pgTable("break_policies", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### cba_rule_set_items

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (3): apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts; apps/union-eyes/services/financial-service/src/services/employer-execution/rule-resolution-engine.ts
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-execution-core
- DRIZZLE_PROJECTION: domains/employer-execution/employer-execution-core.cbaRuleSetItems
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":2,"sqlCreate":0,"pyCreate":0,"runtime":1,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-execution-core.ts:77:  "cba_rule_set_items",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### cba_rule_versions

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (5): apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts; apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts; apps/union-eyes/services/financial-service/src/services/employer-execution/cba-version-resolver.ts
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-execution-core
- DRIZZLE_PROJECTION: domains/employer-execution/employer-execution-core.cbaRuleVersions
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":1,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-execution-core.ts:38:  "cba_rule_versions",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### cnesst_filings

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/cnesst-schema
- DRIZZLE_PROJECTION: domains/health-safety/cnesst-schema.cneesstFilings
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\cnesst-schema.ts:107:export const cneesstFilings = pgTable("cnesst_filings", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_execution_artifacts

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: mixed
- RUNTIME_PRIVILEGES: SELECT, INSERT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (9): apps/union-eyes/app/[locale]/dashboard/employer-execution/payroll-runs/[id]/page.tsx; apps/union-eyes/app/[locale]/dashboard/employer-execution/remittance-runs/[id]/page.tsx; apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts
- ACTIVE_RUNTIME_WRITERS (4): apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts; apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-remittance-runs.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-artifacts
- DRIZZLE_PROJECTION: domains/employer-execution/employer-artifacts.employerExecutionArtifacts
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":3,"rls":9}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-artifacts.ts:40:  "employer_execution_artifacts",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_execution_compliance_events

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: mixed
- RUNTIME_PRIVILEGES: SELECT, INSERT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (7): apps/union-eyes/app/[locale]/dashboard/employer-execution/compliance/page.tsx; apps/union-eyes/app/[locale]/dashboard/employer-execution/payroll-runs/[id]/page.tsx; apps/union-eyes/app/[locale]/dashboard/employer-execution/remittance-runs/[id]/page.tsx; apps/union-eyes/app/api/employer-execution/compliance/route.ts; apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts
- ACTIVE_RUNTIME_WRITERS (5): apps/union-eyes/app/api/employer-execution/compliance/route.ts; apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-compliance.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-compliance
- DRIZZLE_PROJECTION: domains/employer-execution/employer-compliance.employerExecutionComplianceEvents
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":2,"rls":9}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-compliance.ts:30:  "employer_execution_compliance_events",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_execution_evidence_links

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (3): apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts; apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-artifacts
- DRIZZLE_PROJECTION: domains/employer-execution/employer-artifacts.employerExecutionEvidenceLinks
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-artifacts.ts:97:  "employer_execution_evidence_links",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_execution_profiles

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (3): apps/union-eyes/app/[locale]/dashboard/employer-execution/settings/page.tsx; apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-runtime-profile
- DRIZZLE_PROJECTION: domains/employer-execution/employer-runtime-profile.employerExecutionProfiles
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-runtime-profile.ts:21:  "employer_execution_profiles",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_execution_replays

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: mixed
- RUNTIME_PRIVILEGES: SELECT, INSERT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (2): apps/union-eyes/app/[locale]/dashboard/employer-execution/payroll-runs/[id]/page.tsx; apps/union-eyes/lib/workers/employer-execution/process-replay-run.ts
- ACTIVE_RUNTIME_WRITERS (2): apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-replay.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-artifacts
- DRIZZLE_PROJECTION: domains/employer-execution/employer-artifacts.employerExecutionReplays
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":1,"rls":9}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-artifacts.ts:68:  "employer_execution_replays",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_payroll_run_items

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (6): apps/union-eyes/app/[locale]/dashboard/employer-execution/payroll-runs/[id]/page.tsx; apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts; apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-payroll-runs.ts
- ACTIVE_RUNTIME_WRITERS (2): apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-payroll-runs.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-payroll-runs
- DRIZZLE_PROJECTION: domains/employer-execution/employer-payroll-runs.employerPayrollRunItems
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":4,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-payroll-runs.ts:68:  "employer_payroll_run_items",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_payroll_runs

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (8): apps/union-eyes/app/[locale]/dashboard/employer-execution/payroll-runs/[id]/page.tsx; apps/union-eyes/app/[locale]/dashboard/employer-execution/payroll-runs/page.tsx; apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts
- ACTIVE_RUNTIME_WRITERS (4): apps/union-eyes/app/api/employer-execution/payroll-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/lib/workers/employer-execution/process-payroll-run.ts; apps/union-eyes/services/financial-service/src/routes/employer-payroll-runs.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-payroll-runs
- DRIZZLE_PROJECTION: domains/employer-execution/employer-payroll-runs.employerPayrollRuns
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":2,"sqlCreate":0,"pyCreate":0,"runtime":7,"rls":11}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-payroll-runs.ts:29:  "employer_payroll_runs",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_remittance_run_items

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (1): apps/union-eyes/app/api/employer-execution/remittance-runs/[id]/route.ts
- ACTIVE_RUNTIME_WRITERS (1): apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-remittance-runs
- DRIZZLE_PROJECTION: domains/employer-execution/employer-remittance-runs.employerRemittanceRunItems
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-remittance-runs.ts:55:  "employer_remittance_run_items",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_remittance_runs

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (5): apps/union-eyes/app/[locale]/dashboard/employer-execution/remittance-runs/[id]/page.tsx; apps/union-eyes/app/[locale]/dashboard/employer-execution/remittance-runs/page.tsx; apps/union-eyes/app/api/employer-execution/remittance-runs/[id]/route.ts; apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-remittance-runs.ts
- ACTIVE_RUNTIME_WRITERS (3): apps/union-eyes/app/api/employer-execution/remittance-runs/route.ts; apps/union-eyes/lib/workers/employer-execution/process-remittance-run.ts; apps/union-eyes/services/financial-service/src/routes/employer-remittance-runs.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-remittance-runs
- DRIZZLE_PROJECTION: domains/employer-execution/employer-remittance-runs.employerRemittanceRuns
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":2,"sqlCreate":0,"pyCreate":0,"runtime":3,"rls":11}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-remittance-runs.ts:25:  "employer_remittance_runs",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_timesheet_batches

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (4): apps/union-eyes/app/[locale]/dashboard/employer-execution/timesheets/page.tsx; apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/app/api/employer-execution/timesheets/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-timesheets.ts
- ACTIVE_RUNTIME_WRITERS (3): apps/union-eyes/app/api/employer-execution/timesheets/route.ts; apps/union-eyes/lib/workers/employer-execution/process-timesheet-validation.ts; apps/union-eyes/services/financial-service/src/routes/employer-timesheets.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-timesheets
- DRIZZLE_PROJECTION: domains/employer-execution/employer-timesheets.employerTimesheetBatches
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":2,"sqlCreate":0,"pyCreate":0,"runtime":3,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-timesheets.ts:33:  "employer_timesheet_batches",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### employer_timesheet_entries

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (5): apps/union-eyes/app/[locale]/dashboard/employer-execution/timesheets/page.tsx; apps/union-eyes/app/api/employer-execution/payroll-runs/route.ts; apps/union-eyes/app/api/employer-execution/replay/[runId]/route.ts; apps/union-eyes/lib/workers/employer-execution/process-timesheet-validation.ts; apps/union-eyes/services/financial-service/src/routes/employer-timesheets.ts
- ACTIVE_RUNTIME_WRITERS (2): apps/union-eyes/app/api/employer-execution/timesheets/route.ts; apps/union-eyes/services/financial-service/src/routes/employer-timesheets.ts
- STORAGE_AUTHORITY_DOMAIN: domains/employer-execution/employer-timesheets
- DRIZZLE_PROJECTION: domains/employer-execution/employer-timesheets.employerTimesheetEntries
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":2,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\employer-execution\employer-timesheets.ts:62:  "employer_timesheet_entries",
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### integration_partners

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (1): apps/union-eyes/app/[locale]/dashboard/integrations/page.tsx
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/infrastructure/integrations
- DRIZZLE_PROJECTION: domains/infrastructure/integrations.integrationPartners
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":1,"rls":9}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\infrastructure\integrations.ts:241:export const integrationPartners = pgTable('integration_partners', {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### joint_hs_committees

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/cnesst-schema
- DRIZZLE_PROJECTION: domains/health-safety/cnesst-schema.jointHsCommittees
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\cnesst-schema.ts:271:export const jointHsCommittees = pgTable("joint_hs_committees", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### member_breaks

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (1): apps/union-eyes/app/api/breaks/compliance/route.ts
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/member/member-breaks
- DRIZZLE_PROJECTION: domains/member/member-breaks.memberBreaks
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\member\member-breaks.ts:121:export const memberBreaks = pgTable("member_breaks", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### member_dues_issues

- DISPOSITION: **G** — OTHER EXPLICITLY EVIDENCED DISPOSITION
- PRIOR_LOCAL_DISPOSITION: B
- REMAP_RATIONALE: Explicit evidence of CREATE only in gitignored local staging DDL (migrations/staging/...). Not governed lineage. Runtime authority still present (not retired). Classified OTHER EXPLICITLY EVIDENCED rather than STALE/RETIRED.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (1): apps/union-eyes/app/api/dues/issues/route.ts
- STORAGE_AUTHORITY_DOMAIN: dues-finance-schema
- DRIZZLE_PROJECTION: dues-finance-schema.memberDuesIssues
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":1,"pyCreate":0,"runtime":2,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\dues-finance-schema.ts:452:export const memberDuesIssues = pgTable('member_dues_issues', {
- SQL_CREATE_HIT: migrations\staging\union-eyes\create-dues-finance-tables.sql:236:CREATE TABLE IF NOT EXISTS member_dues_issues (
- CREATION_MIGRATION_CANDIDATE: migrations/staging/union-eyes/create-dues-finance-tables.sql

### pay_equity_exercises

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/cnesst-schema
- DRIZZLE_PROJECTION: domains/health-safety/cnesst-schema.payEquityExercises
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\cnesst-schema.ts:336:export const payEquityExercises = pgTable("pay_equity_exercises", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### payroll_deductions

- DISPOSITION: **G** — OTHER EXPLICITLY EVIDENCED DISPOSITION
- PRIOR_LOCAL_DISPOSITION: B
- REMAP_RATIONALE: Explicit evidence of CREATE only in gitignored local staging DDL (migrations/staging/...). Not governed lineage. Runtime authority still present (not retired). Classified OTHER EXPLICITLY EVIDENCED rather than STALE/RETIRED.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (1): apps/union-eyes/app/api/dues/deductions/route.ts
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: dues-finance-schema
- DRIZZLE_PROJECTION: dues-finance-schema.payrollDeductions
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":1,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\dues-finance-schema.ts:409:export const payrollDeductions = pgTable('payroll_deductions', {
- SQL_CREATE_HIT: migrations\staging\union-eyes\create-dues-finance-tables.sql:214:CREATE TABLE IF NOT EXISTS payroll_deductions (
- CREATION_MIGRATION_CANDIDATE: migrations/staging/union-eyes/create-dues-finance-tables.sql

### preventive_withdrawals

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/cnesst-schema
- DRIZZLE_PROJECTION: domains/health-safety/cnesst-schema.preventiveWithdrawals
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\cnesst-schema.ts:228:export const preventiveWithdrawals = pgTable("preventive_withdrawals", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### right_of_refusal_events

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/cnesst-schema
- DRIZZLE_PROJECTION: domains/health-safety/cnesst-schema.rightOfRefusalEvents
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\cnesst-schema.ts:170:export const rightOfRefusalEvents = pgTable("right_of_refusal_events", {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### satisfaction_surveys

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (1): apps/union-eyes/lib/services/satisfaction-service.ts
- ACTIVE_RUNTIME_WRITERS (1): apps/union-eyes/lib/services/satisfaction-service.ts
- STORAGE_AUTHORITY_DOMAIN: domains/claims/satisfaction
- DRIZZLE_PROJECTION: domains/claims/satisfaction.satisfactionSurveys
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\claims\satisfaction.ts:42:  'satisfaction_surveys',
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### security_posture_checks

- DISPOSITION: **A** — GENUINE_MISSING_CREATION_LINEAGE
- PRIOR_LOCAL_DISPOSITION: C
- REMAP_RATIONALE: Active runtime projection with no governed CREATE; genuine missing creation lineage.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: true
- ACTIVE_RUNTIME_READERS (1): apps/union-eyes/app/[locale]/dashboard/security/page.tsx
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/infrastructure/audit
- DRIZZLE_PROJECTION: domains/infrastructure/audit.securityPostureChecks
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":1,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\infrastructure\audit.ts:133:export const securityPostureChecks = pgTable('security_posture_checks', {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### wcb_claims

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/provincial-wcb-schema
- DRIZZLE_PROJECTION: domains/health-safety/provincial-wcb-schema.wcbClaims
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\provincial-wcb-schema.ts:52:export const wcbClaims = pgTable('wcb_claims', {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null

### wcb_employer_assessments

- DISPOSITION: **F** — INTENTIONALLY_OPTIONAL FEATURE STORAGE
- PRIOR_LOCAL_DISPOSITION: D
- REMAP_RATIONALE: Drizzle schema + storage-authority/RLS present but no active runtime readers/writers; intentionally optional / latent feature storage until product activates surface.
- SCHEMA_OWNER: UNKNOWN
- CREATION_MIGRATION: null
- CURRENT_BOOTSTRAP_INCLUDED: false
- RUNTIME_PRINCIPAL: tenant
- RUNTIME_PRIVILEGES: SELECT, INSERT, UPDATE, DELETE
- RLS_REQUIRED: true
- ACTIVE_RUNTIME_REFERENCE: false
- ACTIVE_RUNTIME_READERS (0): (none)
- ACTIVE_RUNTIME_WRITERS (0): (none)
- STORAGE_AUTHORITY_DOMAIN: domains/health-safety/provincial-wcb-schema
- DRIZZLE_PROJECTION: domains/health-safety/provincial-wcb-schema.wcbEmployerAssessments
- CANONICAL_REQUIREMENT: UNRESOLVED
- EVIDENCE_COUNTS: {"schema":1,"authority":1,"sqlCreate":0,"pyCreate":0,"runtime":0,"rls":8}
- SCHEMA_HIT: apps/union-eyes\db\schema\domains\health-safety\provincial-wcb-schema.ts:119:export const wcbEmployerAssessments = pgTable('wcb_employer_assessments', {
- SQL_CREATE_HIT: (none)
- CREATION_MIGRATION_CANDIDATE: null
