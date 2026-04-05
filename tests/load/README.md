# Load Testing

k6 load tests for validating Nzila OS at scale.

## Prerequisites

```bash
# Install k6
# macOS: brew install k6
# Windows: choco install k6
# Linux: https://k6.io/docs/get-started/installation/
```

## Profiles

| Profile     | Virtual Users | Duration | Simulates       |
| ----------- | ------------- | -------- | --------------- |
| `baseline`  | 100           | 5 min    | ~10K users      |
| `scale100k` | 500           | 10 min   | ~100K users     |
| `scale1m`   | 2,000         | 15 min   | ~1M users       |

## Running

```bash
# Baseline (smoke test)
k6 run --env PROFILE=baseline tests/load/smoke.js

# 100K scale test against staging
k6 run --env PROFILE=scale100k --env BASE_URL=https://staging.nzila.app tests/load/smoke.js

# 1M scale test (requires k6 Cloud or distributed execution)
k6 run --env PROFILE=scale1m --env AUTH_TOKEN=$TOKEN tests/load/smoke.js
```

## Thresholds

- **p95 latency** < 500ms (all endpoints)
- **p99 latency** < 1,500ms
- **Error rate** < 2%
- **Claims list** p95 < 400ms
- **Member search** p95 < 300ms (validates GIN index)
- **Dashboard** p95 < 600ms (validates materialized views)

## Output

```bash
# Export to JSON for CI/CD integration
k6 run --out json=results.json --env PROFILE=baseline tests/load/smoke.js
```
