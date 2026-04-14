# Zonga AWS Streaming Architecture

> Technical reference for the AWS-backed streaming infrastructure powering live and on-demand audio/video on Zonga.

---

## Overview

Zonga uses two distinct streaming paths, both backed by AWS services:

| Path | Use Case | AWS Services |
|------|----------|-------------|
| **Live Streaming** | Real-time concerts, listening parties, DJ sets | AWS IVS (Interactive Video Service) |
| **VOD / Audio Delivery** | On-demand music, podcasts, recorded sets | S3 → MediaConvert → CloudFront |

Both paths share a common PostgreSQL schema (5 tables) and are exposed through the `@nzila/zonga-streaming-aws` platform package.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        LIVE PATH                                │
│                                                                 │
│  Creator (OBS)                                                  │
│       │  RTMPS                                                  │
│       ▼                                                         │
│  ┌──────────┐    channel/key     ┌──────────────────┐           │
│  │  AWS IVS  │◄─── provisioned ──│  live-streaming   │           │
│  │  Channel  │     by API        │  -service.ts      │           │
│  └────┬─────┘                    └────────┬─────────┘           │
│       │  HLS                              │                     │
│       ▼                                   │ DB writes           │
│  ┌──────────┐                    ┌────────▼─────────┐           │
│  │ Viewer    │◄── signed URL ────│ zonga_live_streams│           │
│  │ (browser) │   (entitlement    │ zonga_stream_creds│           │
│  └──────────┘    gated)          │ zonga_stream_evts │           │
│                                  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        VOD PATH                                 │
│                                                                 │
│  Upload (blob)                                                  │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐  presigned PUT  ┌──────────────────┐              │
│  │  S3 Raw   │◄───────────────│  media-job        │              │
│  │  Bucket   │                │  -service.ts      │              │
│  └────┬─────┘                 └────────┬─────────┘              │
│       │                                │ submit job             │
│       ▼                                ▼                        │
│  ┌──────────────┐           ┌──────────────────┐                │
│  │ MediaConvert  │           │ zonga_media_jobs  │                │
│  │ (transcode)   │──done──▶ │ zonga_media_vars  │                │
│  └──────┬───────┘           └──────────────────┘                │
│         │  HLS + MP3/AAC                                        │
│         ▼                                                       │
│  ┌──────────┐                                                   │
│  │  S3 Out   │                                                  │
│  │  Bucket   │                                                  │
│  └────┬─────┘                                                   │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────┐    signed URL    ┌──────────────┐             │
│  │  CloudFront   │────────────────▶│  Listener     │             │
│  │  Distribution │   (plan-gated)  │  (browser)    │             │
│  └──────────────┘                  └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

Five tables added by migration `0002_zonga_streaming_infrastructure.sql`:

### `zonga_live_streams`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| org_id | UUID NOT NULL | Org scope |
| event_id | UUID | FK to zonga_events |
| creator_id | UUID NOT NULL | Owning creator |
| provider | TEXT | `'aws_ivs'` |
| provider_channel_arn | TEXT | IVS channel ARN |
| playback_url | TEXT | HLS playback URL |
| ingest_endpoint | TEXT | RTMP ingest host |
| status | TEXT | scheduled / ready / live / ended / failed |
| scheduled_start / scheduled_end | TIMESTAMPTZ | Optional schedule window |
| started_at / ended_at | TIMESTAMPTZ | Actual timestamps |
| viewer_count_peak | INT | High watermark |
| metadata_json | JSONB | Flexible metadata |
| created_at / updated_at | TIMESTAMPTZ | Audit timestamps |

### `zonga_stream_credentials`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| stream_id | UUID FK | → live_streams ON DELETE CASCADE |
| provider_key_arn | TEXT | IVS stream key ARN |
| key_value_encrypted | TEXT | Encrypted stream key |
| is_active | BOOLEAN | Only one active per stream |
| rotated_at | TIMESTAMPTZ | Last rotation time |

### `zonga_media_jobs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| org_id | UUID NOT NULL | |
| asset_id | UUID NOT NULL | FK to content_assets |
| job_type | TEXT | transcode / thumbnail / waveform |
| provider | TEXT | `'aws_mediaconvert'` |
| provider_job_id | TEXT | MediaConvert job ID |
| status | TEXT | submitted / processing / completed / failed / cancelled |
| input_key / output_key_prefix | TEXT | S3 paths |
| submitted_at / completed_at | TIMESTAMPTZ | |
| error_summary | TEXT | Truncated error message |
| metadata_json | JSONB | |

### `zonga_media_variants`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| org_id | UUID NOT NULL | |
| asset_id | UUID NOT NULL | |
| job_id | UUID FK | → media_jobs |
| quality_tier | TEXT | preview / standard / high / hifi |
| format | TEXT | hls / mp3 / aac / flac |
| storage_provider | TEXT | `'aws_s3'` |
| storage_key | TEXT | S3 object key |
| cdn_provider | TEXT | `'aws_cloudfront'` |
| status | TEXT | available / processing / failed |
| file_size_bytes | BIGINT | |
| duration_ms | INT | |
| bitrate_kbps | INT | |

### `zonga_stream_events`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| org_id | UUID NOT NULL | |
| stream_id / job_id | UUID | One of the two populated |
| event_type | TEXT | 14 types (stream.created, job.submitted, playback.started, etc.) |
| actor_id | UUID | User who triggered |
| payload | JSONB | Event-specific data |
| created_at | TIMESTAMPTZ | |

---

## Package Structure

```
packages/zonga-streaming-aws/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts              # Barrel re-exports
    ├── types.ts              # Zod schemas, enums, config resolvers
    ├── ivs-live/
    │   ├── index.ts          # createLiveChannel, getLiveChannelInfo, rotateStreamKey, ...
    │   └── ivs-live.test.ts
    ├── s3-storage/
    │   ├── index.ts          # createPresignedUpload, uploadToS3, ...
    │   └── s3-storage.test.ts
    ├── mediaconvert/
    │   ├── index.ts          # submitTranscodeJob, getTranscodeJobStatus, cancelTranscodeJob
    │   └── mediaconvert.test.ts
    ├── cloudfront-delivery/
    │   ├── index.ts          # createSignedPlaybackUrl, createHlsPlaybackGrant, ...
    │   └── cloudfront-delivery.test.ts
    └── metrics/
        ├── index.ts          # computeStreamingMetrics (pure)
        └── metrics.test.ts
```

---

## Environment Variables

### AWS Core

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | Yes | IAM credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | IAM credentials |
| `AWS_SESSION_TOKEN` | No | For temporary credentials |

### IVS (Live Streaming)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ZONGA_IVS_LATENCY_MODE` | No | `LOW` | `LOW` or `NORMAL` |
| `ZONGA_IVS_CHANNEL_TYPE` | No | `STANDARD` | `STANDARD` or `BASIC` |

### S3 (Storage)

| Variable | Required | Description |
|----------|----------|-------------|
| `ZONGA_S3_RAW_BUCKET` | Yes | Bucket for raw uploads |
| `ZONGA_S3_OUTPUT_BUCKET` | Yes | Bucket for transcoded output |

### MediaConvert (Transcoding)

| Variable | Required | Description |
|----------|----------|-------------|
| `ZONGA_MEDIACONVERT_ENDPOINT` | Yes | Account-specific endpoint URL |
| `ZONGA_MEDIACONVERT_ROLE_ARN` | Yes | IAM role for MediaConvert |
| `ZONGA_MEDIACONVERT_OUTPUT_BUCKET` | No | Overrides `ZONGA_S3_OUTPUT_BUCKET` |
| `ZONGA_MEDIACONVERT_OUTPUT_PREFIX` | No | Key prefix (default: `transcoded/`) |

### CloudFront (Delivery)

| Variable | Required | Description |
|----------|----------|-------------|
| `ZONGA_CLOUDFRONT_DOMAIN` | Yes | Distribution domain (e.g. `d1234.cloudfront.net`) |
| `ZONGA_CLOUDFRONT_KEY_PAIR_ID` | Yes | CloudFront key pair for signing |
| `ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM` | Yes | PEM-encoded private key |
| `ZONGA_CLOUDFRONT_TTL_SEC` | No | Signed URL TTL (default: `3600`) |

---

## API Routes

### Live Streaming

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/live` | Create live stream for event |
| GET | `/api/live` | List streams (optional `?status=` CSV filter) |
| GET | `/api/live/[streamId]` | Real-time status from provider |
| PATCH | `/api/live/[streamId]` | Lifecycle transition (ready/live/end/fail) |
| DELETE | `/api/live/[streamId]` | End and clean up stream |
| GET | `/api/live/[streamId]/ingest` | Creator ingest details (RTMP URL) |
| POST | `/api/live/[streamId]/ingest` | Rotate stream key |
| GET | `/api/live/[streamId]/playback` | Viewer playback (entitlement-gated) |

### VOD Playback

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/stream/[assetId]` | Provider-aware playback URL resolution |

---

## Playback Resolution Order

The stream endpoint resolves playback URLs in priority order:

1. **CloudFront variant** — Checks `zonga_media_variants` for best available tier matching the listener's plan, generates a CloudFront signed URL with TTL
2. **Blob variant** — Falls back to processed audio stored in Azure Blob Storage (legacy path)
3. **Raw upload** — Returns the original uploaded file URL as last resort

If CloudFront resolution fails (missing config, no variants), the system silently falls through to the next tier.

---

## Control Plane Dashboard

The streaming dashboard is accessible at `/streaming` in the Control Plane app:

- **Summary cards**: Total streams, active now, media jobs, completed, failed, variants
- **Live Stream Table**: Real-time status of all live streams with status badges
- **Media Jobs Table**: Transcode job status, provider, timing
- **Stream Event Log**: Audit trail of all streaming events (color-coded by type)

---

## Security Considerations

- **Stream credentials**: Stored in `zonga_stream_credentials` with `key_value_encrypted` — stream key values should be encrypted at rest
- **Signed URLs**: CloudFront URLs are signed with RSA key pair; TTL defaults to 1 hour
- **Entitlement gating**: Viewer playback checks subscription plan before serving URL
- **Org scoping**: All tables have `org_id`; all queries filter by org context
- **RTMP ingest**: Uses RTMPS (TLS) on port 443
- **Key rotation**: Stream keys can be rotated via `/api/live/[streamId]/ingest` POST without interrupting the channel
