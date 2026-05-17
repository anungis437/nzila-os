# UnionEyes — Pilot Runtime Review (B6)

Status: **OPEN** — observation window formally opened `2026-05-17T18:34:00Z`.

## Window definition

- **Start**: `2026-05-17T18:34:00Z`
- **End**: `<to be set — target 2026-06-14T00:00:00Z (4 weeks)>`
- Duration target: 1–4 weeks of controlled use against
  `nzila-os-union-eyes-prod`.
- Opened by: Copilot automated Phase B pass.
- Opening context: metrics 500 fix deployed (PR commit `3c43cf116`),
  LAW log routing confirmed active, 3 KQL alert rules configured.

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

## Week 1 review — 2026-05-17 (opening baseline)

*Captured at window open, not a full 7-day observation.*

| Metric | Value | Notes |
|---|---|---|
| Active revision | `--0000041` | SHA `4697daeee` → `3c43cf116` deploy in progress |
| Replicas | 2 active | min 2, max 6 |
| Health status | `degraded` | DB ok (163ms), auth ok, Redis optional, Django unreachable |
| HTTP 500s | 1 fixed | `/api/metrics/operational` — 500→401 fix deployed this window |
| Alert rules | 3 configured | 503-sustained, high-error-rate, governance-events-zero |
| LAW log routing | confirmed active | ACA environment `log-analytics` destination verified |
| Deployments | 1 in-progress | `GitOps Deploy` run `25999144816` |
| Rollbacks | 0 | rollback drill deferred (awaiting 2nd revision) |
| Unresolved critical risks | 2 | Django backend unreachable (non-critical dep); no custom domain/WAF |

## Exit criteria

The window is complete when:

1. ≥ 1 week of contiguous runtime data has been captured.
2. All Phase B "deferred" sub-phases have been executed and captured.
3. The `/api/metrics/operational` 500 is resolved. ✅ **DONE** — deployed `2026-05-17`.
4. At least one real rollback and one real restore rehearsal have
   completed successfully.
5. No unresolved critical operational risks remain.

Only after all five may the readiness label move beyond
**CONTROLLED PILOT READY**.
