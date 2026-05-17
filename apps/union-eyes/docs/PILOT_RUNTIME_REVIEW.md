# UnionEyes — Pilot Runtime Review (B6)

Status: **not started** — observation window has not yet been
formally opened. This document is the template that will be populated
across the controlled pilot.

## Window definition

- Start: <to be set when pilot opens>
- End: <to be set>
- Duration target: 1–4 weeks of controlled use against
  `nzila-os-union-eyes-prod`.

## Metrics to track (per week)

| Metric | Source | Target / threshold |
|---|---|---|
| Uptime | LAW availability query against `/api/health` | ≥ 99.5 % |
| HTTP 5xx rate | LAW request logs | < 0.5 % |
| Health endpoint `status:"degraded"` minutes | LAW | report as raw count |
| Governance events written | LAW + DB query | non-zero per active day |
| Evidence exports completed | DB query / app logs | non-zero per active day |
| Auth failures (non-credential) | App logs / Sentry | trend only |
| p50 / p95 / p99 latency on `/api/health` | LAW | p95 < 500 ms |
| Deployment count | ACA revision list | report |
| Rollback count | ACA revision list | report |
| Telemetry anomalies | Sentry / LAW alerts | report |
| Unresolved operational risks | this doc | must be zero before PRODUCTION READY |

## Review cadence

- Weekly: append a dated section to this doc with the metrics above.
- End of window: write a final operational readiness verdict and
  update `FINAL_READINESS_STATUS.md` accordingly.

## Exit criteria

The window is complete when:

1. ≥ 1 week of contiguous runtime data has been captured.
2. All Phase B "deferred" sub-phases have been executed and captured.
3. The `/api/metrics/operational` 500 is resolved.
4. At least one real rollback and one real restore rehearsal have
   completed successfully.
5. No unresolved critical operational risks remain.

Only after all five may the readiness label move beyond
**CONTROLLED PILOT READY**.
