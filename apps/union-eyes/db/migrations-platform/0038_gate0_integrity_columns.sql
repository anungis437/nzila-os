-- PLATFORM_SQL 0038_gate0_integrity_columns
-- UNQUALIFIED. Do not apply from Cursor. Native execution is READY_FOR_VS_EXECUTION.
--
-- Closes the schema half of Gate 0 partial fixes whose application code could only approximate a fact the table did not record:
--   * kpi_configurations.direction     - whether a lower or a higher figure is good, instead of inferring it from threshold order.
--   * employer_contacts                - at most one active primary contact per employer, enforced by an index (no race).
--   * committee_meetings.minutes_recorded_by - who recorded the minutes, so approval can be refused for that person.
--   * exit_interviews.submitted_by     - who submitted the interview, so review can be refused for that person.
--   * cms_pages.submitted_by           - who moved the item to review, so publication can be refused for that person.
--   * sso_providers                    - one provider per organization and entity id, and per organization, issuer and client.
--
-- Additive. New columns are NULLABLE and invent no value for existing rows (a row written before this migration stays null and the
-- application falls back to its earlier behaviour). The two unique indexes refuse, rather than repair, data that already breaks
-- them. Relations that the Django snapshot owns (exit_interviews, sso_providers) are evolved only when present; SSO uniqueness keys are added as nullable columns when the Django snapshot contains only a stub.

DO $$
BEGIN
  IF to_regclass('public.kpi_configurations') IS NULL
     OR to_regclass('public.employer_contacts') IS NULL
     OR to_regclass('public.committee_meetings') IS NULL
     OR to_regclass('public.cms_pages') IS NULL THEN
    RAISE EXCEPTION 'platform 0038 fail-closed: kpi_configurations, employer_contacts, committee_meetings and cms_pages must exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.kpi_configurations ADD COLUMN IF NOT EXISTS direction text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kpi_configurations_direction_chk' AND conrelid = 'public.kpi_configurations'::regclass) THEN
    ALTER TABLE public.kpi_configurations
      ADD CONSTRAINT kpi_configurations_direction_chk CHECK (direction IS NULL OR direction IN ('higher_is_better', 'lower_is_better'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employer_contacts
     WHERE is_primary IS TRUE AND is_active IS NOT FALSE
     GROUP BY organization_id, employer_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'platform 0038 fail-closed: an employer has more than one active primary contact; resolve them before applying.';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS employer_contacts_one_primary_per_employer_idx
  ON public.employer_contacts (organization_id, employer_id)
  WHERE is_primary IS TRUE AND is_active IS NOT FALSE;
--> statement-breakpoint
ALTER TABLE public.committee_meetings ADD COLUMN IF NOT EXISTS minutes_recorded_by text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'committee_meetings_minutes_independent_chk' AND conrelid = 'public.committee_meetings'::regclass) THEN
    ALTER TABLE public.committee_meetings
      ADD CONSTRAINT committee_meetings_minutes_independent_chk CHECK (
        minutes_approved_by IS NULL OR minutes_recorded_by IS NULL OR minutes_approved_by <> minutes_recorded_by
      );
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.cms_pages ADD COLUMN IF NOT EXISTS submitted_by text;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.exit_interviews') IS NOT NULL THEN
    ALTER TABLE public.exit_interviews ADD COLUMN IF NOT EXISTS submitted_by text;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exit_interviews_review_independent_chk' AND conrelid = 'public.exit_interviews'::regclass) THEN
      ALTER TABLE public.exit_interviews
        ADD CONSTRAINT exit_interviews_review_independent_chk CHECK (
          reviewed_by IS NULL OR submitted_by IS NULL OR reviewed_by <> submitted_by
        );
    END IF;
  ELSE
    RAISE NOTICE 'platform 0038: exit_interviews is not present; submitted_by was not added.';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.sso_providers') IS NOT NULL THEN
    -- The combined Django + Drizzle bootstrap creates sso_providers as a minimal Django stub
    -- (id and organization_id only). The index keys must exist before any uniqueness query.
    -- Keep new fields nullable: a historical row must not acquire a fabricated identity provider.
    ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS saml_entity_id varchar(500);
    ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_issuer varchar(500);
    ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_client_id varchar(255);
    IF EXISTS (SELECT 1 FROM public.sso_providers WHERE saml_entity_id IS NOT NULL GROUP BY organization_id, saml_entity_id HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM public.sso_providers WHERE oidc_issuer IS NOT NULL GROUP BY organization_id, oidc_issuer, oidc_client_id HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'platform 0038 fail-closed: an organization has duplicate SSO providers; resolve them before applying.';
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS sso_providers_org_saml_entity_idx
      ON public.sso_providers (organization_id, saml_entity_id) WHERE saml_entity_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS sso_providers_org_oidc_issuer_client_idx
      ON public.sso_providers (organization_id, oidc_issuer, oidc_client_id) WHERE oidc_issuer IS NOT NULL;
  ELSE
    RAISE NOTICE 'platform 0038: sso_providers is not present; its unique indexes were not created.';
  END IF;
END $$;
