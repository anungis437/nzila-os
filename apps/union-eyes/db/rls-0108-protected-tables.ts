/**
 * db/rls-0108-protected-tables.ts
 *
 * Single source of truth for the tables db/migrations/0108_rls_tenant_isolation_foundation.sql
 * originally enables RLS on (24 tables), split by parent-owned vs direct
 * vs the one no-tenant-access exception. Both scripts/rls-verify.ts (the
 * live deployment-gate preflight) and
 * scripts/generate-authority-convergence-report.ts (the read-only
 * convergence report) import this SAME list — extracted here in PR #752
 * round 5 so the two consumers cannot silently drift into two different
 * "what does 0108 protect" answers (see the round-5 review's item 8:
 * "manifest, policy-expansion set and eventual grant generator must share
 * one authoritative source rather than parallel hand-maintained lists").
 *
 * IMPORTANT: this is a manually-curated mirror of 0108's actual
 * ue_create_*_rls_policy()/ENABLE ROW LEVEL SECURITY calls, not a live
 * parse of the migration SQL — keep it in sync if 0108 (or a follow-up
 * migration extending its protected set) changes. rls-verify.ts's own
 * checkTableRlsState() is what actually asserts these tables have RLS
 * enabled on a live database; this list only says which tables SHOULD.
 */

export const PROTECTED_DIRECT_TABLES = [
  'organization_members',
  'organizations',
  'grievances',
  'claims',
  'grievance_deadlines',
  'documents',
  'member_documents',
  'workplace_incidents',
  'safety_inspections',
  'hazard_reports',
  'safety_committee_meetings',
  'safety_training_records',
  'ppe_equipment',
  'safety_audits',
  'injury_logs',
  'safety_policies',
  'corrective_actions',
  'safety_certifications',
  'message_threads',
] as const

export const PROTECTED_PARENT_OWNED_TABLES = [
  'messages',
  'message_participants',
  'message_read_receipts',
  'message_notifications',
] as const

export const PROTECTED_NO_TENANT_ACCESS_TABLES = ['cross_org_access_log'] as const

export const ALL_0108_PROTECTED_TABLES: readonly string[] = [
  ...PROTECTED_DIRECT_TABLES,
  ...PROTECTED_PARENT_OWNED_TABLES,
  ...PROTECTED_NO_TENANT_ACCESS_TABLES,
]
