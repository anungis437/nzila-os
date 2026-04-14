-- Migration: 0002_zonga_streaming_infrastructure.sql
-- Description: Add tables for AWS-backed live streaming and VOD processing.
-- Tables: zonga_live_streams, zonga_stream_credentials, zonga_media_jobs,
--         zonga_media_variants, zonga_stream_events

BEGIN;

-- ── Live Streams ────────────────────────────────────────────────────────────
-- Represents a live streaming channel provisioned via AWS IVS (or other provider).
-- Zonga owns event/creator/org relationships; this stores provider resource references.

CREATE TABLE IF NOT EXISTS zonga_live_streams (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID         NOT NULL,
    event_id        UUID         NOT NULL,
    creator_id      UUID         NOT NULL,
    provider        TEXT         NOT NULL DEFAULT 'aws_ivs',
    provider_channel_id TEXT     NULL,
    provider_stage_id   TEXT     NULL,
    ingest_endpoint TEXT         NULL,
    playback_reference TEXT      NULL,
    status          TEXT         NOT NULL DEFAULT 'scheduled'
                                 CHECK (status IN ('scheduled', 'ready', 'live', 'ended', 'failed')),
    scheduled_start TIMESTAMPTZ  NULL,
    scheduled_end   TIMESTAMPTZ  NULL,
    started_at      TIMESTAMPTZ  NULL,
    ended_at        TIMESTAMPTZ  NULL,
    metadata_json   JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonga_live_streams_org       ON zonga_live_streams (org_id);
CREATE INDEX IF NOT EXISTS idx_zonga_live_streams_event     ON zonga_live_streams (event_id);
CREATE INDEX IF NOT EXISTS idx_zonga_live_streams_creator   ON zonga_live_streams (creator_id);
CREATE INDEX IF NOT EXISTS idx_zonga_live_streams_status    ON zonga_live_streams (status);
CREATE INDEX IF NOT EXISTS idx_zonga_live_streams_provider  ON zonga_live_streams (provider);

-- ── Stream Credentials ──────────────────────────────────────────────────────
-- Stores references to stream keys / ingest tokens.
-- credential_ref holds the provider ARN / key reference (NOT the raw secret).

CREATE TABLE IF NOT EXISTS zonga_stream_credentials (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    live_stream_id  UUID         NOT NULL REFERENCES zonga_live_streams(id) ON DELETE CASCADE,
    credential_ref  TEXT         NOT NULL,
    rotated_at      TIMESTAMPTZ  NULL,
    expires_at      TIMESTAMPTZ  NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonga_stream_creds_stream ON zonga_stream_credentials (live_stream_id);

-- ── Media Jobs ──────────────────────────────────────────────────────────────
-- Tracks AWS MediaConvert (or other provider) transcoding jobs.
-- Links to content_asset_id from zonga_content_assets.

CREATE TABLE IF NOT EXISTS zonga_media_jobs (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID         NOT NULL,
    content_asset_id UUID        NOT NULL,
    provider        TEXT         NOT NULL DEFAULT 'aws_mediaconvert',
    provider_job_id TEXT         NULL,
    job_type        TEXT         NOT NULL
                                 CHECK (job_type IN ('transcode_hls', 'transcode_audio', 'thumbnail', 'poster')),
    status          TEXT         NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'submitted', 'processing', 'completed', 'failed', 'cancelled')),
    submitted_at    TIMESTAMPTZ  NULL,
    completed_at    TIMESTAMPTZ  NULL,
    error_summary   TEXT         NULL,
    metadata_json   JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonga_media_jobs_org    ON zonga_media_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_zonga_media_jobs_asset  ON zonga_media_jobs (content_asset_id);
CREATE INDEX IF NOT EXISTS idx_zonga_media_jobs_status ON zonga_media_jobs (status);
CREATE INDEX IF NOT EXISTS idx_zonga_media_jobs_provider ON zonga_media_jobs (provider);

-- ── Media Variants ──────────────────────────────────────────────────────────
-- Processed output variants (HLS playlists, audio files, thumbnails).
-- Each variant is tied to a content asset and delivered via CloudFront.

CREATE TABLE IF NOT EXISTS zonga_media_variants (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    content_asset_id UUID        NOT NULL,
    provider        TEXT         NOT NULL DEFAULT 'aws_cloudfront',
    storage_key     TEXT         NOT NULL,
    delivery_url_ref TEXT        NULL,
    quality_tier    TEXT         NOT NULL
                                 CHECK (quality_tier IN ('free', 'standard', 'high', 'premium')),
    bitrate         INTEGER      NULL,
    codec           TEXT         NULL,
    format          TEXT         NULL,
    duration_seconds NUMERIC     NULL,
    status          TEXT         NOT NULL DEFAULT 'processing'
                                 CHECK (status IN ('processing', 'ready', 'failed', 'deleted')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonga_media_variants_asset   ON zonga_media_variants (content_asset_id);
CREATE INDEX IF NOT EXISTS idx_zonga_media_variants_quality ON zonga_media_variants (quality_tier);
CREATE INDEX IF NOT EXISTS idx_zonga_media_variants_status  ON zonga_media_variants (status);

-- ── Stream Events (append-only audit log) ───────────────────────────────────
-- All streaming/media actions emit events here for governance and telemetry.
-- This is an append-only table — no updates or deletes.

CREATE TABLE IF NOT EXISTS zonga_stream_events (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID         NOT NULL,
    live_stream_id  UUID         NULL REFERENCES zonga_live_streams(id) ON DELETE SET NULL,
    event_type      TEXT         NOT NULL,
    payload_json    JSONB        NOT NULL DEFAULT '{}',
    trace_id        TEXT         NULL,
    actor_id        UUID         NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonga_stream_events_org     ON zonga_stream_events (org_id);
CREATE INDEX IF NOT EXISTS idx_zonga_stream_events_stream  ON zonga_stream_events (live_stream_id);
CREATE INDEX IF NOT EXISTS idx_zonga_stream_events_type    ON zonga_stream_events (event_type);
CREATE INDEX IF NOT EXISTS idx_zonga_stream_events_created ON zonga_stream_events (created_at);

COMMIT;
