# Decision Pipeline — Operations Guide

## Architecture

The decision pipeline turns raw audit events into analytics-ready aggregates that power the Executive OS dashboards.

```
audit_decision_records  ──▶  materialize-decision-aggregates  ──▶  decision_aggregates
                                          │
                                          ▼
                               decision_pipeline_runs
                               decision_pipeline_checkpoints
                                          │
                                          ▼
                               GET /api/intelligence/pipeline-health
                                          │
                                          ▼
                                 Console › PipelineHealthCard
```

## Freshness SLA

Freshness measures the lag between the newest audit record and the newest aggregate window end.

| Status      | Condition                                               |
|-------------|---------------------------------------------------------|
| `healthy`   | lag < 1 hour                                            |
| `warning`   | 1 hour ≤ lag < 2 hours                                  |
| `breached`  | lag ≥ 2 hours                                           |

Constants exported from `@nzila/decision-intelligence/freshness`:

| Constant                        | Value       |
|---------------------------------|-------------|
| `FRESHNESS_WARNING_THRESHOLD_MS` | 3 600 000 ms (1 hr) |
| `FRESHNESS_BREACH_THRESHOLD_MS`  | 7 200 000 ms (2 hr) |

## Materialization Modes

| Mode           | Behaviour                                                                         |
|----------------|-----------------------------------------------------------------------------------|
| `incremental`  | Processes only records created since the last successful run checkpoint.          |
| `full_rebuild` | Drops and rebuilds all aggregates from scratch. Use after schema migrations.      |
| `org_specific` | Processes a single organisation. Requires `--org=<orgId>`.                        |
| `dry_run`      | Validates pipeline logic and connectivity without writing any data.               |

## CI Schedule

File: `.github/workflows/platform-automation.yml`

| Trigger               | Schedule      | Job                                 |
|-----------------------|---------------|-------------------------------------|
| Hourly aggregates     | `0 * * * *`   | `materialize-decision-aggregates`   |
| Daily FinOps          | `0 6 * * *`   | `finops-report` (+ other daily jobs)|

The hourly job runs `--mode=incremental`. Both triggers share the same workflow file and are differentiated by `github.event.schedule`.

## Manual Execution

### Root workspace scripts

```bash
# Incremental run (default)
pnpm aggregates:materialize

# Full rebuild
pnpm --filter @nzila/control-plane job:aggregate-full

# Dry run (validates without writing)
pnpm --filter @nzila/control-plane job:aggregate-dry-run

# Pipeline health check (alias for dry run)
pnpm intelligence:pipeline-health
```

### Control-plane package scripts

```bash
pnpm --filter @nzila/control-plane job:materialize-aggregates          # default
pnpm --filter @nzila/control-plane job:aggregate-incremental            # incremental
pnpm --filter @nzila/control-plane job:aggregate-full                   # full rebuild
pnpm --filter @nzila/control-plane job:aggregate-dry-run                # dry run
```

You can also pass flags directly:

```bash
pnpm --filter @nzila/control-plane job:materialize-aggregates -- --mode=org_specific --org=<orgId>
```

## Health Check Endpoint

```
GET /api/intelligence/pipeline-health
```

**App**: `apps/control-plane` (default port 3010)

**Response shape**:

```json
{
  "status": "healthy" | "warning" | "breached" | "unknown",
  "lagMs": 1234567,
  "lastRunAt": "2026-06-01T05:00:00.000Z",
  "latestAuditRecordAt": "2026-06-01T06:00:00.000Z",
  "latestAggregateWindowEnd": "2026-06-01T05:00:00.000Z"
}
```

Returns HTTP 200 for `healthy`/`warning`, HTTP 503 for `breached`/`unknown`.

## Console Dashboard

Navigation: **Intelligence** → data-sources section → **Pipeline Health** card

Component: `apps/console/src/components/intelligence/PipelineHealthCard.tsx`

The card polls `GET /api/intelligence/pipeline-health` and renders a colour-coded status badge with the lag duration and last-run timestamp.

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/decision-intelligence/src/freshness.ts` | Freshness SLA utilities |
| `apps/control-plane/jobs/materialize-decision-aggregates.ts` | Materialisation job |
| `apps/control-plane/app/api/intelligence/pipeline-health/route.ts` | Health API route |
| `apps/console/src/components/intelligence/PipelineHealthCard.tsx` | Console UI card |
| `.github/workflows/platform-automation.yml` | CI schedules |
| `packages/db/src/schema/decision-pipeline-checkpoints.ts` | Checkpoint schema |
| `packages/db/src/schema/decision-pipeline-runs.ts` | Run history schema |
