-- Rollback of PLATFORM_SQL 0038_gate0_integrity_columns. Safe forward-recovery companion: it removes only what 0038 added.
-- Do not drop saml_entity_id, oidc_issuer or oidc_client_id: these nullable columns may have
-- predated this migration on a complete SSO relation. Forward recovery avoids destroying them.
DROP INDEX IF EXISTS public.sso_providers_org_oidc_issuer_client_idx;
DROP INDEX IF EXISTS public.sso_providers_org_saml_entity_idx;
ALTER TABLE IF EXISTS public.exit_interviews DROP CONSTRAINT IF EXISTS exit_interviews_review_independent_chk;
ALTER TABLE IF EXISTS public.exit_interviews DROP COLUMN IF EXISTS submitted_by;
ALTER TABLE IF EXISTS public.cms_pages DROP COLUMN IF EXISTS submitted_by;
ALTER TABLE IF EXISTS public.committee_meetings DROP CONSTRAINT IF EXISTS committee_meetings_minutes_independent_chk;
ALTER TABLE IF EXISTS public.committee_meetings DROP COLUMN IF EXISTS minutes_recorded_by;
DROP INDEX IF EXISTS public.employer_contacts_one_primary_per_employer_idx;
ALTER TABLE IF EXISTS public.kpi_configurations DROP CONSTRAINT IF EXISTS kpi_configurations_direction_chk;
ALTER TABLE IF EXISTS public.kpi_configurations DROP COLUMN IF EXISTS direction;
