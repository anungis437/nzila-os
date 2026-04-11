-- ============================================================
-- 0073: Seed MS Celebrations auth users (user_management.users)
-- ============================================================
-- Migration 0072 seeded org members, creators, and listeners
-- but omitted the user_management.users rows needed for
-- password-based login. This adds them with the standard
-- test password (NzilaTest2026!).
-- ============================================================

BEGIN;

INSERT INTO user_management.users (
  user_id, email, first_name, last_name,
  password_hash, email_verified, is_active,
  locale, timezone
) VALUES
  -- Admin
  ('user_msc_admin_01',   'marie@mscelebrations.com',      'Marie-Sophie', 'C.',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Africa/Kinshasa'),

  -- Managers
  ('user_msc_mgr_01',     'patrick@mscelebrations.com',    'Patrick',      'Kalala',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Africa/Kinshasa'),

  ('user_msc_mgr_02',     'grace@mscelebrations.com',      'Grace',        'Tshilanda',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Africa/Lubumbashi'),

  -- Creators
  ('user_msc_creator_01', 'fally@mscelebrations.com',      'Fally',        'Mukendi',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Africa/Kinshasa'),

  ('user_msc_creator_02', 'yemi@mscelebrations.com',       'Yemi',         'Bolingo',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Africa/Brazzaville'),

  ('user_msc_creator_03', 'lokua@mscelebrations.com',      'Lokua',        'Mbala',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Europe/Paris'),

  -- Finance
  ('user_msc_fin_01',     'christelle@mscelebrations.com', 'Christelle',   'Ngoy',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Africa/Kinshasa'),

  -- Viewer
  ('user_msc_viewer_01',  'david@mscelebrations.com',      'David',        'Kasongo',
   '$argon2id$v=19$m=19456,t=2,p=1$rULSd9B0b97M/+296hWXDA$UvzIyyi6IJsM0wQYryvPUOutO0pB/J5PYNWCXcJ+Ayo',
   true, true, 'fr-CA', 'Africa/Kinshasa')
ON CONFLICT (user_id) DO UPDATE SET
  password_hash  = EXCLUDED.password_hash,
  email_verified = EXCLUDED.email_verified,
  is_active      = EXCLUDED.is_active;

-- Also seed organization_users linkage so auth() can resolve org context
INSERT INTO user_management.organization_users (
  organization_id, user_id, role, is_active, is_primary, joined_at
) VALUES
  ('44444444-4444-4444-4444-444444444444', 'user_msc_admin_01',   'admin',   true, true,  now()),
  ('44444444-4444-4444-4444-444444444444', 'user_msc_mgr_01',     'manager', true, false, now()),
  ('44444444-4444-4444-4444-444444444444', 'user_msc_mgr_02',     'manager', true, false, now()),
  ('44444444-4444-4444-4444-444444444444', 'user_msc_creator_01', 'member',  true, false, now()),
  ('44444444-4444-4444-4444-444444444444', 'user_msc_creator_02', 'member',  true, false, now()),
  ('44444444-4444-4444-4444-444444444444', 'user_msc_creator_03', 'member',  true, false, now()),
  ('44444444-4444-4444-4444-444444444444', 'user_msc_fin_01',     'manager', true, false, now()),
  ('44444444-4444-4444-4444-444444444444', 'user_msc_viewer_01',  'member',  true, false, now())
ON CONFLICT (user_id, organization_id) DO NOTHING;

COMMIT;
