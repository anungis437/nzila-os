-- =============================================================
-- Quebec Federation Seed Data
-- Central labour bodies and major federations operating in QC
--
-- Sources:
--   • CSN membership: Rapport annuel 2024 (~300 000 membres)
--   • FTQ membership: site officiel (~600 000 membres)
--   • CSQ membership: site officiel (~200 000 membres)
--   • CSD membership: site officiel (~75 000 membres)
--   • SFPQ membership: site officiel (~42 000 membres)
--   • FIQ membership: site officiel (~80 000 membres)
--   • APTS membership: site officiel (~60 000 membres)
-- =============================================================

BEGIN;

-- ─── Quebec labour centrals ────────────────────────────────

-- FTQ — Fédération des travailleurs et travailleuses du Québec
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000001-0000-4000-a000-000000000001',
  'Fédération des travailleurs et travailleuses du Québec (FTQ)',
  'ftq',
  'federation', 'QC',
  600000, 580000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- CSN — Confédération des syndicats nationaux
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000001-0000-4000-a000-000000000002',
  'Confédération des syndicats nationaux (CSN)',
  'csn',
  'federation', 'QC',
  300000, 290000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- CSQ — Centrale des syndicats du Québec
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000001-0000-4000-a000-000000000003',
  'Centrale des syndicats du Québec (CSQ)',
  'csq',
  'federation', 'QC',
  200000, 195000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- CSD — Centrale des syndicats démocratiques
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000001-0000-4000-a000-000000000004',
  'Centrale des syndicats démocratiques (CSD)',
  'csd',
  'federation', 'QC',
  75000, 72000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ─── Quebec independent unions ─────────────────────────────

-- SFPQ — Syndicat de la fonction publique et parapublique du Québec
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000001-0000-4000-a000-000000000005',
  'Syndicat de la fonction publique et parapublique du Québec (SFPQ)',
  'sfpq',
  'national_union', 'QC',
  42000, 40500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- FIQ — Fédération interprofessionnelle de la santé du Québec
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000001-0000-4000-a000-000000000006',
  'Fédération interprofessionnelle de la santé du Québec (FIQ)',
  'fiq',
  'federation', 'QC',
  80000, 78000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- APTS — Alliance du personnel professionnel et technique de la santé et des services sociaux
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000001-0000-4000-a000-000000000007',
  'Alliance du personnel professionnel et technique de la santé et des services sociaux (APTS)',
  'apts',
  'national_union', 'QC',
  60000, 58000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ─── Sample affiliated locals ──────────────────────────────

-- CSN - Fédération du commerce (FC–CSN) — retail/commerce
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000002-0000-4000-a000-000000000001',
  'Fédération du commerce (FC–CSN)',
  'fc-csn',
  'national_union', 'QC',
  32000, 31000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- CSN - Fédération nationale des enseignantes et enseignants du Québec (FNEEQ–CSN)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000002-0000-4000-a000-000000000002',
  'Fédération nationale des enseignantes et enseignants du Québec (FNEEQ–CSN)',
  'fneeq-csn',
  'national_union', 'QC',
  35000, 34000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- CSQ - Fédération des syndicats de l'enseignement (FSE–CSQ)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000002-0000-4000-a000-000000000003',
  'Fédération des syndicats de l''enseignement (FSE–CSQ)',
  'fse-csq',
  'national_union', 'QC',
  65000, 63500,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- FTQ - Syndicat des Métallos (USW/FTQ)
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000002-0000-4000-a000-000000000004',
  'Syndicat des Métallos (USW) – Section Québec',
  'metallos-ftq',
  'national_union', 'QC',
  60000, 58000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- FTQ - SCFP/CUPE Québec
INSERT INTO organizations (
  id, name, slug, organization_type, province_territory,
  member_count, active_member_count, status, created_at, updated_at
) VALUES (
  'b1000002-0000-4000-a000-000000000005',
  'Syndicat canadien de la fonction publique (SCFP–FTQ) – Québec',
  'scfp-ftq-qc',
  'national_union', 'QC',
  122000, 120000,
  'active', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- ─── Parent-child relationships ────────────────────────────

-- CSN affiliates
UPDATE organizations SET parent_organization_id = 'b1000001-0000-4000-a000-000000000002'
  WHERE id IN (
    'b1000002-0000-4000-a000-000000000001',
    'b1000002-0000-4000-a000-000000000002'
  );

-- CSQ affiliates
UPDATE organizations SET parent_organization_id = 'b1000001-0000-4000-a000-000000000003'
  WHERE id = 'b1000002-0000-4000-a000-000000000003';

-- FTQ affiliates
UPDATE organizations SET parent_organization_id = 'b1000001-0000-4000-a000-000000000001'
  WHERE id IN (
    'b1000002-0000-4000-a000-000000000004',
    'b1000002-0000-4000-a000-000000000005'
  );

COMMIT;
