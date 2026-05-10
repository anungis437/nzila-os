# Deployment Profiles

**Purpose:** Document the three deployment models for Nzila OS pilots and production engagements.
**Owner:** Platform Engineering / Solutions
**Last Updated:** 2026-03-03

---

## Overview

Nzila OS supports three deployment profiles to balance customer control, data residency requirements, and operational simplicity:

| Profile | Description | Best For |
|---------|-------------|----------|
| **Managed** | Nzila-hosted on Azure, fully managed infrastructure | Most pilots, fast time-to-value |
| **Sovereign** | Customer-hosted on their own Azure subscription | Regulated industries, data sovereignty requirements |
| **Hybrid** | Split: compute in customer sub, data in Nzila-managed | Balanced control + managed operations |

---

## 1. Managed Profile

### Architecture

```
Customer Browser → Nzila CDN → Azure App Service (Nzila Sub)
                                    ↓
                              PostgreSQL (Nzila Sub)
                              Azure Blob (Nzila Sub)
                              Azure Key Vault (Nzila Sub)
```

### Characteristics

| Aspect | Detail |
|--------|--------|
| Infrastructure owner | Nzila |
| Data location | Azure region of choice (default: South Africa North) |
| Updates | Automatic, zero-downtime |
| Monitoring | Nzila ops team (24/7 on-call) |
| Backups | Automated daily, 30-day retention |
| Cost model | SaaS subscription (per-org, per-month) |

### When to Choose

- Standard pilot with no special data residency needs.
- Want fastest time to production.
- Don't want to manage infrastructure.

### Setup Steps

1. Nzila provisions org in shared infrastructure.
2. Customer configures via Console.
3. Data onboarding (see [data onboarding guide](../pilot/02-data-onboarding.md)).
4. Go live.

---

## 2. Sovereign Profile

### Architecture

```
Customer Browser → Customer CDN → Azure App Service (Customer Sub)
                                        ↓
                                  PostgreSQL (Customer Sub)
                                  Azure Blob (Customer Sub)
                                  Azure Key Vault (Customer Sub)
```

### Characteristics

| Aspect | Detail |
|--------|--------|
| Infrastructure owner | Customer |
| Data location | Customer's Azure subscription and region |
| Updates | Customer-managed (Nzila provides containers) |
| Monitoring | Customer ops + optional Nzila advisory |
| Backups | Customer-managed (Nzila provides backup scripts) |
| Cost model | License + support fee (annual) |

### When to Choose

- Strict data sovereignty requirements (e.g., government, financial services).
- Customer must own all infrastructure and data.
- Regulatory constraints prevent shared hosting.

### Setup Steps

1. Customer provisions Azure resources (Terraform/Bicep templates provided).
2. Nzila provides Docker images and configuration.
3. Customer deploys using provided scripts.
4. Nzila trains customer ops team on runbooks.
5. Go live.

### Provided Artifacts

- Terraform/Bicep infrastructure templates
- Docker Compose configuration
- Environment variable reference
- Runbooks and monitoring setup guide
- Release update process documentation

---

## 3. Hybrid Profile

### Architecture

```
Customer Browser → Nzila CDN → Azure App Service (Customer Sub)
                                        ↓
                                  PostgreSQL (Nzila Managed)
                                  Azure Blob (Nzila Managed)
                                  Azure Key Vault (Customer Sub)
```

### Characteristics

| Aspect | Detail |
|--------|--------|
| Infrastructure owner | Split: compute (customer), data (Nzila) |
| Data location | Nzila-managed in customer-selected Azure region |
| Updates | Compute: customer-managed; Data: Nzila-managed |
| Monitoring | Joint (Nzila monitors data layer, customer monitors compute) |
| Backups | Nzila-managed (data layer) |
| Cost model | Hybrid: SaaS data fee + customer compute costs |

### When to Choose

- Customer wants control over compute but not database operations.
- Data compliance is handled by managed region selection.
- Balance between control and operational simplicity.

### Setup Steps

1. Nzila provisions data layer in customer-selected region.
2. Customer provisions compute resources.
3. Nzila provides connection strings and configuration.
4. Joint monitoring setup.
5. Go live.

---

## Profile Comparison Matrix

| Feature | Managed | Sovereign | Hybrid |
|---------|---------|-----------|--------|
| Time to pilot | 1–2 days | 2–4 weeks | 1–2 weeks |
| Customer infra management | None | Full | Partial (compute) |
| Data residency control | Region selection | Full control | Region selection |
| Update responsibility | Nzila | Customer | Split |
| Monitoring | Nzila | Customer | Joint |
| Typical cost | $$ | $$$ | $$–$$$ |
| Best for | Standard pilots | Regulated / gov | Balanced |

---

## Console Integration

The deploy profile is visible in `Console → Deploy Profile`:

- Shows current profile for the org.
- Links to profile-specific documentation.
- Displays infrastructure health for the selected profile.

---

## Related Documents

- [Scope Checklist](../pilot/01-scope-checklist.md)
- [Security & Privacy Packet](../pilot/03-security-privacy-packet.md)
- [Monitoring & SLOs](../pilot/04-monitoring-and-slos.md)
