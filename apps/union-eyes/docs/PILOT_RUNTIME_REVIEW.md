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

## Week 1 review — 2026-05-17 (opening baseline — updated)

*Captured progressively during Phase B execution. Active revision updated as Phase B drills completed.*

| Metric | Value | Notes |
|---|---|---|
| Active revision | `--0000062` | Evidence blob store, HTTP autoscaling (KEDA concurrency 10), Upstash + storage secrets wired |
| Image | `SHA 3c43cf116...` | metrics-500 fix, Phase B infra updates |
| Replicas | 2 active | min 2, max 6 |
| Health status | `degraded` | DB ok (133ms), auth ok, redis ok (70ms), Django unreachable |
| Redis | live ✅ | Upstash `cuddly-mudfish-102231.upstash.io` wired on `--0000049`; `ms:70` on `--0000062` |
| `NZILA_MODE` | `production` ✅ | was `prod` (invalid enum); fixed `2026-05-17T19:35Z` — confirmed in health `"environment":"production"` |
| `SECRET_TOPOLOGY` | `aca-secrets-kv-pending` ✅ | lineage var set; KV RBAC unblocked `2026-05-17T20:45Z` — migration pending |
| Evidence blob store | `nzilacanadaprodev` ✅ | GRS, deny-all network, `union-eyes-evidence` container; wired on `--0000062` |
| HTTP autoscaling | KEDA HTTP concurrency=10 ✅ | active on `--0000062`, min 2 / max 6 |
| Custom domain + HSTS | `app.unioneyes.app` ✅ | validated (managed cert, SniEnabled, 2-year HSTS+preload) |
| AFD + WAF | `nzila-ue-afd-prod` + `nzilauewafdprod` ✅ | provisioned + security policy linked; DNS routing through AFD pending registrar action |
| HTTP 500s | 0 active | `/api/metrics/operational` — 500→401 fix deployed earlier this window |
| Alert rules | 3 validated | 503-sustained, high-error-rate, governance-events-zero |
| LAW log routing | confirmed active | 1800+ events/hr ingesting |
| Deployments | ~62 revisions | CI/CD auto-deploys each push; all health-gated |
| Rollback drill | ✅ validated | `2026-05-17T18:45:00Z`, 23s duration, smoke passed |
| PITR restore drill | ✅ validated | `2026-05-17T18:52:09Z`, 4 min to Ready |
| Incident drill (B4C) | ✅ validated | failed-deploy fast-fail `2026-05-17T19:18:22Z`, 82s, zero prod impact |
| B8 full suite | ✅ all green | typecheck, lint, 7075 UE tests, 8962 contract tests, governance 54/54 |
| Unresolved critical risks | 1 | Django backend unreachable (non-critical dep); custom domain/WAF provisioned (DNS routing pending registrar action) |

### Boot warnings resolved in this window

| Warning | Resolution |
|---|---|
| `NZILA_MODE=prod is invalid` | Fixed: ACA env var changed to `production`; bicep updated |
| `SECRET_TOPOLOGY missing` | Fixed: set to `aca-secrets-kv-migration-pending` |
| `SECRET_AUTHORITY missing` | Fixed: set to `nzila-canada-prod-kv` |
| `ENVIRONMENT_ISOLATION missing` | Fixed: set to `full` |

### Active amber items at week 1 close

| Item | Disposition |
|---|---|
| Django backend 503 (`auth_core/health/`) | Non-critical dep; unapplied migrations suspected — investigation deferred |
| No prod blob storage | Evidence is DB-only; blob story deferred |
| Key Vault RBAC migration | Blocked — `appid=04b07795` lacks `Key Vault Secrets Officer` |
| No custom domain / WAF / HSTS | Deferred; ACA FQDN only |
| Alert fire drill | Deferred — maintenance window required |
| Governance authenticated drill (B3B) | Deferred — authenticated session required |

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
