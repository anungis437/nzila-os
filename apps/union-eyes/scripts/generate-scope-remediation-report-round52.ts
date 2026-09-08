#!/usr/bin/env tsx
/**
 * scripts/generate-scope-remediation-report-round52.ts
 *
 * PR #752 round 52 (NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION): durable,
 * advisory-only remediation record for the 13 non-finance exceptions the
 * round-51 scope-discriminator report left in its EXCEPTION_QUEUE (see
 * reports/union-eyes-scope-discriminator-round51.{json,md}, which is a
 * historical round-51 artifact and is NOT modified by this script or this
 * round).
 *
 * This script NEVER rewrites the manifest. Every table's
 * `finalManifestClassification` field reflects the ACTUAL
 * db/rls-storage-authority/*.ts disposition applied this round. See
 * db/rls-storage-authority/*.ts for the authoritative classification.
 *
 * Usage: tsx scripts/generate-scope-remediation-report-round52.ts
 * Output: reports/union-eyes-scope-remediation-round52.{json,md}
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const APP_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

type Family =
  | 'LOCATION_AND_GEOFENCE'
  | 'PRIVACY_AND_JURISDICTION'
  | 'EXTERNAL_REFERENCE_AND_SYNC'
  | 'DIRECTORY_PROFILE'
  | 'DERIVED_MOVEMENT_INSIGHT'
  | 'PRE_AUTH_IDENTITY'
  | 'CROSS_SERVICE_IDENTITY_MAPPING'

interface RemediatedTable {
  table: string
  round51Partition: string
  family: Family
  finalScope: 'TENANT' | 'GLOBAL_REFERENCE' | 'SEPARATE_DATABASE' | 'CONTAINED'
  finalManifestClassification: string
  trustedRoot: string | null
  tenantRuntimePrivileges: string[]
  systemRuntimePrivileges: string[]
  invocationAuthority: string
  dbExecutionPrincipal: string
  djangoDisposition: string
  concreteDefectFixed: string | null
  status: 'CLOSED'
}

// prettier-ignore
const TABLES: RemediatedTable[] = [
  { table: 'geofences', round51Partition: 'TENANT_SCOPE_MISSING', family: 'LOCATION_AND_GEOFENCE', finalScope: 'TENANT', finalManifestClassification: 'TENANT_RLS_REQUIRED', trustedRoot: 'unionLocalId (server-derived via getOrganizationIdForUser(caller), never client-supplied)', tenantRuntimePrivileges: ['SELECT', 'INSERT'], systemRuntimePrivileges: [], invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'GeofencesViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: 'POST /api/location/geofence trusted client-supplied body.unionLocalId (cross-tenant geofence creation IDOR); GET checkGeofenceEntry accepted arbitrary userId query param (fabricated attendance); no cross-tenant read guard on entry-check', status: 'CLOSED' },
  { table: 'location_deletion_log', round51Partition: 'SYSTEM_INTERNAL', family: 'LOCATION_AND_GEOFENCE', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: ['INSERT'], systemRuntimePrivileges: [], invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'LocationDeletionLogViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },
  { table: 'location_tracking_config', round51Partition: 'TENANT_SCOPE_MISSING', family: 'LOCATION_AND_GEOFENCE', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: ['SELECT', 'INSERT'], systemRuntimePrivileges: [], invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'LocationTrackingConfigViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },

  { table: 'privacy_breaches', round51Partition: 'TENANT_SCOPE_MISSING', family: 'PRIVACY_AND_JURISDICTION', finalScope: 'CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', trustedRoot: null, tenantRuntimePrivileges: [], systemRuntimePrivileges: [], invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'PrivacyBreachesViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },
  { table: 'provincial_privacy_config', round51Partition: 'PRIVACY_OR_SOVEREIGNTY_SENSITIVE', family: 'PRIVACY_AND_JURISDICTION', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: ['SELECT'], systemRuntimePrivileges: [], invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'ProvincialPrivacyConfigViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },
  { table: 'data_classification_policy', round51Partition: 'PLATFORM_SHARED_CONFIGURATION', family: 'PRIVACY_AND_JURISDICTION', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: ['SELECT', 'INSERT'], systemRuntimePrivileges: [], invocationAuthority: 'MIXED', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'DataClassificationPolicyViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: "app/api/privacy/{breach,dsar,provincial}/route.ts used writeRole:'admin' (ordinary per-org role) to gate platform-wide compliance-doctrine mutation (no organizationId column at all) -> fixed to 'compliance_manager' (platform-elevated role)", status: 'CLOSED' },

  { table: 'external_data_sync_log', round51Partition: 'SYSTEM_INTERNAL', family: 'EXTERNAL_REFERENCE_AND_SYNC', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: ['INSERT', 'UPDATE'], systemRuntimePrivileges: ['INSERT', 'UPDATE'], invocationAuthority: 'SYSTEM_SCHEDULE', dbExecutionPrincipal: 'MIXED (SYSTEM_RUNTIME via the 2 fixed sync paths; still TENANT_RUNTIME via the frozen finance syncContributionRates path)', djangoDisposition: 'ExternalDataSyncLogViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },
  { table: 'cost_of_living_data', round51Partition: 'TRUE_GLOBAL_REFERENCE', family: 'EXTERNAL_REFERENCE_AND_SYNC', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: [], systemRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE'], invocationAuthority: 'SYSTEM_SCHEDULE', dbExecutionPrincipal: 'SYSTEM_RUNTIME', djangoDisposition: 'CostOfLivingDataViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: 'syncCOLAData ran on the plain tenant db despite SYSTEM_SCHEDULE cron invocation (round-46-class principal mismatch) -> wrapped in withSystemContext', status: 'CLOSED' },
  { table: 'wage_benchmarks', round51Partition: 'TRUE_GLOBAL_REFERENCE', family: 'EXTERNAL_REFERENCE_AND_SYNC', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: [], systemRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE'], invocationAuthority: 'SYSTEM_SCHEDULE', dbExecutionPrincipal: 'SYSTEM_RUNTIME', djangoDisposition: 'WageBenchmarksViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: 'syncWageData ran on the plain tenant db despite SYSTEM_SCHEDULE cron invocation (round-46-class principal mismatch) -> wrapped in withSystemContext', status: 'CLOSED' },

  { table: 'arbitrator_profiles', round51Partition: 'UNKNOWN', family: 'DIRECTORY_PROFILE', finalScope: 'CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', trustedRoot: null, tenantRuntimePrivileges: [], systemRuntimePrivileges: [], invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'ArbitratorProfilesViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },

  { table: 'movement_trends', round51Partition: 'TENANT_SCOPE_MISSING', family: 'DERIVED_MOVEMENT_INSIGHT', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: ['SELECT'], systemRuntimePrivileges: [], invocationAuthority: 'TENANT_USER', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'MovementTrendsViewSet allowed full CRUD to any authenticated user of any org with no officer-role gate at all -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },

  { table: 'pending_profiles', round51Partition: 'USER_SCOPE_MISSING', family: 'PRE_AUTH_IDENTITY', finalScope: 'GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', trustedRoot: null, tenantRuntimePrivileges: ['SELECT', 'INSERT'], systemRuntimePrivileges: [], invocationAuthority: 'MIXED', dbExecutionPrincipal: 'TENANT_RUNTIME', djangoDisposition: 'PendingProfilesViewSet was IsAuthenticated-only -> contained DenyAllPermission', concreteDefectFixed: "app/api/onboarding/route.ts and its alias app/api/continuity/inheritance/route.ts used readRole:'member' (no organizationId column on this pre-signup table) -> any authenticated member of any org could list every pre-signup user's email/Whop-membership/billing data -> fixed to readRole:'support_agent' (platform-elevated)", status: 'CLOSED' },

  { table: 'user_uuid_mapping', round51Partition: 'SEPARATE_DATABASE_BOUNDARY', family: 'CROSS_SERVICE_IDENTITY_MAPPING', finalScope: 'CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', trustedRoot: null, tenantRuntimePrivileges: [], systemRuntimePrivileges: [], invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', djangoDisposition: 'UserUuidMappingViewSet allowed full CRUD (incl. UPDATE, an identity-reassignment/account-takeover-equivalent op) to any authenticated user -> contained DenyAllPermission', concreteDefectFixed: null, status: 'CLOSED' },
]

const FINANCE_FROZEN_EXCEPTIONS = [
  'contribution_rates',
  'currency_enforcement_audit',
  'fx_rate_audit_log',
  't106_filing_tracking',
  'bank_of_canada_rates',
  'currency_enforcement_policy',
  'currency_enforcement_violations',
  'transaction_currency_conversions',
  'transfer_pricing_documentation',
  'fee_settlement_batches',
]

function main() {
  const familyCounts: Record<string, number> = {}
  for (const t of TABLES) familyCounts[t.family] = (familyCounts[t.family] ?? 0) + 1

  const concreteDefects = TABLES.filter((t) => t.concreteDefectFixed !== null)

  const summary = {
    generatedAt: new Date().toISOString(),
    round: 52,
    mission: 'NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION',
    startSha: '2984cc9a035c6cac970a0d836cb7182149f6945b',
    upstreamReport: 'reports/union-eyes-scope-discriminator-round51.json (historical, unmodified this round)',
    totalTablesRemediated: TABLES.length,
    familyCounts,
    financeFrozenExceptions: FINANCE_FROZEN_EXCEPTIONS,
    financeFreezeStatus: 'PRESERVED — none of these 10 tables, their manifest classifications, or their runtime principal architecture were touched this round',
    concreteDefectsFixedCount: concreteDefects.length,
    tables: TABLES,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'union-eyes-scope-remediation-round52.json'), JSON.stringify(summary, null, 2))

  const md: string[] = []
  md.push('# Union Eyes Scope Remediation Report (round 52)')
  md.push('')
  md.push(`Generated: ${summary.generatedAt}`)
  md.push('')
  md.push('Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.')
  md.push('')
  md.push('This report remediates the 13 non-finance exceptions left open by the round-51 scope-discriminator report (reports/union-eyes-scope-discriminator-round51.md, a historical artifact NOT modified this round).')
  md.push('')
  md.push(`Total tables remediated: ${summary.totalTablesRemediated} (all CLOSED)`)
  md.push('')
  md.push('## Family counts')
  md.push('')
  md.push('| Family | Count |')
  md.push('| --- | --- |')
  for (const [family, count] of Object.entries(familyCounts)) {
    md.push(`| ${family} | ${count} |`)
  }
  md.push('')
  md.push('## 13-table disposition matrix')
  md.push('')
  md.push('| Table | Round-51 partition | Final scope | Final classification | Django | Concrete defect fixed |')
  md.push('| --- | --- | --- | --- | --- | --- |')
  for (const t of TABLES) {
    md.push(`| ${t.table} | ${t.round51Partition} | ${t.finalScope} | ${t.finalManifestClassification} | ${t.djangoDisposition} | ${t.concreteDefectFixed ?? '(none — dead-code/Django-only containment)'} |`)
  }
  md.push('')
  md.push('## Finance freeze (must remain PRESERVED)')
  md.push('')
  md.push(summary.financeFreezeStatus)
  md.push('')
  for (const f of FINANCE_FROZEN_EXCEPTIONS) md.push(`- ${f}`)
  md.push('')

  writeFileSync(resolve(OUT_DIR, 'union-eyes-scope-remediation-round52.md'), md.join('\n'))

  console.log(`Total remediated: ${summary.totalTablesRemediated}`)
  console.log(`Concrete defects fixed: ${summary.concreteDefectsFixedCount}`)
  console.log('Report written to reports/union-eyes-scope-remediation-round52.{json,md}')
}

main()
