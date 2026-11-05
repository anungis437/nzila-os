-- PLATFORM_SQL 0048_sso_scim_shape
--
-- The combined Django + Drizzle bootstrap creates sso_providers and scim_configurations as minimal Django stubs (sso_providers carries
-- only the three uniqueness-key columns added by 0038; scim_configurations only id, organization_id and the timestamps), so the
-- identity-provider routes that read and write them failed against a real database: name, provider_type, the SAML/OIDC settings and
-- every SCIM column did not exist. This migration evolves both stubs to the shape the application declares, with two deliberate
-- differences from the earlier Drizzle declaration:
--
--   * scim_configurations has NO bearer_token column. The IdP is shown a bearer token once, when it is issued or rotated; the database
--     keeps only its SHA-256 (token_hash, 64 lowercase hex characters, unique) plus when it was created, when it expires, when it was
--     last used and when it was revoked. A plaintext long-lived credential is never stored. If a deployment already carries a
--     bearer_token column, its values are hashed into token_hash where that is empty and the column is then dropped.
--   * a provider or a SCIM endpoint is created disabled (enabled, auto_provision and just_in_time_provisioning default to false).
--
-- Fail closed: a NOT NULL column cannot be added to a table that already holds rows, so a populated stub aborts the migration and
-- nothing is rewritten. Duplicate organization rows in scim_configurations abort it too (one configuration per organization).
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
DECLARE
  rows_found bigint;
  dup bigint;
BEGIN
  IF to_regclass('public.sso_providers') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sso_providers' AND column_name = 'provider_type') THEN
    EXECUTE 'SELECT count(*) FROM public.sso_providers' INTO rows_found;
    IF rows_found > 0 THEN
      RAISE EXCEPTION 'sso/scim shape fail-closed: public.sso_providers holds % row(s) and lacks the columns the application requires. Rows were not rewritten.', rows_found;
    END IF;
  END IF;
  IF to_regclass('public.scim_configurations') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scim_configurations' AND column_name = 'base_url') THEN
      EXECUTE 'SELECT count(*) FROM public.scim_configurations' INTO rows_found;
      IF rows_found > 0 THEN
        RAISE EXCEPTION 'sso/scim shape fail-closed: public.scim_configurations holds % row(s) and lacks the columns the application requires. Rows were not rewritten.', rows_found;
      END IF;
    END IF;
    EXECUTE 'SELECT count(*) FROM (SELECT 1 FROM public.scim_configurations GROUP BY organization_id HAVING count(*) > 1) d' INTO dup;
    IF dup > 0 THEN
      RAISE EXCEPTION 'sso/scim shape fail-closed: % organization(s) hold more than one SCIM configuration. Rows were not rewritten.', dup;
    END IF;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.sso_providers') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS name varchar(255) NOT NULL;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS provider_type varchar(50) NOT NULL;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS saml_sso_url varchar(500);
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS saml_slo_url varchar(500);
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS saml_certificate text;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS saml_signing_algorithm varchar(50) DEFAULT 'sha256';
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS saml_name_id_format varchar(200) DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_client_secret text;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_authorization_endpoint varchar(500);
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_token_endpoint varchar(500);
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_userinfo_endpoint varchar(500);
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_jwks_uri varchar(500);
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS oidc_scopes text[] DEFAULT ARRAY['openid', 'profile', 'email'];
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS attribute_mapping jsonb NOT NULL;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS role_mapping jsonb;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS auto_provision boolean NOT NULL DEFAULT false;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS just_in_time_provisioning boolean NOT NULL DEFAULT false;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS require_groups text[];
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS created_by varchar(255) NOT NULL;
  ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS updated_by varchar(255);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sso_providers_provider_type_check' AND conrelid = 'public.sso_providers'::regclass) THEN
    ALTER TABLE public.sso_providers ADD CONSTRAINT sso_providers_provider_type_check CHECK (provider_type IN ('saml', 'oidc'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.scim_configurations') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS base_url varchar(500) NOT NULL;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS token_hash varchar(64);
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS token_created_at timestamptz DEFAULT now();
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS token_last_used_at timestamptz;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS sync_users boolean NOT NULL DEFAULT true;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS sync_groups boolean NOT NULL DEFAULT true;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS deprovision_action varchar(50) NOT NULL DEFAULT 'suspend';
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS user_filter jsonb;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS group_filter jsonb;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS user_attribute_mapping jsonb NOT NULL;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS group_attribute_mapping jsonb;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS users_synced integer NOT NULL DEFAULT 0;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS groups_synced integer NOT NULL DEFAULT 0;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS created_by varchar(255) NOT NULL;
  ALTER TABLE public.scim_configurations ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

  -- A bearer token that an earlier shape stored in the clear is hashed, then the column is removed.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scim_configurations' AND column_name = 'bearer_token') THEN
    EXECUTE $q$UPDATE public.scim_configurations
                SET token_hash = encode(sha256(convert_to(bearer_token, 'UTF8')), 'hex')
                WHERE token_hash IS NULL AND bearer_token IS NOT NULL AND bearer_token <> ''$q$;
    ALTER TABLE public.scim_configurations DROP COLUMN bearer_token;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scim_configurations_token_hash_check' AND conrelid = 'public.scim_configurations'::regclass) THEN
    ALTER TABLE public.scim_configurations ADD CONSTRAINT scim_configurations_token_hash_check CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scim_configurations_deprovision_check' AND conrelid = 'public.scim_configurations'::regclass) THEN
    ALTER TABLE public.scim_configurations ADD CONSTRAINT scim_configurations_deprovision_check CHECK (deprovision_action IN ('suspend', 'delete', 'archive'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.scim_configurations') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS scim_configurations_token_hash_uq ON public.scim_configurations (token_hash) WHERE token_hash IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS scim_configurations_organization_uq ON public.scim_configurations (organization_id);
  END IF;
END $$;
