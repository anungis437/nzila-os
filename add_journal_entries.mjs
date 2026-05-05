import { readFileSync, writeFileSync } from 'fs';
const journalPath = 'apps/union-eyes/db/migrations/meta/_journal.json';
const journal = JSON.parse(readFileSync(journalPath, 'utf8'));

const newTags = [
  '0001_nzilaos_rls_org_isolation',
  '0025_pilot_enrollments',
  '0056_add_missing_training_fks',
  '0070_predeployment_hardening',
  '0080_audit_remediation',
  '0082_add_pilot_tables',
  '0083_data_source_tables',
  '0084_claims_monetary_varchar_to_decimal',
  '0085_monetization_infrastructure_layer',
  '0086_monetization_phase2',
  '0087_add_member_location_fields',
  '0088_add_fts_gin_index',
  '0089_ingestion_hardening',
  '0090_zonga_listeners_user_id_unique',
  '0091_zonga_social_tables',
  '0092_msc_enterprise_billing',
  '0093_applications_registry',
  '0094_ms_celebrations_seed',
  '0095_ms_celebrations_auth_users',
  '0096_add_missing_ue_required_tables',
  '1770880372830_consolidate_chart_of_accounts_fixed',
  '20260212_add_hris_tables_fixed',
  '20260212_add_integration_framework_fixed',
  '20260213_add_accounting_tables_fixed',
  '20260213_add_integration_foreign_keys',
  '20260324_add_missing_tables_and_columns',
  '20260324_add_remaining_missing_tables',
  '20260325_dapl_platform_ledger',
  '20260327_staging_alignment_phase2',
  '20260327_staging_alignment_phase3',
  '20260327_staging_schema_alignment',
  '20260328_jurisdiction_preferences',
  '20260401_cba_intelligence_public_sources',
  '20260402_audit_immutability',
  '20260402_pgvector_embeddings',
  '20260404_pilot_observability',
  '20260710_clerk_to_entra_user_ids',
  '20260711_auth_password_reset_tokens',
  '20260712_org_users_unique_constraint',
  '20260713_dedup_and_quality_warnings',
  '20260714_correspondence_pipeline',
  '20260715_integration_fabric',
];

let idx = 43;
let when = 1770621534496;
for (const tag of newTags) {
  journal.entries.push({ idx, version: '7', when, tag, breakpoints: true });
  idx++;
  when += 1000;
}
writeFileSync(journalPath, JSON.stringify(journal, null, 2));
console.log(`Journal now has ${journal.entries.length} entries (idx 0-${idx - 1})`);
