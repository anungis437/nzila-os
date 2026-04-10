-- ============================================================
-- Zonga Platform Upgrade — Production Data Model
-- ============================================================
-- Extends the existing zonga_* tables with full media pipeline,
-- creator publishing, discovery, event ticketing, monetization,
-- rights governance, and operational observability tables.
-- ============================================================

BEGIN;

-- ── 1. MEDIA INFRASTRUCTURE ────────────────────────────────────────────────

-- Track assets (raw uploads)
CREATE TABLE IF NOT EXISTS zonga_track_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_asset_id UUID NOT NULL,
  org_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'raw-uploads',
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  sha256_fingerprint TEXT,
  duration_seconds NUMERIC(10,2),
  sample_rate INTEGER,
  bit_depth INTEGER,
  channels INTEGER,
  upload_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending','uploading','completed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Processed variants (transcoded audio)
CREATE TABLE IF NOT EXISTS zonga_processed_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_asset_id UUID NOT NULL REFERENCES zonga_track_assets(id),
  quality_tier TEXT NOT NULL CHECK (quality_tier IN ('standard','high','hifi','preview')),
  format TEXT NOT NULL CHECK (format IN ('aac','mp3','flac','opus','ogg')),
  bitrate INTEGER NOT NULL,
  codec TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  duration_seconds NUMERIC(10,2),
  loudness_lufs NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_variants_asset
  ON zonga_processed_variants(track_asset_id);

-- Artwork assets
CREATE TABLE IF NOT EXISTS zonga_artwork_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track','release','event','artist','playlist')),
  entity_id UUID NOT NULL,
  org_id UUID NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artwork_entity
  ON zonga_artwork_assets(entity_type, entity_id);

-- Upload jobs (processing pipeline)
CREATE TABLE IF NOT EXISTS zonga_upload_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_asset_id UUID NOT NULL REFERENCES zonga_track_assets(id),
  org_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'transcode'
    CHECK (job_type IN ('transcode','normalize','waveform','fingerprint','metadata_extract')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','completed','failed','retrying')),
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  input_key TEXT NOT NULL,
  output_key TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_jobs_status
  ON zonga_upload_jobs(status, priority DESC, created_at);

-- ── 2. ARTIST / CREATOR PROFILE ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zonga_artist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  org_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  bio TEXT,
  genre TEXT,
  sub_genres TEXT[] DEFAULT '{}',
  country TEXT,
  city TEXT,
  languages TEXT[] DEFAULT '{}',
  website_url TEXT,
  social_links JSONB DEFAULT '{}',
  avatar_url TEXT,
  banner_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  follower_count INTEGER NOT NULL DEFAULT 0,
  track_count INTEGER NOT NULL DEFAULT 0,
  monthly_listeners INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_artist_slug ON zonga_artist_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_artist_genre ON zonga_artist_profiles(genre);
CREATE INDEX IF NOT EXISTS idx_artist_country ON zonga_artist_profiles(country);

-- ── 3. RELEASES / COLLECTIONS ──────────────────────────────────────────────

-- Release tracks (join table)
CREATE TABLE IF NOT EXISTS zonga_release_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL,
  content_asset_id UUID NOT NULL,
  track_number INTEGER NOT NULL,
  disc_number INTEGER NOT NULL DEFAULT 1,
  is_explicit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(release_id, track_number, disc_number)
);

CREATE INDEX IF NOT EXISTS idx_release_tracks_release
  ON zonga_release_tracks(release_id);

-- ── 4. EVENT SYSTEM (extended) ─────────────────────────────────────────────

-- Event artists (lineup)
CREATE TABLE IF NOT EXISTS zonga_event_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  artist_id UUID,
  artist_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'performer'
    CHECK (role IN ('headliner','performer','dj','host','guest')),
  set_time TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_artists_event
  ON zonga_event_artists(event_id);

-- Venues
CREATE TABLE IF NOT EXISTS zonga_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  capacity INTEGER,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  venue_type TEXT DEFAULT 'indoor'
    CHECK (venue_type IN ('indoor','outdoor','hybrid','virtual')),
  amenities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket types (multi-tier)
CREATE TABLE IF NOT EXISTS zonga_ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity_total INTEGER NOT NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  sale_starts_at TIMESTAMPTZ,
  sale_ends_at TIMESTAMPTZ,
  max_per_order INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event
  ON zonga_ticket_types(event_id);

-- Ticket orders
CREATE TABLE IF NOT EXISTS zonga_ticket_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  ticket_type_id UUID NOT NULL REFERENCES zonga_ticket_types(id),
  org_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  organizer_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','cancelled','refunded','expired')),
  payment_provider TEXT DEFAULT 'stripe',
  payment_ref TEXT,
  stripe_checkout_session_id TEXT,
  confirmation_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON zonga_ticket_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_buyer ON zonga_ticket_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_status ON zonga_ticket_orders(status);

-- Individual tickets (for scanning/check-in)
CREATE TABLE IF NOT EXISTS zonga_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES zonga_ticket_orders(id),
  event_id UUID NOT NULL,
  ticket_type_id UUID NOT NULL,
  holder_name TEXT,
  holder_email TEXT,
  qr_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid','used','cancelled','transferred')),
  checked_in_at TIMESTAMPTZ,
  checked_in_by TEXT,
  transferred_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_order ON zonga_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON zonga_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON zonga_tickets(qr_token);

-- Check-ins
CREATE TABLE IF NOT EXISTS zonga_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES zonga_tickets(id),
  event_id UUID NOT NULL,
  scanned_by TEXT NOT NULL,
  scan_method TEXT NOT NULL DEFAULT 'qr'
    CHECK (scan_method IN ('qr','manual','nfc')),
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  device_id TEXT,
  is_valid BOOLEAN NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkins_event ON zonga_checkins(event_id);

-- ── 5. MONETIZATION / EARNINGS ─────────────────────────────────────────────

-- Earnings entries (per-track / per-event attribution)
CREATE TABLE IF NOT EXISTS zonga_earnings_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('stream','download','tip','ticket_sale','sponsorship','subscription_share')),
  source_entity_id UUID,
  amount NUMERIC(12,4) NOT NULL,
  currency TEXT NOT NULL,
  platform_fee NUMERIC(12,4) NOT NULL DEFAULT 0,
  creator_net NUMERIC(12,4) NOT NULL DEFAULT 0,
  revenue_split_rule_id UUID,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','available','paid','disputed','held')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earnings_creator ON zonga_earnings_entries(creator_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON zonga_earnings_entries(status);
CREATE INDEX IF NOT EXISTS idx_earnings_source ON zonga_earnings_entries(source_type, source_entity_id);

-- Revenue split rules
CREATE TABLE IF NOT EXISTS zonga_revenue_split_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track','release','event')),
  entity_id UUID NOT NULL,
  platform_share_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  splits JSONB NOT NULL DEFAULT '[]',
  -- splits: [{ creator_id, share_pct, role }]
  total_creator_pct NUMERIC(5,2) NOT NULL DEFAULT 85.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_split_total CHECK (platform_share_pct + total_creator_pct = 100.00)
);

CREATE INDEX IF NOT EXISTS idx_split_rules_entity
  ON zonga_revenue_split_rules(entity_type, entity_id);

-- Payout requests
CREATE TABLE IF NOT EXISTS zonga_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  requested_amount NUMERIC(12,4) NOT NULL,
  currency TEXT NOT NULL,
  payout_rail TEXT NOT NULL DEFAULT 'stripe_connect'
    CHECK (payout_rail IN ('stripe_connect','mobile_money','bank_transfer','manual')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','processing','completed','failed','cancelled')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  stripe_transfer_id TEXT,
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator ON zonga_payout_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON zonga_payout_requests(status);

-- Payout batches
CREATE TABLE IF NOT EXISTS zonga_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  total_amount NUMERIC(14,4) NOT NULL,
  currency TEXT NOT NULL,
  payout_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','processing','completed','partial_failure','failed')),
  initiated_by TEXT NOT NULL,
  approved_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. RIGHTS / GOVERNANCE ─────────────────────────────────────────────────

-- Ownership splits
CREATE TABLE IF NOT EXISTS zonga_ownership_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track','release')),
  entity_id UUID NOT NULL,
  org_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  owner_name TEXT NOT NULL,
  ownership_pct NUMERIC(5,2) NOT NULL,
  role TEXT NOT NULL DEFAULT 'primary'
    CHECK (role IN ('primary','co-creator','producer','songwriter','featured','label')),
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ownership_entity
  ON zonga_ownership_splits(entity_type, entity_id);

-- Rights claims
CREATE TABLE IF NOT EXISTS zonga_rights_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track','release')),
  entity_id UUID NOT NULL,
  org_id UUID NOT NULL,
  claimant_id UUID NOT NULL,
  claimant_name TEXT NOT NULL,
  claim_type TEXT NOT NULL
    CHECK (claim_type IN ('ownership','copyright','trademark','derivative','takedown')),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'filed'
    CHECK (status IN ('filed','under_review','upheld','rejected','withdrawn','escalated')),
  reviewer_id TEXT,
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rights_claims_entity
  ON zonga_rights_claims(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_rights_claims_status
  ON zonga_rights_claims(status);

-- Moderation decisions (extended)
CREATE TABLE IF NOT EXISTS zonga_moderation_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  org_id UUID NOT NULL,
  decision TEXT NOT NULL
    CHECK (decision IN ('approve','reject','suspend','remove','escalate','warn')),
  reason TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  policy_refs TEXT[] DEFAULT '{}',
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_entity
  ON zonga_moderation_decisions(entity_type, entity_id);

-- Takedown requests
CREATE TABLE IF NOT EXISTS zonga_takedown_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track','release','event')),
  entity_id UUID NOT NULL,
  org_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('copyright','trademark','defamation','illegal_content','fraud','other')),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','reviewing','actioned','rejected','appealed')),
  actioned_by TEXT,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 7. DISCOVERY / SIGNALS ─────────────────────────────────────────────────

-- Discovery signals (engagement-based ranking)
CREATE TABLE IF NOT EXISTS zonga_discovery_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track','artist','event','release','playlist')),
  entity_id UUID NOT NULL,
  signal_type TEXT NOT NULL
    CHECK (signal_type IN ('play','save','share','follow','like','purchase','search_click','skip')),
  count INTEGER NOT NULL DEFAULT 1,
  period DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, signal_type, period)
);

CREATE INDEX IF NOT EXISTS idx_discovery_signals_entity
  ON zonga_discovery_signals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_discovery_signals_period
  ON zonga_discovery_signals(period DESC);

-- Trending scores (pre-computed)
CREATE TABLE IF NOT EXISTS zonga_trending_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track','artist','event','release')),
  entity_id UUID NOT NULL,
  score NUMERIC(12,4) NOT NULL DEFAULT 0,
  rank INTEGER,
  genre TEXT,
  region TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_trending_type_score
  ON zonga_trending_scores(entity_type, score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_genre
  ON zonga_trending_scores(genre, score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_region
  ON zonga_trending_scores(region, score DESC);

-- Featured content (editorial)
CREATE TABLE IF NOT EXISTS zonga_featured_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  org_id UUID NOT NULL,
  placement TEXT NOT NULL
    CHECK (placement IN ('hero','spotlight','new_releases','editorial','genre_pick','event_highlight')),
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_featured_active
  ON zonga_featured_content(is_active, placement, sort_order);

-- ── 8. PLAYBACK TELEMETRY ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zonga_playback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listener_id UUID,
  content_asset_id UUID NOT NULL,
  quality_tier TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT false,
  skip_position_ms INTEGER,
  source TEXT DEFAULT 'catalog'
    CHECK (source IN ('catalog','playlist','search','radio','event','share_link','embed')),
  device_type TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playback_asset
  ON zonga_playback_events(content_asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_listener
  ON zonga_playback_events(listener_id, created_at DESC);

-- ── 9. OPERATIONAL HEALTH ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zonga_platform_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC(14,4) NOT NULL,
  metadata JSONB DEFAULT '{}',
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_type
  ON zonga_platform_health_snapshots(metric_type, snapshot_at DESC);

-- ── 10. NZILA OS INTEGRATION ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zonga_nzila_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL
    CHECK (sync_type IN ('creator_summary','event_summary','revenue_summary','governance_alert','health_check')),
  entity_type TEXT,
  entity_id UUID,
  payload JSONB NOT NULL,
  synced_to TEXT NOT NULL DEFAULT 'nzila_os',
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','acknowledged','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
