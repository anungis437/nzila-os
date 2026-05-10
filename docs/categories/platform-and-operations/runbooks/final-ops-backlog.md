# Final Operations Backlog — Nzila OS Post-9.96 Ops Pass

> Created: 2026-04-22 | Owner: Platform Engineering  
> Scope: Production readiness items following the 9.96/10 snapshot session.

---

## Closed Items ✅

### INFRA-01 — Control-plane 500 (node:crypto edge runtime)

- **Root cause**: `node:crypto` imported by auth middleware ran in Edge runtime, not Node.js.
- **Fix**: Added `export const runtime = 'nodejs'` to the affected API route.
- **Status**: Resolved. Control-plane returns 200.

### INFRA-02 — Platform-admin orchestrator 404

- **Root cause**: Health dependency probe used bare `/health` path; control-plane serves at `/api/health`.
- **Fix**: Patched `apps/platform-admin/app/api/health/dependencies/route.ts` (path corrected, queues/metrics marked `optional`).
- **Status**: Resolved and deployed to `nzila-os-platform-admin` revision `0000005`.

### INFRA-03 — Console blob=false

- **Root cause**: `AZURE_STORAGE_ACCOUNT_KEY` on Container App `nzila-os-console` was stale (key rotated after provisioning).
- **Fix**: Updated key via `az containerapp update --set-env-vars`.
- **Status**: Resolved. Blob health returns `true`.

### DNS-01 — Production domain routing

- **Domains confirmed healthy** (2026-04-22 probe):

  - `nzilaventures.com` → 200 / TLS valid
  - `console.nzilaventures.com` → 200 / TLS valid
  - `partners.nzilaventures.com` → 200 / TLS valid
  - `unioneyes.app` → 200 / TLS valid

- **Status**: All operational.

### SEC-01 — X-Robots-Tag: noindex for internal apps

- **Problem**: Console, platform-admin, partners, control-plane were indexable by search engines.
- **Fix**: Added `X-Robots-Tag: noindex, nofollow, noarchive` to `securityHeaders` in each app's `next.config.ts`.
- **Status**: Fixed (deploy needed to take effect in production).

### OPS-01 — Status page URL construction bug

- **Problem**: `apps/web/app/status/page.tsx` used incorrect ACA domain substitution (`replace('jollydune', 'nzila-os-web-jollydune')`) — resulted in invalid probe URLs.
- **Fix**: Rewrote to use `https://<appname>.<envDomain>/api/health` pattern with `STATUS_ACA_ENV_DOMAIN` env var.
- **Status**: Fixed.

### OPS-02 — Ops snapshot populated with real telemetry

- **Metrics updated** (`reports/ops/snapshot.json`, `reports/ops/snapshot.md`):

  - `build_success_rate_30d`: 81.5% (163/200 runs, GitHub Actions)
  - `deploy_frequency_30d`: 10 successful deploys in 30d
  - `incidents_last_30d`: 0 (no incident-labeled GitHub issues)
  - `change_failure_rate_30d`: 0%

- **Status**: Complete.

### BUG-01 — Partners portal Drizzle `.rows` pattern

- **Problem**: `db.execute()` result accessed as `.rows[0]` (wrong). `db.execute()` returns rows directly as array.
- **Fix**: Patched `apps/partners/app/portal/page.tsx`.
- **Status**: Fixed.

---

## Open Items / Future Work 🔄

### OPS-03 — Azure Monitor SLO export

- Connect Azure Monitor uptime alerts to `ops/outputs/uptime.json` for automated uptime tracking.
- **Priority**: Medium
- **Owner**: Platform Engineering

### OPS-04 — Application Insights latency rollup

- Export p50/p95 route latency from Application Insights to `ops/outputs/latency.json`.
- **Priority**: Medium

### OPS-05 — CI workflow all-failing investigation

- All `CI` workflow runs are failing. Pre-existing issue, not introduced in this ops pass.
- **Next action**: Investigate root cause (test failures, env issues, or workflow config).
- **Priority**: High

### SEC-02 — Rotate stale CLERK_* env vars on Container Apps

- Old Clerk env vars still present on ACA deployments (unused but cluttered).
- **Next action**: `az containerapp update --remove-env-vars CLERK_*` per app.
- **Priority**: Low (cosmetic, no security risk — Clerk is not wired in code)

### COST-01 — Azure monthly cost baseline

- `monthly_infra_cost_estimate` is null in ops snapshot. Run cost collection pass.
- **Next action**: `az consumption usage list` + update `ops/outputs/cost-allocation.json`.
- **Priority**: Low

### DNS-02 — Set STATUS_ACA_ENV_DOMAIN env var on nzila-os-web

- Status page `STATUS_ACA_ENV_DOMAIN` defaults to the correct value in code, but should be set explicitly on the Container App for env-independence.
- **Next action**: `az containerapp update -n nzila-os-web --set-env-vars "STATUS_ACA_ENV_DOMAIN=jollydune-88c1e97f.canadacentral.azurecontainerapps.io"`
- **Priority**: Low

### INFRA-04 — Deploy platform-admin (optional deps fix)

- Platform-admin code change (orchestrator path fix, queues/metrics optional) needs Docker build + push + `az containerapp update`.
- **Status**: Completed 2026-04-22 (`platform-admin-1636e98e-20260422172320:latest`, revision `0000005`).
- **Priority**: Done

---

## Deployment Checklist (April 2026 Ops Pass)

| App | Change | Built | Pushed | ACA Updated |
|---|---|---|---|---|
| nzila-os-console | Blob key fix (infra only) | — | — | ✅ |
| nzila-os-platform-admin | Dependency health fix | ✅ | ✅ | ✅ |
| nzila-os-web | Status page URL fix + noindex | pending | pending | pending |
| nzila-os-console | noindex header | pending | pending | pending |
| nzila-os-partners | noindex header + Drizzle fix | pending | pending | pending |
| nzila-os-control-plane | noindex header | pending | pending | pending |

---

## Environment Variable Audit (Staging)

| Variable | App | Status |
|---|---|---|
| `AZURE_STORAGE_ACCOUNT_KEY` | nzila-os-console | ✅ Updated 2026-04-22 |
| `STATUS_ACA_ENV_DOMAIN` | nzila-os-web | ⚠️ Not set (default works) |
| `CLERK_*` | All ACAs | ⚠️ Stale (unused, OK to purge) |
| `ORCHESTRATOR_API_URL` | nzila-os-platform-admin | ✅ Points to control-plane |
