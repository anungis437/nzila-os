# CUPE Pilot → Production Transition Guide

**Service**: Union Eyes (nzila-os-union-eyes)  
**Pilot launch date**: 2026-05-03  
**Document owner**: Platform Engineering  
**Status**: DRAFT — awaiting approver sign-off

---

## 1. Environment Summary

| Property | Pilot (Staging) | Production |
|----------|-----------------|------------|
| Azure Region | Canada Central | Canada Central |
| Resource Group | `nzila-canada-staging-rg` | `nzila-canada-prod-rg` |
| Container Apps Env | `nzila-canada-staging-env` | `nzila-canada-prod-env` |
| ACR | `nzilacanadaacr.azurecr.io` | TBD (shared or dedicated) |
| Database | `nzila-staging-db` (PostgreSQL Flexible, Canada Central) | Dedicated prod DB |
| Key Vault | `nzila-staging-kv` | Dedicated prod KV |
| Domain | `jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | Custom domain (TLS) |
| Data Residency | `canadacentral` | `canadacentral` |
| Compliance | PIPEDA / Québec Law 25 | PIPEDA / Québec Law 25 |

> **Compliance note**: `eastus` and `eastus2` are NOT approved for CUPE workloads. All production
> data must remain in `canadacentral` (Canada Central). The pilot already runs in the correct
> region — production must match.

---

## 2. Transition Options

### Option A — Clean Start (Recommended)

Provision a fresh production resource group, Container Apps environment, and PostgreSQL instance
in `canadacentral`. Run schema migrations on the blank database. Migrate member data from pilot
via a supervised export/import with a compliance officer present.

**Pros**: Clean production baseline; no staging artefacts in prod.  
**Cons**: Additional provisioning time; member data re-entry or migration job required.

### Option B — Selective Migration

Retain pilot Container Apps environment long-term. Add a separate `prod` Container App pointing at
a new database. Pilot and prod coexist in the same ACA environment under different Container App
names.

**Pros**: Fast; reuses existing infrastructure.  
**Cons**: Shared ACA environment — blast radius for infra incidents; harder to enforce prod-only
network policies.

### Option C — Pilot as Long-Lived Tenant (Not Recommended)

Rename/repurpose the staging environment as production.

**Cons**: Breaks staging availability; staging becomes permanently conflated with production; no
fallback environment for pre-prod testing. **Do not choose this option.**

---

## 3. Pre-Production Gates (All Must Pass)

| # | Gate | Command / Check | Owner |
|---|------|-----------------|-------|
| 1 | Region validation | `pnpm exec tsx scripts/validate-prod-region.ts` | Platform Eng |
| 2 | Production readiness dry-run | `pnpm exec tsx scripts/ue-prod-canadacentral-dry-run.ts` | Platform Eng |
| 3 | QA gate | `pnpm exec tsx scripts/ue-qa-gate.ts --target production` | QA |
| 4 | AI validation | `pnpm exec tsx scripts/ai-agent-runner.ts --phase=validate` | Platform Eng |
| 5 | NAR chain verify | `pnpm nar:chain:verify` | Compliance |
| 6 | SRE validation | `pnpm exec tsx scripts/sre/validate-health-contract.ts && pnpm exec tsx scripts/sre/synthetic-dry-run.ts && pnpm exec tsx scripts/sre/alert-routing-dry-run.ts && pnpm exec tsx scripts/sre/audit-reliability.ts && pnpm exec tsx scripts/sre/generate-executive-dashboard.ts` | SRE |

All six gates must exit `0` before any production deployment proceeds.

---

## 4. Required Approvals

| Role | Name | Status |
|------|------|--------|
| Platform Engineering Lead | TBD | PENDING |
| CUPE Pilot Representative | TBD | PENDING |
| Privacy / Compliance Officer | TBD | PENDING |
| SRE On-Call | TBD | PENDING |

Approvals must be recorded in the evidence pack (`artifacts/ue-pilot-launch/launch-evidence-pack.md`)
before production deployment is executed.

---

## 5. Deployment Checklist

### 5.1 Infrastructure provisioning
- [ ] Create `nzila-canada-prod-rg` in `canadacentral`
- [ ] Provision Container Apps environment `nzila-canada-prod-env`
- [ ] Provision PostgreSQL Flexible Server (prod tier, Canada Central)
- [ ] Provision Key Vault `nzila-prod-kv` and populate secrets
- [ ] Configure custom domain + managed TLS certificate
- [ ] Set up ACR (or reuse `nzilacanadaacr.azurecr.io` with prod repositories)

### 5.2 Database
- [ ] Run Drizzle migrations against prod database
- [ ] Seed RBAC roles and permission groups
- [ ] Verify no staging-specific seed data is present
- [ ] Configure automated backups (geo-redundant, 35-day retention)

### 5.3 Application deployment
- [ ] Build Docker images from `main` (or release tag) via `gitops-deploy.yml`
- [ ] Push images to prod ACR
- [ ] Deploy Container App `nzila-os-union-eyes` to `nzila-canada-prod-env`
- [ ] Deploy sidecar Django service if applicable
- [ ] Verify all required env vars are set (no CLERK_* refs, all AUTH_* present)

### 5.4 Post-deploy smoke tests
- [ ] `GET /api/auth_core/health/` → 200
- [ ] `GET /api/tasks/queues/` → 403 (unauthenticated) or 200 (authenticated admin)
- [ ] Member login flow
- [ ] Case timeline renders without error
- [ ] File upload completes

---

## 6. Rollback Procedure

If production deployment fails or a P0 incident occurs within 1 hour of go-live:

1. `az containerapp revision deactivate --name nzila-os-union-eyes --resource-group nzila-canada-prod-rg --revision <revision-name>`
2. Activate the previous revision:  
   `az containerapp revision activate --name nzila-os-union-eyes --resource-group nzila-canada-prod-rg --revision <previous-revision>`
3. Notify SRE on-call and CUPE pilot representative.
4. Open a post-mortem incident in the `reports/` directory within 24 hours.

---

## 7. Data Migration Notes

- All PII (member names, addresses, pension data) must remain in `canadacentral` at all times.
- Export from staging database must be encrypted at rest and in transit.
- A compliance officer must be present during any PII migration operation.
- Migration artefacts (SQL dumps) must be deleted within 24 hours of successful import.
- Use Azure Blob Storage (`nzilacanadastore`, container `evidence`) for signed compliance logs.

---

## 8. References

- Evidence pack: [`artifacts/ue-pilot-launch/launch-evidence-pack.md`](../../../artifacts/ue-pilot-launch/launch-evidence-pack.md)
- GitOps production manifest: [`infrastructure/gitops/environments/production.yml`](../../../infrastructure/gitops/environments/production.yml)
- Production env vars: [`ops/environments/prod.env`](../../../ops/environments/prod.env)
- Region validation script: [`scripts/validate-prod-region.ts`](../../../scripts/validate-prod-region.ts)
- Dry-run script: [`scripts/ue-prod-canadacentral-dry-run.ts`](../../../scripts/ue-prod-canadacentral-dry-run.ts)
- SRE reliability audit: [`reports/sre-reliability-audit.json`](../../../reports/sre-reliability-audit.json)
- Go-live decision: [`reports/ue-go-live-decision.md`](../../../reports/ue-go-live-decision.md)
