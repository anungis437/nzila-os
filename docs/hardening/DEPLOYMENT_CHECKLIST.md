# Zonga — Deployment Checklist

Pre-deployment verification for the Zonga platform after hardening.

## Pre-Deployment

### Code Quality
- [ ] All TypeScript compiles: `pnpm turbo build --filter=zonga`
- [ ] Lint passes with zero warnings: `pnpm turbo lint --filter=zonga`
- [ ] All tests pass: `pnpm turbo test --filter=zonga`
  - 84 guard unit tests (E1-E6, R1-R5, T1-T6, G1-G5)
  - 20 structural hardening tests
  - 153 workflow invariant tests
  - Existing workflow transition tests

### Security
- [ ] Snyk scan: `snyk test --all-projects --severity-threshold=high`
- [ ] Trivy Dockerfile scan: passes with zero CRITICAL
- [ ] Dependency audit: `node tooling/security/supply-chain-policy.ts check-vulns`
- [ ] No secrets in source code (Secret Scan workflow green)
- [ ] SBOM generated and current

### Database
- [ ] All referenced tables exist: `audit_log`, `payouts`, `tickets`, `releases`,
      `events`, `revenue_events`, `rights_disputes`, `royalty_splits`,
      `moderation_cases`
- [ ] `audit_log` table has required columns: `id`, `org_id`, `action`,
      `entity_type`, `entity_id`, `actor_id`, `metadata`, `created_at`
- [ ] Indexes on `audit_log(action)`, `audit_log(org_id)`, `audit_log(created_at)`

### Environment Variables
- [ ] `DATABASE_URL` — PostgreSQL connection string
- [ ] `STRIPE_SECRET_KEY` — Stripe API key
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- [ ] `CLERK_SECRET_KEY` — Clerk secret key
- [ ] `AZURE_STORAGE_ACCOUNT_NAME` — Blob storage account
- [ ] `AZURE_STORAGE_ACCOUNT_KEY` — Blob storage key

## Deployment

### Docker Build
- [ ] `docker build -t nzila/zonga .` succeeds
- [ ] Image size within expected bounds
- [ ] Health check endpoint responds: `GET /api/health`

### Container App Update
```bash
az containerapp update \
  --name nzila-os-web \
  --resource-group nzila-canada-staging-rg \
  --image nzilacanadaacr.azurecr.io/nzila/web:latest \
  --set-env-vars <ALL env vars>
```

### Post-Deployment Verification
- [ ] Health check: `curl https://<app-url>/api/health` returns 200
- [ ] Smoke test: Create release (DRAFT), transition to SUBMITTED
- [ ] Verify audit_log entries appear for smoke test operations
- [ ] Check observability metrics flowing
- [ ] Confirm no `%.compensated` audit entries (clean deployment)

## Rollback Plan

1. Revert to previous image tag: `az containerapp update --image <previous-tag>`
2. Verify health check returns 200
3. Check audit_log for any compensation events during bad deployment
4. Investigate root cause before re-deploying
