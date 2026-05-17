# UnionEyes — Production Cutover Checklist

> Complete ALL items before routing live traffic to production.
> Do not use this as a "mostly done" guide — every gate must be closed.

## Pre-Cutover Infrastructure Gates

### Database
- [ ] Azure PostgreSQL Flexible Server created (Canada Central, HA zone-redundant)
- [ ] Connection string stored in Key Vault as `DATABASE_URL`
- [ ] TLS-only connections enforced
- [ ] Backup retention verified (7-day PITR)
- [ ] Migration `db:migrate` run successfully against prod DB
- [ ] Row-level security policies applied (run `db:apply-rls`)
- [ ] Spot-check: `GET /api/health` shows `db: { status: "ok" }` from prod URL

### Authentication (Clerk)
- [ ] Clerk production application created (`unioneyes-production`)
- [ ] Production domain allowlisted (`app.unioneyes.ca`)
- [ ] `CLERK_SECRET_KEY` stored in Key Vault
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set in Container App env
- [ ] Test login end-to-end with real Clerk production keys

### Blob Storage
- [ ] Azure Blob Storage account created (`unioneyesprodstorage` or similar)
- [ ] Container `union-eyes-evidence` created (private)
- [ ] SAS token generation working (tested via `/api/evidence/upload` staging-equivalent)
- [ ] Account key stored in Key Vault

### Redis
- [ ] Upstash Redis created (US-East region, closest to Canada Central)
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Key Vault
- [ ] Verified: metrics endpoint falls back gracefully if Redis is unreachable

### Observability
- [ ] Azure Application Insights created (`union-eyes-prod`)
- [ ] `OTEL_EXPORTER_OTLP_ENDPOINT` set in Key Vault
- [ ] Sentry project `union-eyes-production` created
- [ ] `SENTRY_DSN` set in Key Vault
- [ ] Test error fires and appears in Sentry production project

## Pre-Cutover Application Gates

### Build and Tests
- [ ] `pnpm --filter union-eyes lint` — zero errors
- [ ] `pnpm --filter union-eyes typecheck` — zero errors
- [ ] `pnpm --filter union-eyes test` — all unit tests pass
- [ ] `pnpm contract-tests` — INV-34 and org-scope tests pass
- [ ] `pnpm governance:check` — passes
- [ ] Docker image builds successfully against production Dockerfile
- [ ] Container starts without errors (check `docker logs`)

### Health Verification
- [ ] `GET /api/health` from production URL → `200 { status: "ok", dependencies: all ok }`
- [ ] `GET /api/metrics/operational` → `200` with valid org-scoped counters
- [ ] `GET /api/governance/telemetry` → `200` with valid governance data

### Org Isolation Smoke Test
- [ ] Create org A and org B via Clerk admin
- [ ] Create a case in org A
- [ ] Verify org B user cannot see org A case (expect 403/404)
- [ ] Verify evidence export is org-scoped

### Evidence Pipeline
- [ ] Upload a document as org A user
- [ ] Verify document appears in evidence timeline
- [ ] Export evidence bundle — verify correct org A documents only
- [ ] Verify export generates an audit event

### Auth/Session
- [ ] Login with valid credentials → redirected to dashboard
- [ ] Login with invalid credentials → error shown, no data exposed
- [ ] Session expiry → redirected to login, no data retained
- [ ] Org switching (if applicable) → correct org context loaded

## Deployment Dry Run

- [ ] Deploy production container to a blue/green preview slot
- [ ] Run smoke tests against preview slot
- [ ] Test rollback: reactivate previous revision, verify health probe
- [ ] Document rollback time (target < 3 minutes)

## DNS / SSL

- [ ] DNS record pointing `app.unioneyes.ca` to Container Apps ingress IP/CNAME
- [ ] SSL certificate issued and auto-renewal configured
- [ ] HTTPS redirect enforced (HTTP → HTTPS, 301)
- [ ] HSTS header present in response

## Final Human Sign-Off

| Sign-off | Name | Date |
|---|---|---|
| Release engineer | | |
| Security reviewer | | |
| Founder/executive | | |

> Only proceed to live traffic after all three sign-offs are recorded here.

## Post-Cutover Monitoring (First 30 minutes)

- [ ] Monitor Sentry for new errors
- [ ] Monitor Azure Monitor for p95 latency spikes
- [ ] Monitor health probe: `GET /api/health` (auto-monitored by Container Apps)
- [ ] Check Azure Log Analytics for unexpected 5xx rates
- [ ] Confirm at least one successful real user login end-to-end

## Rollback Trigger Criteria

Roll back immediately if:
- Health probe returns non-200 for > 2 consecutive checks
- Sentry error rate > 5% within first 15 minutes
- Any critical-severity alert fires in Azure Monitor
- Evidence export produces incorrect or empty data for valid cases

Rollback procedure: see `PRODUCTION_TOPOLOGY.md` — Rollback Procedure section.
