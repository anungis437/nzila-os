-- ═══════════════════════════════════════════════════════════════════════
-- Zonga Platform Seed Data (Delta Upgrade Edition)
-- Generated: 2026-04-18T21:47:04.980Z
-- Org: 22222222-2222-2222-2222-222222222222 (Clerk: org_3BEaESt8ZIC4XEdJ7hmmB6nu6pp)
-- Covers: creators, assets, releases, events, tickets, listeners,
-- economics (ledger, splits, payouts), rights, moderation, integrity
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Cleanup (reverse FK order) ──
DELETE FROM zonga_outbox WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_integrity_signals WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_moderation_cases WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_notifications WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_listener_activity WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_listener_playlist_saves WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_listener_favorites WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_listener_follows WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_playlist_items WHERE playlist_id IN (SELECT id FROM zonga_playlists WHERE org_id = '22222222-2222-2222-2222-222222222222');
DELETE FROM zonga_playlists WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_ticket_purchases WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_ticket_types WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_events WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_wallet_ledger WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_payout_previews WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_payouts WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_royalty_splits WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_revenue_events WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_release_tracks WHERE release_id IN (SELECT id FROM zonga_releases WHERE org_id = '22222222-2222-2222-2222-222222222222');
DELETE FROM zonga_releases WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_content_assets WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_creator_accounts WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_listeners WHERE org_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM zonga_creators WHERE org_id = '22222222-2222-2222-2222-222222222222';

-- ═══ Org ═══
INSERT INTO orgs (id, clerk_org_id, legal_name, jurisdiction, fiscal_year_end, policy_config, status)
VALUES ('22222222-2222-2222-2222-222222222222', 'org_3BEaESt8ZIC4XEdJ7hmmB6nu6pp', 'Zonga Music Platform', 'CA-QC', '12-31', '{"tier":"PREMIUM"}', 'active')
ON CONFLICT (id) DO UPDATE SET clerk_org_id = EXCLUDED.clerk_org_id;

-- ═══ Creators ═══
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000001', 'Amara Diallo', 'Pioneering Afrobeats from Dakar — voice of the Sahel generation', 'active', 'Afrobeats', 'SN', 'Dakar', 'XOF', true, '2026-01-15T00:00:00Z');
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000002', 'Kwame Asante', 'Modern highlife with traditional roots from the Gold Coast', 'active', 'Highlife', 'GH', 'Accra', 'GHS', true, '2026-01-15T00:00:00Z');
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000003', 'Zara Okafor', 'Chart-topping Afropop artist, 2x Headies Award winner', 'active', 'Afropop', 'NG', 'Lagos', 'NGN', true, '2026-01-15T00:00:00Z');
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000004', 'Tendai Moyo', 'Amapiano producer and DJ redefining piano from Jozi', 'active', 'Amapiano', 'ZA', 'Johannesburg', 'ZAR', true, '2026-01-15T00:00:00Z');
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000005', 'Fatou Cissé', 'Contemporary Mbalax vocalist bridging griot tradition and pop', 'active', 'Mbalax', 'SN', 'Saint-Louis', 'XOF', false, '2026-01-15T00:00:00Z');
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000006', 'Kofi Mensah', 'Hiplife pioneer blending hip-hop with highlife in Twi', 'active', 'Hiplife', 'GH', 'Kumasi', 'GHS', true, '2026-01-15T00:00:00Z');
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000007', 'Nia Kamara', 'Soulful R&B from Nairobi with Swahili undertones', 'active', 'R&B', 'KE', 'Nairobi', 'KES', false, '2026-01-15T00:00:00Z');
INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, genre, country, city, payout_currency, verified, created_at)
VALUES ('c10000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000008', 'Jabari Nkomo', 'Underground Gqom producer pushing Durban bass worldwide', 'active', 'Gqom', 'ZA', 'Durban', 'ZAR', true, '2026-01-15T00:00:00Z');

-- ═══ Creator Accounts ═══
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'amara.diallo@zonga.example.com', 'active', 'approved', '2026-01-15T00:00:00Z');
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'kwame.asante@zonga.example.com', 'active', 'approved', '2026-01-15T00:00:00Z');
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'zara.okafor@zonga.example.com', 'active', 'approved', '2026-01-15T00:00:00Z');
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'tendai.moyo@zonga.example.com', 'active', 'approved', '2026-01-15T00:00:00Z');
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'fatou.cissé@zonga.example.com', 'payout_ready', 'pending', '2026-01-15T00:00:00Z');
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'kofi.mensah@zonga.example.com', 'active', 'approved', '2026-01-15T00:00:00Z');
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'nia.kamara@zonga.example.com', 'payout_ready', 'pending', '2026-01-15T00:00:00Z');
INSERT INTO zonga_creator_accounts (id, org_id, creator_id, email, onboarding_status, kyc_status, created_at)
VALUES ('ca0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'jabari.nkomo@zonga.example.com', 'active', 'approved', '2026-01-15T00:00:00Z');

-- ═══ Content Assets ═══
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'Sunrise in Dakar', 'track', 'published', 'Afrobeats', 234, '{"isrc":"NGZON2600001"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'Ocean Waves', 'track', 'published', 'Afrobeats', 198, '{"isrc":"NGZON2600002"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'Accra Nights', 'track', 'published', 'Highlife', 267, '{"isrc":"NGZON2600003"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'Golden Coast', 'track', 'published', 'Highlife', 312, '{"isrc":"NGZON2600004"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'Lagos Love', 'track', 'published', 'Afropop', 245, '{"isrc":"NGZON2600005"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'Victoria Island', 'track', 'published', 'Afropop', 189, '{"isrc":"NGZON2600006"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'Joburg Groove', 'track', 'published', 'Amapiano', 278, '{"isrc":"NGZON2600007"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'Township Beats', 'track', 'published', 'Amapiano', 356, '{"isrc":"NGZON2600008"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'Dakar Dawn', 'track', 'published', 'Mbalax', 223, '{"isrc":"NGZON2600009"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'Kumasi Flow', 'track', 'published', 'Hiplife', 201, '{"isrc":"NGZON2600010"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'Nairobi Nights', 'track', 'published', 'R&B', 289, '{"isrc":"NGZON2600011"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_content_assets (id, org_id, creator_id, title, type, status, genre, duration_seconds, metadata, published_at, created_at)
VALUES ('a10000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'Durban Bass', 'track', 'published', 'Gqom', 334, '{"isrc":"NGZON2600012"}', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- ═══ Releases ═══
INSERT INTO zonga_releases (id, org_id, creator_id, title, release_type, status, release_date, published_at, created_at)
VALUES ('r10000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'Sahel Sounds', 'album', 'published', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_releases (id, org_id, creator_id, title, release_type, status, release_date, published_at, created_at)
VALUES ('r10000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'Gold Coast Chronicles', 'ep', 'published', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_releases (id, org_id, creator_id, title, release_type, status, release_date, published_at, created_at)
VALUES ('r10000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'Lagos Diaries', 'album', 'published', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_releases (id, org_id, creator_id, title, release_type, status, release_date, published_at, created_at)
VALUES ('r10000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'Piano Stories', 'ep', 'published', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-15T00:00:00Z');
INSERT INTO zonga_releases (id, org_id, creator_id, title, release_type, status, release_date, published_at, created_at)
VALUES ('r10000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'Mbalax Rising', 'single', 'draft', NULL, NULL, '2026-01-15T00:00:00Z');
INSERT INTO zonga_releases (id, org_id, creator_id, title, release_type, status, release_date, published_at, created_at)
VALUES ('r10000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'Hiplife Heritage', 'album', 'published', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z', '2026-01-15T00:00:00Z');

-- ═══ Release Tracks ═══
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000001', 'r10000-0000-0000-000000000001', 'a10000-0000-0000-000000000001', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000002', 'r10000-0000-0000-000000000001', 'a10000-0000-0000-000000000002', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000003', 'r10000-0000-0000-000000000002', 'a10000-0000-0000-000000000003', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000004', 'r10000-0000-0000-000000000002', 'a10000-0000-0000-000000000004', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000005', 'r10000-0000-0000-000000000003', 'a10000-0000-0000-000000000005', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000006', 'r10000-0000-0000-000000000003', 'a10000-0000-0000-000000000006', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000007', 'r10000-0000-0000-000000000004', 'a10000-0000-0000-000000000007', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000008', 'r10000-0000-0000-000000000004', 'a10000-0000-0000-000000000008', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-000000000009', 'r10000-0000-0000-000000000005', 'a10000-0000-0000-000000000009', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_release_tracks (id, release_id, asset_id, track_number, created_at)
VALUES ('rt0000-0000-0000-00000000000a', 'r10000-0000-0000-000000000006', 'a10000-0000-0000-00000000000a', 1, '2026-01-15T00:00:00Z');

-- ═══ Royalty Splits (revenue sharing) ═══
INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)
VALUES ('rs0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'r10000-0000-0000-000000000001', 'c10000-0000-0000-000000000001', 'Amara Diallo', 80.00, '2026-01-15T00:00:00Z');
INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)
VALUES ('rs0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'r10000-0000-0000-000000000001', 'c10000-0000-0000-000000000002', 'Kwame Asante', 20.00, '2026-01-15T00:00:00Z');
INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)
VALUES ('rs0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'r10000-0000-0000-000000000002', 'c10000-0000-0000-000000000002', 'Kwame Asante', 80.00, '2026-01-15T00:00:00Z');
INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)
VALUES ('rs0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'r10000-0000-0000-000000000002', 'c10000-0000-0000-000000000003', 'Zara Okafor', 20.00, '2026-01-15T00:00:00Z');
INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)
VALUES ('rs0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'r10000-0000-0000-000000000003', 'c10000-0000-0000-000000000003', 'Zara Okafor', 80.00, '2026-01-15T00:00:00Z');
INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)
VALUES ('rs0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'r10000-0000-0000-000000000004', 'c10000-0000-0000-000000000004', 'Tendai Moyo', 80.00, '2026-01-15T00:00:00Z');
INSERT INTO zonga_royalty_splits (id, org_id, release_id, creator_id, creator_name, share_percent, created_at)
VALUES ('rs0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'r10000-0000-0000-000000000006', 'c10000-0000-0000-000000000006', 'Kofi Mensah', 80.00, '2026-01-15T00:00:00Z');

-- ═══ Events ═══
INSERT INTO zonga_events (id, org_id, creator_id, title, description, venue, city, country, starts_at, ends_at, status, ticketing_status, metadata, created_at)
VALUES ('e10000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'Dakar Music Festival 2026', 'Live music experience in Dakar', 'Place du Souvenir Africain', 'Dakar', 'Senegal', '2026-02-14T00:00:00.000Z', '2026-02-14T00:00:00.000Z', 'published', 'on_sale', '{}', '2026-01-15T00:00:00Z');
INSERT INTO zonga_events (id, org_id, creator_id, title, description, venue, city, country, starts_at, ends_at, status, ticketing_status, metadata, created_at)
VALUES ('e10000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'Lagos Live Sessions', 'Live music experience in Lagos', 'Eko Hotel & Suites', 'Lagos', 'Nigeria', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', 'published', 'on_sale', '{}', '2026-01-15T00:00:00Z');
INSERT INTO zonga_events (id, org_id, creator_id, title, description, venue, city, country, starts_at, ends_at, status, ticketing_status, metadata, created_at)
VALUES ('e10000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'Amapiano Nights Jozi', 'Live music experience in Johannesburg', 'Constitution Hill', 'Johannesburg', 'ZA', '2026-03-15T23:00:00.000Z', '2026-03-15T23:00:00.000Z', 'published', 'on_sale', '{}', '2026-01-15T00:00:00Z');
INSERT INTO zonga_events (id, org_id, creator_id, title, description, venue, city, country, starts_at, ends_at, status, ticketing_status, metadata, created_at)
VALUES ('e10000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'Nairobi Soundscapes', 'Live music experience in Nairobi', 'KICC Amphitheatre', 'Nairobi', 'Kenya', '2026-03-30T23:00:00.000Z', '2026-03-30T23:00:00.000Z', 'published', 'on_sale', '{}', '2026-01-15T00:00:00Z');
INSERT INTO zonga_events (id, org_id, creator_id, title, description, venue, city, country, starts_at, ends_at, status, ticketing_status, metadata, created_at)
VALUES ('e10000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'Durban Bass Carnival', 'Live music experience in Durban', 'Moses Mabhida Stadium', 'Durban', 'ZA', '2026-04-14T23:00:00.000Z', '2026-04-14T23:00:00.000Z', 'published', 'on_sale', '{}', '2026-01-15T00:00:00Z');

-- ═══ Ticket Types ═══
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000001', 'General Admission', 5000, 'XOF', 500, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000001', 'VIP', 15000, 'XOF', 50, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000001', 'Early Bird', 3500, 'XOF', 100, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000002', 'General Admission', 10000, 'NGN', 500, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000002', 'VIP', 50000, 'NGN', 50, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000002', 'Early Bird', 7000, 'NGN', 100, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000003', 'General Admission', 250, 'ZAR', 500, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000003', 'VIP', 750, 'ZAR', 50, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000003', 'Early Bird', 175, 'ZAR', 100, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000004', 'General Admission', 2000, 'KES', 500, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000004', 'VIP', 8000, 'KES', 50, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000004', 'Early Bird', 1400, 'KES', 100, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000005', 'General Admission', 200, 'ZAR', 500, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000005', 'VIP', 600, 'ZAR', 50, '2026-01-15T00:00:00Z');
INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available, created_at)
VALUES ('tt0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000005', 'Early Bird', 140, 'ZAR', 100, '2026-01-15T00:00:00Z');

-- ═══ Listeners ═══
INSERT INTO zonga_listeners (id, org_id, display_name, email, city, country, created_at)
VALUES ('l10000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Adama Traoré', 'adama@example.com', 'Dakar', 'Senegal', '2026-01-15T00:00:00Z');
INSERT INTO zonga_listeners (id, org_id, display_name, email, city, country, created_at)
VALUES ('l10000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Chioma Eze', 'chioma@example.com', 'Lagos', 'Nigeria', '2026-01-15T00:00:00Z');
INSERT INTO zonga_listeners (id, org_id, display_name, email, city, country, created_at)
VALUES ('l10000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Thabo Molefe', 'thabo@example.com', 'Johannesburg', 'ZA', '2026-01-15T00:00:00Z');
INSERT INTO zonga_listeners (id, org_id, display_name, email, city, country, created_at)
VALUES ('l10000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Wanjiku Mwangi', 'wanjiku@example.com', 'Nairobi', 'Kenya', '2026-01-15T00:00:00Z');
INSERT INTO zonga_listeners (id, org_id, display_name, email, city, country, created_at)
VALUES ('l10000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Yaa Mensah', 'yaa@example.com', 'Accra', 'Ghana', '2026-01-15T00:00:00Z');
INSERT INTO zonga_listeners (id, org_id, display_name, email, city, country, created_at)
VALUES ('l10000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'Ibrahim Diop', 'ibrahim@example.com', 'Abidjan', 'Côte d''Ivoire', '2026-01-15T00:00:00Z');

-- ═══ Follows ═══
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'c10000-0000-0000-000000000001', '2026-01-15T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'c10000-0000-0000-000000000003', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'c10000-0000-0000-000000000005', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'c10000-0000-0000-000000000003', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'c10000-0000-0000-000000000006', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'c10000-0000-0000-000000000001', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'c10000-0000-0000-000000000004', '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'c10000-0000-0000-000000000008', '2026-01-22T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'c10000-0000-0000-000000000002', '2026-01-23T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'c10000-0000-0000-000000000007', '2026-01-24T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'c10000-0000-0000-000000000003', '2026-01-25T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'c10000-0000-0000-000000000001', '2026-01-26T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'c10000-0000-0000-000000000002', '2026-01-27T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'c10000-0000-0000-000000000006', '2026-01-28T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'c10000-0000-0000-000000000003', '2026-01-29T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'c10000-0000-0000-000000000001', '2026-01-30T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'c10000-0000-0000-000000000005', '2026-01-31T00:00:00.000Z');
INSERT INTO zonga_listener_follows (id, org_id, listener_id, creator_id, created_at)
VALUES ('fl0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'c10000-0000-0000-000000000002', '2026-02-01T00:00:00.000Z');

-- ═══ Favorites ═══
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'asset', 'a10000-0000-0000-000000000001', '2026-01-15T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'asset', 'a10000-0000-0000-000000000009', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'asset', 'a10000-0000-0000-000000000005', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'asset', 'a10000-0000-0000-000000000006', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'asset', 'a10000-0000-0000-00000000000a', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'asset', 'a10000-0000-0000-000000000007', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'asset', 'a10000-0000-0000-000000000008', '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'asset', 'a10000-0000-0000-00000000000c', '2026-01-22T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'asset', 'a10000-0000-0000-00000000000b', '2026-01-23T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'asset', 'a10000-0000-0000-000000000003', '2026-01-24T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'asset', 'a10000-0000-0000-000000000003', '2026-01-25T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'asset', 'a10000-0000-0000-000000000004', '2026-01-26T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'asset', 'a10000-0000-0000-00000000000a', '2026-01-27T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'asset', 'a10000-0000-0000-000000000001', '2026-01-28T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'asset', 'a10000-0000-0000-000000000002', '2026-01-29T00:00:00.000Z');
INSERT INTO zonga_listener_favorites (id, org_id, listener_id, entity_type, entity_id, created_at)
VALUES ('fv0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'asset', 'a10000-0000-0000-000000000009', '2026-01-30T00:00:00.000Z');

-- ═══ Playlists ═══
INSERT INTO zonga_playlists (id, org_id, owner_type, owner_id, title, visibility, created_at)
VALUES ('pl0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'listener', 'l10000-0000-0000-000000000001', 'Sahel Vibes', 'public', '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlists (id, org_id, owner_type, owner_id, title, visibility, created_at)
VALUES ('pl0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'listener', 'l10000-0000-0000-000000000002', 'Naija to the World', 'public', '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlists (id, org_id, owner_type, owner_id, title, visibility, created_at)
VALUES ('pl0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'listener', 'l10000-0000-0000-000000000003', 'Amapiano Essentials', 'public', '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlists (id, org_id, owner_type, owner_id, title, visibility, created_at)
VALUES ('pl0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'listener', 'l10000-0000-0000-000000000005', 'Ghana Highlife Gold', 'public', '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlists (id, org_id, owner_type, owner_id, title, visibility, created_at)
VALUES ('pl0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'listener', 'l10000-0000-0000-000000000004', 'My Late Night Mix', 'private', '2026-01-15T00:00:00Z');

-- ═══ Playlist Items ═══
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000001', 'pl0000-0000-0000-000000000001', 'asset', 'a10000-0000-0000-000000000001', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000002', 'pl0000-0000-0000-000000000001', 'asset', 'a10000-0000-0000-000000000002', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000003', 'pl0000-0000-0000-000000000001', 'asset', 'a10000-0000-0000-000000000009', 3, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000004', 'pl0000-0000-0000-000000000002', 'asset', 'a10000-0000-0000-000000000005', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000005', 'pl0000-0000-0000-000000000002', 'asset', 'a10000-0000-0000-000000000006', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000006', 'pl0000-0000-0000-000000000002', 'asset', 'a10000-0000-0000-00000000000a', 3, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000007', 'pl0000-0000-0000-000000000003', 'asset', 'a10000-0000-0000-000000000007', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000008', 'pl0000-0000-0000-000000000003', 'asset', 'a10000-0000-0000-000000000008', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-000000000009', 'pl0000-0000-0000-000000000003', 'asset', 'a10000-0000-0000-00000000000c', 3, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-00000000000a', 'pl0000-0000-0000-000000000004', 'asset', 'a10000-0000-0000-000000000003', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-00000000000b', 'pl0000-0000-0000-000000000004', 'asset', 'a10000-0000-0000-000000000004', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-00000000000c', 'pl0000-0000-0000-000000000004', 'asset', 'a10000-0000-0000-00000000000a', 3, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-00000000000d', 'pl0000-0000-0000-000000000005', 'asset', 'a10000-0000-0000-00000000000b', 1, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-00000000000e', 'pl0000-0000-0000-000000000005', 'asset', 'a10000-0000-0000-000000000001', 2, '2026-01-15T00:00:00Z');
INSERT INTO zonga_playlist_items (id, playlist_id, entity_type, entity_id, position, created_at)
VALUES ('pi0000-0000-0000-00000000000f', 'pl0000-0000-0000-000000000005', 'asset', 'a10000-0000-0000-000000000007', 3, '2026-01-15T00:00:00Z');

-- ═══ Playlist Saves ═══
INSERT INTO zonga_listener_playlist_saves (id, org_id, listener_id, playlist_id, created_at)
VALUES ('ps0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'pl0000-0000-0000-000000000001', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_playlist_saves (id, org_id, listener_id, playlist_id, created_at)
VALUES ('ps0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'pl0000-0000-0000-000000000001', '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_listener_playlist_saves (id, org_id, listener_id, playlist_id, created_at)
VALUES ('ps0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'pl0000-0000-0000-000000000002', '2026-01-22T00:00:00.000Z');
INSERT INTO zonga_listener_playlist_saves (id, org_id, listener_id, playlist_id, created_at)
VALUES ('ps0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'pl0000-0000-0000-000000000002', '2026-01-23T00:00:00.000Z');
INSERT INTO zonga_listener_playlist_saves (id, org_id, listener_id, playlist_id, created_at)
VALUES ('ps0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'pl0000-0000-0000-000000000004', '2026-01-24T00:00:00.000Z');

-- ═══ Revenue Events ═══
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'a10000-0000-0000-000000000001', 'stream', 0.35, 'XOF', 'Sunrise in Dakar', 'zonga', '500 streams', '2026-01-16T00:00:00.000Z', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'a10000-0000-0000-000000000002', 'stream', 0.4459, 'XOF', 'Ocean Waves', 'zonga', '637 streams', '2026-01-17T00:00:00.000Z', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'a10000-0000-0000-000000000003', 'stream', 0.774, 'GHS', 'Accra Nights', 'zonga', '774 streams', '2026-01-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'a10000-0000-0000-000000000004', 'stream', 0.911, 'GHS', 'Golden Coast', 'zonga', '911 streams', '2026-01-19T00:00:00.000Z', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'a10000-0000-0000-000000000005', 'stream', 1.2576, 'NGN', 'Lagos Love', 'zonga', '1048 streams', '2026-01-20T00:00:00.000Z', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'a10000-0000-0000-000000000006', 'stream', 1.422, 'NGN', 'Victoria Island', 'zonga', '1185 streams', '2026-01-21T00:00:00.000Z', '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'a10000-0000-0000-000000000007', 'stream', 1.983, 'ZAR', 'Joburg Groove', 'zonga', '1322 streams', '2026-01-22T00:00:00.000Z', '2026-01-22T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'a10000-0000-0000-000000000008', 'stream', 2.1885, 'ZAR', 'Township Beats', 'zonga', '1459 streams', '2026-01-23T00:00:00.000Z', '2026-01-23T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'a10000-0000-0000-000000000009', 'stream', 1.1172, 'XOF', 'Dakar Dawn', 'zonga', '1596 streams', '2026-01-24T00:00:00.000Z', '2026-01-24T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'a10000-0000-0000-00000000000a', 'stream', 1.733, 'GHS', 'Kumasi Flow', 'zonga', '1733 streams', '2026-01-25T00:00:00.000Z', '2026-01-25T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'a10000-0000-0000-00000000000b', 'stream', 1.496, 'KES', 'Nairobi Nights', 'zonga', '1870 streams', '2026-01-26T00:00:00.000Z', '2026-01-26T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'a10000-0000-0000-00000000000c', 'stream', 3.0105, 'ZAR', 'Durban Bass', 'zonga', '2007 streams', '2026-01-27T00:00:00.000Z', '2026-01-27T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'a10000-0000-0000-000000000001', 'stream', 1.5008, 'XOF', 'Sunrise in Dakar', 'zonga', '2144 streams', '2026-01-28T00:00:00.000Z', '2026-01-28T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'a10000-0000-0000-000000000002', 'stream', 1.5967, 'XOF', 'Ocean Waves', 'zonga', '2281 streams', '2026-01-29T00:00:00.000Z', '2026-01-29T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'a10000-0000-0000-000000000003', 'stream', 2.418, 'GHS', 'Accra Nights', 'zonga', '2418 streams', '2026-01-30T00:00:00.000Z', '2026-01-30T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'a10000-0000-0000-000000000004', 'stream', 2.555, 'GHS', 'Golden Coast', 'zonga', '2555 streams', '2026-01-31T00:00:00.000Z', '2026-01-31T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'a10000-0000-0000-000000000005', 'stream', 3.2304, 'NGN', 'Lagos Love', 'zonga', '2692 streams', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'a10000-0000-0000-000000000006', 'stream', 3.3948, 'NGN', 'Victoria Island', 'zonga', '2829 streams', '2026-02-02T00:00:00.000Z', '2026-02-02T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000013', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'a10000-0000-0000-000000000007', 'stream', 4.449, 'ZAR', 'Joburg Groove', 'zonga', '2966 streams', '2026-02-03T00:00:00.000Z', '2026-02-03T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'a10000-0000-0000-000000000008', 'stream', 4.6545, 'ZAR', 'Township Beats', 'zonga', '3103 streams', '2026-02-04T00:00:00.000Z', '2026-02-04T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'a10000-0000-0000-000000000009', 'stream', 2.268, 'XOF', 'Dakar Dawn', 'zonga', '3240 streams', '2026-02-05T00:00:00.000Z', '2026-02-05T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'a10000-0000-0000-00000000000a', 'stream', 3.377, 'GHS', 'Kumasi Flow', 'zonga', '3377 streams', '2026-02-06T00:00:00.000Z', '2026-02-06T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000017', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'a10000-0000-0000-00000000000b', 'stream', 2.8112, 'KES', 'Nairobi Nights', 'zonga', '3514 streams', '2026-02-07T00:00:00.000Z', '2026-02-07T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000018', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'a10000-0000-0000-00000000000c', 'stream', 5.4765, 'ZAR', 'Durban Bass', 'zonga', '3651 streams', '2026-02-08T00:00:00.000Z', '2026-02-08T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000019', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'a10000-0000-0000-000000000001', 'stream', 2.6516, 'XOF', 'Sunrise in Dakar', 'zonga', '3788 streams', '2026-02-09T00:00:00.000Z', '2026-02-09T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000001a', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'a10000-0000-0000-000000000002', 'stream', 2.7475, 'XOF', 'Ocean Waves', 'zonga', '3925 streams', '2026-02-10T00:00:00.000Z', '2026-02-10T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000001b', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'a10000-0000-0000-000000000003', 'stream', 4.062, 'GHS', 'Accra Nights', 'zonga', '4062 streams', '2026-02-11T00:00:00.000Z', '2026-02-11T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000001c', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'a10000-0000-0000-000000000004', 'stream', 4.199, 'GHS', 'Golden Coast', 'zonga', '4199 streams', '2026-02-12T00:00:00.000Z', '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000001d', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'a10000-0000-0000-000000000005', 'stream', 5.2032, 'NGN', 'Lagos Love', 'zonga', '4336 streams', '2026-02-13T00:00:00.000Z', '2026-02-13T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000001e', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'a10000-0000-0000-000000000006', 'stream', 5.3676, 'NGN', 'Victoria Island', 'zonga', '4473 streams', '2026-02-14T00:00:00.000Z', '2026-02-14T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000001f', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'a10000-0000-0000-000000000007', 'stream', 6.915, 'ZAR', 'Joburg Groove', 'zonga', '4610 streams', '2026-01-16T00:00:00.000Z', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000020', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'a10000-0000-0000-000000000008', 'stream', 7.1205, 'ZAR', 'Township Beats', 'zonga', '4747 streams', '2026-01-17T00:00:00.000Z', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'a10000-0000-0000-000000000009', 'stream', 3.4188, 'XOF', 'Dakar Dawn', 'zonga', '4884 streams', '2026-01-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000022', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'a10000-0000-0000-00000000000a', 'stream', 0.521, 'GHS', 'Kumasi Flow', 'zonga', '521 streams', '2026-01-19T00:00:00.000Z', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000023', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'a10000-0000-0000-00000000000b', 'stream', 0.5264, 'KES', 'Nairobi Nights', 'zonga', '658 streams', '2026-01-20T00:00:00.000Z', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, asset_id, type, amount, currency, asset_title, source, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000024', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'a10000-0000-0000-00000000000c', 'stream', 1.1925, 'ZAR', 'Durban Bass', 'zonga', '795 streams', '2026-01-21T00:00:00.000Z', '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000025', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'ticket_sale', 825000, 'XOF', 'Ticket revenue: Dakar Music Festival 2026', '2026-02-09T00:00:00.000Z', '2026-02-09T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000026', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'ticket_sale', 1950000, 'NGN', 'Ticket revenue: Lagos Live Sessions', '2026-02-24T00:00:00.000Z', '2026-02-24T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000027', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'ticket_sale', 41250, 'ZAR', 'Ticket revenue: Amapiano Nights Jozi', '2026-03-10T23:00:00.000Z', '2026-03-10T23:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000028', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'tip', 1000, 'XOF', 'Fan tip', '2026-01-25T00:00:00.000Z', '2026-01-25T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-000000000029', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'tip', 20, 'GHS', 'Fan tip', '2026-01-26T00:00:00.000Z', '2026-01-26T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000002a', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'tip', 2000, 'NGN', 'Fan tip', '2026-01-27T00:00:00.000Z', '2026-01-27T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000002b', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'tip', 50, 'ZAR', 'Fan tip', '2026-01-28T00:00:00.000Z', '2026-01-28T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000002c', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'tip', 1000, 'XOF', 'Fan tip', '2026-01-29T00:00:00.000Z', '2026-01-29T00:00:00.000Z');
INSERT INTO zonga_revenue_events (id, org_id, creator_id, type, amount, currency, description, occurred_at, created_at)
VALUES ('rv0000-0000-0000-00000000002d', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'tip', 20, 'GHS', 'Fan tip', '2026-01-30T00:00:00.000Z', '2026-01-30T00:00:00.000Z');

-- ═══ Wallet Ledger ═══
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 0.35, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-000000000001', 0.35, '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 0.4459, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-000000000002', 0.7959, '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'credit', 0.774, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-000000000003', 0.774, '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'credit', 0.911, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-000000000004', 1.685, '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 1.2576, 'NGN', 'Revenue: stream', 'rv0000-0000-0000-000000000005', 1.2576, '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 1.422, 'NGN', 'Revenue: stream', 'rv0000-0000-0000-000000000006', 2.6796, '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 1.983, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-000000000007', 1.983, '2026-01-22T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 2.1885, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-000000000008', 4.1715, '2026-01-23T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'credit', 1.1172, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-000000000009', 1.1172, '2026-01-24T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'credit', 1.733, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-00000000000a', 1.733, '2026-01-25T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'credit', 1.496, 'KES', 'Revenue: stream', 'rv0000-0000-0000-00000000000b', 1.496, '2026-01-26T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'credit', 3.0105, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-00000000000c', 3.0105, '2026-01-27T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 1.5008, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-00000000000d', 2.2967, '2026-01-28T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 1.5967, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-00000000000e', 3.8934, '2026-01-29T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'credit', 2.418, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-00000000000f', 4.103, '2026-01-30T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'credit', 2.555, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-000000000010', 6.658, '2026-01-31T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 3.2304, 'NGN', 'Revenue: stream', 'rv0000-0000-0000-000000000011', 5.91, '2026-02-01T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 3.3948, 'NGN', 'Revenue: stream', 'rv0000-0000-0000-000000000012', 9.3048, '2026-02-02T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000013', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 4.449, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-000000000013', 8.6205, '2026-02-03T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 4.6545, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-000000000014', 13.275, '2026-02-04T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'credit', 2.268, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-000000000015', 3.3852, '2026-02-05T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'credit', 3.377, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-000000000016', 5.11, '2026-02-06T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000017', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'credit', 2.8112, 'KES', 'Revenue: stream', 'rv0000-0000-0000-000000000017', 4.3072, '2026-02-07T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000018', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'credit', 5.4765, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-000000000018', 8.487, '2026-02-08T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000019', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 2.6516, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-000000000019', 6.545, '2026-02-09T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000001a', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 2.7475, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-00000000001a', 9.2925, '2026-02-10T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000001b', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'credit', 4.062, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-00000000001b', 10.72, '2026-02-11T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000001c', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'credit', 4.199, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-00000000001c', 14.919, '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000001d', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 5.2032, 'NGN', 'Revenue: stream', 'rv0000-0000-0000-00000000001d', 14.508, '2026-02-13T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000001e', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 5.3676, 'NGN', 'Revenue: stream', 'rv0000-0000-0000-00000000001e', 19.8756, '2026-02-14T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000001f', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 6.915, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-00000000001f', 20.19, '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000020', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 7.1205, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-000000000020', 27.3105, '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'credit', 3.4188, 'XOF', 'Revenue: stream', 'rv0000-0000-0000-000000000021', 6.804, '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000022', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'credit', 0.521, 'GHS', 'Revenue: stream', 'rv0000-0000-0000-000000000022', 5.631, '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000023', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000007', 'credit', 0.5264, 'KES', 'Revenue: stream', 'rv0000-0000-0000-000000000023', 4.8336, '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000024', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000008', 'credit', 1.1925, 'ZAR', 'Revenue: stream', 'rv0000-0000-0000-000000000024', 9.6795, '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000025', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 825000, 'XOF', 'Revenue: ticket_sale', 'rv0000-0000-0000-000000000025', 825009.2925, '2026-02-09T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000026', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 1950000, 'NGN', 'Revenue: ticket_sale', 'rv0000-0000-0000-000000000026', 1950019.8756, '2026-02-24T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000027', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 41250, 'ZAR', 'Revenue: ticket_sale', 'rv0000-0000-0000-000000000027', 41277.3105, '2026-03-10T23:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000028', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'credit', 1000, 'XOF', 'Revenue: tip', 'rv0000-0000-0000-000000000028', 826009.2925, '2026-01-25T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000029', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'credit', 20, 'GHS', 'Revenue: tip', 'rv0000-0000-0000-000000000029', 34.919, '2026-01-26T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000002a', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'credit', 2000, 'NGN', 'Revenue: tip', 'rv0000-0000-0000-00000000002a', 1952019.8756, '2026-01-27T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000002b', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'credit', 50, 'ZAR', 'Revenue: tip', 'rv0000-0000-0000-00000000002b', 41327.3105, '2026-01-28T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000002c', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000005', 'credit', 1000, 'XOF', 'Revenue: tip', 'rv0000-0000-0000-00000000002c', 1006.804, '2026-01-29T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, revenue_event_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000002d', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000006', 'credit', 20, 'GHS', 'Revenue: tip', 'rv0000-0000-0000-00000000002d', 25.631, '2026-01-30T00:00:00.000Z');

-- ═══ Payouts ═══
INSERT INTO zonga_payouts (id, org_id, creator_id, creator_name, amount, currency, status, payout_rail, period_start, period_end, revenue_event_count, previewed_at, approved_at, completed_at, created_at)
VALUES ('po0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'Amara Diallo', 660807.43, 'XOF', 'completed', 'orange_money', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 10, '2026-02-12T00:00:00.000Z', '2026-02-13T00:00:00.000Z', '2026-02-14T00:00:00.000Z', '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, payout_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000002e', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', 'debit', 660807.43, 'XOF', 'Payout completed', 'po0000-0000-0000-000000000001', 165201.8625, '2026-02-14T00:00:00.000Z');
INSERT INTO zonga_payouts (id, org_id, creator_id, creator_name, amount, currency, status, payout_rail, period_start, period_end, revenue_event_count, previewed_at, approved_at, completed_at, created_at)
VALUES ('po0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'Zara Okafor', 1561615.9, 'NGN', 'completed', 'flutterwave', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 10, '2026-02-12T00:00:00.000Z', '2026-02-13T00:00:00.000Z', '2026-02-14T00:00:00.000Z', '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, payout_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-00000000002f', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', 'debit', 1561615.9, 'NGN', 'Payout completed', 'po0000-0000-0000-000000000002', 390403.9756, '2026-02-14T00:00:00.000Z');
INSERT INTO zonga_payouts (id, org_id, creator_id, creator_name, amount, currency, status, payout_rail, period_start, period_end, revenue_event_count, previewed_at, approved_at, completed_at, created_at)
VALUES ('po0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'Tendai Moyo', 33061.85, 'ZAR', 'completed', 'bank_transfer', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 10, '2026-02-12T00:00:00.000Z', '2026-02-13T00:00:00.000Z', '2026-02-14T00:00:00.000Z', '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_wallet_ledger (id, org_id, creator_id, entry_type, amount, currency, description, payout_id, balance_after, created_at)
VALUES ('wl0000-0000-0000-000000000030', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', 'debit', 33061.85, 'ZAR', 'Payout completed', 'po0000-0000-0000-000000000003', 8265.4605, '2026-02-14T00:00:00.000Z');
INSERT INTO zonga_payouts (id, org_id, creator_id, creator_name, amount, currency, status, payout_rail, period_start, period_end, revenue_event_count, created_at)
VALUES ('po0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', 'Kwame Asante', 27.94, 'GHS', 'pending', 'mtn_momo', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 6, '2026-02-14T00:00:00.000Z');

-- ═══ Payout Previews ═══
INSERT INTO zonga_payout_previews (id, org_id, creator_id, period_start, period_end, total_amount, currency, status, created_at)
VALUES ('pp0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000001', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 165201.86, 'XOF', 'locked', '2026-02-11T00:00:00.000Z');
INSERT INTO zonga_payout_previews (id, org_id, creator_id, period_start, period_end, total_amount, currency, status, created_at)
VALUES ('pp0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000003', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 390403.98, 'NGN', 'locked', '2026-02-11T00:00:00.000Z');
INSERT INTO zonga_payout_previews (id, org_id, creator_id, period_start, period_end, total_amount, currency, status, created_at)
VALUES ('pp0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000004', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 8265.46, 'ZAR', 'locked', '2026-02-11T00:00:00.000Z');
INSERT INTO zonga_payout_previews (id, org_id, creator_id, period_start, period_end, total_amount, currency, status, created_at)
VALUES ('pp0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'c10000-0000-0000-000000000002', '2026-01-01T00:00:00Z', '2026-01-31T23:59:59Z', 34.92, 'GHS', 'draft', '2026-02-11T00:00:00.000Z');

-- ═══ Ticket Purchases ═══
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000001', 'tt0000-0000-0000-000000000001', 'l10000-0000-0000-000000000001', 'confirmed', 5000, 'XOF', '2026-02-04T00:00:00.000Z', '2026-02-02T00:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000001', 'tt0000-0000-0000-000000000002', 'l10000-0000-0000-000000000001', 'confirmed', 15000, 'XOF', '2026-02-04T00:00:00.000Z', '2026-02-02T00:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000002', 'tt0000-0000-0000-000000000004', 'l10000-0000-0000-000000000002', 'confirmed', 10000, 'NGN', '2026-02-19T00:00:00.000Z', '2026-02-17T00:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000003', 'tt0000-0000-0000-000000000008', 'l10000-0000-0000-000000000003', 'confirmed', 750, 'ZAR', '2026-03-06T00:00:00.000Z', '2026-03-04T00:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000004', 'tt0000-0000-0000-00000000000a', 'l10000-0000-0000-000000000004', 'confirmed', 2000, 'KES', '2026-03-20T23:00:00.000Z', '2026-03-18T23:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000002', 'tt0000-0000-0000-000000000006', 'l10000-0000-0000-000000000005', 'confirmed', 7000, 'NGN', '2026-02-19T00:00:00.000Z', '2026-02-17T00:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000001', 'tt0000-0000-0000-000000000001', 'l10000-0000-0000-000000000006', 'pending', 5000, 'XOF', NULL, '2026-02-02T00:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000005', 'tt0000-0000-0000-00000000000d', 'l10000-0000-0000-000000000003', 'confirmed', 200, 'ZAR', '2026-04-04T23:00:00.000Z', '2026-04-02T23:00:00.000Z');
INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id, status, amount, currency, confirmed_at, created_at)
VALUES ('tp0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'e10000-0000-0000-000000000002', 'tt0000-0000-0000-000000000005', 'l10000-0000-0000-000000000004', 'refunded', 50000, 'NGN', NULL, '2026-02-17T00:00:00.000Z');

-- ═══ Listener Activity ═══
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'play', 'asset', 'a10000-0000-0000-000000000002', '{"duration":150,"quality":"medium","country":"Senegal"}', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'play', 'asset', 'a10000-0000-0000-000000000003', '{"duration":180,"quality":"medium","country":"Senegal"}', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'follow', 'asset', 'a10000-0000-0000-000000000004', '{"duration":210,"quality":"medium","country":"Senegal"}', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'favorite', 'asset', 'a10000-0000-0000-000000000005', '{"duration":240,"quality":"medium","country":"Senegal"}', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000001', 'share', 'asset', 'a10000-0000-0000-000000000006', '{"duration":270,"quality":"medium","country":"Senegal"}', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'play', 'asset', 'a10000-0000-0000-000000000005', '{"duration":150,"quality":"medium","country":"Nigeria"}', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'follow', 'asset', 'a10000-0000-0000-000000000006', '{"duration":180,"quality":"medium","country":"Nigeria"}', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'favorite', 'asset', 'a10000-0000-0000-000000000007', '{"duration":210,"quality":"medium","country":"Nigeria"}', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'share', 'asset', 'a10000-0000-0000-000000000008', '{"duration":240,"quality":"medium","country":"Nigeria"}', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000002', 'buy_ticket', 'asset', 'a10000-0000-0000-000000000009', '{"duration":270,"quality":"medium","country":"Nigeria"}', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'follow', 'asset', 'a10000-0000-0000-000000000008', '{"duration":150,"quality":"medium","country":"ZA"}', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'favorite', 'asset', 'a10000-0000-0000-000000000009', '{"duration":180,"quality":"medium","country":"ZA"}', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'share', 'asset', 'a10000-0000-0000-00000000000a', '{"duration":210,"quality":"medium","country":"ZA"}', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'buy_ticket', 'asset', 'a10000-0000-0000-00000000000b', '{"duration":240,"quality":"medium","country":"ZA"}', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000003', 'play', 'asset', 'a10000-0000-0000-00000000000c', '{"duration":270,"quality":"medium","country":"ZA"}', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'favorite', 'asset', 'a10000-0000-0000-00000000000b', '{"duration":150,"quality":"medium","country":"Kenya"}', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'share', 'asset', 'a10000-0000-0000-00000000000c', '{"duration":180,"quality":"medium","country":"Kenya"}', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'buy_ticket', 'asset', 'a10000-0000-0000-000000000001', '{"duration":210,"quality":"medium","country":"Kenya"}', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000013', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'play', 'asset', 'a10000-0000-0000-000000000002', '{"duration":240,"quality":"medium","country":"Kenya"}', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000004', 'play', 'asset', 'a10000-0000-0000-000000000003', '{"duration":270,"quality":"medium","country":"Kenya"}', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'share', 'asset', 'a10000-0000-0000-000000000002', '{"duration":150,"quality":"medium","country":"Ghana"}', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'buy_ticket', 'asset', 'a10000-0000-0000-000000000003', '{"duration":180,"quality":"medium","country":"Ghana"}', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000017', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'play', 'asset', 'a10000-0000-0000-000000000004', '{"duration":210,"quality":"medium","country":"Ghana"}', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000018', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'play', 'asset', 'a10000-0000-0000-000000000005', '{"duration":240,"quality":"medium","country":"Ghana"}', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-000000000019', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000005', 'play', 'asset', 'a10000-0000-0000-000000000006', '{"duration":270,"quality":"medium","country":"Ghana"}', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000001a', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'buy_ticket', 'asset', 'a10000-0000-0000-000000000005', '{"duration":150,"quality":"medium","country":"Côte d''Ivoire"}', '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000001b', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'play', 'asset', 'a10000-0000-0000-000000000006', '{"duration":180,"quality":"medium","country":"Côte d''Ivoire"}', '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000001c', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'play', 'asset', 'a10000-0000-0000-000000000007', '{"duration":210,"quality":"medium","country":"Côte d''Ivoire"}', '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000001d', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'play', 'asset', 'a10000-0000-0000-000000000008', '{"duration":240,"quality":"medium","country":"Côte d''Ivoire"}', '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_listener_activity (id, org_id, listener_id, activity_type, entity_type, entity_id, metadata_json, created_at)
VALUES ('la0000-0000-0000-00000000001e', '22222222-2222-2222-2222-222222222222', 'l10000-0000-0000-000000000006', 'follow', 'asset', 'a10000-0000-0000-000000000009', '{"duration":270,"quality":"medium","country":"Côte d''Ivoire"}', '2026-01-20T00:00:00.000Z');

-- ═══ Moderation Cases ═══
INSERT INTO zonga_moderation_cases (id, org_id, entity_type, entity_id, case_type, status, severity, notes, resolved_at, created_at)
VALUES ('mc0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'asset', 'a10000-0000-0000-00000000000c', 'copyright', 'resolved', 'high', 'Sample clearance verified — original production confirmed via beat license', '2026-01-23T00:00:00.000Z', '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_moderation_cases (id, org_id, entity_type, entity_id, case_type, status, severity, notes, resolved_at, created_at)
VALUES ('mc0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'asset', 'a10000-0000-0000-000000000006', 'quality', 'dismissed', 'low', 'Audio quality meets minimum 128kbps AAC threshold', '2026-01-26T00:00:00.000Z', '2026-01-23T00:00:00.000Z');
INSERT INTO zonga_moderation_cases (id, org_id, entity_type, entity_id, case_type, status, severity, notes, resolved_at, created_at)
VALUES ('mc0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'creator', 'c10000-0000-0000-000000000007', 'policy', 'in_review', 'medium', 'Bio text flagged for review — pending manual check', NULL, '2026-01-27T00:00:00.000Z');
INSERT INTO zonga_moderation_cases (id, org_id, entity_type, entity_id, case_type, status, severity, notes, resolved_at, created_at)
VALUES ('mc0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'asset', 'a10000-0000-0000-000000000008', 'copyright', 'open', 'high', 'DMCA-style claim filed by third party — investigating ownership', NULL, '2026-01-30T00:00:00.000Z');
INSERT INTO zonga_moderation_cases (id, org_id, entity_type, entity_id, case_type, status, severity, notes, resolved_at, created_at)
VALUES ('mc0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'release', 'r10000-0000-0000-000000000003', 'quality', 'resolved', 'low', 'Cover art resolution upgraded to meet 3000x3000px minimum', '2026-01-21T00:00:00.000Z', '2026-01-18T00:00:00.000Z');

-- ═══ Integrity Signals ═══
INSERT INTO zonga_integrity_signals (id, org_id, entity_type, entity_id, signal_type, severity, explanation, metadata_json, created_at)
VALUES ('is0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'asset', 'a10000-0000-0000-000000000001', 'stream_spike', 'warning', '312% stream increase in 24h from Dakar region — likely organic (festival promo)', '{}', '2026-02-04T00:00:00.000Z');
INSERT INTO zonga_integrity_signals (id, org_id, entity_type, entity_id, signal_type, severity, explanation, metadata_json, created_at)
VALUES ('is0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'asset', 'a10000-0000-0000-000000000007', 'bot_pattern', 'critical', 'Repeated 31-second plays from same /24 subnet — 89% bot probability', '{}', '2026-02-06T00:00:00.000Z');
INSERT INTO zonga_integrity_signals (id, org_id, entity_type, entity_id, signal_type, severity, explanation, metadata_json, created_at)
VALUES ('is0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'creator', 'c10000-0000-0000-000000000008', 'geo_anomaly', 'info', '95% of streams from single city (Durban) — consistent with local artist profile', '{}', '2026-02-02T00:00:00.000Z');
INSERT INTO zonga_integrity_signals (id, org_id, entity_type, entity_id, signal_type, severity, explanation, metadata_json, created_at)
VALUES ('is0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'asset', 'a10000-0000-0000-000000000005', 'duplicate_content', 'warning', 'Audio fingerprint 94% match with existing track — may be remix/sample', '{}', '2026-01-25T00:00:00.000Z');
INSERT INTO zonga_integrity_signals (id, org_id, entity_type, entity_id, signal_type, severity, explanation, metadata_json, created_at)
VALUES ('is0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'creator', 'c10000-0000-0000-000000000003', 'payout_anomaly', 'info', 'Revenue spike correlates with verified Nigeria Independence Day streaming event', '{}', '2026-02-09T00:00:00.000Z');

-- ═══ Notifications ═══
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000001', 'payout_completed', 'Payout Sent', 'XOF payout via Orange Money has been completed', true, '2026-01-16T00:00:00.000Z');
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000003', 'payout_completed', 'Payout Sent', 'NGN payout via Flutterwave has been completed', true, '2026-01-17T00:00:00.000Z');
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000004', 'payout_completed', 'Payout Sent', 'ZAR payout via bank transfer has been completed', false, '2026-01-18T00:00:00.000Z');
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000002', 'new_release', 'Release Published', 'Gold Coast Chronicles is now live on Zonga', true, '2026-01-19T00:00:00.000Z');
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000006', 'new_release', 'Release Published', 'Hiplife Heritage is now live on Zonga', false, '2026-01-20T00:00:00.000Z');
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000008', 'moderation_action', 'Copyright Review', 'A copyright claim has been filed on Township Beats — please provide evidence', false, '2026-01-21T00:00:00.000Z');
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000007', 'event_reminder', 'Event Coming Up', 'Nairobi Soundscapes is 10 days away — check ticket sales', false, '2026-01-22T00:00:00.000Z');
INSERT INTO zonga_notifications (id, org_id, user_id, type, title, body, read, created_at)
VALUES ('nt0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'u10000-0000-0000-000000000001', 'system', 'Welcome to Zonga', 'Your creator profile is verified — you can now receive payouts', true, '2026-01-23T00:00:00.000Z');

-- ═══ Outbox Events ═══
INSERT INTO zonga_outbox (id, org_id, event_type, payload, status, dispatched_at, created_at)
VALUES ('ob0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'payout.completed', '{"payoutId":"po0000-0000-0000-000000000001","creatorId":"c10000-0000-0000-000000000001","amount":"see payout table","currency":"XOF"}', 'dispatched', '2026-02-13T00:00:00.000Z', '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_outbox (id, org_id, event_type, payload, status, dispatched_at, created_at)
VALUES ('ob0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'payout.completed', '{"payoutId":"po0000-0000-0000-000000000002","creatorId":"c10000-0000-0000-000000000003","amount":"see payout table","currency":"NGN"}', 'dispatched', '2026-02-13T00:00:00.000Z', '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_outbox (id, org_id, event_type, payload, status, dispatched_at, created_at)
VALUES ('ob0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'release.published', '{"releaseId":"r10000-0000-0000-000000000002","creatorId":"c10000-0000-0000-000000000002","title":"Gold Coast Chronicles"}', 'dispatched', '2026-02-13T00:00:00.000Z', '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_outbox (id, org_id, event_type, payload, status, dispatched_at, created_at)
VALUES ('ob0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'moderation.case_opened', '{"caseId":"mc0000-0000-0000-000000000004","entityType":"asset","entityId":"a10000-0000-0000-000000000008"}', 'pending', NULL, '2026-02-12T00:00:00.000Z');
INSERT INTO zonga_outbox (id, org_id, event_type, payload, status, dispatched_at, created_at)
VALUES ('ob0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'integrity.signal_detected', '{"signalId":"is0000-0000-0000-000000000002","signalType":"bot_pattern","severity":"critical"}', 'pending', NULL, '2026-02-12T00:00:00.000Z');

COMMIT;

-- ═══ Seed complete ═══