-- =============================================================
-- All-Provinces Federation Seed Data
-- Major labour centrals, provincial federations, and locals
-- for every Canadian province/territory (excluding QC — see
-- fixtures/quebec/federations/quebec-federations-seed.sql)
--
-- Sources:
--   • CLC membership: clc-ctc.ca (~3M members across affiliates)
--   • Provincial federation websites (2024/2025)
--   • Public union financial disclosures
-- =============================================================

BEGIN;

-- ═════════════════════════════════════════════════════════════
-- NATIONAL / FEDERAL
-- ═════════════════════════════════════════════════════════════

-- CLC — Canadian Labour Congress
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c1000001-0000-4000-a000-000000000001',
  'Canadian Labour Congress (CLC)',
  'clc-ctc',
  'federation', 'ON',
  3000000, 2900000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- CUPE National — Canadian Union of Public Employees
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c1000001-0000-4000-a000-000000000002',
  'Canadian Union of Public Employees (CUPE)',
  'cupe-national',
  'federation', 'ON',
  750000, 730000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Unifor
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c1000001-0000-4000-a000-000000000003',
  'Unifor',
  'unifor-national',
  'federation', 'ON',
  315000, 305000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- USW — United Steelworkers (Canadian District)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c1000001-0000-4000-a000-000000000004',
  'United Steelworkers — Canadian District',
  'usw-canada',
  'federation', 'ON',
  225000, 215000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- PSAC — Public Service Alliance of Canada
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c1000001-0000-4000-a000-000000000005',
  'Public Service Alliance of Canada (PSAC)',
  'psac-afpc',
  'federation', 'ON',
  230000, 220000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- ONTARIO
-- ═════════════════════════════════════════════════════════════

-- OFL — Ontario Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c2000001-0000-4000-a000-000000000001',
  'Ontario Federation of Labour (OFL)',
  'ofl',
  'federation', 'ON',
  1000000, 950000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- OPSEU — Ontario Public Service Employees Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c2000001-0000-4000-a000-000000000002',
  'Ontario Public Service Employees Union (OPSEU/SEFPO)',
  'opseu',
  'union', 'ON',
  180000, 170000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- OSSTF — Ontario Secondary School Teachers' Federation
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c2000001-0000-4000-a000-000000000003',
  'Ontario Secondary School Teachers\'' || ' Federation (OSSTF)',
  'osstf',
  'union', 'ON',
  60000, 58000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ETFO — Elementary Teachers' Federation of Ontario
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c2000001-0000-4000-a000-000000000004',
  'Elementary Teachers\'' || ' Federation of Ontario (ETFO)',
  'etfo',
  'union', 'ON',
  83000, 80000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ONA — Ontario Nurses' Association
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c2000001-0000-4000-a000-000000000005',
  'Ontario Nurses\'' || ' Association (ONA)',
  'ona',
  'union', 'ON',
  68000, 65000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- BRITISH COLUMBIA
-- ═════════════════════════════════════════════════════════════

-- BCFED — BC Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c3000001-0000-4000-a000-000000000001',
  'BC Federation of Labour (BCFED)',
  'bcfed',
  'federation', 'BC',
  500000, 480000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- BCGEU — BC General Employees' Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c3000001-0000-4000-a000-000000000002',
  'BC General Employees\'' || ' Union (BCGEU)',
  'bcgeu',
  'union', 'BC',
  85000, 82000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- BCTF — BC Teachers' Federation
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c3000001-0000-4000-a000-000000000003',
  'BC Teachers\'' || ' Federation (BCTF)',
  'bctf',
  'union', 'BC',
  49000, 47000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- HEU — Hospital Employees' Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c3000001-0000-4000-a000-000000000004',
  'Hospital Employees\'' || ' Union (HEU)',
  'heu-bc',
  'union', 'BC',
  50000, 48000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- ALBERTA
-- ═════════════════════════════════════════════════════════════

-- AFL — Alberta Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c4000001-0000-4000-a000-000000000001',
  'Alberta Federation of Labour (AFL)',
  'afl',
  'federation', 'AB',
  175000, 170000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- AUPE — Alberta Union of Provincial Employees
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c4000001-0000-4000-a000-000000000002',
  'Alberta Union of Provincial Employees (AUPE)',
  'aupe',
  'union', 'AB',
  95000, 90000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- UNA — United Nurses of Alberta
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c4000001-0000-4000-a000-000000000003',
  'United Nurses of Alberta (UNA)',
  'una',
  'union', 'AB',
  34000, 32000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ATA — Alberta Teachers' Association
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c4000001-0000-4000-a000-000000000004',
  'Alberta Teachers\'' || ' Association (ATA)',
  'ata',
  'union', 'AB',
  46000, 44000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- SASKATCHEWAN
-- ═════════════════════════════════════════════════════════════

-- SFL — Saskatchewan Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c5000001-0000-4000-a000-000000000001',
  'Saskatchewan Federation of Labour (SFL)',
  'sfl',
  'federation', 'SK',
  100000, 95000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- SGEU — Saskatchewan Government and General Employees' Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c5000001-0000-4000-a000-000000000002',
  'Saskatchewan Government and General Employees\'' || ' Union (SGEU)',
  'sgeu',
  'union', 'SK',
  20000, 19000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- SUN — Saskatchewan Union of Nurses
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c5000001-0000-4000-a000-000000000003',
  'Saskatchewan Union of Nurses (SUN)',
  'sun',
  'union', 'SK',
  11000, 10500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- STF — Saskatchewan Teachers' Federation
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c5000001-0000-4000-a000-000000000004',
  'Saskatchewan Teachers\'' || ' Federation (STF)',
  'stf',
  'union', 'SK',
  13000, 12500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- MANITOBA
-- ═════════════════════════════════════════════════════════════

-- MFL — Manitoba Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c6000001-0000-4000-a000-000000000001',
  'Manitoba Federation of Labour (MFL)',
  'mfl',
  'federation', 'MB',
  110000, 105000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- MGEU — Manitoba Government and General Employees' Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c6000001-0000-4000-a000-000000000002',
  'Manitoba Government and General Employees\'' || ' Union (MGEU)',
  'mgeu',
  'union', 'MB',
  42000, 40000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- MNU — Manitoba Nurses Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c6000001-0000-4000-a000-000000000003',
  'Manitoba Nurses Union (MNU)',
  'mnu',
  'union', 'MB',
  12500, 12000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- MTS — Manitoba Teachers' Society
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c6000001-0000-4000-a000-000000000004',
  'Manitoba Teachers\'' || ' Society (MTS)',
  'mts',
  'union', 'MB',
  16000, 15500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- NEW BRUNSWICK
-- ═════════════════════════════════════════════════════════════

-- NBFL — New Brunswick Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c7000001-0000-4000-a000-000000000001',
  'New Brunswick Federation of Labour (NBFL)',
  'nbfl',
  'federation', 'NB',
  40000, 38000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NBNU — New Brunswick Nurses Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c7000001-0000-4000-a000-000000000002',
  'New Brunswick Nurses Union (NBNU)',
  'nbnu',
  'union', 'NB',
  8500, 8200,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NBUUPE — NB Union of Public and Private Employees
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c7000001-0000-4000-a000-000000000003',
  'NB Union of Public and Private Employees (NBUPPE)',
  'nbuppe',
  'union', 'NB',
  5000, 4800,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- NOVA SCOTIA
-- ═════════════════════════════════════════════════════════════

-- NSFL — Nova Scotia Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c8000001-0000-4000-a000-000000000001',
  'Nova Scotia Federation of Labour (NSFL)',
  'nsfl',
  'federation', 'NS',
  70000, 67000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NSGEU — Nova Scotia Government and General Employees' Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c8000001-0000-4000-a000-000000000002',
  'Nova Scotia Government and General Employees\'' || ' Union (NSGEU)',
  'nsgeu',
  'union', 'NS',
  32000, 30000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NSNU — Nova Scotia Nurses' Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c8000001-0000-4000-a000-000000000003',
  'Nova Scotia Nurses\'' || ' Union (NSNU)',
  'nsnu',
  'union', 'NS',
  7800, 7500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NSTU — Nova Scotia Teachers Union
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c8000001-0000-4000-a000-000000000004',
  'Nova Scotia Teachers Union (NSTU)',
  'nstu',
  'union', 'NS',
  10000, 9500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- PRINCE EDWARD ISLAND
-- ═════════════════════════════════════════════════════════════

-- PEI Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c9000001-0000-4000-a000-000000000001',
  'PEI Federation of Labour',
  'peifl',
  'federation', 'PE',
  12000, 11500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- UPSE — Union of Public Sector Employees (PEI)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c9000001-0000-4000-a000-000000000002',
  'Union of Public Sector Employees (UPSE)',
  'upse',
  'union', 'PE',
  5800, 5500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- PEITF — PEI Teachers' Federation
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'c9000001-0000-4000-a000-000000000003',
  'PEI Teachers\'' || ' Federation (PEITF)',
  'peitf',
  'union', 'PE',
  1600, 1550,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- NEWFOUNDLAND AND LABRADOR
-- ═════════════════════════════════════════════════════════════

-- NLFL — Newfoundland and Labrador Federation of Labour
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'ca000001-0000-4000-a000-000000000001',
  'Newfoundland and Labrador Federation of Labour (NLFL)',
  'nlfl',
  'federation', 'NL',
  70000, 67000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NAPE — Newfoundland and Labrador Association of Public and Private Employees
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'ca000001-0000-4000-a000-000000000002',
  'NL Association of Public and Private Employees (NAPE)',
  'nape',
  'union', 'NL',
  30000, 28000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- RNUNL — Registered Nurses' Union of NL
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'ca000001-0000-4000-a000-000000000003',
  'Registered Nurses\'' || ' Union of NL (RNUNL)',
  'rnunl',
  'union', 'NL',
  6600, 6300,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NLTA — NL Teachers' Association
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'ca000001-0000-4000-a000-000000000004',
  'NL Teachers\'' || ' Association (NLTA)',
  'nlta',
  'union', 'NL',
  6100, 5900,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- YUKON
-- ═════════════════════════════════════════════════════════════

-- YEU — Yukon Employees' Union (PSAC Component)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'cb000001-0000-4000-a000-000000000001',
  'Yukon Employees\'' || ' Union (YEU/PSAC)',
  'yeu',
  'union', 'YT',
  4500, 4300,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- YTA — Yukon Teachers' Association
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'cb000001-0000-4000-a000-000000000002',
  'Yukon Teachers\'' || ' Association (YTA)',
  'yta',
  'union', 'YT',
  850, 820,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- NORTHWEST TERRITORIES
-- ═════════════════════════════════════════════════════════════

-- UNW — Union of Northern Workers (PSAC)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'cc000001-0000-4000-a000-000000000001',
  'Union of Northern Workers (UNW/PSAC)',
  'unw',
  'union', 'NT',
  4200, 4000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NWTTA — Northwest Territories Teachers' Association
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'cc000001-0000-4000-a000-000000000002',
  'NWT Teachers\'' || ' Association (NWTTA)',
  'nwtta',
  'union', 'NT',
  700, 680,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- NUNAVUT
-- ═════════════════════════════════════════════════════════════

-- NEU — Nunavut Employees Union (PSAC)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'cd000001-0000-4000-a000-000000000001',
  'Nunavut Employees Union (NEU/PSAC)',
  'neu',
  'union', 'NU',
  3800, 3600,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- NTA — Nunavut Teachers' Association
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'cd000001-0000-4000-a000-000000000002',
  'Nunavut Teachers\'' || ' Association (NTA)',
  'nta',
  'union', 'NU',
  750, 720,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- PARENT-CHILD RELATIONSHIPS
-- Set provincial federations as children of CLC
-- ═════════════════════════════════════════════════════════════

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c2000001-0000-4000-a000-000000000001'; -- OFL → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c3000001-0000-4000-a000-000000000001'; -- BCFED → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c4000001-0000-4000-a000-000000000001'; -- AFL → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c5000001-0000-4000-a000-000000000001'; -- SFL → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c6000001-0000-4000-a000-000000000001'; -- MFL → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c7000001-0000-4000-a000-000000000001'; -- NBFL → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c8000001-0000-4000-a000-000000000001'; -- NSFL → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'c9000001-0000-4000-a000-000000000001'; -- PEI FL → CLC

UPDATE organizations SET parent_organization_id = 'c1000001-0000-4000-a000-000000000001'
  WHERE id = 'ca000001-0000-4000-a000-000000000001'; -- NLFL → CLC

-- Set major unions under their provincial federation
UPDATE organizations SET parent_organization_id = 'c2000001-0000-4000-a000-000000000001'
  WHERE id IN (
    'c2000001-0000-4000-a000-000000000002', -- OPSEU → OFL
    'c2000001-0000-4000-a000-000000000003', -- OSSTF → OFL
    'c2000001-0000-4000-a000-000000000004', -- ETFO → OFL
    'c2000001-0000-4000-a000-000000000005'  -- ONA → OFL
  );

UPDATE organizations SET parent_organization_id = 'c3000001-0000-4000-a000-000000000001'
  WHERE id IN (
    'c3000001-0000-4000-a000-000000000002', -- BCGEU → BCFED
    'c3000001-0000-4000-a000-000000000003', -- BCTF → BCFED
    'c3000001-0000-4000-a000-000000000004'  -- HEU → BCFED
  );

UPDATE organizations SET parent_organization_id = 'c4000001-0000-4000-a000-000000000001'
  WHERE id IN (
    'c4000001-0000-4000-a000-000000000002', -- AUPE → AFL
    'c4000001-0000-4000-a000-000000000003', -- UNA → AFL
    'c4000001-0000-4000-a000-000000000004'  -- ATA → AFL
  );

UPDATE organizations SET parent_organization_id = 'c5000001-0000-4000-a000-000000000001'
  WHERE id IN (
    'c5000001-0000-4000-a000-000000000002', -- SGEU → SFL
    'c5000001-0000-4000-a000-000000000003', -- SUN → SFL
    'c5000001-0000-4000-a000-000000000004'  -- STF → SFL
  );

UPDATE organizations SET parent_organization_id = 'c6000001-0000-4000-a000-000000000001'
  WHERE id IN (
    'c6000001-0000-4000-a000-000000000002', -- MGEU → MFL
    'c6000001-0000-4000-a000-000000000003', -- MNU → MFL
    'c6000001-0000-4000-a000-000000000004'  -- MTS → MFL
  );

COMMIT;
