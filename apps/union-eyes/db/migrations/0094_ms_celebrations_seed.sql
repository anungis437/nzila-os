-- ============================================================
-- 0072: Seed MS Celebrations Partner (Zonga)
-- ============================================================
-- Adds MS Celebrations as a partner label organization on Zonga
-- with team members, creators, and listeners.
-- ============================================================

BEGIN;

-- 1a. Organization (main organizations table)
INSERT INTO organizations (
  id, name, slug, display_name, short_name, description,
  organization_type, hierarchy_path, hierarchy_level,
  app_id, status, features_enabled, settings
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'MS Celebrations',
  'ms-celebrations',
  'MS Celebrations',
  'MSC',
  'Event entertainment and music label - partner organization on Zonga',
  'platform',
  '{}',
  0,
  'a0000001-0000-0000-0000-000000000007',
  'active',
  ARRAY['catalog','distribution','analytics','royalties'],
  '{"partner": true, "tier": "label"}'::jsonb
);

-- 1b. Orgs table (Zonga FK target for creators/listeners)
INSERT INTO orgs (id, legal_name, status)
VALUES ('44444444-4444-4444-4444-444444444444', 'MS Celebrations Entertainment Ltd.', 'active');

-- 2. Org members (8 people)
INSERT INTO organization_members (
  id, user_id, organization_id, name, email, role, status,
  position, location, is_primary, created_at, joined_at, updated_at
) VALUES
  (gen_random_uuid(), 'user_msc_admin_01',   '44444444-4444-4444-4444-444444444444',
   'Marie-Sophie C.',  'marie@mscelebrations.com',      'admin',   'active',
   'Founder & CEO',      'Kinshasa, DRC',   true,  now(), now(), now()),

  (gen_random_uuid(), 'user_msc_mgr_01',     '44444444-4444-4444-4444-444444444444',
   'Patrick Kalala',   'patrick@mscelebrations.com',    'manager', 'active',
   'A&R Director',       'Kinshasa, DRC',   false, now(), now(), now()),

  (gen_random_uuid(), 'user_msc_mgr_02',     '44444444-4444-4444-4444-444444444444',
   'Grace Tshilanda',  'grace@mscelebrations.com',      'manager', 'active',
   'Operations Manager', 'Lubumbashi, DRC', false, now(), now(), now()),

  (gen_random_uuid(), 'user_msc_creator_01', '44444444-4444-4444-4444-444444444444',
   'Fally Mukendi',    'fally@mscelebrations.com',      'creator', 'active',
   'Lead Artist',        'Kinshasa, DRC',   false, now(), now(), now()),

  (gen_random_uuid(), 'user_msc_creator_02', '44444444-4444-4444-4444-444444444444',
   'Yemi Bolingo',     'yemi@mscelebrations.com',       'creator', 'active',
   'Artist',             'Brazzaville, CG', false, now(), now(), now()),

  (gen_random_uuid(), 'user_msc_creator_03', '44444444-4444-4444-4444-444444444444',
   'Lokua Mbala',      'lokua@mscelebrations.com',      'creator', 'active',
   'Producer & Artist',  'Paris, France',   false, now(), now(), now()),

  (gen_random_uuid(), 'user_msc_fin_01',     '44444444-4444-4444-4444-444444444444',
   'Christelle Ngoy',  'christelle@mscelebrations.com', 'manager', 'active',
   'Finance Manager',    'Kinshasa, DRC',   false, now(), now(), now()),

  (gen_random_uuid(), 'user_msc_viewer_01',  '44444444-4444-4444-4444-444444444444',
   'David Kasongo',    'david@mscelebrations.com',      'viewer',  'active',
   'Marketing Intern',   'Kinshasa, DRC',   false, now(), now(), now());

-- 3. Zonga creators (3 artists under MSC label)
INSERT INTO zonga_creators (
  id, org_id, user_id, display_name, bio, status, plan,
  genre, country, city, payout_currency, verified,
  created_at, updated_at
) VALUES
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
   'user_msc_creator_01', 'Fally Mukendi',
   'Rumba-fusion artist from Kinshasa blending tradition with modern Afrobeats',
   'active', 'label', 'Rumba', 'DR Congo', 'Kinshasa', 'CDF', true, now(), now()),

  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
   'user_msc_creator_02', 'Yemi Bolingo',
   'Ndombolo and soukous vocalist representing the Congo River sound',
   'active', 'label', 'Ndombolo', 'Congo', 'Brazzaville', 'XAF', true, now(), now()),

  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
   'user_msc_creator_03', 'Lokua Mbala',
   'Multi-instrumentalist producer fusing Congolese roots with world music',
   'active', 'label', 'World', 'France', 'Paris', 'EUR', false, now(), now());

-- 4. Zonga listeners (2 fans associated with MSC events)
INSERT INTO zonga_listeners (
  id, org_id, user_id, display_name, email, city, country,
  plan, preferences_json, created_at, updated_at
) VALUES
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
   'user_msc_listener_01', 'Amara K.', 'amara.k@gmail.com',
   'Kinshasa', 'DR Congo', 'premium',
   '{"genres": ["Rumba", "Ndombolo", "Soukous"], "language": "fr"}'::jsonb,
   now(), now()),

  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
   'user_msc_listener_02', 'Tresor M.', 'tresor.m@outlook.com',
   'Montreal', 'Canada', 'free',
   '{"genres": ["Afrobeats", "Rumba"], "language": "fr"}'::jsonb,
   now(), now());

COMMIT;
