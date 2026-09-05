# Migration Manifest

**Auto-generated cryptographic verification for database migrations**

## Repository State

- **Repository:** `anungis437/nzila-os`
- **Branch:** main
- **Commit:** local
- **Short Commit:** local
- **Generated:** 2026-09-03T04:41:51.026Z
- **Migrations Directory:** `db/migrations`
- **Total Migrations:** 96

## Migration Files

| Prefix | Filename | SHA-256 Hash | Size | First Line |
|--------|----------|--------------|------|------------|
| 0000 | 0000_flippant_luke_cage.sql | `07668a87...aa91105c` | 16.98 KB | DO $$ BEGIN |
| 0001 | 0001_phase5b_inter_union_features.sql | `9ef7e383...b4cb1a74` | 42.47 KB | DO $$ BEGIN |
| 0002 | 0002_true_selene.sql | `0367f501...80eb11d4` | 20.51 KB | DO $$ BEGIN |
| 0003 | 0003_curious_agent_zero.sql | `e19136d7...18a6c59a` | 3.83 KB | DO $$ BEGIN |
| 0004 | 0004_phase2_complete.sql | `5cf59c18...58b82c63` | 19.35 KB | /** |
| 0005 | 0005_lazy_kate_bishop.sql | `3efe6d45...6307f507` | 11.02 KB | CREATE TABLE IF NOT EXISTS "feature_flags" ( |
| 0006 | 0006_flat_stepford_cuckoos.sql | `2eb17491...3d3495f1` | 83.05 KB | DO $$ BEGIN |
| 0007 | 0007_add_wage_benchmarks.sql | `1b1e34b0...04349357` | 9.33 KB | ============================================================================ |
| 0008 | 0008_lean_mother_askani.sql | `a6734b2a...ae354e13` | 3243.08 KB | DROP TYPE IF EXISTS "public"."negotiation_session_type" CASCADE;--> statement-br |
| 0019 | 0019_lonely_stephen_strange.sql | `bf43dc43...edaf6acf` | 55.29 KB | CREATE TYPE "public"."committee_member_role" AS ENUM('chair', 'vice_chair', 'sec |
| 0020 | 0020_keen_roulette.sql | `66d5a5ce...5119dde4` | 9.43 KB | CREATE TYPE "public"."employment_status" AS ENUM('active', 'on_leave', 'layoff', |
| 0021 | 0021_steady_darwin.sql | `06b8638a...5f3b311b` | 1.78 KB | CREATE TABLE "member_segments" ( |
| 0025 | 0025_pilot_enrollments.sql | `357179d0...baf4535f` | 1.31 KB | Pilot enrollment and milestones tables |
| 0041 | 0041_steady_reavers.sql | `618dc735...983452bc` | 3.52 KB | ALTER TYPE "public"."organization_type" ADD VALUE 'platform' BEFORE 'congress';- |
| 0042 | 0042_perpetual_karen_page.sql | `b8121577...74d08ef1` | 4.89 KB | CREATE TYPE "public"."exit_interview_event_type" AS ENUM('created', 'updated', ' |
| 0043 | 0043_fantastic_mysterio.sql | `8d4d2f51...b641fe96` | 2.12 KB | CREATE TYPE "public"."exit_interview_indexing_status" AS ENUM('pending', 'indexi |
| 0051 | 0051_add_messaging_rls_policies.sql | `3dcafe74...657a40f5` | 9.33 KB | Migration: Add Row-Level Security Policies for Messaging Tables |
| 0052 | 0052_add_notifications_documents_rls.sql | `0792a9f7...6efee2d9` | 7.24 KB | Migration: Add Row-Level Security Policies for Notifications and Documents |
| 0053 | 0053_add_reports_rls_policies.sql | `108b0c5e...5830f5cf` | 11.63 KB | Migration: Add Row-Level Security Policies for Reports Tables |
| 0054 | 0054_add_calendar_rls_policies.sql | `dbdafca4...da99ec8e` | 10.41 KB | Migration: Add Row-Level Security Policies for Calendar Tables |
| 0055 | 0055_align_user_ids_to_clerk.sql | `0ec97950...e53b008b` | 15.13 KB | Migration 0055: Align User IDs to Clerk varchar(255) format |
| 0056 | 0056_add_missing_fk_constraints.sql | `a174838e...9d7771f5` | 1.57 KB | Migration 0056: Add Missing FK Constraints for Training/Certification |
| 0057 | 0057_recreate_training_views.sql | `29f9030b...1732320a` | 10.69 KB | Migration 0057: Recreate Training/Certification Views |
| 0058 | 0058_world_class_rls_policies.sql | `4842815d...fdf99a9a` | 22.21 KB | Migration 0058: World-Class RLS Policy Implementation |
| 0059 | 0059_convert_remaining_user_ids.sql | `4976c0f5...6bf51695` | 19.43 KB | Migration 0059: Convert Additional User ID Columns to VARCHAR(255) |
| 0060 | 0060_add_visibility_scopes.sql | `30ad2e5b...5c25f0d6` | 1.52 KB | ============================================================================ |
| 0061 | 0061_add_defensibility_packs.sql | `32252673...100bc994` | 10.75 KB | ============================================================================ |
| 0062 | 0062_add_immutable_transition_history.sql | `27c607fa...1e1dd815` | 3.55 KB | ============================================================================ |
| 0063 | 0063_add_audit_log_archive_support.sql | `6d76d2ba...909a75f4` | 3.23 KB | ============================================================================ |
| 0064 | 0064_add_immutability_triggers.sql | `0d37ccea...5609c423` | 7.53 KB | ============================================================================ |
| 0065 | 0065_add_governance_tables.sql | `3b910835...59f6d97c` | 4.85 KB | CREATE TABLE IF NOT EXISTS "golden_shares" ( |
| 0066 | 0066_drop_obsolete_search_vector_trigger.sql | `554d1636...8b83aa11` | 0.94 KB | Migration: 0066_drop_obsolete_search_vector_trigger |
| 0067 | 0067_add_congress_memberships.sql | `e64889c6...fecbf3b1` | 1.74 KB | ============================================================================ |
| 0068 | 0068_add_peer_detection_indexes.sql | `13d7ef08...207941c3` | 2.23 KB | ============================================================================ |
| 0069 | 0069_rename_tenant_users_to_organization_users.sql | `752b0d49...12c9871d` | 0.40 KB | Date: 2026-02-12 |
| 0070 | 0070_add_organization_users_rls_policies.sql | `1d111974...ac532e86` | 0.39 KB | Migration: Add RLS Policies for Organization Users |
| 0071 | 0071_update_messaging_rls_for_session_context.sql | `5e867ba9...37a93c0b` | 8.54 KB | Migration: Update Messaging RLS Policies for Session Context |
| 0072 | 0072_update_in_app_notifications_rls.sql | `a5196f24...34d2819c` | 4.32 KB | Migration: Update in_app_notifications RLS for Session Context |
| 0073 | 0073_update_documents_reports_calendar_rls.sql | `08282f94...5944186e` | 15.47 KB | Migration: Update documents, reports, and calendar RLS for Session Context |
| 0074 | 0074_add_hierarchical_rls_functions.sql | `fc49e63d...de952df2` | 5.88 KB | Migration: 0074_add_hierarchical_rls_functions |
| 0075 | 0075_add_organizations_rls_policies.sql | `289e99d7...90681795` | 4.06 KB | Migration: 0075_add_organizations_rls_policies |
| 0076 | 0076_add_claims_rls_policies.sql | `3c89dfdc...fbf0deb4` | 5.64 KB | Migration: 0076_add_claims_rls_policies |
| 0077 | 0077_migrate_claim_deadlines_to_org_id.sql | `9b5e6eb0...d4f5ca99` | 2.66 KB | Migrate claim_deadlines table from tenant_id to organization_id |
| 0078 | 0078_force_dues_transactions_rls.sql | `b6027be5...1c414f36` | 0.25 KB | Migration: 0078_force_dues_transactions_rls |
| 0079 | 0079_ai_cost_tracking_phase1.sql | `5c3bd840...902cf329` | 10.62 KB | Phase 1: AI Cost Tracking and Rate Limiting |
| 0080 | 0080_add_schema_drift_protection.sql | `d6806b36...2a012166` | 11.05 KB | Migration: Add Schema Drift Protection (DDL Event Logging) |
| 0081 | 0081_add_missing_critical_indexes.sql | `eccee0f7...eeaa50b2` | 17.71 KB | Migration: Add Missing Critical Database Indexes |
| 0082 | 0082_add_pilot_tables.sql | `b009840e...4a7beab2` | 2.27 KB | Migration: Add pilot onboarding tables |
| 0083 | 0083_data_source_tables.sql | `53677aa3...8041e709` | 12.73 KB | Migration: 0083_data_source_tables.sql |
| 0084 | 0084_claims_monetary_varchar_to_decimal.sql | `adb7b9e0...37d0f879` | 1.34 KB | Migration: Convert claim monetary fields from varchar to decimal(14,2) |
| 0085 | 0085_monetization_infrastructure_layer.sql | `b0f4f4f5...79654796` | 13.47 KB | ============================================================================= |
| 0086 | 0086_monetization_phase2.sql | `2fad4d82...431a7f47` | 17.54 KB | Migration: 0086_monetization_phase2 |
| 0087 | 0087_add_member_location_fields.sql | `37e52d23...15a43b65` | 0.60 KB | Add missing columns to organization_members that are referenced by the API |
| 0088 | 0088_add_fts_gin_index.sql | `dcfff672...1facfa8e` | 1.93 KB | Migration 0088: Full-text search GIN index on organization_members |
| 0089 | 0089_ingestion_hardening.sql | `86981811...a2d9573d` | 7.37 KB | Migration: 0089_ingestion_hardening.sql |
| 0090 | 0090_zonga_listeners_user_id_unique.sql | `f7b4cc76...0e0cf7ba` | 0.23 KB | Migration 0090: Add unique index on zonga_listeners.user_id |
| 0091 | 0091_zonga_social_tables.sql | `a034802d...8d0cc6e3` | 2.05 KB | Migration 0091: Create missing Zonga social interaction tables |
| 0092 | 0092_msc_enterprise_billing.sql | `94a28d2b...870df98d` | 0.89 KB | Migration 0092: Set MSC org to enterprise tier and upgrade member plans |
| 0093 | 0093_applications_registry.sql | `f5f32c1b...7ac6a9f0` | 7.97 KB | ============================================================ |
| 0094 | 0094_ms_celebrations_seed.sql | `1483eb91...e431279b` | 4.87 KB | ============================================================ |
| 0095 | 0095_ms_celebrations_auth_users.sql | `b5d52c88...47487ff8` | 3.68 KB | ============================================================ |
| 0096 | 0096_add_missing_ue_required_tables.sql | `4a64cd99...9fa958b2` | 5.69 KB | 0096: Add missing required UE tables for union-structure/member-segmentation par |
| 0097 | 0097_nzilaos_rls_org_isolation.sql | `bf1a733f...da85a153` | 4.33 KB | NzilaOS PR-UE-02: Enable RLS org-scoping for org-scoped tables |
| 0098 | 0098_predeployment_hardening.sql | `f2646154...91990429` | 9.54 KB | ============================================================================= |
| 0099 | 0099_audit_remediation.sql | `471da694...fed0e0bc` | 1.04 KB | Migration 0080: Audit Remediation |
| 0100 | 0100_clerk_to_entra_user_ids.sql | `41481bae...a0ad2de5` | 2.17 KB | ============================================================================= |
| 0101 | 0101_auth_password_reset_tokens.sql | `ddf61c8d...d24a3ce4` | 2.92 KB | Migration: 20260711_auth_password_reset_tokens |
| 0102 | 0102_align_organization_members_columns.sql | `1eb1a0a1...e9c4e137` | 2.48 KB | Re-add columns to organization_members that were dropped in 0002_true_selene |
| 0103 | 0103_org_users_unique_constraint.sql | `284e1ba6...ae3b623a` | 0.35 KB | Add unique constraint on (user_id, organization_id) to prevent duplicate |
| 0104 | 0104_dedup_and_quality_warnings.sql | `c7726d78...a827fe93` | 4.04 KB | Migration: Dedup Groups & Data Quality Warnings |
| 0105 | 0105_correspondence_pipeline.sql | `7855d408...10ef63cf` | 6.68 KB | =========================================================================== |
| 0106 | 0106_integration_fabric.sql | `8d983c5e...2edf8f42` | 10.40 KB | =========================================================================== |
| 0107 | 0107_ue_policy_bindings.sql | `647a14f0...fc78c704` | 1.42 KB | ============================================================================= |
| 0108 | 0108_rls_tenant_isolation_foundation.sql | `aba7074a...3328d766` | 21.62 KB | ============================================================================= |
| 1770880372830 | 1770880372830_consolidate_chart_of_accounts_fixed.sql | `1f4b3853...106ce17e` | 10.59 KB | ============================================================================ |
| 20260212 | 20260212_add_hris_tables_fixed.sql | `fba48701...41ece925` | 8.66 KB | Migration: HRIS Integration Tables (FIXED) |
| 20260212 | 20260212_add_integration_framework_fixed.sql | `7235867e...fe0c086e` | 7.28 KB | Integration Framework Database Schema |
| 20260213 | 20260213_add_accounting_tables_fixed.sql | `1fd0e789...c371bc6c` | 8.07 KB | Migration: Add Accounting Integration Tables (FIXED) |
| 20260213 | 20260213_add_integration_foreign_keys.sql | `52cb71c0...5d0b1ca6` | 2.97 KB | Add foreign key constraints to integration tables now that organizations table e |
| 20260324 | 20260324_add_missing_tables_and_columns.sql | `f30246e3...3e730e7e` | 6.53 KB | Migration: Add missing tables and columns |
| 20260324 | 20260324_add_remaining_missing_tables.sql | `78788c27...a34fa038` | 19.70 KB | Migration: Create 20 missing tables referenced by CRUD routes |
| 20260325 | 20260325_dapl_platform_ledger.sql | `b33d837b...84bc111b` | 20.76 KB | ============================================================================ |
| 20260327 | 20260327_staging_alignment_phase2.sql | `7c80b562...eda2fb38` | 6.81 KB | ============================================================================ |
| 20260327 | 20260327_staging_alignment_phase3.sql | `506c64e2...25d5a7e0` | 3.59 KB | ============================================================================ |
| 20260327 | 20260327_staging_schema_alignment.sql | `38d720a6...beb4e98b` | 13.45 KB | ============================================================================ |
| 20260328 | 20260328_jurisdiction_preferences.sql | `f3a164c2...d5eba375` | 0.86 KB | Migration: Create member_jurisdiction_preferences table |
| 20260401 | 20260401_cba_intelligence_public_sources.sql | `6d908185...0d67a664` | 17.82 KB | ========================================================================== |
| 20260402 | 20260402_audit_immutability.sql | `b9bedf84...26209feb` | 2.96 KB | Migration: Audit log immutability — prevent DELETE/UPDATE on review decision rec |
| 20260402 | 20260402_pgvector_embeddings.sql | `cc36f748...367cbe8e` | 5.18 KB | Migration: Enable pgvector, convert TEXT embedding columns to vector(1536), |
| 20260404 | 20260404_pilot_observability.sql | `d8f5b606...5b2a2f42` | 1.44 KB | Pilot observability & feedback tables |
| 20260507 | 20260507_fixup_create_break_glass_activations.sql | `411900e6...335a7692` | 125.27 KB | ============================================================================ |
| 20260507 | 20260507_fixup_phase5b_org_fks.sql | `b588b8f5...24e2f413` | 3.32 KB | Fixup: re-add FK constraints from 0001_phase5b_inter_union_features that |
| 20260507 | 20260507_fixup_pre_0008_missing_tables.sql | `92c820f1...77174c69` | 31.60 KB | ============================================================================ |
| 20260508 | 20260508_fixup_post_0019_align_modern_schema.sql | `163e9a5f...88048bcf` | 5.59 KB | Fixup: align modern schema after 0019 drops + missing newer migrations. |
| 20260509 | 20260509_fixup_auth_mfa_magic_invites.sql | `aac9d2ab...ef5411fe` | 3.01 KB | 20260509_fixup_auth_mfa_magic_invites.sql |
| 20260521 | 20260521_fixup_icra_assessments_claim_columns.sql | `56960b63...e8457fba` | 0.85 KB | Fixup: add icra_assessments claim/payment columns that exist in Drizzle schema |

## Verification

To verify a migration file's integrity:

```bash
# Linux/macOS
shasum -a 256 db/migrations/<filename>.sql

# Windows (PowerShell)
Get-FileHash -Algorithm SHA256 db/migrations\<filename>.sql
```

Compare the output with the SHA-256 hash in this manifest.

---

*Generated by `scripts/generate-migration-manifest.ts`*
