-- Rollback for 20261101_shopify_shop_domain_routing.sql. No data changes.
DO $$
BEGIN
  IF to_regclass('shopify_config') IS NULL THEN
    RETURN;
  END IF;
  DROP INDEX IF EXISTS uq_shopify_config_shop_domain;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
    EXECUTE 'DROP POLICY IF EXISTS ue_system_shop_routing ON shopify_config';
    EXECUTE 'REVOKE SELECT (org_id, shop_domain) ON TABLE shopify_config FROM union_eyes_system';
  END IF;
END
$$;
