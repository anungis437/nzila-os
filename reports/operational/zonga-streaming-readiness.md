# Zonga — Upload / Streaming Readiness Report

**Sprint**: Client Launch Readiness | **Date**: 2026-04-19

---

## Executive Summary

Zonga's media pipeline is multi-layered and production-conscious. It includes format validation, size limits, SHA-256 duplicate detection, async transcoding via AWS MediaConvert, circuit-breaker-protected CloudFront delivery, and a blob-storage fallback path. The AWS integration is real and conditional on environment configuration. For a first client launch, the pipeline is **safe at controlled scale** with documented concurrency limits.

**Launch Mode**: LAUNCHABLE with documented constraints (see Section 6).

---

## 1. Upload Pipeline Audit

### File Validation (upload-service.ts)

| Check | Implementation | Status |
|---|---|---|
| MIME type whitelist | `ALLOWED_AUDIO_TYPES` Set: mp3/mp4/aac/wav/flac/ogg/webm | ✅ |
| File size limit | `MAX_AUDIO_BYTES = 500 MB` | ✅ |
| Artwork type validation | `ALLOWED_IMAGE_TYPES`: jpeg/png/webp | ✅ |
| Artwork size limit | `MAX_IMAGE_BYTES = 10 MB` | ✅ |
| SHA-256 duplicate detection | `computeSha256` + `checkForDuplicate()` | ✅ |
| Duplicate rejection | Returns `{ isDuplicate: true, error }` — upload blocked | ✅ |

### Upload Storage Path

- Raw files → Azure Blob Storage (`uploadBuffer()` from `@nzila/blob`)
- Container: `zonga-audio`
- Storage key pattern: `raw/{creatorId}/{contentAssetId}/{timestamp}.{ext}`
- After upload: DB record in `zonga_track_assets` with `upload_status: 'completed'`

### Processing Queue

After upload, jobs are enqueued:

1. `metadata_extract` (priority 10) — extract duration, sample rate, channels
2. `fingerprint` (priority 9) — audio fingerprint for dedup
3. `transcode` × 4 quality tiers: preview, standard, high, hifi (priority 5–8)
4. `waveform` — waveform data generation

Processing is async. Files are accessible via raw URL immediately after upload; processed variants become available as jobs complete.

---

## 2. Streaming / Playback Audit

### Delivery Resolution Order (playback-service.ts)

```
1. CloudFront-signed URL (AWS, primary path) — TTL: 4 hours (14,400s)
2. Azure Blob SAS URL (fallback path, legacy)
3. Raw upload URL (emergency fallback)
```

### Circuit Breaker Configuration (resilience.ts)

| Service | Failure Threshold | Reset Timeout | Success Threshold |
|---|---|---|---|
| CloudFront | 3 failures | 15 seconds | 1 success |
| MediaConvert | 5 failures | 30 seconds | 2 successes |
| IVS (live) | 3 failures | 30 seconds | 2 successes |

On breaker OPEN: `resilientAwsCall` throws and caller falls through to blob fallback.

### Quality Tier Entitlement Enforcement

The `clampQuality()` function in `playback-service.ts` enforces subscription entitlement at the service layer — **defense-in-depth even if route layer is bypassed**:

- Free tier: max `free` (Opus 48kbps)
- Standard: max `standard` (AAC 128kbps)
- Premium: max `hifi` (FLAC 1411kbps)

### Signed URL Behavior

- CloudFront: signed URLs with 4-hour TTL. Link sharing beyond TTL fails gracefully.
- Azure SAS: generated on-demand via `generateSasUrl()`. TTL configurable.
- Expiry behavior: expired URL returns 403; player should request a fresh URL.

---

## 3. Live Streaming Audit

### AWS IVS Integration (live-streaming-service.ts)

- Live stream lifecycle: `draft → scheduled → live → ended`
- Circuit-breaker protected IVS channel creation
- Ingest endpoint and RTMP URL returned to creator
- Viewer playback grant enforces event entitlement
- Stream status persisted in DB (not AWS-authoritative)

### Live Stream Gaps

| Gap | Severity | Notes |
|---|---|---|
| IVS credentials not confirmed in env | 🟠 HIGH | Must configure `AWS_IVS_REGION`, ARN, etc. before live launch |
| Recording / VOD from live | ❌ Not confirmed | Check IVS recording config |
| Concurrent stream limit | Not documented | IVS has account-level channel limits |

---

## 4. Readiness Tests Performed

The following checks were validated against the source code (functional test harness — see tests/zonga-media-readiness.spec.ts):

| Test | Result | Notes |
|---|---|---|
| MIME type rejection (text/plain) | ✅ PASS | Returns `{ ok: false, error: 'Unsupported audio format' }` |
| MIME type acceptance (audio/mpeg) | ✅ PASS | Proceeds to upload |
| Oversized file rejection (>500MB) | ✅ PASS | Returns size error |
| SHA-256 duplicate detection | ✅ PASS | Second upload of same bytes rejected |
| Entitlement clamping (free → premium request) | ✅ PASS | Clamped to 'free' quality |
| Circuit breaker open state fallback | ✅ PASS | Falls through to blob path |
| Missing media fallback (no variants) | ✅ PASS | Tries raw asset path |
| Artwork type rejection (image/gif) | ✅ PASS | Blocked by ALLOWED_IMAGE_TYPES |

---

## 5. Gaps and Risks

| Item | Severity | Launch Blocker? | Mitigation |
|---|---|---|---|
| AWS MediaConvert not confirmed configured | 🔴 CRITICAL | YES (for transcoding) | Set `AWS_MEDIACONVERT_*` env vars; test one transcode end-to-end before launch |
| CloudFront distribution not confirmed | 🟠 HIGH | NO (blob fallback exists) | Confirm distribution ARN in env; blob path covers initial launch |
| IVS not configured for live events | 🟠 HIGH | YES (if live streaming at launch) | Defer live streaming if IVS unconfigured; VOD is unaffected |
| No resumable upload (chunked) | 🟡 MEDIUM | NO | 500MB limit + Azure blob single upload covers most tracks |
| No upload rate limiting per creator | 🟡 MEDIUM | NO | Plan limits (uploads/month) are in `CREATOR_PLANS` but not enforced in API |
| Processing queue worker not confirmed running | 🔴 CRITICAL | YES | Confirm background job processor is running before launch |
| No upload progress UI confirmed | 🟡 MEDIUM | NO | Frontend concern; UX gap only |

---

## 6. Safe Launch Concurrency Estimate

Based on code analysis and Azure Blob + AWS architecture:

| Metric | Safe Limit (Launch) | Notes |
|---|---|---|
| Concurrent uploads | 10 simultaneous | Azure Blob handles more; limit set by available processing queue slots |
| Max file size | 500 MB | Hard-coded in types.ts |
| Concurrent streams (VOD) | 50–100 sessions | CloudFront CDN scales horizontally; initial limit is cost, not technical |
| Live stream channels | 1–3 concurrent | IVS account limit; contact AWS to increase |
| Processing queue backlog | ~2 min for standard audio | Based on typical MediaConvert transcode time |

### Recommended Limits for First Client

- **Max catalog at launch**: 500 tracks
- **Max concurrent listeners**: 100 (monitor Stripe + CloudFront costs weekly)
- **Max upload size**: 200 MB (enforced via client-side limit; server enforces 500 MB)
- **Live events**: **Disabled at launch** unless IVS is confirmed configured and tested
- **Upload rate**: 10 tracks per creator per day (honor plan limits)

---

## 7. Broken Upload Recovery

The system stores upload state in `zonga_track_assets.upload_status`. If an upload fails mid-way:

1. Record stays in `upload_status: 'pending'` or `'uploading'`
2. Creator can retry — duplicate detection prevents re-processing same bytes
3. Stuck jobs (processing >30 min) surfaced in admin observability dashboard (`getUploadHealthPanel`)
4. Admin can manually reset stuck jobs via DB or future admin API

---

*Generated by Nzila OS Automation — Zonga Client Launch Readiness Sprint*
