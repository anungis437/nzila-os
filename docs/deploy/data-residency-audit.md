# Data Residency Audit — PIPEDA / Québec Law 25

> **Date:** 2026-04-04
> **Scope:** Production readiness for Canadian data residency compliance
> **Status:** ✅ Azure infrastructure validated; ⚠️ Clerk PIA pending

---

## 1. Azure Resource Provider Availability — Canada Central

All services required for production were verified available in `canadacentral`:

| Service | Resource Provider | Canada Central | Notes |
|---------|-------------------|:--------------:|-------|
| Container Apps | Microsoft.App/managedEnvironments | ✅ | Primary compute |
| Container Registry | Microsoft.ContainerRegistry/registries | ✅ | Premium tier for geo-replication |
| Key Vault | Microsoft.KeyVault/vaults | ✅ | Auto-rotation for prod |
| Log Analytics | Microsoft.OperationalInsights/workspaces | ✅ | 90-day retention (prod) |
| Storage | Microsoft.Storage/storageAccounts | ✅ | GRS within Canada |
| PostgreSQL Flexible Server | Microsoft.DBforPostgreSQL/flexibleServers | ✅ | Zone-redundant HA |
| Front Door / WAF | Microsoft.Cdn/profiles | ✅ (Global) | Edge CDN; no data storage — routing only |
| Sentinel | Microsoft.SecurityInsights | ✅ (via Log Analytics) | Data stored in Log Analytics workspace (Canada Central) |

**DR Region:** `canadaeast` — confirmed accessible in subscription.

## 2. GitOps Environment Configuration

All three environment files target Canadian regions:

| Environment | File | Primary Region | DR Region |
|-------------|------|:--------------:|:---------:|
| Development | `infrastructure/gitops/environments/development.yml` | canadacentral | — |
| Staging | `infrastructure/gitops/environments/staging.yml` | canadacentral | canadaeast |
| Production | `infrastructure/gitops/environments/production.yml` | canadacentral | canadaeast |

Production environment includes `data_residency` enforcement block:
```yaml
data_residency:
  enforce: true
  allowed_regions: [canadacentral, canadaeast]
  cross_border_transfer: disabled
  regulatory_frameworks: [PIPEDA, "Québec Law 25"]
```

## 3. Bicep Infrastructure

`infrastructure/bicep/main.bicep` uses `param location string = resourceGroup().location` — no hardcoded regions. All modules inherit the resource group location. When the production RG is created in `canadacentral`, all resources deploy there automatically.

## 4. Third-Party Data Processors

### 4.1 Authentication (`@nzila/platform-auth`)
- **Primary auth:** Email/password — all data stays in Azure Canada Central PostgreSQL
- **Optional SSO:** Microsoft Entra External ID — data subject to Microsoft DPA + Azure data residency commitments (Canada Central)
- **Legacy note:** Clerk was previously used for auth. The migration to `@nzila/platform-auth` (email/password + Entra SSO) is complete. Clerk CSP references may remain in some `next.config.ts` files but are non-functional.
- **PII NOT sent externally:** SIN, banking info, pension records, grievance details, health data — all stored exclusively in Azure Canada Central PostgreSQL
- **PIPEDA / Law 25 compliance:** With email/password auth, all PII stays in Canada. Entra SSO data is covered by Microsoft's Canadian data residency commitments.

See `governance/business/verticals/uniontech/strategy/compliance-privacy.md` §8 for full assessment.

### 4.2 Azure (Microsoft)
- **Data location:** Canada Central (primary) + Canada East (DR)
- **Canadian data residency:** ✅ Contractually guaranteed via Microsoft DPA and Azure data residency commitments
- **All sensitive union PII resides here exclusively**

## 5. Current State & Outstanding Actions

| # | Item | Status |
|---|------|--------|
| 1 | Azure resource providers validated for Canada Central | ✅ Complete |
| 2 | GitOps configs migrated from `eastus` → `canadacentral` | ✅ Complete |
| 3 | Production data residency enforcement block added | ✅ Complete |
| 4 | Bicep verified region-agnostic (inherits from RG) | ✅ Complete |
| 5 | Auth migration to `@nzila/platform-auth` (email/pwd + Entra SSO) | ✅ Complete |
| 6 | **Provision production RG in `canadacentral`** | ⏳ Not started |
| 7 | **Update GitHub workflow URLs** after new Container Apps domain assigned | ⏳ Blocked by #6 |
| 8 | **Existing staging RG** (`nzila-staging-rg` in `eastus`) — migrate or recreate in `canadacentral` | ⏳ Decision pending |

## 6. Notes

- **Existing staging environment** is in `eastus` (`nzila-staging-rg`). The GitOps config now targets `canadacentral`, but the actual Azure resources remain in `eastus`. A new staging RG in `canadacentral` will need to be provisioned (or the existing one migrated).
- **GitHub workflow URLs** (`delightfulisland-0d503d3c.eastus.azurecontainerapps.io`) will need updating once the new Canada Central Container Apps environment is provisioned — Azure assigns a new domain.

---

*Owner: Platform Engineering + Legal/Compliance | Review: Before production provisioning*
