# Nzila OS — Deployment Models

> Describes the available deployment architectures, infrastructure components, and configuration options for Nzila OS platform engagements.
>
> Updated: 2026-04-17

---

## 1. Current Deployment — Managed Cloud (Canada Central)

The canonical staging deployment runs on **Azure Canada Central** using Azure Container Apps. This is the environment used for all pilot engagements.

### Infrastructure Stack

| Component | Service | Region |
|-----------|---------|--------|
| Container runtime | Azure Container Apps | Canada Central |
| Container registry | Azure Container Registry (nzilacanadaacr) | Canada Central |
| Database | Azure PostgreSQL Flexible Server | Canada Central |
| Object storage | Azure Blob Storage (nzilacanadastore) | Canada Central |
| Secrets management | Azure Key Vault (nzila-staging-kv) | Canada Central |
| Identity federation | Azure Entra ID (nzila-canada-staging-env) | Global |
| AI services | Azure OpenAI (gpt-4.1-mini, whisper, text-embedding-3-small) | East US / East US 2 |

### Deployed Applications

| App | URL Pattern | Current Status |
|-----|-------------|----------------|
| web | nzila-os-web.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | HTTP 200 |
| console | nzila-os-console.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | HTTP 200 |
| union-eyes | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | HTTP 200 |
| zonga | nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | HTTP 200 |
| partners | nzila-os-partners.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | HTTP 404 (pending) |

### Build & Deploy Pipeline

1. **CI/CD**: GitHub Actions (`gitops-deploy.yml`) builds 7 Docker images per commit
2. **Registry**: Images pushed to `nzilacanadaacr.azurecr.io/<app>:latest`
3. **Deploy**: `az containerapp update --image` per app — rolling restart, zero downtime target
4. **Secrets**: Set via `az containerapp update --set-env-vars` — additive, never destructive

---

## 2. Pilot Deployment Process

For a new pilot customer:

1. **Org provisioning**: A new organisation record is created with appropriate roles
2. **RBAC configuration**: User accounts with org-scoped roles assigned
3. **Environment variables**: Customer-specific configuration applied to the relevant Container App
4. **Smoke test**: Core user journeys validated before handing off to buyer
5. **Walkthrough**: Initial onboarding session with buyer team

No infrastructure changes are needed per pilot customer — isolation is achieved at the application layer (org-scoping), not the infrastructure layer.

---

## 3. Configuration Architecture

### Environment Segregation

| Environment | Purpose | Database | Auth |
|-------------|---------|----------|------|
| Development | Local developer machines | Local PostgreSQL (port 5433) | Local auth bypass available |
| Staging | Pilot customers and internal validation | nzila-staging-db (Azure, Canada Central) | Full Entra + password auth |
| Production | Not yet activated | TBD | TBD |

### Required Environment Variables Per App

All apps require:
- `AUTH_SECRET` — session signing key
- `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` — Entra SSO
- `DATABASE_URL` — PostgreSQL connection string

Apps with orchestrator integration additionally require:
- `ORCHESTRATOR_API_URL` — defaults to `http://localhost:4000` in development
- `ORCHESTRATOR_API_KEY` — API key for orchestrator authentication

---

## 4. Scalability & Limits

### Current Staging Configuration

| Resource | Current | Notes |
|----------|---------|-------|
| Container App replicas | Min 1, Max auto | Azure scales on request |
| PostgreSQL vCores | Flexible Server, burstable | Can scale vertically |
| Blob storage | Standard LRS | 24 ML artifacts in exports container |
| OpenAI capacity | 10 TPM (gpt-4.1-mini), 1 TPM (whisper) | Expand on request |

### Known Scaling Considerations

- **Database**: Single PostgreSQL instance shared across apps — partitioning strategy is per-org at the schema level. Production deployment will require connection pooling (PgBouncer or similar).
- **AI services**: Whisper (Standard SKU) only available in East US 2, not Canada Central. Voice upload routes use a separate endpoint override.
- **Storage**: Evidence bundles stored in Azure Blob. No CDN currently — large export jobs may be slow.

---

## 5. Disaster Recovery

| Objective | Target | Current Status |
|-----------|--------|----------------|
| RTO | 4 hours | Pilot phase |
| RPO | 24 hours | Daily automated backups (PostgreSQL Flexible Server) |
| Backup retention | 7 days | Default; configurable to 35 days |
| Geographic failover | Not configured | Post-GA roadmap |

Full DR runbook: `docs/disaster-recovery.md` (if present) or request from platform-core team.

---

## 6. Future Deployment Modes (Roadmap)

| Mode | Status | Notes |
|------|--------|-------|
| Multi-region active-active | Roadmap | Requires DB replication strategy |
| Customer-managed Azure | Roadmap | Customer brings subscription, Nzila provides IaC |
| Self-hosted (Docker Compose) | Possible | Supported for local dev; not officially for production |
| On-premises | Not planned | No current roadmap item |
