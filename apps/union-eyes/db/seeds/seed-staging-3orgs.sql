-- ============================================================
-- STAGING SEED — 4 Pilot Organizations (match local dev state)
--
-- Orgs: NZILA Ventures, Canadian Labour Congress, CAPE-ACEP,
--       CUPE Local 123
--
-- Clerk Orgs (provisioned in known-hagfish-67 instance):
--   NZILA  → org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ
--   CLC    → org_3B3NjHnvzeSJBZQE8PGQf0nmgts
--   CAPE   → org_3B3Nj6NGSY6rT9ibI8bgFhZdMRN
--   CUPE   → org_3BP6K4uezEa2CLEvUNDwhnJGNFg
--
-- Strategy: UPDATE existing orgs + DELETE/INSERT members
-- (No unique constraint on (user_id, organization_id) so we
--  delete-then-insert instead of upsert)
--
-- All users have real Clerk IDs (user_*) and can log in via
-- the known-hagfish-67 Clerk instance. Password: NzilaTest2026!
--
-- Run via:
--   $env:PGPASSWORD="<pw>"; & "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
--     -U nzilaadmin -d nzila_os_staging `
--     -h nzila-staging-db.postgres.database.azure.com -p 5432 `
--     -f apps/union-eyes/db/seeds/seed-staging-3orgs.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. NZILA Ventures (Platform Org) — UUID 458a56cb-...
--    Staging has "Nzila Platform" / slug "nzila-platform"
--    Update to match local: name "NZILA Ventures", slug "default"
-- ============================================================
UPDATE organizations
SET name             = 'NZILA Ventures',
    slug             = 'default',
    display_name     = 'NZILA Ventures',
    organization_type = 'platform',
    hierarchy_level  = 0,
    sectors          = '{technology,financial_services}',
    member_count     = 12,
    active_member_count = 12,
    settings         = '{"currency":"CAD","smsAlerts":"critical","dateFormat":"YYYY-MM-DD","webhookUrl":"","emailDigest":true,"mobileAccess":true,"requireSymbol":true,"mfaEnforcement":"admins_only","sessionTimeout":30,"voiceGrievance":true,"defaultLanguage":"en","digestFrequency":"daily","rateLimitPerMin":100,"aiClauseAnalysis":true,"requireMixedCase":true,"passwordMinLength":12,"pushNotifications":true,"crossUnionAnalytics":false,"webhookNotifications":false}'::jsonb,
    features_enabled = '{dashboard,members,claims,grievances,communications}',
    clerk_organization_id = 'org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ'
WHERE id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';

-- ============================================================
-- 2. Replace org_members for NZILA Ventures
-- ============================================================
DELETE FROM organization_members
WHERE organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';

INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
VALUES
  ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'app_owner',        'active', 'Aubert Nungisa',    'aubert@nzila.app'),
  ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'app_owner',        'active', 'Platform Admin',    'admin@nzila.io'),
  ('user_3A2c7Rsg6612F3BAxHxx5L29jRH', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'employer',         'active', 'Sandra Weatherby',  'test.employer@nzilaventures.com'),
  ('user_3A2c3b8lVI7gxi3Keb6xE4piwGv', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'federation_exec',  'active', 'Patty Coates',      'test.fedexec@nzilaventures.com'),
  ('user_3A2c6sEcW7WdJSnLVVQFB28PjIU', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'local_admin',      'active', 'Tania Da Silva',    'test.localadmin@nzilaventures.com'),
  ('user_3A2c7AO7bbapxh9IdAgW5kXPhHu', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'member',           'active', 'Priya Sharma',      'test.member2@nzilaventures.com'),
  ('user_3A2c75rcBNDcTYtkjnNgbYLqsEx', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'member',           'active', 'Carlos Rivera',     'test.member1@nzilaventures.com'),
  ('user_3A2c7IXYOHgNMiIdOte7C5MEwFd', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'member',           'active', 'Ahmed Hassan',      'test.member3@nzilaventures.com'),
  ('user_3A2c3apBW0oMKPX2CjIMd8b1ujq', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'national_officer', 'active', 'Mark Hancock',      'test.nationaloff@nzilaventures.com'),
  ('user_3A2c3SaKc0xFearcu0NbUL2lhDF', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'platform_admin',   'active', 'David Nkemdirim',   'test.platformlead@nzilaventures.com'),
  ('user_3A2c6rLMOmF45HEkaU7XdQp05Zk', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'president',        'active', 'Tim Maguire',       'test.president@nzilaventures.com'),
  ('user_3A2c729gwvVEXyC6vc2ICqzihxp', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'steward',          'active', 'Keisha Brown',      'test.steward@nzilaventures.com');

-- ============================================================
-- 3. Canadian Labour Congress — update existing to match local
--    Staging UUID (5ecb17ab-...) kept; local UUID differs
-- ============================================================
UPDATE organizations
SET display_name     = 'CLC',
    short_name       = 'CLC',
    province_territory = 'ON',
    sectors          = '{public_service,education}',
    email            = 'info@clc-ctc.ca',
    phone            = '613-521-3400',
    website          = 'https://canadianlabour.ca',
    address          = '{"city":"Ottawa","street":"2841 Riverside Drive","country":"CA","province":"ON","postalCode":"K1V 8X7"}'::jsonb,
    clc_affiliated   = false,
    member_count     = 10,
    active_member_count = 10,
    settings         = '{"language":"bilingual","fiscalYearEnd":"December 31","perCapitaRate":0.54,"remittanceDay":15,"affiliateCount":56,"governanceModel":"triennial_convention","executiveCouncil":true}'::jsonb,
    features_enabled = '{dues-management,member-directory,financial-reporting,per-capita-remittances,clc-integration,affiliate-management,convention-governance}',
    clc_affiliate_code = 'CLC',
    per_capita_rate  = 0.54,
    remittance_day   = 15,
    fiscal_year_end  = '2024-12-31',
    clerk_organization_id = 'org_3B3NjHnvzeSJBZQE8PGQf0nmgts'
WHERE slug = 'clc';

-- Replace CLC members
DO $$
DECLARE
  v_clc_id text;
BEGIN
  SELECT id::text INTO v_clc_id FROM organizations WHERE slug = 'clc';

  DELETE FROM organization_members WHERE organization_id = v_clc_id;

  INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
  VALUES
    ('user_3BSyEWUb0cnQ56CSS0W0fK8g35a', v_clc_id, 'admin',  'active', 'Hassan Yussuff',      'h.yussuff@clc-ctc.ca'),
    ('user_3BSyEa51htBN51y0YxG9a9Elp2L', v_clc_id, 'admin',  'active', 'Marie Clarke Walker', 'm.walker@clc-ctc.ca'),
    ('user_3BSzDRcx41T9Pq06KAhtQkFmi8T', v_clc_id, 'member', 'active', 'Denis Bolduc',        'd.bolduc@clc-ctc.ca'),
    ('user_3BSzDdNeiCPn9x4M95Deq5vnWkv', v_clc_id, 'member', 'active', 'Sophie Tremblay',     's.tremblay@clc-ctc.ca'),
    ('user_3BSzDYPQ9F0SAJkkkFk2pSisOii', v_clc_id, 'member', 'active', 'James Nguyen',        'j.nguyen@clc-ctc.ca'),
    ('user_3BSzDZezfNN1Nw6YvP9hoYDDuxK', v_clc_id, 'member', 'active', 'Rebecca Martin',      'r.martin@clc-ctc.ca'),
    ('user_3BSzDjuKqbDZAHQmjVJccs9r9mq', v_clc_id, 'member', 'active', 'Louis Picard',        'l.picard@clc-ctc.ca'),
    ('user_3BSzDiXRbv3kAsmbUqzOjvVv7o7', v_clc_id, 'member', 'active', 'Angela Varga',        'a.varga@clc-ctc.ca'),
    ('user_3BSzDlKgwVGWHOKtHluyRSdJNTb', v_clc_id, 'member', 'active', 'Patrick O''Connor',   'p.oconnor@clc-ctc.ca'),
    ('user_3BSzDtwjg8WXJf36fw9wjVTu8yX', v_clc_id, 'member', 'active', 'Fatima Al-Rashid',    'f.alrashid@clc-ctc.ca');
END $$;

-- ============================================================
-- 4. CAPE-ACEP — update existing to match local
--    Staging UUID (885aa4e0-...) kept; set parent to CLC
-- ============================================================
DO $$
DECLARE
  v_clc_id  UUID;
  v_cape_id UUID;
BEGIN
  SELECT id INTO v_clc_id FROM organizations WHERE slug = 'clc';
  SELECT id INTO v_cape_id FROM organizations WHERE slug = 'cape-acep';

  UPDATE organizations
  SET display_name     = 'CAPE-ACEP',
      short_name       = 'CAPE',
      organization_type = 'union',
      parent_id        = v_clc_id,
      hierarchy_path   = ARRAY[v_clc_id::text],
      hierarchy_level  = 1,
      province_territory = 'ON',
      sectors          = '{public_service}',
      email            = 'info@acep-cape.ca',
      phone            = '613-236-9181',
      website          = 'https://acep-cape.ca',
      address          = '{"city":"Ottawa","street":"100 Queen Street, 4th Floor","country":"CA","province":"ON","postalCode":"K1P 1J9"}'::jsonb,
      clc_affiliated   = true,
      affiliation_date = '1967-01-01',
      member_count     = 12,
      active_member_count = 12,
      settings         = '{"employer":"Treasury Board of Canada Secretariat","language":"bilingual","fiscalYearEnd":"December 31","perCapitaRate":0.54,"remittanceDay":15,"bargainingAgent":"CAPE-ACEP","bargainingGroups":["EC","TR","SI"]}'::jsonb,
      features_enabled = '{dues-management,member-directory,grievance-tracking,collective-bargaining,financial-reporting,tax-slips,clc-integration,strike-fund}',
      clc_affiliate_code = 'CAPE',
      per_capita_rate  = 0.54,
      remittance_day   = 15,
      fiscal_year_end  = '2024-12-31',
      clerk_organization_id = 'org_3B3Nj6NGSY6rT9ibI8bgFhZdMRN'
  WHERE id = v_cape_id;

  -- Platform admins as CLC members (org-picker visibility)
  INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
  VALUES
    ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', v_clc_id::text, 'admin', 'active', 'Aubert Nungisa',  'aubert@nzila.app'),
    ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', v_clc_id::text, 'admin', 'active', 'Platform Admin',  'admin@nzila.io');

  -- Replace CAPE members
  DELETE FROM organization_members WHERE organization_id = v_cape_id::text;

  INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
  VALUES
    ('user_3BSyETlaLS6t8wuol22bVECjPFM', v_cape_id::text, 'admin',  'active', 'Greg Phillips',        'g.phillips@acep-cape.ca'),
    ('user_3BSyEi6TduTzKp2mZigpD6D746h', v_cape_id::text, 'admin',  'active', 'Emmanuelle Tremblay',  'e.tremblay@acep-cape.ca'),
    ('user_3BSzDo4cpXO7qTM0bY800AuLOd2', v_cape_id::text, 'member', 'active', 'Brian Faulkner',       'b.faulkner@acep-cape.ca'),
    ('user_3BSzDqnxMraAlxaRvhyrTabrTOE', v_cape_id::text, 'member', 'active', 'Chantal Bertrand',     'c.bertrand@acep-cape.ca'),
    ('user_3BSzE0qWBvXm6eP75nAukpBbpvk', v_cape_id::text, 'member', 'active', 'Mike Savard',          'm.savard@acep-cape.ca'),
    ('user_3BSzDyCmU8iKsYeD1tyBqkDfBFP', v_cape_id::text, 'member', 'active', 'Nadia Ouellet',        'n.ouellet@acep-cape.ca'),
    ('user_3BSzEAPted20wutKC5lY8lTn9jZ', v_cape_id::text, 'member', 'active', 'Daniel Kim',           'd.kim@acep-cape.ca'),
    ('user_3BSzE9z6NFV3hbYd4Fu2ufoL4rI', v_cape_id::text, 'member', 'active', 'Sarah Lefebvre',       's.lefebvre@acep-cape.ca'),
    ('user_3BSzE5AtIbImjHukqc0yM9EXQdu', v_cape_id::text, 'member', 'active', 'Alexandre Moreau',     'a.moreau@acep-cape.ca'),
    ('user_3BSzEIjI6LSWANw6ssfwXcxxnhT', v_cape_id::text, 'member', 'active', 'Jennifer Walsh',       'j.walsh@acep-cape.ca'),
    ('user_3BSzEIXiSqVXnNYgymDZ1PY6ZhY', v_cape_id::text, 'member', 'active', 'Pierre Desmarais',     'p.desmarais@acep-cape.ca'),
    ('user_3BSzEIf1ARXNRQOs3d5Qju58yNZ', v_cape_id::text, 'member', 'active', 'Amira Hassan',         'a.hassan@acep-cape.ca');

  -- Platform admins as CAPE members (org-picker visibility)
  INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
  VALUES
    ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', v_cape_id::text, 'admin', 'active', 'Aubert Nungisa',  'aubert@nzila.app'),
    ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', v_cape_id::text, 'admin', 'active', 'Platform Admin',  'admin@nzila.io');
END $$;

-- ============================================================
-- 5. CUPE Local 123 — insert or update pilot org
--    UUID: 9210418f-6a4f-4dab-a7d2-4450d581dc81
--    Clerk: org_3BP6K4uezEa2CLEvUNDwhnJGNFg
-- ============================================================
INSERT INTO organizations (id, name, slug, display_name, short_name, organization_type,
  parent_id, hierarchy_level, province_territory, sectors, email, phone, website, address,
  member_count, active_member_count, settings, features_enabled, clerk_organization_id, status)
VALUES (
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  'CUPE Local 123',
  'cupe-local-123',
  'CUPE Local 123',
  'CUPE L123',
  'local',
  NULL, -- parent_id set below
  2,
  'ON',
  '{public_service}',
  'contact@cupelocal123.ca',
  '+1-416-555-0123',
  'https://cupe.ca/local-123',
  '{"city":"Toronto","street":"100 Queen Street West","country":"CA","province":"ON","postalCode":"M5H 2N2"}'::jsonb,
  7,
  7,
  '{"language":"en","fiscalYearEnd":"December 31","employer":"City of Toronto","bargainingGroups":["Inside Workers","Outside Workers","Library Workers"]}'::jsonb,
  '{dashboard,members,claims,grievances,communications,collective-bargaining,strike-fund}',
  'org_3BP6K4uezEa2CLEvUNDwhnJGNFg',
  'active'
)
ON CONFLICT (slug) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  short_name       = EXCLUDED.short_name,
  organization_type = EXCLUDED.organization_type,
  province_territory = EXCLUDED.province_territory,
  sectors          = EXCLUDED.sectors,
  email            = EXCLUDED.email,
  phone            = EXCLUDED.phone,
  website          = EXCLUDED.website,
  address          = EXCLUDED.address,
  member_count     = EXCLUDED.member_count,
  active_member_count = EXCLUDED.active_member_count,
  settings         = EXCLUDED.settings,
  features_enabled = EXCLUDED.features_enabled,
  clerk_organization_id = EXCLUDED.clerk_organization_id;

-- CUPE members (all have real Clerk user IDs)
DELETE FROM organization_members
WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';

INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
VALUES
  ('user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'admin',   'active', 'Grace Lee',       'grace.lee@city.toronto.ca'),
  ('user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'member',  'active', 'Alice Johnson',   'alice.johnson@city.toronto.ca'),
  ('user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'steward', 'active', 'Bob Smith',       'bob.smith@city.toronto.ca'),
  ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'admin',   'active', 'Aubert Nungisa',  'aubert@nzila.app'),
  ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'admin',   'active', 'Platform Admin',  'admin@nzila.io');

-- ============================================================
-- 6. Remove extra organizations (not in core 4)
--    Clear FK references from populated tables first
-- ============================================================

-- Clean org_members for non-core orgs
DELETE FROM organization_members
WHERE organization_id NOT IN (
  SELECT id::text FROM organizations
  WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
);

-- Clean organization_relationships for non-core orgs
DELETE FROM organization_relationships
WHERE parent_org_id::text NOT IN (
  SELECT id::text FROM organizations WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
)
OR child_org_id::text NOT IN (
  SELECT id::text FROM organizations WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
);

-- Clean organization_billing_config
DELETE FROM organization_billing_config
WHERE organization_id NOT IN (
  SELECT id FROM organizations WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
);

-- Clean organization_contacts
DELETE FROM organization_contacts
WHERE organization_id NOT IN (
  SELECT id FROM organizations WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
);

-- Clean organization_sharing_settings
DELETE FROM organization_sharing_settings
WHERE organization_id NOT IN (
  SELECT id FROM organizations WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
);

-- Clean organization_benchmark_snapshots
DELETE FROM organization_benchmark_snapshots
WHERE organization_id NOT IN (
  SELECT id FROM organizations WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
);

-- Dynamically clean ALL tables with FK to organizations
DO $$
DECLARE
  rec record;
  keep_ids text;
BEGIN
  SELECT string_agg('''' || id::text || '''', ',')
    INTO keep_ids
    FROM organizations
    WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe-local-123');

  FOR rec IN
    SELECT DISTINCT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'organizations'
      AND tc.table_name NOT IN ('organizations','organization_members','organization_relationships',
                                'organization_billing_config','organization_contacts',
                                'organization_sharing_settings','organization_benchmark_snapshots')
      -- Only tables that exist as real relations
      AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = tc.table_name AND c.relkind = 'r'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'DELETE FROM %I WHERE %I IS NOT NULL AND %I::text NOT IN (%s)',
        rec.table_name, rec.column_name, rec.column_name, keep_ids
      );
    EXCEPTION WHEN undefined_table THEN
      -- Skip tables that don't actually exist
      NULL;
    END;
  END LOOP;
END $$;

-- Now delete the extra organizations (children first)
DELETE FROM organizations
WHERE slug NOT IN ('default', 'clc', 'cape-acep', 'cupe-local-123')
  AND parent_id IS NOT NULL;

DELETE FROM organizations
WHERE slug NOT IN ('default', 'clc', 'cape-acep', 'cupe-local-123');

COMMIT;

-- ============================================================
-- Verification
-- ============================================================
SELECT id, name, slug, organization_type, hierarchy_level, member_count
FROM organizations ORDER BY hierarchy_level, name;

SELECT om.user_id, o.slug AS org, om.role, om.name
FROM organization_members om
JOIN organizations o ON o.id::text = om.organization_id
ORDER BY o.slug, om.role, om.name;
