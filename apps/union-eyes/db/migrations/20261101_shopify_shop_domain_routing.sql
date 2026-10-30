-- UE Gate 0 (DEF-0B8-ICRA-SHOPIFY-SHOP-DOMAIN-NEVER-CHECKED..., DEF-0B8-ICRA-SHOPIFY-WEBHOOK-QUERIES-TENANT-RLS-TABLES...):
-- a Shopify webhook is routed to its organization by the shop domain it comes from, so one shop must belong to exactly one
-- organization, and the webhook receiver (system role) must be able to read that mapping and nothing else of shopify_config.
-- shopify_config was revoked from both application roles; the token and secret references stay unreadable. Only the two routing
-- columns are granted, and only to the system role, for SELECT.
-- Idempotent on PostgreSQL 15 and 16; requires migration-owner privileges.
DO $$
DECLARE
  repeated_domains integer;
BEGIN
  IF to_regclass('shopify_config') IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO repeated_domains
  FROM (
    SELECT lower(shop_domain) FROM shopify_config GROUP BY lower(shop_domain) HAVING count(*) > 1
  ) repeated;

  IF repeated_domains = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_shopify_config_shop_domain ON shopify_config (lower(shop_domain));
  ELSE
    -- The receiver refuses a domain that maps to several organizations, so these stay unroutable until an operator resolves them.
    RAISE NOTICE 'shopify_config has % shop domains configured for more than one organization; uniqueness not enforced', repeated_domains;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
    EXECUTE 'GRANT SELECT (org_id, shop_domain) ON TABLE shopify_config TO union_eyes_system';
    EXECUTE 'DROP POLICY IF EXISTS ue_system_shop_routing ON shopify_config';
    EXECUTE 'CREATE POLICY ue_system_shop_routing ON shopify_config FOR SELECT TO union_eyes_system USING (true)';
  END IF;
END
$$;
