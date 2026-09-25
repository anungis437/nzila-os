# Union Eyes Runtime Schema Authority Oracle

Generated: 2026-09-23T15:17:00.751Z

This report treats the storage-authority registry as the runtime-storage universe and reconciles it against repository migration history. It does not mutate Azure, does not generate migrations, and does not claim the current fresh bootstrap is complete.

## Status

- F60040_SCHEMA: PARTIAL_RUNTIME_SCHEMA
- PREVIOUS_RUNTIME_CONTRACT_COMPLETENESS: INSUFFICIENT
- CANONICAL_SCHEMA_AUTHORITY_CLOSURE: BLOCKED
- PRE_COMPLETE_RUNTIME_SCHEMA_DIGEST: f60040e62c1253d0e3aa6476e993241c331f8e02b10a16015ec83c2577a73c47

## Counts

- storageAuthorityEntries: 805
- runtimeUniverseTables: 349
- tenantOrMixedRuntimePrincipalTables: 349
- tablesWithNonEmptyRuntimePrivileges: 346
- rlsRequiredTables: 326
- runtimeTablesWithExistingCreationMigration: 339
- runtimeTablesWithoutCreationMigration: 10
- runtimeTablesWithOwner: 339
- runtimeTablesWithoutSchemaOwner: 10
- runtimeTablesWithMultipleSchemaOwners: 233
- bootstrapParticipatingCreationTables: 64
- bootstrapMissingCreationTables: 285

## Lineages

| lineage | owner | directory | execution mechanism | current bootstrap status |
|---|---|---|---|---|
| DJANGO_MIGRATIONS | DJANGO_OWNED | apps/union-eyes/backend/**/migrations | Django migration executor | NOT_EXECUTED_BY_FRESH_BOOTSTRAP |
| UNION_EYES_LEGACY_SQL | PLATFORM_SQL_OWNED | apps/union-eyes/db/migrations | Frozen historical SQL/Drizzle lineage; guarded by .lineage-frozen | NOT_EXECUTED_BY_FRESH_BOOTSTRAP |
| UNION_EYES_SCOPED_SQL | SCOPED_AUTHORITY_OWNED | apps/union-eyes/db/migrations-cache | tooling/scripts/lib/union-eyes-scoped-migrations.mjs via db:bootstrap and db:scoped-migrate:existing | EXECUTED_BY_FRESH_BOOTSTRAP |
| UNION_EYES_PLATFORM_SQL | PLATFORM_SQL_OWNED | apps/union-eyes/db/migrations-platform | tooling/scripts/lib/union-eyes-platform-migrations.mjs via db:bootstrap (after scoped) | EXECUTED_BY_FRESH_BOOTSTRAP |
| UNION_EYES_AUDIT_SQL | PLATFORM_SQL_OWNED | apps/union-eyes/db/migrations-audit | Audit/forensic SQL lineage; no fresh-bootstrap executor found | NOT_EXECUTED_BY_FRESH_BOOTSTRAP |
| ROOT_PLATFORM_SQL | PLATFORM_SQL_OWNED | migrations/platform | Root platform SQL lineage; no Union Eyes fresh-bootstrap executor found | NOT_EXECUTED_BY_FRESH_BOOTSTRAP |
| ROOT_SQL | PLATFORM_SQL_OWNED | migrations | Root SQL lineage; execution governed by repository-level migration manifest where applicable | NOT_EXECUTED_BY_FRESH_BOOTSTRAP |
| SHARED_DRIZZLE_SQL | PLATFORM_SQL_OWNED | packages/db/drizzle | Shared package Drizzle lineage; not executed by Union Eyes fresh bootstrap | NOT_EXECUTED_BY_FRESH_BOOTSTRAP |
| QA_BASELINE_SQL | QA_BASELINE_ONLY | tooling/sql | QA/CI bootstrap fallback when no snapshot exists or user_management is absent | OPTIONAL_QA_CI_BASELINE |
| SCRIPTED_SQL | SCRIPTED_OR_STUB_ONLY | scripts | Ad hoc scripted SQL; not canonical unless separately governed | FORENSIC_OR_SCRIPTED_ONLY |
| SERVICE_SQL | EXTERNAL | apps/union-eyes/services/** | Service-local SQL lineage, potentially separate database boundary | NOT_EXECUTED_BY_FRESH_BOOTSTRAP |

## Critical Runtime Tables

| table | owner | creation lineage | creating migration | current bootstrap participates | readers | writers |
|---|---|---|---|---|---|---|
| ai_grievance_triages | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations-platform/0004_audit_gap_canonical_tables.sql | YES | 1 | 1 |
| billing_accounts | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql | NO | 3 | 1 |
| billing_periods | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql | NO | 5 | 1 |
| billing_subscriptions | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations-platform/0001_billing_subscriptions.sql | YES | 1 | 0 |
| document_versions | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations/manual/070_governed_case_access_documents.sql | NO | 5 | 5 |
| org_subscriptions | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql | YES | 7 | 5 |
| pension_plans | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations-platform/0004_audit_gap_canonical_tables.sql | YES | 3 | 2 |
| platform_invoices | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql | YES | 5 | 2 |
| platform_payments | PLATFORM_SQL_OWNED | ACTIVE_SQL_PLATFORM_LINEAGE | apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql | YES | 4 | 2 |

## Tables Without Creation Lineage

- anti_scab_violations (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- cnesst_filings (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- joint_hs_committees (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- member_dues_issues (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- pay_equity_exercises (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- payroll_deductions (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- preventive_withdrawals (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- right_of_refusal_events (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- wcb_claims (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)
- wcb_employer_assessments (UNKNOWN; PROJECTED_OR_RUNTIME_USED_WITHOUT_CREATION_LINEAGE)