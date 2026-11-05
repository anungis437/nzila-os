-- Rollback for 0048_sso_scim_shape. The columns this migration added are dropped, which discards what they hold; export first.
-- A SCIM bearer token is never restored: only its hash was kept, and the IdP holds the token.
DO $$
BEGIN
  IF to_regclass('public.scim_configurations') IS NOT NULL THEN
    DROP INDEX IF EXISTS public.scim_configurations_token_hash_uq;
    DROP INDEX IF EXISTS public.scim_configurations_organization_uq;
    ALTER TABLE public.scim_configurations DROP CONSTRAINT IF EXISTS scim_configurations_token_hash_check;
    ALTER TABLE public.scim_configurations DROP CONSTRAINT IF EXISTS scim_configurations_deprovision_check;
    ALTER TABLE public.scim_configurations
      DROP COLUMN IF EXISTS base_url, DROP COLUMN IF EXISTS token_hash, DROP COLUMN IF EXISTS token_created_at,
      DROP COLUMN IF EXISTS token_expires_at, DROP COLUMN IF EXISTS token_last_used_at, DROP COLUMN IF EXISTS revoked_at,
      DROP COLUMN IF EXISTS enabled, DROP COLUMN IF EXISTS sync_users, DROP COLUMN IF EXISTS sync_groups,
      DROP COLUMN IF EXISTS deprovision_action, DROP COLUMN IF EXISTS user_filter, DROP COLUMN IF EXISTS group_filter,
      DROP COLUMN IF EXISTS user_attribute_mapping, DROP COLUMN IF EXISTS group_attribute_mapping, DROP COLUMN IF EXISTS last_sync_at,
      DROP COLUMN IF EXISTS users_synced, DROP COLUMN IF EXISTS groups_synced, DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS metadata;
  END IF;
  IF to_regclass('public.sso_providers') IS NOT NULL THEN
    ALTER TABLE public.sso_providers DROP CONSTRAINT IF EXISTS sso_providers_provider_type_check;
    ALTER TABLE public.sso_providers
      DROP COLUMN IF EXISTS name, DROP COLUMN IF EXISTS provider_type, DROP COLUMN IF EXISTS saml_sso_url, DROP COLUMN IF EXISTS saml_slo_url,
      DROP COLUMN IF EXISTS saml_certificate, DROP COLUMN IF EXISTS saml_signing_algorithm, DROP COLUMN IF EXISTS saml_name_id_format,
      DROP COLUMN IF EXISTS oidc_client_secret, DROP COLUMN IF EXISTS oidc_authorization_endpoint, DROP COLUMN IF EXISTS oidc_token_endpoint,
      DROP COLUMN IF EXISTS oidc_userinfo_endpoint, DROP COLUMN IF EXISTS oidc_jwks_uri, DROP COLUMN IF EXISTS oidc_scopes,
      DROP COLUMN IF EXISTS attribute_mapping, DROP COLUMN IF EXISTS role_mapping, DROP COLUMN IF EXISTS auto_provision,
      DROP COLUMN IF EXISTS just_in_time_provisioning, DROP COLUMN IF EXISTS require_groups, DROP COLUMN IF EXISTS enabled,
      DROP COLUMN IF EXISTS metadata, DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS updated_by;
  END IF;
END $$;
