# Live Event Operator Runbook

> Step-by-step procedures for operating live streaming events on Zonga.

---

## Pre-Event Setup

### 1. Create the Live Stream

```bash
curl -X POST https://<zonga-host>/api/live \
  -H "Content-Type: application/json" \
  -H "Cookie: nzila_session=<session-token>" \
  -d '{
    "eventId": "<event-uuid>",
    "scheduledStart": "2026-06-15T19:00:00Z",
    "scheduledEnd": "2026-06-15T22:00:00Z",
    "metadata": { "title": "Afrobeats Live from Lagos" }
  }'
```

**Response** includes:
- `stream.id` — Stream UUID for all subsequent API calls
- `ingest.rtmpUrl` — Full RTMPS URL for OBS
- `ingest.streamKeyArn` — Reference to the active stream key

### 2. Configure OBS Studio

1. Open OBS → Settings → Stream
2. Service: **Custom**
3. Server: `rtmps://<ingest-endpoint>:443/app/`
4. Stream Key: Value from the `/api/live/[streamId]/ingest` GET response
5. Recommended output settings:
   - Encoder: x264 or NVENC
   - Rate Control: CBR
   - Bitrate: 3500 kbps (1080p) or 1500 kbps (720p)
   - Keyframe interval: 2 seconds
   - Audio bitrate: 160 kbps AAC

### 3. Verify Stream Ready

```bash
# Mark stream as ready (equipment tested, OBS configured)
curl -X PATCH https://<zonga-host>/api/live/<streamId> \
  -H "Content-Type: application/json" \
  -H "Cookie: nzila_session=<session-token>" \
  -d '{ "action": "ready" }'
```

Verify via Control Plane → Streaming dashboard: stream should show **Ready** badge.

---

## Going Live

### 1. Start Streaming from OBS

Click **Start Streaming** in OBS. The IVS channel detects the RTMP ingest automatically.

### 2. Mark Stream as Live

```bash
curl -X PATCH https://<zonga-host>/api/live/<streamId> \
  -H "Content-Type: application/json" \
  -H "Cookie: nzila_session=<session-token>" \
  -d '{ "action": "live" }'
```

### 3. Monitor

- **Control Plane** → Streaming: live viewer count, stream health, event log
- **AWS IVS Console**: Real-time metrics (ingest bitrate, frame rate, dropped frames)
- `GET /api/live/<streamId>` returns real-time status synced from IVS

---

## Ending the Stream

### Normal End

```bash
curl -X PATCH https://<zonga-host>/api/live/<streamId> \
  -H "Content-Type: application/json" \
  -H "Cookie: nzila_session=<session-token>" \
  -d '{ "action": "end" }'
```

This will:
1. Stop the IVS stream (if still broadcasting)
2. Record `ended_at` and final `viewer_count_peak`
3. Emit `stream.ended` audit event

### Emergency Stop

```bash
curl -X DELETE https://<zonga-host>/api/live/<streamId> \
  -H "Cookie: nzila_session=<session-token>"
```

Force-ends and cleans up the stream immediately.

---

## Credential Rotation

If a stream key is compromised or needs rotation mid-event:

```bash
curl -X POST https://<zonga-host>/api/live/<streamId>/ingest \
  -H "Cookie: nzila_session=<session-token>"
```

This:
1. Deactivates the current stream key in IVS
2. Creates a new stream key
3. Returns the new credentials
4. **Creator must update OBS stream key** and reconnect

---

## Viewer Playback

Viewers access the live stream via:

```bash
GET /api/live/<streamId>/playback
```

The endpoint:
- Checks the viewer's subscription tier (free vs. premium listener)
- Returns an HLS playback URL for authorized viewers
- Returns `425 Too Early` for scheduled-but-not-live streams
- Returns `404` for ended or nonexistent streams

---

## Troubleshooting

### Stream stuck in "scheduled" status

**Cause**: Creator hasn't started OBS, or RTMP ingest failed.

**Fix**:
1. Verify OBS settings (server URL, stream key)
2. Check IVS console for ingest errors
3. Try `GET /api/live/<streamId>` to sync status from IVS
4. If IVS shows `LIVE` but DB doesn't, manually `PATCH` with `{ "action": "live" }`

### Viewer gets 425 response

**Cause**: Stream not yet live.

**Fix**: Ensure the stream is in `live` status. Verify with `GET /api/live/<streamId>`.

### Stream key not working

**Cause**: Key was rotated or deactivated.

**Fix**: Call `GET /api/live/<streamId>/ingest` to get the current active key. If needed, rotate with `POST /api/live/<streamId>/ingest`.

### High latency (> 5 seconds)

**Checks**:
1. Verify `ZONGA_IVS_LATENCY_MODE` is set to `LOW` (not `NORMAL`)
2. Check OBS keyframe interval is 2 seconds
3. Check viewer network conditions
4. Review IVS CloudWatch metrics for encoder health

### Stream marked as "failed"

**Cause**: IVS detected a critical error (encoder disconnect, invalid input, resource limits).

**Recovery**:
1. Check stream event log in Control Plane for the `stream.failed` event payload
2. Fix the root cause (OBS config, network, etc.)
3. Create a **new** live stream — failed streams cannot be restarted
4. Share new ingest URL with the creator

---

## Monitoring Checklist

| Check | Where | Frequency |
|-------|-------|-----------|
| Stream status and health | Control Plane → Streaming | Continuous during event |
| Viewer count | `GET /api/live/<streamId>` | Every 30 seconds |
| IVS ingest metrics | AWS IVS Console → Monitoring | Continuous |
| Stream event log | Control Plane → Streaming → Event Log | After key actions |
| Error alerts | `zonga_stream_events` where type = `stream.failed` or `stream.error` | Continuous |

---

## Post-Event

1. Verify stream ended cleanly (status = `ended`, `ended_at` populated)
2. Review peak viewer count in DB or Control Plane
3. Check for any `stream.error` events in the audit log
4. If recording was enabled, verify the VOD asset was created in S3
5. Consider submitting a transcode job for the recording via the VOD pipeline
