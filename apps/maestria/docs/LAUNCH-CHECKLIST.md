# Maestria GA Launch Checklist — Shop Moi Ça

> **Target**: First live customer deployment (Shop Moi Ça pilot)  
> **Owner**: Platform Engineering  
> **Status**: Pre-launch validation

---

## 1. Infrastructure

- [ ] PostgreSQL / SQLite data path mounted at `MAESTRIA_DATA_DIR` (persistent volume)
- [ ] `NODE_ENV=production` set in container / hosting environment
- [ ] `MAESTRIA_BASE_URL` set to the production domain (e.g. `https://app.shopmoica.com`)
- [ ] TLS certificate provisioned and auto-renewed (Let's Encrypt or Azure-managed)
- [ ] Health endpoint responds 200: `GET /api/health`
- [ ] Readiness endpoint responds 200: `GET /api/readiness`
- [ ] Metrics endpoint responds 200: `GET /api/metrics` (internal network only)
- [ ] Container restart policy set to `always` / ACA min-replicas ≥ 1
- [ ] Memory limit ≥ 512 MB; CPU ≥ 0.5 vCPU

---

## 2. Environment Secrets

- [ ] `MAESTRIA_SECRET` (JWT/session signing secret) — min 32 chars, stored in Key Vault
- [ ] `MAESTRIA_SHOPIFY_CLIENT_ID` + `MAESTRIA_SHOPIFY_CLIENT_SECRET`
- [ ] `MAESTRIA_GOOGLE_ADS_CLIENT_ID` + `MAESTRIA_GOOGLE_ADS_CLIENT_SECRET`
- [ ] `MAESTRIA_ZOHO_CLIENT_ID` + `MAESTRIA_ZOHO_CLIENT_SECRET`
- [ ] `DATABASE_URL` or `MAESTRIA_DATA_DIR` confirmed pointing to production DB
- [ ] All secrets injected as env vars (never baked into image)

---

## 3. Database / Persistence

- [ ] DB schema migration applied to production (or SQLite file confirmed intact)
- [ ] Backup script tested: `node scripts/db-backup.mjs` completes without error
- [ ] Restore drill performed on staging: `node scripts/db-restore.mjs <backup>` succeeds
- [ ] Backup retention policy confirmed (7 daily, 4 weekly)
- [ ] Backup destination storage account accessible from production environment

---

## 4. Connector Configuration

- [ ] Shopify OAuth app registered; redirect URI matches `MAESTRIA_BASE_URL/api/maestria/connectors/shopify/callback`
- [ ] Google Ads OAuth app registered; redirect URI confirmed
- [ ] Zoho CRM OAuth app registered; redirect URI confirmed
- [ ] `GET /api/maestria/connectors/status` returns `ok: true` with all connectors listed
- [ ] Manual OAuth flow tested end-to-end for each connector on staging

---

## 5. User Provisioning

- [ ] Owner accounts created for: **Lissa**, **Rox**, **Fred**
- [ ] Each owner can log in and reach the internal dashboard
- [ ] Role-based access verified: `owner` sees full nav, `production_staff` sees reduced nav
- [ ] `POST /api/maestria/users/invite` tested — invite email delivered
- [ ] `POST /api/maestria/users/:id/activate` tested — account activates correctly
- [ ] No default/demo accounts with weak passwords exist in production

---

## 6. Core Feature Smoke Tests

- [ ] Dashboard loads within 3 s (LCP ≤ 3 s, no unhandled errors in console)
- [ ] Quote creation flow: create → approve → export PDF — works end-to-end
- [ ] Finance summary page renders with real data (no mock fallbacks active)
- [ ] Inventory view loads; at least one product visible
- [ ] Shipping view loads; at least one shipment record visible
- [ ] Campaign / Ads view loads (even if no live ads yet)
- [ ] CRM / Zoho view loads (even if empty)
- [ ] CSV import: `POST /api/maestria/import/csv` accepts a valid file; returns `imported` count ≥ 0
- [ ] Export download: `GET /api/maestria/exports` returns a valid file

---

## 7. Monitoring & Alerting

- [ ] `GET /api/metrics` returns `overallErrorRate` < 0.01 after smoke tests
- [ ] Monitoring page (`/internal/monitoring`) renders ring-buffer stats
- [ ] Alerting channel configured (email / Slack / Teams) for error rate > 5 %
- [ ] Log drain connected to Azure Monitor / Log Analytics (structured JSON logs)
- [ ] SLA dashboard baseline captured before go-live

---

## 8. Security Sign-off

- [ ] `SECURITY-ONE-PAGER.md` reviewed and signed by responsible party
- [ ] No `console.log` of secrets or PII in production code (`pnpm lint` passes)
- [ ] Rate-limiting active on all public API routes (trial, contact)
- [ ] Input validation on CSV import (max size 10 MB, only `.csv` MIME)
- [ ] CORS policy restricted to `MAESTRIA_BASE_URL` origin
- [ ] Dependency audit passes: `pnpm audit --audit-level=high` — 0 critical/high unfixed

---

## 9. Onboarding Completion

- [ ] Onboarding checklist walked through with Shop Moi Ça team (`ONBOARDING-CHECKLIST.md`)
- [ ] Initial catalogue data loaded (Shopify sync or CSV import)
- [ ] First supplier record entered
- [ ] First quote created and approved by an owner
- [ ] Pilot-metrics baseline captured (`/internal/pilot-metrics`)

---

## 10. Go-Live Sign-off

| Checkpoint | Owner | Status | Date |
|---|---|---|---|
| Infrastructure ready | DevOps | ☐ | |
| Secrets verified | Security | ☐ | |
| DB backup confirmed | DevOps | ☐ | |
| Connector OAuth live | Platform Eng | ☐ | |
| User provisioning done | Platform Eng | ☐ | |
| Smoke tests passed | QA | ☐ | |
| Monitoring active | DevOps | ☐ | |
| Security sign-off | Security | ☐ | |
| Customer onboarding done | CS | ☐ | |
| **Final GO / NO-GO** | **Project Lead** | **☐** | |

---

_Last updated: auto-generated by Maestria GA readiness pass_
