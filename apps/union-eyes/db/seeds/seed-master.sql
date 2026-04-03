-- =============================================================================
-- MASTER SEED — Union Eyes (Nzila OS)
-- =============================================================================
-- THE definitive, idempotent, Clerk-aligned seed for all 4 core tenants:
--   1. NZILA Ventures  (platform)  → org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ
--   2. CLC             (congress)  → org_3B3NjHnvzeSJBZQE8PGQf0nmgts
--   3. CAPE-ACEP       (union)     → org_3B3Nj6NGSY6rT9ibI8bgFhZdMRN
--   4. CUPE Local 123  (local)     → org_3BP6K4uezEa2CLEvUNDwhnJGNFg
--
-- Also seeds the full CLC hierarchy (federations, national unions, locals)
-- including CUPE National as the parent of CUPE Local 123.
--
-- All member user_ids are REAL Clerk user IDs from the known-hagfish-67
-- Clerk instance. Password for all test users: NzilaTest2026!
--
-- Idempotent: all inserts use ON CONFLICT DO NOTHING or upsert.
-- Safe to re-run without duplicating data.
--
-- Prerequisites: Drizzle migrations must be applied first.
--
-- Run (native PG on port 5433):
--   $env:PGPASSWORD="nzila_dev"
--   Get-Content apps\union-eyes\db\seeds\seed-master.sql |
--     & "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
--       -U nzila -d nzila_automation -p 5433 -h localhost
--
-- Authoritative UUIDs (hardcoded for supplementary-seed compatibility):
--   NZILA:       458a56cb-251a-4c91-a0b5-81bb8ac39087
--   CLC:         9588c826-a543-4d43-9c22-2e477e532649
--   CAPE-ACEP:   063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6
--   CUPE Natl:   7bc67951-0cd1-40eb-b0bf-da84452cf345
--   CUPE L123:   9210418f-6a4f-4dab-a7d2-4450d581dc81
--
-- Authoritative Grievance UUIDs:
--   CLC-GRV-2025-001:  c247cd41-eb1b-4b0f-8c3c-da569debcdd0
--   CLC-GRV-2025-002:  5e88d701-ba56-4b21-9cb5-56c955fda2af
--   CLC-GRV-2025-003:  3c5a2aa4-2beb-4d7d-b93e-2f95bd7f1dc8
--   L123-GRV-2025-001: 25fb07a4-74c4-4d0b-ac61-d241b79fd85a
--   L123-GRV-2025-002: 6efb0d95-5601-45ed-957e-10639b8aabd1
--   L123-GRV-2025-003: 25764b98-db08-4884-88d5-098d45750731
-- =============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 1: CORE ORGANIZATIONS                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 1a. NZILA Ventures (Platform)
INSERT INTO organizations (
  id, name, slug, display_name, short_name, organization_type,
  hierarchy_path, hierarchy_level, sectors, member_count, active_member_count,
  settings, features_enabled, clerk_organization_id, status
) VALUES (
  '458a56cb-251a-4c91-a0b5-81bb8ac39087',
  'NZILA Ventures', 'default', 'NZILA Ventures', 'NZILA', 'platform',
  '{}', 0, '{technology,financial_services}', 12, 12,
  '{"currency":"CAD","dateFormat":"YYYY-MM-DD","defaultLanguage":"en","mfaEnforcement":"admins_only","sessionTimeout":30}'::jsonb,
  '{dashboard,members,claims,grievances,communications}',
  'org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ', 'active'
) ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  organization_type = EXCLUDED.organization_type,
  clerk_organization_id = EXCLUDED.clerk_organization_id;

-- 1b. CLC (Congress — root of hierarchy)
INSERT INTO organizations (
  id, name, slug, display_name, short_name, description, organization_type,
  parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
  email, phone, website, address,
  clc_affiliated, member_count, active_member_count, status,
  clc_affiliate_code, per_capita_rate, remittance_day, fiscal_year_end,
  settings, features_enabled, clerk_organization_id
) VALUES (
  '9588c826-a543-4d43-9c22-2e477e532649',
  'Canadian Labour Congress', 'clc', 'CLC', 'CLC',
  'The Canadian Labour Congress is the national voice of the labour movement, representing 3 million workers.',
  'congress', NULL, '{}', 0, 'ON', '{public_service,education}',
  'info@clc-ctc.ca', '613-521-3400', 'https://canadianlabour.ca',
  '{"city":"Ottawa","street":"2841 Riverside Drive","country":"CA","province":"ON","postalCode":"K1V 8X7"}'::jsonb,
  false, 3000000, 3000000, 'active',
  'CLC', 0.54, 15, '2024-12-31',
  '{"language":"bilingual","fiscalYearEnd":"December 31","perCapitaRate":0.54,"remittanceDay":15,"affiliateCount":56,"governanceModel":"triennial_convention","executiveCouncil":true}'::jsonb,
  '{dues-management,member-directory,financial-reporting,per-capita-remittances,clc-integration,affiliate-management,convention-governance}',
  'org_3B3NjHnvzeSJBZQE8PGQf0nmgts'
) ON CONFLICT (slug) DO UPDATE SET
  clerk_organization_id = EXCLUDED.clerk_organization_id,
  settings = EXCLUDED.settings,
  features_enabled = EXCLUDED.features_enabled;

-- 1c. CAPE-ACEP (Union — CLC affiliate)
DO $$
DECLARE v_clc_id UUID;
BEGIN
  SELECT id INTO v_clc_id FROM organizations WHERE slug = 'clc';

  INSERT INTO organizations (
    id, name, slug, display_name, short_name, description, organization_type,
    parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
    email, phone, website, address,
    clc_affiliated, affiliation_date, member_count, active_member_count, status,
    clc_affiliate_code, per_capita_rate, remittance_day, fiscal_year_end,
    settings, features_enabled, clerk_organization_id
  ) VALUES (
    '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6',
    'Canadian Association of Professional Employees', 'cape-acep', 'CAPE-ACEP', 'CAPE',
    'CAPE-ACEP represents ~23,000 federal public-service professionals (EC, TR, SI groups).',
    'union', v_clc_id, ARRAY[v_clc_id::text], 1, 'ON', '{public_service}',
    'info@acep-cape.ca', '613-236-9181', 'https://acep-cape.ca',
    '{"city":"Ottawa","street":"100 Queen Street, 4th Floor","country":"CA","province":"ON","postalCode":"K1P 1J9"}'::jsonb,
    true, '1967-01-01', 23000, 23000, 'active',
    'CAPE', 0.54, 15, '2024-12-31',
    '{"employer":"Treasury Board of Canada Secretariat","language":"bilingual","fiscalYearEnd":"December 31","perCapitaRate":0.54,"remittanceDay":15,"bargainingAgent":"CAPE-ACEP","bargainingGroups":["EC","TR","SI"]}'::jsonb,
    '{dues-management,member-directory,grievance-tracking,collective-bargaining,financial-reporting,tax-slips,clc-integration,strike-fund}',
    'org_3B3Nj6NGSY6rT9ibI8bgFhZdMRN'
  ) ON CONFLICT (slug) DO UPDATE SET
    parent_id = v_clc_id,
    hierarchy_path = ARRAY[v_clc_id::text],
    hierarchy_level = 1,
    clerk_organization_id = EXCLUDED.clerk_organization_id,
    settings = EXCLUDED.settings;
END $$;

-- 1e. CUPE National (hardcoded ID for supplementary-seed compatibility)
--     NOTE: clerk_organization_id is intentionally NULL — no Clerk org exists for
--     CUPE National yet. CUPE members log in via CUPE L123's Clerk org
--     (org_3BP6K4uezEa2CLEvUNDwhnJGNFg). Create a Clerk org when CUPE National
--     needs its own auth boundary.
DO $$
DECLARE v_clc_id UUID;
BEGIN
  SELECT id INTO v_clc_id FROM organizations WHERE slug = 'clc';
  INSERT INTO organizations (
    id, name, slug, display_name, short_name, description, organization_type,
    parent_id, hierarchy_path, hierarchy_level, province_territory, sectors, website,
    clc_affiliated, member_count, active_member_count, status, settings, features_enabled
  ) VALUES (
    '7bc67951-0cd1-40eb-b0bf-da84452cf345',
    'Canadian Union of Public Employees', 'cupe', 'CUPE', 'CUPE',
    'Canada''s largest union — 700,000 members in healthcare, education, and municipalities.',
    'union', v_clc_id, ARRAY[v_clc_id::text], 1, NULL,
    ARRAY['public_service','healthcare','education']::labour_sector[],
    'https://cupe.ca', true, 700000, 700000, 'active',
    '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb,
    ARRAY['grievance-management','member-portal','contract-management','dues-tracking']
  ) ON CONFLICT (slug) DO NOTHING;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 2: CLC HIERARCHY (Federations + National Unions + Locals)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  clc_id   UUID;
  cupe_id  UUID;
  unifor_id UUID;
  ufcw_id  UUID;
  usw_id   UUID;
  ofl_id   UUID;
  bcfed_id UUID;
  fed_id   UUID;
  aff_id   UUID;
BEGIN
  SELECT id INTO clc_id FROM organizations WHERE slug = 'clc';
  IF clc_id IS NULL THEN
    RAISE EXCEPTION 'CLC organization not found — cannot seed hierarchy';
  END IF;

  -- ══════ 2a. Provincial / Territorial Federations (13) ══════
  INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
    parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
    clc_affiliated, member_count, active_member_count, status, settings, features_enabled)
  VALUES
    ('Alberta Federation of Labour',                   'afl',   'AFL',    'AFL',    'Alberta Federation of Labour — Provincial federation for AB.',             'federation', clc_id, ARRAY[clc_id::text], 1, 'AB', '{}', true, 175000, 175000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('BC Federation of Labour',                        'bcfed', 'BCFED',  'BCFED',  'BC Federation of Labour — Provincial federation for BC.',                  'federation', clc_id, ARRAY[clc_id::text], 1, 'BC', '{}', true, 500000, 500000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Manitoba Federation of Labour',                  'mfl',   'MFL',    'MFL',    'Manitoba Federation of Labour — Provincial federation for MB.',            'federation', clc_id, ARRAY[clc_id::text], 1, 'MB', '{}', true, 100000, 100000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('New Brunswick Federation of Labour',             'nbfl',  'NBFL',   'NBFL',   'New Brunswick Federation of Labour — Provincial federation for NB.',       'federation', clc_id, ARRAY[clc_id::text], 1, 'NB', '{}', true, 40000,  40000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Newfoundland and Labrador Federation of Labour', 'nlfl',  'NLFL',   'NLFL',   'NL Federation of Labour — Provincial federation for NL.',                  'federation', clc_id, ARRAY[clc_id::text], 1, 'NL', '{}', true, 65000,  65000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Nova Scotia Federation of Labour',               'nsfl',  'NSFL',   'NSFL',   'Nova Scotia Federation of Labour — Provincial federation for NS.',         'federation', clc_id, ARRAY[clc_id::text], 1, 'NS', '{}', true, 75000,  75000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Northwest Territories Federation of Labour',     'nwtfl', 'NWTFL',  'NWTFL',  'NWT Federation of Labour — Territorial federation for NT.',                'federation', clc_id, ARRAY[clc_id::text], 1, 'NT', '{}', true, 5000,   5000,   'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Nunavut Employees Union',                        'nueu',  'NUEU',   'NUEU',   'Nunavut Employees Union — Territorial federation for NU.',                 'federation', clc_id, ARRAY[clc_id::text], 1, 'NU', '{}', true, 3000,   3000,   'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Ontario Federation of Labour',                   'ofl',   'OFL',    'OFL',    'Ontario Federation of Labour — Provincial federation for ON.',             'federation', clc_id, ARRAY[clc_id::text], 1, 'ON', '{}', true, 1000000,1000000,'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('PEI Federation of Labour',                       'peifl', 'PEIFL',  'PEIFL',  'PEI Federation of Labour — Provincial federation for PE.',                'federation', clc_id, ARRAY[clc_id::text], 1, 'PE', '{}', true, 12000,  12000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Fédération des travailleurs et travailleuses du Québec', 'ftq', 'FTQ', 'FTQ', 'FTQ — Provincial federation for QC.',                                    'federation', clc_id, ARRAY[clc_id::text], 1, 'QC', '{}', true, 600000, 600000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Saskatchewan Federation of Labour',              'sfl',   'SFL',    'SFL',    'Saskatchewan Federation of Labour — Provincial federation for SK.',        'federation', clc_id, ARRAY[clc_id::text], 1, 'SK', '{}', true, 100000, 100000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging']),
    ('Yukon Federation of Labour',                     'yfl',   'YFL',    'YFL',    'Yukon Federation of Labour — Territorial federation for YT.',              'federation', clc_id, ARRAY[clc_id::text], 1, 'YT', '{}', true, 4000,   4000,   'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['local-management','federation-reporting','shared-clause-library','inter-union-messaging'])
  ON CONFLICT (slug) DO NOTHING;

  -- Federation → CLC relationships
  FOR fed_id IN SELECT id FROM organizations WHERE organization_type = 'federation' AND parent_id = clc_id
  LOOP
    INSERT INTO organization_relationships (parent_org_id, child_org_id, relationship_type, effective_date, notes)
    SELECT clc_id, fed_id, 'affiliate', CURRENT_DATE, 'Provincial/territorial federation affiliated to CLC'
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_relationships
      WHERE parent_org_id = clc_id AND child_org_id = fed_id
    );
  END LOOP;

  -- ══════ 2b. National / International Union Affiliates (11 — CUPE seeded in Phase 1e) ══════
  INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
    parent_id, hierarchy_path, hierarchy_level, province_territory, sectors, website,
    clc_affiliated, member_count, active_member_count, status, settings, features_enabled)
  VALUES
    ('Unifor',                                                       'unifor',   'Unifor',    'Unifor',    'Canada''s largest private-sector union — auto, aerospace, media, telecom.',                 'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['manufacturing','transportation','telecommunications']::labour_sector[], 'https://unifor.org', true, 315000, 315000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('United Food and Commercial Workers Canada',                    'ufcw',     'UFCW',      'UFCW',      'Workers in food processing, retail, hospitality, and agriculture across Canada.',          'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['retail','agriculture','hospitality']::labour_sector[], 'https://ufcw.ca',      true, 250000, 250000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('United Steelworkers',                                          'usw',      'USW',       'USW',       'One of North America''s largest industrial unions — steel, mining, manufacturing.',         'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['manufacturing','trades']::labour_sector[], 'https://usw.ca',           true, 225000, 225000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('Public Service Alliance of Canada',                            'psac',     'PSAC',      'PSAC',      'The union of Canada''s federal public service.',                                           'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['public_service']::labour_sector[], 'https://psacunion.ca',         true, 215000, 215000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('Canadian Federation of Nurses Unions',                         'cfnu',     'CFNU',      'CFNU',      'National federation representing nurses across all provinces.',                            'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['healthcare']::labour_sector[], 'https://nursesunions.ca',         true, 200000, 200000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('Teamsters Canada',                                             'teamsters','Teamsters', 'Teamsters', 'Freight, parcel, airline, rail, and warehouse workers across Canada.',                     'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['transportation','retail']::labour_sector[], 'https://teamsters.ca',    true, 125000, 125000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('Service Employees International Union',                        'seiu',     'SEIU',      'SEIU',      'Healthcare, property services, and public-sector workers across Canada.',                  'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['healthcare','public_service']::labour_sector[], 'https://seiulocal2.ca', true, 100000, 100000, 'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('International Brotherhood of Electrical Workers — Canada',     'ibew-ca',  'IBEW',      'IBEW',      'Electricians, lineworkers, and utility technicians.',                                      'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['trades','construction','utilities']::labour_sector[], 'https://ibew.org',   true, 70000,  70000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('Canadian Union of Postal Workers',                             'cupw',     'CUPW',      'CUPW',      'Letter carriers, postal clerks, and RSMCs delivering mail coast to coast.',                'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['public_service','transportation']::labour_sector[], 'https://cupw-sttp.org',true, 55000,  55000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('International Association of Machinists and Aerospace Workers','iamaw',    'IAMAW',     'IAMAW',     'Aerospace, airline, rail, and precision-manufacturing workers.',                           'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['manufacturing','transportation']::labour_sector[], 'https://iamaw.ca',    true, 50000,  50000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking']),
    ('Alliance of Canadian Cinema, Television and Radio Artists',    'actra',    'ACTRA',     'ACTRA',     'Performers in film, television, radio, and digital media.',                                'union', clc_id, ARRAY[clc_id::text], 1, NULL, ARRAY['arts_culture']::labour_sector[], 'https://actra.ca',            true, 28000,  28000,  'active', '{"perCapitaRate":0.54,"remittanceDay":15}'::jsonb, ARRAY['grievance-management','member-portal','contract-management','dues-tracking'])
  ON CONFLICT (slug) DO NOTHING;

  -- National union → CLC relationships
  FOR aff_id IN SELECT id FROM organizations WHERE organization_type = 'union' AND parent_id = clc_id
  LOOP
    INSERT INTO organization_relationships (parent_org_id, child_org_id, relationship_type, effective_date, notes)
    SELECT clc_id, aff_id, 'affiliate', CURRENT_DATE, 'National union affiliated to CLC'
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_relationships
      WHERE parent_org_id = clc_id AND child_org_id = aff_id
    );
  END LOOP;

  -- ══════ 2c. Sample Locals & District Labour Councils ══════
  SELECT id INTO cupe_id   FROM organizations WHERE slug = 'cupe';
  SELECT id INTO unifor_id FROM organizations WHERE slug = 'unifor';
  SELECT id INTO ufcw_id   FROM organizations WHERE slug = 'ufcw';
  SELECT id INTO usw_id    FROM organizations WHERE slug = 'usw';
  SELECT id INTO ofl_id    FROM organizations WHERE slug = 'ofl';
  SELECT id INTO bcfed_id  FROM organizations WHERE slug = 'bcfed';

  -- CUPE locals (NOT including CUPE L123 — seeded separately in Phase 1d)
  IF cupe_id IS NOT NULL THEN
    INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
      parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
      clc_affiliated, member_count, active_member_count, status, charter_number, settings, features_enabled)
    VALUES
      ('CUPE Local 79',   'cupe-local-79',   'CUPE 79',   'CUPE 79',   'City of Toronto inside workers — largest CUPE local.', 'local', cupe_id, ARRAY[clc_id::text, cupe_id::text], 2, 'ON', ARRAY['public_service']::labour_sector[], true, 25000, 25000, 'active', 'CUPE-ON-079',   '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking']),
      ('CUPE Local 3903', 'cupe-local-3903', 'CUPE 3903', 'CUPE 3903', 'York University contract faculty and TAs.',            'local', cupe_id, ARRAY[clc_id::text, cupe_id::text], 2, 'ON', ARRAY['education']::labour_sector[],       true, 3800,  3800,  'active', 'CUPE-ON-3903', '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking']),
      ('CUPE Local 1000', 'cupe-local-1000', 'CUPE 1000', 'CUPE 1000', 'Ottawa-Carleton region municipality workers.',         'local', cupe_id, ARRAY[clc_id::text, cupe_id::text], 2, 'ON', ARRAY['public_service']::labour_sector[], true, 4500,  4500,  'active', 'CUPE-ON-1000', '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking'])
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- Unifor locals
  IF unifor_id IS NOT NULL THEN
    INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
      parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
      clc_affiliated, member_count, active_member_count, status, charter_number, settings, features_enabled)
    VALUES
      ('Unifor Local 444',  'unifor-local-444',  'Unifor 444',  'Unifor 444',  'Windsor Stellantis assembly workers.',   'local', unifor_id, ARRAY[clc_id::text, unifor_id::text], 2, 'ON', ARRAY['manufacturing']::labour_sector[], true, 12000, 12000, 'active', 'UNI-ON-444',   '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking']),
      ('Unifor Local 2002', 'unifor-local-2002', 'Unifor 2002', 'Unifor 2002', 'Airline workers — Air Canada, Jazz.',   'local', unifor_id, ARRAY[clc_id::text, unifor_id::text], 2, NULL, ARRAY['transportation']::labour_sector[], true, 7000,  7000,  'active', 'UNI-NAT-2002', '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking'])
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- UFCW locals
  IF ufcw_id IS NOT NULL THEN
    INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
      parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
      clc_affiliated, member_count, active_member_count, status, charter_number, settings, features_enabled)
    VALUES
      ('UFCW Local 401',   'ufcw-local-401',   'UFCW 401',   'UFCW 401',   'Alberta retail, agriculture, hospitality.', 'local', ufcw_id, ARRAY[clc_id::text, ufcw_id::text], 2, 'AB', ARRAY['retail','agriculture']::labour_sector[], true, 32000, 32000, 'active', 'UFCW-AB-401',   '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking']),
      ('UFCW Local 1006A', 'ufcw-local-1006a', 'UFCW 1006A', 'UFCW 1006A', 'Ontario food retail and hospitality.',      'local', ufcw_id, ARRAY[clc_id::text, ufcw_id::text], 2, 'ON', ARRAY['retail','hospitality']::labour_sector[],  true, 35000, 35000, 'active', 'UFCW-ON-1006A', '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking'])
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- USW locals
  IF usw_id IS NOT NULL THEN
    INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
      parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
      clc_affiliated, member_count, active_member_count, status, charter_number, settings, features_enabled)
    VALUES
      ('USW Local 1005', 'usw-local-1005', 'USW 1005', 'USW 1005', 'ArcelorMittal Dofasco steelworkers, Hamilton.', 'local', usw_id, ARRAY[clc_id::text, usw_id::text], 2, 'ON', ARRAY['manufacturing']::labour_sector[],         true, 2200, 2200, 'active', 'USW-ON-1005', '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking']),
      ('USW Local 6500', 'usw-local-6500', 'USW 6500', 'USW 6500', 'Vale nickel mine workers, Sudbury.',           'local', usw_id, ARRAY[clc_id::text, usw_id::text], 2, 'ON', ARRAY['manufacturing','trades']::labour_sector[], true, 4000, 4000, 'active', 'USW-ON-6500', '{"perCapitaRate":0.54}'::jsonb, ARRAY['grievance-management','member-portal','dues-tracking'])
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  -- District Labour Councils
  IF ofl_id IS NOT NULL THEN
    INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
      parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
      clc_affiliated, member_count, active_member_count, status, settings, features_enabled)
    VALUES ('Toronto & York Region Labour Council', 'tyrlc', 'TYRLC', 'TYRLC',
      'Greater Toronto Area and York Region district labour council.',
      'district', ofl_id, ARRAY[clc_id::text, ofl_id::text], 2, 'ON', '{}',
      true, 200000, 200000, 'active', '{}'::jsonb, ARRAY['local-management','federation-reporting'])
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  IF bcfed_id IS NOT NULL THEN
    INSERT INTO organizations (name, slug, display_name, short_name, description, organization_type,
      parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
      clc_affiliated, member_count, active_member_count, status, settings, features_enabled)
    VALUES ('Vancouver & District Labour Council', 'vdlc', 'VDLC', 'VDLC',
      'Metro Vancouver area district labour council.',
      'district', bcfed_id, ARRAY[clc_id::text, bcfed_id::text], 2, 'BC', '{}',
      true, 120000, 120000, 'active', '{}'::jsonb, ARRAY['local-management','federation-reporting'])
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- 1d. CUPE Local 123 (Local — under CUPE National)
-- Authoritative UUID: 9210418f-6a4f-4dab-a7d2-4450d581dc81
DO $$
DECLARE
  v_clc_id  UUID;
  v_cupe_id UUID;
BEGIN
  SELECT id INTO v_clc_id  FROM organizations WHERE slug = 'clc';
  SELECT id INTO v_cupe_id FROM organizations WHERE slug = 'cupe';

  INSERT INTO organizations (
    id, name, slug, display_name, short_name, organization_type,
    parent_id, hierarchy_path, hierarchy_level, province_territory, sectors,
    email, phone, website, address,
    member_count, active_member_count,
    settings, features_enabled, clerk_organization_id, status
  ) VALUES (
    '9210418f-6a4f-4dab-a7d2-4450d581dc81',
    'CUPE Local 123', 'cupe-local-123', 'CUPE Local 123', 'CUPE L123', 'local',
    v_cupe_id, ARRAY[v_clc_id::text, v_cupe_id::text], 2, 'ON', '{public_service}',
    'contact@cupelocal123.ca', '+1-416-555-0123', 'https://cupe.ca/local-123',
    '{"city":"Toronto","street":"100 Queen Street West","country":"CA","province":"ON","postalCode":"M5H 2N2"}'::jsonb,
    12, 12,
    '{"language":"bilingual","fiscalYearEnd":"December 31","employer":"City of Toronto","bargainingGroups":["Inside Workers","Outside Workers","Library Workers"]}'::jsonb,
    '{dashboard,members,claims,grievances,communications,collective-bargaining,strike-fund}',
    'org_3BP6K4uezEa2CLEvUNDwhnJGNFg', 'active'
  ) ON CONFLICT (slug) DO UPDATE SET
    parent_id = v_cupe_id,
    hierarchy_path = ARRAY[v_clc_id::text, v_cupe_id::text],
    hierarchy_level = 2,
    clerk_organization_id = EXCLUDED.clerk_organization_id,
    settings = EXCLUDED.settings;

  -- CUPE Local 123 → CUPE relationship
  IF v_cupe_id IS NOT NULL THEN
    INSERT INTO organization_relationships (parent_org_id, child_org_id, relationship_type, effective_date, notes)
    SELECT v_cupe_id, '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid, 'affiliate', CURRENT_DATE,
           'CUPE Local 123 — City of Toronto inside/outside workers'
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_relationships
      WHERE parent_org_id = v_cupe_id
        AND child_org_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid
    );
  END IF;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 3: ORGANIZATION MEMBERS (Clerk user IDs)                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 3a. NZILA Ventures members (12)
DELETE FROM organization_members
WHERE organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087';

INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
VALUES
  ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'app_owner',        'active', 'Aubert Nungisa',    'aubert@nzila.app'),
  ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'app_owner',        'active', 'Platform Admin',    'admin@nzila.io'),
  ('user_3A2c7Rsg6612F3BAxHxx5L29jRH', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'system_admin',     'active', 'Sandra Weatherby',  'test.employer@nzilaventures.com'),
  ('user_3A2c3b8lVI7gxi3Keb6xE4piwGv', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'fed_executive',    'active', 'Patty Coates',      'test.fedexec@nzilaventures.com'),
  ('user_3A2c6sEcW7WdJSnLVVQFB28PjIU', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'fed_staff',        'active', 'Tania Da Silva',    'test.localadmin@nzilaventures.com'),
  ('user_3A2c7AO7bbapxh9IdAgW5kXPhHu', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'member',           'active', 'Priya Sharma',      'test.member2@nzilaventures.com'),
  ('user_3A2c75rcBNDcTYtkjnNgbYLqsEx', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'member',           'active', 'Carlos Rivera',     'test.member1@nzilaventures.com'),
  ('user_3A2c7IXYOHgNMiIdOte7C5MEwFd', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'member',           'active', 'Ahmed Hassan',      'test.member3@nzilaventures.com'),
  ('user_3A2c3apBW0oMKPX2CjIMd8b1ujq', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'national_officer', 'active', 'Mark Hancock',      'test.nationaloff@nzilaventures.com'),
  ('user_3A2c3SaKc0xFearcu0NbUL2lhDF', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'platform_admin',   'active', 'David Nkemdirim',   'test.platformlead@nzilaventures.com'),
  ('user_3A2c6rLMOmF45HEkaU7XdQp05Zk', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'president',        'active', 'Tim Maguire',       'test.president@nzilaventures.com'),
  ('user_3A2c729gwvVEXyC6vc2ICqzihxp', '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'steward',          'active', 'Keisha Brown',      'test.steward@nzilaventures.com');

-- 3b. CLC members (10 + 2 platform admins)
DO $$
DECLARE v_clc_id text;
BEGIN
  SELECT id::text INTO v_clc_id FROM organizations WHERE slug = 'clc';

  DELETE FROM organization_members WHERE organization_id = v_clc_id;

  INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
  VALUES
    ('user_3BSyEWUb0cnQ56CSS0W0fK8g35a', v_clc_id, 'clc_executive', 'active', 'Hassan Yussuff',      'h.yussuff@clc-ctc.ca'),
    ('user_3BSyEa51htBN51y0YxG9a9Elp2L', v_clc_id, 'clc_executive', 'active', 'Marie Clarke Walker', 'm.walker@clc-ctc.ca'),
    ('user_3BSzDRcx41T9Pq06KAhtQkFmi8T', v_clc_id, 'clc_staff',     'active', 'Denis Bolduc',        'd.bolduc@clc-ctc.ca'),
    ('user_3BSzDdNeiCPn9x4M95Deq5vnWkv', v_clc_id, 'member', 'active', 'Sophie Tremblay',     's.tremblay@clc-ctc.ca'),
    ('user_3BSzDYPQ9F0SAJkkkFk2pSisOii', v_clc_id, 'member', 'active', 'James Nguyen',        'j.nguyen@clc-ctc.ca'),
    ('user_3BSzDZezfNN1Nw6YvP9hoYDDuxK', v_clc_id, 'member', 'active', 'Rebecca Martin',      'r.martin@clc-ctc.ca'),
    ('user_3BSzDjuKqbDZAHQmjVJccs9r9mq', v_clc_id, 'member', 'active', 'Louis Picard',        'l.picard@clc-ctc.ca'),
    ('user_3BSzDiXRbv3kAsmbUqzOjvVv7o7', v_clc_id, 'member', 'active', 'Angela Varga',        'a.varga@clc-ctc.ca'),
    ('user_3BSzDlKgwVGWHOKtHluyRSdJNTb', v_clc_id, 'member', 'active', 'Patrick O''Connor',   'p.oconnor@clc-ctc.ca'),
    ('user_3BSzDtwjg8WXJf36fw9wjVTu8yX', v_clc_id, 'member', 'active', 'Fatima Al-Rashid',    'f.alrashid@clc-ctc.ca'),
    -- Platform admins (cross-org visibility)
    ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', v_clc_id, 'admin',  'active', 'Aubert Nungisa',      'aubert@nzila.app'),
    ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', v_clc_id, 'admin',  'active', 'Platform Admin',      'admin@nzila.io');
END $$;

-- 3c. CAPE-ACEP members (12 + 2 platform admins)
DO $$
DECLARE v_cape_id text;
BEGIN
  SELECT id::text INTO v_cape_id FROM organizations WHERE slug = 'cape-acep';

  DELETE FROM organization_members WHERE organization_id = v_cape_id;

  INSERT INTO organization_members (user_id, organization_id, role, status, name, email)
  VALUES
    ('user_3BSyETlaLS6t8wuol22bVECjPFM', v_cape_id, 'admin',  'active', 'Greg Phillips',        'g.phillips@acep-cape.ca'),
    ('user_3BSyEi6TduTzKp2mZigpD6D746h', v_cape_id, 'admin',  'active', 'Emmanuelle Tremblay',  'e.tremblay@acep-cape.ca'),
    ('user_3BSzDo4cpXO7qTM0bY800AuLOd2', v_cape_id, 'member', 'active', 'Brian Faulkner',       'b.faulkner@acep-cape.ca'),
    ('user_3BSzDqnxMraAlxaRvhyrTabrTOE', v_cape_id, 'member', 'active', 'Chantal Bertrand',     'c.bertrand@acep-cape.ca'),
    ('user_3BSzE0qWBvXm6eP75nAukpBbpvk', v_cape_id, 'member', 'active', 'Mike Savard',          'm.savard@acep-cape.ca'),
    ('user_3BSzDyCmU8iKsYeD1tyBqkDfBFP', v_cape_id, 'member', 'active', 'Nadia Ouellet',        'n.ouellet@acep-cape.ca'),
    ('user_3BSzEAPted20wutKC5lY8lTn9jZ', v_cape_id, 'member', 'active', 'Daniel Kim',           'd.kim@acep-cape.ca'),
    ('user_3BSzE9z6NFV3hbYd4Fu2ufoL4rI', v_cape_id, 'member', 'active', 'Sarah Lefebvre',       's.lefebvre@acep-cape.ca'),
    ('user_3BSzE5AtIbImjHukqc0yM9EXQdu', v_cape_id, 'member', 'active', 'Alexandre Moreau',     'a.moreau@acep-cape.ca'),
    ('user_3BSzEIjI6LSWANw6ssfwXcxxnhT', v_cape_id, 'member', 'active', 'Jennifer Walsh',       'j.walsh@acep-cape.ca'),
    ('user_3BSzEIXiSqVXnNYgymDZ1PY6ZhY', v_cape_id, 'member', 'active', 'Pierre Desmarais',     'p.desmarais@acep-cape.ca'),
    ('user_3BSzEIf1ARXNRQOs3d5Qju58yNZ', v_cape_id, 'member', 'active', 'Amira Hassan',         'a.hassan@acep-cape.ca'),
    -- Platform admins
    ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', v_cape_id, 'admin',  'active', 'Aubert Nungisa',       'aubert@nzila.app'),
    ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', v_cape_id, 'admin',  'active', 'Platform Admin',       'admin@nzila.io');
END $$;

-- 3d. CUPE National members (6 — national office staff)
-- NOTE: These user IDs are placeholders until Clerk users are provisioned
-- for CUPE National. They can log in to CUPE L123 which has its own Clerk org.
DO $$
DECLARE v_cupe_id text;
BEGIN
  SELECT id::text INTO v_cupe_id FROM organizations WHERE slug = 'cupe';

  INSERT INTO organization_members (user_id, organization_id, role, status, name, email, department, position)
  SELECT v.user_id, v_cupe_id, v.role, 'active', v.name, v.email, v.department, v.position
  FROM (VALUES
    ('cupe-natl-001', 'admin',  'Mark Hancock',       'president@cupe.ca',      'Executive',        'National President'),
    ('cupe-natl-002', 'admin',  'Candace Rennick',    'c.rennick@cupe.ca',      'Executive',        'National Secretary-Treasurer'),
    ('cupe-natl-003', 'member', 'Charles Fleury',     'c.fleury@cupe.ca',       'Operations',       'General Vice-President'),
    ('cupe-natl-004', 'member', 'Fred Hahn',          'f.hahn@cupe.ca',         'Ontario Division', 'Ontario President'),
    ('cupe-natl-005', 'member', 'Judy Henley',        'j.henley@cupe.ca',       'Policy',           'National Director of Policy'),
    ('cupe-natl-006', 'member', 'Patrick Gloutney',   'p.gloutney@cupe.ca',     'Organizing',       'National Director of Organizing')
  ) AS v(user_id, role, name, email, department, position)
  WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = v.user_id AND om.organization_id = v_cupe_id
  );
END $$;

-- 3e. CUPE Local 123 members (10 + 2 platform admins)
--     First 4 IDs are hardcoded for supplementary-seed compatibility:
--       Grace Lee      = 0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc
--       Alice Johnson  = beb4a1d7-fa51-4622-b118-2eff94decb45
--       Bob Smith      = 2f5bdfe0-7d87-47b7-b2c3-36242b256a4f
--       Marie-Claire   = 8653b21c-9692-49b9-b519-128a7dc52558
DELETE FROM organization_members
WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';

INSERT INTO organization_members (id, user_id, organization_id, role, status, name, email)
VALUES
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'admin',   'active', 'Grace Lee',            'grace.lee@city.toronto.ca'),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'member',  'active', 'Alice Johnson',        'alice.johnson@city.toronto.ca'),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'steward', 'active', 'Bob Smith',            'bob.smith@city.toronto.ca'),
  ('8653b21c-9692-49b9-b519-128a7dc52558', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bargaining_committee', 'active', 'Marie-Claire Dubois',  'mc.dubois@city.toronto.ca'),
  (gen_random_uuid(), 'user_3BSzhdQTA7fsGN5kUPfXJpMTK1O', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'president',            'active', 'Jean-Pierre Tremblay', 'jp.tremblay@city.toronto.ca'),
  (gen_random_uuid(), 'user_3BSzhpCQGDtA22YfStHM5ksq6pI', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'chief_steward',        'active', 'David Thompson',       'd.thompson@city.toronto.ca'),
  (gen_random_uuid(), 'user_3BSzhnlEbmEnazjOxZdVE2eXO64', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'vice_president',       'active', 'Priya Patel',          'p.patel@city.toronto.ca'),
  (gen_random_uuid(), 'user_3BSzhk06aD2b1kK5jUuMlmy7vGu', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'health_safety_rep',    'active', 'Marco Rossi',          'm.rossi@city.toronto.ca'),
  (gen_random_uuid(), 'user_3BSzhvBJ63gV7BmDQlH6VTLm18g', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'secretary_treasurer',  'active', 'Nathalie Lafontaine',  'n.lafontaine@city.toronto.ca'),
  (gen_random_uuid(), 'user_3BSzhpyvCHVWm3o4QSYs87ufGGg', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'officer',              'active', 'Kevin O''Brien',       'k.obrien@city.toronto.ca'),
  -- Platform admins
  (gen_random_uuid(), 'user_35NlrrNcfTv0DMh2kzBHyXZRtpb', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'admin',   'active', 'Aubert Nungisa',       'aubert@nzila.app'),
  (gen_random_uuid(), 'user_37Zo7OrvP4jy0J0MU5APfkDtE2V', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'admin',   'active', 'Platform Admin',       'admin@nzila.io');


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 4: user_management.users (i18n / locale data)                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO user_management.users (user_id, email, first_name, last_name, locale, timezone, is_active)
VALUES
  -- NZILA (all en-CA)
  ('user_35NlrrNcfTv0DMh2kzBHyXZRtpb', 'aubert@nzila.app',                  'Aubert',       'Nungisa',      'en-CA', 'America/Toronto', true),
  ('user_37Zo7OrvP4jy0J0MU5APfkDtE2V', 'admin@nzila.io',                    'Michel',       'Platform',     'en-CA', 'America/Toronto', true),
  ('user_3A2c7Rsg6612F3BAxHxx5L29jRH', 'test.employer@nzilaventures.com',    'Sandra',       'Weatherby',    'en-CA', 'America/Toronto', true),
  ('user_3A2c3b8lVI7gxi3Keb6xE4piwGv', 'test.fedexec@nzilaventures.com',     'Patty',        'Coates',       'en-CA', 'America/Toronto', true),
  ('user_3A2c6sEcW7WdJSnLVVQFB28PjIU', 'test.localadmin@nzilaventures.com',  'Tania',        'Da Silva',     'en-CA', 'America/Toronto', true),
  ('user_3A2c7AO7bbapxh9IdAgW5kXPhHu', 'test.member2@nzilaventures.com',     'Priya',        'Sharma',       'en-CA', 'America/Toronto', true),
  ('user_3A2c75rcBNDcTYtkjnNgbYLqsEx', 'test.member1@nzilaventures.com',     'Carlos',       'Rivera',       'en-CA', 'America/Toronto', true),
  ('user_3A2c7IXYOHgNMiIdOte7C5MEwFd', 'test.member3@nzilaventures.com',     'Ahmed',        'Hassan',       'en-CA', 'America/Toronto', true),
  ('user_3A2c3apBW0oMKPX2CjIMd8b1ujq', 'test.nationaloff@nzilaventures.com', 'Mark',         'Hancock',      'en-CA', 'America/Toronto', true),
  ('user_3A2c3SaKc0xFearcu0NbUL2lhDF', 'test.platformlead@nzilaventures.com','David',        'Nkemdirim',    'en-CA', 'America/Toronto', true),
  ('user_3A2c6rLMOmF45HEkaU7XdQp05Zk', 'test.president@nzilaventures.com',   'Tim',          'Maguire',      'en-CA', 'America/Toronto', true),
  ('user_3A2c729gwvVEXyC6vc2ICqzihxp', 'test.steward@nzilaventures.com',     'Keisha',       'Brown',        'en-CA', 'America/Toronto', true),
  -- CLC (bilingual — mix of en-CA and fr-CA)
  ('user_3BSyEWUb0cnQ56CSS0W0fK8g35a', 'h.yussuff@clc-ctc.ca',    'Hassan',       'Yussuff',      'en-CA', 'America/Toronto', true),
  ('user_3BSyEa51htBN51y0YxG9a9Elp2L', 'm.walker@clc-ctc.ca',     'Marie',        'Clarke Walker','en-CA', 'America/Toronto', true),
  ('user_3BSzDRcx41T9Pq06KAhtQkFmi8T', 'd.bolduc@clc-ctc.ca',     'Denis',        'Bolduc',       'fr-CA', 'America/Toronto', true),
  ('user_3BSzDdNeiCPn9x4M95Deq5vnWkv', 's.tremblay@clc-ctc.ca',   'Sophie',       'Tremblay',     'fr-CA', 'America/Toronto', true),
  ('user_3BSzDYPQ9F0SAJkkkFk2pSisOii', 'j.nguyen@clc-ctc.ca',     'James',        'Nguyen',       'en-CA', 'America/Toronto', true),
  ('user_3BSzDZezfNN1Nw6YvP9hoYDDuxK', 'r.martin@clc-ctc.ca',     'Rebecca',      'Martin',       'en-CA', 'America/Toronto', true),
  ('user_3BSzDjuKqbDZAHQmjVJccs9r9mq', 'l.picard@clc-ctc.ca',     'Louis',        'Picard',       'fr-CA', 'America/Toronto', true),
  ('user_3BSzDiXRbv3kAsmbUqzOjvVv7o7', 'a.varga@clc-ctc.ca',      'Angela',       'Varga',        'en-CA', 'America/Toronto', true),
  ('user_3BSzDlKgwVGWHOKtHluyRSdJNTb', 'p.oconnor@clc-ctc.ca',    'Patrick',      'O''Connor',    'en-CA', 'America/Toronto', true),
  ('user_3BSzDtwjg8WXJf36fw9wjVTu8yX', 'f.alrashid@clc-ctc.ca',   'Fatima',       'Al-Rashid',    'en-CA', 'America/Toronto', true),
  -- CAPE (bilingual — mix of en-CA and fr-CA)
  ('user_3BSyETlaLS6t8wuol22bVECjPFM', 'g.phillips@acep-cape.ca',  'Greg',         'Phillips',     'en-CA', 'America/Toronto', true),
  ('user_3BSyEi6TduTzKp2mZigpD6D746h', 'e.tremblay@acep-cape.ca',  'Emmanuelle',   'Tremblay',     'fr-CA', 'America/Toronto', true),
  ('user_3BSzDo4cpXO7qTM0bY800AuLOd2', 'b.faulkner@acep-cape.ca',  'Brian',        'Faulkner',     'en-CA', 'America/Toronto', true),
  ('user_3BSzDqnxMraAlxaRvhyrTabrTOE', 'c.bertrand@acep-cape.ca',  'Chantal',      'Bertrand',     'fr-CA', 'America/Toronto', true),
  ('user_3BSzE0qWBvXm6eP75nAukpBbpvk', 'm.savard@acep-cape.ca',    'Mike',         'Savard',       'fr-CA', 'America/Toronto', true),
  ('user_3BSzDyCmU8iKsYeD1tyBqkDfBFP', 'n.ouellet@acep-cape.ca',   'Nadia',        'Ouellet',      'fr-CA', 'America/Toronto', true),
  ('user_3BSzEAPted20wutKC5lY8lTn9jZ', 'd.kim@acep-cape.ca',        'Daniel',       'Kim',          'en-CA', 'America/Toronto', true),
  ('user_3BSzE9z6NFV3hbYd4Fu2ufoL4rI', 's.lefebvre@acep-cape.ca',   'Sarah',        'Lefebvre',     'fr-CA', 'America/Toronto', true),
  ('user_3BSzE5AtIbImjHukqc0yM9EXQdu', 'a.moreau@acep-cape.ca',     'Alexandre',    'Moreau',       'fr-CA', 'America/Toronto', true),
  ('user_3BSzEIjI6LSWANw6ssfwXcxxnhT', 'j.walsh@acep-cape.ca',      'Jennifer',     'Walsh',        'en-CA', 'America/Toronto', true),
  ('user_3BSzEIXiSqVXnNYgymDZ1PY6ZhY', 'p.desmarais@acep-cape.ca',  'Pierre',       'Desmarais',    'fr-CA', 'America/Toronto', true),
  ('user_3BSzEIf1ARXNRQOs3d5Qju58yNZ', 'a.hassan@acep-cape.ca',     'Amira',        'Hassan',       'en-CA', 'America/Toronto', true),
  -- CUPE Local 123 (bilingual — mix of en-CA and fr-CA)
  ('user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'grace.lee@city.toronto.ca',      'Grace',         'Lee',          'en-CA', 'America/Toronto', true),
  ('user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', 'alice.johnson@city.toronto.ca',  'Alice',         'Johnson',      'en-CA', 'America/Toronto', true),
  ('user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'bob.smith@city.toronto.ca',      'Bob',           'Smith',        'en-CA', 'America/Toronto', true),
  ('user_3BSzhd4q6moCIlT3PhkWbdiAhtA', 'mc.dubois@city.toronto.ca',      'Marie-Claire',  'Dubois',       'fr-CA', 'America/Toronto', true),
  ('user_3BSzhdQTA7fsGN5kUPfXJpMTK1O', 'jp.tremblay@city.toronto.ca',    'Jean-Pierre',   'Tremblay',     'fr-CA', 'America/Toronto', true),
  ('user_3BSzhpCQGDtA22YfStHM5ksq6pI', 'd.thompson@city.toronto.ca',     'David',         'Thompson',     'en-CA', 'America/Toronto', true),
  ('user_3BSzhnlEbmEnazjOxZdVE2eXO64', 'p.patel@city.toronto.ca',        'Priya',         'Patel',        'en-CA', 'America/Toronto', true),
  ('user_3BSzhk06aD2b1kK5jUuMlmy7vGu', 'm.rossi@city.toronto.ca',        'Marco',         'Rossi',        'en-CA', 'America/Toronto', true),
  ('user_3BSzhvBJ63gV7BmDQlH6VTLm18g', 'n.lafontaine@city.toronto.ca',   'Nathalie',      'Lafontaine',   'fr-CA', 'America/Toronto', true),
  ('user_3BSzhpyvCHVWm3o4QSYs87ufGGg', 'k.obrien@city.toronto.ca',       'Kevin',         'O''Brien',     'en-CA', 'America/Toronto', true)
ON CONFLICT (user_id) DO UPDATE SET
  locale     = EXCLUDED.locale,
  first_name = EXCLUDED.first_name,
  last_name  = EXCLUDED.last_name,
  timezone   = EXCLUDED.timezone,
  is_active  = EXCLUDED.is_active;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 5: CLC CHART OF ACCOUNTS                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Revenue
INSERT INTO clc_chart_of_accounts (account_code, account_name, account_type, financial_statement_line, statistics_canada_code, description, is_active, parent_account_code) VALUES
('4000', 'Revenue',               'revenue', 'dues_revenue',       NULL,             'All revenue accounts',                      true, NULL),
('4100', 'Per-Capita Tax Revenue', 'revenue', 'per_capita_revenue', 'REV-PER-CAPITA', 'Monthly per-capita remittances from locals', true, '4000'),
('4200', 'Membership Dues',       'revenue', 'dues_revenue',       'REV-DUES',       'Regular membership dues collected',          true, '4000'),
('4300', 'Grants and Donations',  'revenue', 'other_revenue',      'REV-GRANTS',     'Government grants, donations, and gifts',   true, '4000'),
('4400', 'Investment Income',     'revenue', 'other_revenue',      'REV-INVEST',     'Interest, dividends, returns',              true, '4000')
ON CONFLICT (account_code) DO NOTHING;

-- Operating Expenses
INSERT INTO clc_chart_of_accounts (account_code, account_name, account_type, financial_statement_line, statistics_canada_code, description, is_active, parent_account_code) VALUES
('5000', 'Operating Expenses',       'expense', 'administrative',     NULL,           'All operating expense accounts',           true, NULL),
('5100', 'Salaries and Wages',       'expense', 'salaries_wages',     'EXP-SALARIES','Staff salaries, wages, and related costs', true, '5000'),
('5200', 'Legal and Professional',   'expense', 'legal_professional', 'EXP-LEGAL',   'Legal counsel, arbitration, professional', true, '5000'),
('5300', 'Per-Capita Tax Expense',   'expense', 'administrative',     'EXP-PER-CAPITA','Per-capita remittances to parents',      true, '5000'),
('5400', 'Administrative Expenses',  'expense', 'administrative',     'EXP-ADMIN',   'Office supplies, utilities, rent, admin',  true, '5000'),
('5500', 'Travel and Meetings',      'expense', 'administrative',     'EXP-TRAVEL',  'Travel, accommodations, meetings',         true, '5000')
ON CONFLICT (account_code) DO NOTHING;

-- Special Expenses
INSERT INTO clc_chart_of_accounts (account_code, account_name, account_type, financial_statement_line, statistics_canada_code, description, is_active, parent_account_code) VALUES
('6000', 'Special Expenses',         'expense', 'strike_fund',        NULL,            'Strike fund, education, organizing',       true, NULL),
('6100', 'Strike Fund Disbursements','expense', 'strike_fund',        'EXP-STRIKE',   'Strike pay and related support costs',     true, '6000'),
('6200', 'Education and Training',   'expense', 'education_training', 'EXP-EDUCATION','Member education, steward training',       true, '6000'),
('6300', 'Organizing Campaigns',     'expense', 'organizing',         'EXP-ORGANIZING','New member organizing and recruitment',   true, '6000'),
('6400', 'Political Action',         'expense', 'political_action',   'EXP-POLITICAL','Political advocacy and lobbying',          true, '6000')
ON CONFLICT (account_code) DO NOTHING;

-- Assets
INSERT INTO clc_chart_of_accounts (account_code, account_name, account_type, financial_statement_line, statistics_canada_code, description, is_active, parent_account_code) VALUES
('7000', 'Assets',                'asset', 'assets', NULL,            'Cash, investments, and capital assets',   true, NULL),
('7100', 'Cash and Bank Accounts','asset', 'assets', 'ASSET-CASH',   'Operating accounts and petty cash',       true, '7000'),
('7200', 'Investments',           'asset', 'assets', 'ASSET-INVEST', 'Securities, GICs, and investment funds',  true, '7000'),
('7300', 'Capital Assets',        'asset', 'assets', 'ASSET-CAPITAL','Buildings, equipment, and vehicles',      true, '7000')
ON CONFLICT (account_code) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 6: COLLECTIVE AGREEMENTS (CAPE + CUPE L123)                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- CAPE-ACEP PA Group CBA (Active)
DO $$
DECLARE v_cape_id UUID;
BEGIN
  SELECT id INTO v_cape_id FROM organizations WHERE slug = 'cape-acep';

  INSERT INTO collective_agreements (
    id, organization_id, cba_number, title, jurisdiction, language,
    employer_name, union_name, union_local,
    effective_date, expiry_date, industry_sector,
    status, version, created_at, updated_at
  ) VALUES (
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    v_cape_id,
    'PA-CAPE-2021-001',
    'CAPE PA Group Collective Agreement 2021-2025',
    'federal', 'bilingual',
    'Treasury Board of Canada Secretariat',
    'Canadian Association of Professional Employees (CAPE)', 'National',
    '2021-06-22', '2025-06-21', 'Federal Public Service',
    'active', 1, now(), now()
  ) ON CONFLICT (id) DO NOTHING;
END $$;

-- CUPE Local 123 Inside Workers CBA
INSERT INTO collective_agreements (
  id, organization_id, cba_number, title, jurisdiction, language,
  employer_name, union_name, union_local,
  effective_date, expiry_date, industry_sector,
  status, version, created_at, updated_at
) VALUES (
  '12a1844e-014d-48c6-9e9a-543942d42517',
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  'CUPE123-IW-2024',
  'CUPE Local 123 Inside Workers Collective Agreement 2024-2027',
  'ontario', 'en',
  'City of Toronto',
  'Canadian Union of Public Employees', 'Local 123',
  '2024-01-01', '2027-12-31', 'public_administration',
  'active', 1, now(), now()
) ON CONFLICT (id) DO NOTHING;

-- CUPE Local 123 Outside Workers CBA
INSERT INTO collective_agreements (
  id, organization_id, cba_number, title, jurisdiction, language,
  employer_name, union_name, union_local,
  effective_date, expiry_date, industry_sector,
  status, version, created_at, updated_at
) VALUES (
  'c89170f0-256f-44f3-a579-894360c2675c',
  '9210418f-6a4f-4dab-a7d2-4450d581dc81',
  'CUPE123-OW-2024',
  'CUPE Local 123 Outside Workers Collective Agreement 2024-2027',
  'ontario', 'en',
  'City of Toronto',
  'Canadian Union of Public Employees', 'Local 123',
  '2024-01-01', '2027-12-31', 'public_administration',
  'active', 1, now(), now()
) ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 7: GRIEVANCES (CLC + CAPE + CUPE L123)                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- CLC Grievances (3)
DO $$
DECLARE v_clc_id UUID;
BEGIN
  SELECT id INTO v_clc_id FROM organizations WHERE slug = 'clc';

  INSERT INTO grievances (id, grievance_number, type, status, priority, step, title, description,
    organization_id, grievant_name, grievant_email, employer_name, workplace_name,
    incident_date, filed_date, background, desired_outcome)
  SELECT v.id::uuid, v.grievance_number, v.gtype::grievance_type, v.gstatus::grievance_status,
         v.gpriority::grievance_priority, v.gstep::grievance_step,
         v.title, v.description, v_clc_id, v.grievant_name, v.grievant_email,
         v.employer_name, v.workplace_name,
         v.incident_date::timestamptz, v.filed_date::timestamptz, v.background, v.desired_outcome
  FROM (VALUES
    ('c247cd41-eb1b-4b0f-8c3c-da569debcdd0', 'CLC-GRV-2025-001', 'contract', 'filed', 'high', 'step_1',
     'Overtime Pay Calculation Dispute',
     'Employer calculating overtime at 1.0x instead of 1.5x for hours exceeding 40/week.',
     'James Nguyen', 'j.nguyen@clc-ctc.ca', 'Treasury Board of Canada', 'CLC National Office',
     '2025-01-15', '2025-01-20',
     'New payroll system in Dec 2024 miscalculates overtime rates.',
     'Retroactive overtime payments at the correct 1.5x rate for all affected periods.'),
    ('5e88d701-ba56-4b21-9cb5-56c955fda2af', 'CLC-GRV-2025-002', 'harassment', 'investigating', 'urgent', 'step_2',
     'Workplace Harassment - Hostile Environment',
     'Ongoing pattern of intimidation by a supervisor including public belittling.',
     'Rebecca Martin', 'r.martin@clc-ctc.ca', 'Treasury Board of Canada', 'CLC National Office',
     '2024-12-01', '2025-01-05',
     'Multiple incidents since October 2024. Informal resolution failed.',
     'Formal investigation, supervisor reassignment, and anti-harassment training.'),
    ('3c5a2aa4-2beb-4d7d-b93e-2f95bd7f1dc8', 'CLC-GRV-2025-003', 'discipline', 'escalated', 'high', 'step_3',
     'Unjust Suspension Without Pay',
     'Member suspended 5 days without pay for alleged insubordination. No prior discipline.',
     'Patrick O''Connor', 'p.oconnor@clc-ctc.ca', 'Treasury Board of Canada', 'CLC National Office',
     '2025-02-10', '2025-02-12',
     'Member questioned directive believed to violate safety protocols.',
     'Full reinstatement with back pay and removal of suspension from record.')
  ) AS v(id, grievance_number, gtype, gstatus, gpriority, gstep, title, description,
         grievant_name, grievant_email, employer_name, workplace_name,
         incident_date, filed_date, background, desired_outcome)
  WHERE NOT EXISTS (
    SELECT 1 FROM grievances g WHERE g.grievance_number = v.grievance_number
  );
END $$;

-- CUPE Local 123 Grievances (3)
INSERT INTO grievances (id, grievance_number, type, status, priority, step, title, description,
  organization_id, grievant_name, grievant_email, employer_name, workplace_name,
  incident_date, filed_date, background, desired_outcome)
SELECT v.id::uuid, v.grievance_number, v.gtype::grievance_type, v.gstatus::grievance_status,
       v.gpriority::grievance_priority, v.gstep::grievance_step,
       v.title, v.description, '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid,
       v.grievant_name, v.grievant_email, v.employer_name, v.workplace_name,
       v.incident_date::timestamptz, v.filed_date::timestamptz, v.background, v.desired_outcome
FROM (VALUES
  ('25fb07a4-74c4-4d0b-ac61-d241b79fd85a', 'L123-GRV-2025-001', 'contract', 'filed', 'medium', 'step_1',
   'Shift Schedule Violation',
   'Employer changed shift schedule without 14-day notice as required by CBA Article 8.',
   'Alice Johnson', 'alice.johnson@city.toronto.ca', 'City of Toronto', 'City Hall',
   '2025-03-01', '2025-03-05',
   'The employer posted a new shift schedule with only 5 days'' notice, violating Article 8.01.',
   'Restore previous schedule and compensate affected members for schedule disruption.'),
  ('6efb0d95-5601-45ed-957e-10639b8aabd1', 'L123-GRV-2025-002', 'safety', 'investigating', 'high', 'step_2',
   'Chemical Exposure Without PPE',
   'Supervisor directed cleaning staff to use industrial solvents without proper PPE or ventilation.',
   'Bob Smith', 'bob.smith@city.toronto.ca', 'City of Toronto', 'Metro Convention Centre',
   '2025-02-20', '2025-02-22',
   'Three members reported headaches and respiratory irritation after using unmarked cleaning chemicals.',
   'WSIB claim support, PPE procurement, and SDS compliance audit.'),
  ('25764b98-db08-4884-88d5-098d45750731', 'L123-GRV-2025-003', 'contract', 'escalated', 'high', 'step_3',
   'Denied Seniority-Based Promotion',
   'Junior employee promoted over two senior candidates without documented justification.',
   'Marie-Claire Dubois', 'mc.dubois@city.toronto.ca', 'City of Toronto', 'City Clerk''s Office',
   '2025-01-15', '2025-01-20',
   'Two senior employees with clean records and relevant qualifications were passed over.',
   'Rescind appointment and re-post position with proper seniority consideration.')
) AS v(id, grievance_number, gtype, gstatus, gpriority, gstep, title, description,
       grievant_name, grievant_email, employer_name, workplace_name,
       incident_date, filed_date, background, desired_outcome)
WHERE NOT EXISTS (
  SELECT 1 FROM grievances g WHERE g.grievance_number = v.grievance_number
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 8: DUES RATES (all orgs)                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  v_clc_id  UUID;
  v_cape_id UUID;
  v_cupe_id UUID;
BEGIN
  SELECT id INTO v_clc_id  FROM organizations WHERE slug = 'clc';
  SELECT id INTO v_cape_id FROM organizations WHERE slug = 'cape-acep';
  SELECT id INTO v_cupe_id FROM organizations WHERE slug = 'cupe';

  INSERT INTO dues_rates (id, organization_id, rate_name, rate_type, amount, effective_from, status, created_at, updated_at)
  VALUES
    -- CLC
    ('d1000001-0001-4000-a000-000000000001', v_clc_id, 'Standard Monthly Dues', 'monthly', 72.00, '2025-01-01', 'active', now(), now()),
    ('d1000001-0001-4000-a000-000000000002', v_clc_id, 'Initiation Fee', 'initiation', 150.00, '2025-01-01', 'active', now(), now()),
    -- CAPE
    ('d2000002-0001-4000-a000-000000000001', v_cape_id, 'Standard Monthly Dues', 'monthly', 85.50, '2025-01-01', 'active', now(), now()),
    ('d2000002-0001-4000-a000-000000000002', v_cape_id, 'Initiation Fee', 'initiation', 200.00, '2025-01-01', 'active', now(), now()),
    -- CUPE National
    ('d4000004-0001-4000-a000-000000000001', v_cupe_id, 'Standard Monthly Dues', 'monthly', 68.00, '2025-01-01', 'active', now(), now()),
    ('d4000004-0001-4000-a000-000000000002', v_cupe_id, 'Initiation Fee', 'initiation', 100.00, '2025-01-01', 'active', now(), now()),
    -- CUPE Local 123
    ('d3000003-0001-4000-a000-000000000001', '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid, 'Standard Monthly Dues', 'monthly', 65.00, '2025-01-01', 'active', now(), now()),
    ('d3000003-0001-4000-a000-000000000002', '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid, 'Initiation Fee', 'initiation', 125.00, '2025-01-01', 'active', now(), now())
  ON CONFLICT (id) DO NOTHING;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  PHASE 9: VALIDATION QUERIES                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  org_count   int;
  mem_count   int;
  grv_count   int;
  cba_count   int;
  user_count  int;
BEGIN
  SELECT count(*) INTO org_count FROM organizations WHERE slug IN ('default','clc','cape-acep','cupe','cupe-local-123');
  SELECT count(*) INTO mem_count FROM organization_members
    WHERE organization_id IN (SELECT id::text FROM organizations WHERE slug IN ('default','clc','cape-acep','cupe','cupe-local-123'));
  SELECT count(*) INTO grv_count FROM grievances
    WHERE organization_id IN (SELECT id FROM organizations WHERE slug IN ('clc','cupe-local-123'));
  SELECT count(*) INTO cba_count FROM collective_agreements;
  SELECT count(*) INTO user_count FROM user_management.users;

  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '  SEED VALIDATION';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '  Core orgs:    % (expected: 5)', org_count;
  RAISE NOTICE '  Members:      % (expected: 56+)', mem_count;
  RAISE NOTICE '  Grievances:   % (expected: 6+)', grv_count;
  RAISE NOTICE '  CBAs:         % (expected: 3+)', cba_count;
  RAISE NOTICE '  Users (i18n): % (expected: 34+)', user_count;
  RAISE NOTICE '═══════════════════════════════════════════════';

  IF org_count < 5 THEN RAISE WARNING 'MISSING CORE ORGS — expected 5, got %', org_count; END IF;
  IF mem_count < 50 THEN RAISE WARNING 'LOW MEMBER COUNT — expected 56+, got %', mem_count; END IF;
END $$;

-- Final summary
SELECT slug, display_name, organization_type, hierarchy_level,
       clerk_organization_id, member_count, status
FROM organizations
WHERE slug IN ('default', 'clc', 'cape-acep', 'cupe', 'cupe-local-123')
ORDER BY hierarchy_level, slug;

COMMIT;
