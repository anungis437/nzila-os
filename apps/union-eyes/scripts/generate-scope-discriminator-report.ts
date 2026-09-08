#!/usr/bin/env tsx
/**
 * scripts/generate-scope-discriminator-report.ts
 *
 * PR #752 round 51 (GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY):
 * durable, advisory-only partition of the round-51 "no-org" NEEDS_REVIEW
 * universe (cohortKey COMPLEX:none:NORMAL / COMPLEX:none:HIGH in the
 * storage-authority census, plus two tables the mechanical census cohort
 * key missed — federation_remittances, which had zero TS references at all
 * so its schema-scan orgColumn/parentForeignKeys lookup never ran, and
 * cba_intel_review_decisions, part of the same cohort) into the 13
 * STORAGE_SCOPE_DISCRIMINATOR categories defined by the round-51 spec.
 *
 * This script NEVER rewrites the manifest — it is a durable evidence record
 * of the investigation performed this round (real-caller git-grep traces,
 * Django ViewSet permission audits, schema column checks), not a live
 * re-scanner. Every table's `finalManifestClassification` field reflects
 * the ACTUAL db/rls-storage-authority/*.ts disposition applied (or, for the
 * unclosed remainder, the fact that it remains NEEDS_REVIEW pending further
 * review). See db/rls-storage-authority/*.ts for the authoritative
 * classification; this report explains WHY.
 *
 * Usage: tsx scripts/generate-scope-discriminator-report.ts
 * Output: reports/union-eyes-scope-discriminator-round51.{json,md}
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const APP_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'reports')

type ScopePartition =
  | 'TRUE_GLOBAL_REFERENCE'
  | 'PLATFORM_SHARED_CONFIGURATION'
  | 'SYSTEM_INTERNAL'
  | 'TENANT_SCOPE_MISSING'
  | 'USER_SCOPE_MISSING'
  | 'PARENT_SCOPE_MISSING'
  | 'MIXED_GLOBAL_TENANT'
  | 'FINANCE_REFERENCE'
  | 'PRIVACY_OR_SOVEREIGNTY_SENSITIVE'
  | 'CREDENTIAL_CONFIGURATION'
  | 'SEPARATE_DATABASE_BOUNDARY'
  | 'LATENT_OR_CONTAINED'
  | 'UNKNOWN'

interface PartitionedTable {
  table: string
  partition: ScopePartition
  finalManifestClassification: string
  status: 'CLOSED' | 'EXCEPTION_QUEUE'
  evidence: string
}

// prettier-ignore
const TABLES: PartitionedTable[] = [
  // ---- CONTAINED (dead TS + Django IsAuthenticated-only -> DenyAll/SharedDenyAll) ----
  { table: 'swiss_cold_storage', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/break-glass-service.ts + services/force-majeure-integration.ts both zero production importers (git-grep confirmed); compliance/views.py SwissColdStorageViewSet was IsAuthenticated-only -> DenyAllPermission.' },
  { table: 'break_glass_system', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same break-glass-service.ts cluster as swiss_cold_storage; round 49 only contained the sibling BreakGlassActivationsViewSet, explicitly left this one out of scope.' },
  { table: 'disaster_recovery_drills', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same break-glass-service.ts cluster.' },
  { table: 'emergency_declarations', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same break-glass-service.ts cluster.' },
  { table: 'recovery_time_objectives', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same break-glass-service.ts cluster.' },
  { table: 'fmv_audit_log', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/joint-trust-fmv-service.ts zero production importers; billing/views.py FmvAuditLogViewSet -> SharedDenyAllPermission.' },
  { table: 'fmv_benchmarks', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster.' },
  { table: 'fmv_policy', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster.' },
  { table: 'fmv_violations', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster.' },
  { table: 'cpi_adjusted_pricing', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster.' },
  { table: 'cpi_data', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster (distinct from cost_of_living_data, which is externally-sourced and still open).' },
  { table: 'independent_appraisals', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster.' },
  { table: 'procurement_bids', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster.' },
  { table: 'procurement_requests', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same joint-trust-fmv-service.ts cluster.' },
  { table: 'strike_fund_payment_audit', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/whiplash-prevention-service.ts zero production importers; billing/views.py StrikeFundPaymentAuditViewSet -> SharedDenyAllPermission.' },
  { table: 'stripe_connect_accounts', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Django ViewSet already SharedDenyAllPermission from a prior round; manifest classification had never been updated to match -- fixed this round (no Django edit needed).' },
  { table: 'tax_year_end_processing', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Django ViewSet already SharedDenyAllPermission from a prior round; manifest classification had never been updated to match -- fixed this round (no Django edit needed).' },
  { table: 'cross_border_transactions', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Both lib/services/currency-service.ts and services/currency-enforcement-service.ts zero production importers; billing/views.py CrossBorderTransactionsViewSet -> SharedDenyAllPermission.' },
  { table: 'arms_length_verification', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/founder-conflict-service.ts zero production importers; compliance/views.py -> DenyAllPermission.' },
  { table: 'conflict_of_interest_policy', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same founder-conflict-service.ts cluster.' },
  { table: 'data_classification_registry', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/employer-non-interference-service.ts zero production importers; compliance/views.py -> DenyAllPermission.' },
  { table: 'union_only_data_tags', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same employer-non-interference-service.ts cluster.' },
  { table: 'certification_compliance_reports', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/certification-management-service.ts (+ dead lib/api/*-service-api.ts Django-bridge scaffolding) zero production importers; compliance/views.py -> DenyAllPermission.' },
  { table: 'certification_types', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same certification-management-service.ts cluster; confirmed distinct from the separate staff_certifications (per-member credential assignment) table, untouched.' },
  { table: 'license_renewals', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same certification-management-service.ts cluster.' },
  { table: 'foreign_workers', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/lmbp-immigration-service.ts (+ dead Django-bridge) zero production importers; compliance/views.py -> DenyAllPermission.' },
  { table: 'lmbp_compliance_alerts', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same lmbp-immigration-service.ts cluster.' },
  { table: 'lmbp_compliance_reports', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same lmbp-immigration-service.ts cluster.' },
  { table: 'lmbp_letters', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same lmbp-immigration-service.ts cluster.' },
  { table: 'mentorships', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same lmbp-immigration-service.ts cluster.' },
  { table: 'band_council_consent', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'services/indigenous-data-service.ts zero production importers (barrel-exported from lib/services/index.ts but unused); compliance/views.py -> DenyAllPermission.' },
  { table: 'band_councils', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same indigenous-data-service.ts cluster.' },
  { table: 'indigenous_data_sharing_agreements', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same indigenous-data-service.ts cluster.' },
  { table: 'traditional_knowledge_registry', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same indigenous-data-service.ts cluster.' },
  { table: 'knowledge_base_articles', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'lib/services/support-service.ts searchKnowledgeBase/getKBArticleBySlug zero callers, consistent with round 44 finding this same file dead for ticket_comments/ticket_history; core/views.py -> DenyAllPermission.' },
  { table: 'sla_policies', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same support-service.ts cluster (getSLAMetrics).' },
  { table: 'country_address_formats', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'lib/address/address-service.ts zero production importers; auth_core/views.py -> DenyAllPermission.' },
  { table: 'address_validation_cache', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same address-service.ts cluster.' },
  { table: 'clc_bargaining_trends', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'lib/services/external-data/clc-partnership-service.ts zero production importers; billing/views.py -> SharedDenyAllPermission.' },
  { table: 'clc_union_density', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same clc-partnership-service.ts cluster.' },
  { table: 'clc_oauth_tokens', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same clc-partnership-service.ts cluster (also CREDENTIAL_CONFIGURATION-adjacent: stores OAuth tokens -- an extra reason this generated CRUD surface must stay denied).' },
  { table: 'lrb_agreements', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'lib/services/external-data/lrb-unified-service.ts zero production importers; compliance/views.py -> DenyAllPermission.' },
  { table: 'lrb_sync_log', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Same lrb-unified-service.ts cluster.' },
  { table: 'exchange_rates', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'lib/services/currency-service.ts zero production importers; billing/views.py -> SharedDenyAllPermission (distinct from the already-closed currency_exchange_rates).' },
  { table: 'federation_remittances', partition: 'LATENT_OR_CONTAINED', finalManifestClassification: 'CONTAINED_NO_AUTHORITY', status: 'CLOSED', evidence: 'Confirmed ZERO TypeScript consumer anywhere (round-31 finding only ever documented the Django exposure); unions/views.py -> DenyAllPermission.' },

  // ---- TRUE_GLOBAL_REFERENCE / PLATFORM_SHARED_CONFIGURATION (closed) ----
  { table: 'cba_intel_sources', partition: 'TRUE_GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', status: 'CLOSED', evidence: 'CBA_INTELLIGENCE domain root, no org column anywhere in the domain (round-43 root assumption CONFIRMED); mutated by org admin/steward via ordinary org-authenticated routes, same content-integrity risk class as its round-43 descendants; the ingestion-scheduler.ts cron path is unwired (zero callers), not a live SYSTEM_SCHEDULE path.' },
  { table: 'cba_intel_review_decisions', partition: 'TRUE_GLOBAL_REFERENCE', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', status: 'CLOSED', evidence: 'Same CBA_INTELLIGENCE domain, polymorphic targetType/targetId into the shared dataset, reviewerId is just the acting user not an org scope.' },
  { table: 'feature_flags', partition: 'PLATFORM_SHARED_CONFIGURATION', finalManifestClassification: 'GLOBAL_REFERENCE_DATA', status: 'CLOSED', evidence: 'No org column at all -- one row per globally-unique flag name. REAL DEFECT FOUND+FIXED: PATCH /api/admin/feature-flags used withAdminAuth (ordinary per-org admin role) to flip a platform-wide kill switch; fixed to withSystemAdminAuth (isSystemAdmin()).' },

  // ---- EXCEPTION QUEUE (still NEEDS_REVIEW; genuinely complex, not force-closed) ----
  { table: 'geofences', partition: 'TENANT_SCOPE_MISSING', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'services/geofence-privacy-service.ts has REAL production callers (app/api/emergency/{activate,recovery}, app/api/location/{consent,geofence,track}) -- likely per-organization/per-local geofence definitions with no persisted org discriminator; candidate tenant-scope defect, not verified deeply enough this round to disposition safely.' },
  { table: 'location_deletion_log', partition: 'SYSTEM_INTERNAL', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same geofence-privacy-service.ts cluster as geofences -- an append-only deletion audit log; likely SYSTEM_INTERNAL but tied to the same unresolved tenant-scope question as its parent.' },
  { table: 'location_tracking_config', partition: 'TENANT_SCOPE_MISSING', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same geofence-privacy-service.ts cluster -- likely per-org tracking configuration with no persisted org discriminator.' },
  { table: 'privacy_breaches', partition: 'TENANT_SCOPE_MISSING', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'services/provincial-privacy-service.ts has REAL production callers (app/api/emergency/{dashboard,pipeda}, app/api/privacy/consent) -- an incident log, likely org-specific, no persisted org discriminator found.' },
  { table: 'provincial_privacy_config', partition: 'PRIVACY_OR_SOVEREIGNTY_SENSITIVE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same provincial-privacy-service.ts cluster -- likely genuine province/jurisdiction-level privacy-law reference (PIPEDA vs provincial regimes), a special jurisdictional-governance case per round-51 doctrine section 30, not yet independently verified.' },
  { table: 'arbitrator_profiles', partition: 'UNKNOWN', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'lib/services/precedent-service.ts has REAL production callers (app/api/precedents, app/api/precedents/search). Round-51 doctrine section 23 requires field-by-field review (public bio vs private evaluation/rate data may coexist in one row) -- not completed this round.' },
  { table: 'external_data_sync_log', partition: 'SYSTEM_INTERNAL', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'lib/services/external-data/wage-enrichment-service.ts has a REAL SYSTEM_SCHEDULE caller (app/api/cron/external-data-sync). Likely a genuine sync audit log, not independently verified/dispositioned this round.' },
  { table: 'contribution_rates', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'wage-enrichment-service.ts (cron) + a GraphQL resolver module both real callers -- pension/wage contribution-rate reference data; ejected per round-51 doctrine section 31 (do not broaden into finance convergence).' },
  { table: 'cost_of_living_data', partition: 'TRUE_GLOBAL_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'wage-enrichment-service.ts (cron) real caller -- externally-sourced CPI-adjacent reference data, likely TRUE_GLOBAL_REFERENCE, but effective-dated/lineage review (doctrine sections 19-20) not completed this round.' },
  { table: 'wage_benchmarks', partition: 'TRUE_GLOBAL_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same wage-enrichment-service.ts cluster -- externally-sourced benchmark data, lineage review not completed this round.' },
  { table: 'movement_trends', partition: 'TENANT_SCOPE_MISSING', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'REAL dashboard page callers (app/[locale]/dashboard/movement-insights/{page,export/page}.tsx) -- likely per-organization movement-analytics insights with no persisted org discriminator; candidate defect, not verified deeply enough to disposition safely.' },
  { table: 'pending_profiles', partition: 'USER_SCOPE_MISSING', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'REAL TS callers (actions/pending-profiles-actions.ts, actions/whop-actions.ts, app/api/onboarding, app/api/continuity/inheritance) -- a pre-signup record keyed by email (no user_id yet exists). auth_core/views.py PendingProfilesViewSet is ALSO still IsAuthenticated-only with no scope filter -- a real Django-side exposure alongside the TS path, flagged but not fixed this round pending full TS-route auth verification.' },
  { table: 'user_uuid_mapping', partition: 'SEPARATE_DATABASE_BOUNDARY', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'lib/utils/user-uuid-helpers.ts (this app) + services/financial-service/{drizzle,src/db}/schema.ts (a SEPARATE deployable package/database) both reference this table name -- mixed same-name-different-boundary evidence per round-48 precedent; auth_core/views.py UserUuidMappingViewSet ALSO still IsAuthenticated-only, flagged but not fixed this round.' },
  { table: 'data_classification_policy', partition: 'PLATFORM_SHARED_CONFIGURATION', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'REAL TS callers (app/api/privacy/{breach,dsar,provincial}) -- likely platform-wide privacy-classification doctrine, not independently verified/dispositioned this round.' },
  { table: 'currency_enforcement_audit', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'services/transfer-pricing-service.ts has a REAL production caller (app/api/billing/validate) -- transfer-pricing/tax-compliance audit trail; ejected per round-51 doctrine section 31.' },
  { table: 'fx_rate_audit_log', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same transfer-pricing-service.ts cluster; ejected per doctrine section 31.' },
  { table: 't106_filing_tracking', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same transfer-pricing-service.ts cluster (CRA T106 cross-border filing); ejected per doctrine section 31.' },
  { table: 'bank_of_canada_rates', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same transfer-pricing-service.ts cluster -- externally-sourced but consumed inside the transfer-pricing tax-compliance engine; ejected per doctrine section 31 rather than split from its consuming domain.' },
  { table: 'currency_enforcement_policy', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same transfer-pricing-service.ts cluster; ejected per doctrine section 31.' },
  { table: 'currency_enforcement_violations', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same transfer-pricing-service.ts cluster; ejected per doctrine section 31.' },
  { table: 'transaction_currency_conversions', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Referenced by both the dead lib/services/multi-currency-treasury-service.ts AND the live services/transfer-pricing-service.ts -- the live reference keeps this open; ejected per doctrine section 31.' },
  { table: 'transfer_pricing_documentation', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'Same transfer-pricing-service.ts cluster; ejected per doctrine section 31.' },
  { table: 'fee_settlement_batches', partition: 'FINANCE_REFERENCE', finalManifestClassification: 'NEEDS_REVIEW', status: 'EXCEPTION_QUEUE', evidence: 'services/platform-economics/transaction-fee-engine.ts. Round 46 ALREADY found and explicitly ejected a PRINCIPAL_MISMATCH defect in this exact module (webhook-invoked code using tenant db instead of withSystemContext), recommending "a dedicated future round auditing services/platform-economics/**" -- round 51 respects that boundary and does not force-close this table.' },
]

function main() {
  const closed = TABLES.filter((t) => t.status === 'CLOSED')
  const exceptionQueue = TABLES.filter((t) => t.status === 'EXCEPTION_QUEUE')

  const partitionCounts: Record<string, number> = {}
  for (const t of TABLES) {
    partitionCounts[t.partition] = (partitionCounts[t.partition] ?? 0) + 1
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    round: 51,
    universe: 'COMPLEX:none:NORMAL + COMPLEX:none:HIGH cohort from the round-38 census, plus federation_remittances and cba_intel_review_decisions (see header comment)',
    totalTablesPartitioned: TABLES.length,
    closedCount: closed.length,
    exceptionQueueCount: exceptionQueue.length,
    partitionCounts,
    tables: TABLES,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'union-eyes-scope-discriminator-round51.json'), JSON.stringify(summary, null, 2))

  const md: string[] = []
  md.push('# Union Eyes Storage Scope Discriminator Report (round 51)')
  md.push('')
  md.push(`Generated: ${summary.generatedAt}`)
  md.push('')
  md.push('Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.')
  md.push('')
  md.push(`Total no-org candidates partitioned: ${summary.totalTablesPartitioned} (closed this round: ${summary.closedCount}, exception queue / still NEEDS_REVIEW: ${summary.exceptionQueueCount})`)
  md.push('')
  md.push('## Partition counts')
  md.push('')
  md.push('| Partition | Count |')
  md.push('| --- | --- |')
  for (const [partition, count] of Object.entries(partitionCounts).sort((a, b) => b[1] - a[1])) {
    md.push(`| ${partition} | ${count} |`)
  }
  md.push('')
  md.push('## Closed this round')
  md.push('')
  md.push('| Table | Partition | Final classification | Evidence |')
  md.push('| --- | --- | --- | --- |')
  for (const t of closed) {
    md.push(`| ${t.table} | ${t.partition} | ${t.finalManifestClassification} | ${t.evidence} |`)
  }
  md.push('')
  md.push('## Exception queue (still NEEDS_REVIEW)')
  md.push('')
  md.push('| Table | Partition | Evidence |')
  md.push('| --- | --- | --- |')
  for (const t of exceptionQueue) {
    md.push(`| ${t.table} | ${t.partition} | ${t.evidence} |`)
  }
  md.push('')

  writeFileSync(resolve(OUT_DIR, 'union-eyes-scope-discriminator-round51.md'), md.join('\n'))

  console.log(`Total partitioned: ${summary.totalTablesPartitioned}`)
  console.log(`Closed: ${summary.closedCount}`)
  console.log(`Exception queue: ${summary.exceptionQueueCount}`)
  console.log('Report written to reports/union-eyes-scope-discriminator-round51.{json,md}')
}

main()
