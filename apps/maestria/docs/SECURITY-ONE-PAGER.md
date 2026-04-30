# Maestria — Security One-Pager

**Version:** 1.0 | **Date:** 2026-04-29 | **Client:** Shop Moi Ça

---

## 1. Data Flow Diagram

```
Browser / Mobile
       │  HTTPS (TLS 1.3)
       ▼
┌─────────────────────────┐
│  Next.js Edge (ACA)     │  Rate-limit · i18n · Request-ID
│  middleware.ts          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  API Route Handlers     │  authorizeRequest() · Input validation
│  /api/maestria/*        │
└────────────┬────────────┘
             │
     ┌───────┴───────┐
     ▼               ▼
┌─────────┐    ┌──────────────────┐
│ SQLite  │    │ External APIs    │
│ (node:  │    │ Shopify · Google │
│  sqlite)│    │ Ads · Zoho CRM   │
└─────────┘    └──────────────────┘
                      │ HTTPS + OAuth 2.0
                      ▼
               Third-party SaaS
```

All inbound traffic flows through the middleware rate-limiter before reaching any API handler.
No direct database access from external networks.

---

## 2. RBAC Model

| Role              | Key Permissions                                                          |
|-------------------|--------------------------------------------------------------------------|
| `owner`           | All permissions (full access)                                           |
| `finance_admin`   | `finance.summary.view`, `invoice.manage`, `refund.manage`, `margin.view`|
| `marketing_staff` | `campaign.view`, `ads.view`, `shopify.view`                             |
| `customer_service`| `crm.view`, `task.assigned.view`, `task.assigned.update`               |
| `production_staff`| `inventory.view`, `supplier.view`, `shipping.view`                     |
| `corporate_client`| `module.client.view`, `quote.manage`, `export.download`                |
| `seasonal_temp`   | `task.assigned.view`, `task.assigned.update` only                       |

**Enforcement:** Every API route calls `authorizeRequest(req, permission)` before executing.
Unauthorized requests return `403 Forbidden` — no data leakage in the response body.

---

## 3. Audit Log Approach

- **What is logged:** All create/update operations on quotes, proposals, tasks, notifications, connector events, and user role changes.
- **Where:** `kpi_events` table in SQLite — `{ eventType, actorId, actorRole, payload, createdAt }`.
- **Retention:** Logs are never deleted (append-only table). Backup scripts export logs with each snapshot.
- **Access:** Only `owner` role can call `GET /api/metrics` and view the monitoring dashboard.
- **Tamper resistance:** SQLite WAL mode; file-system snapshots are immutable `.sqlite.bak` archives.

---

## 4. Data Residency

- **Primary region:** Canada Central (Azure Container Apps + PostgreSQL Flexible Server).
- **SQLite data file:** Mounted persistent volume in the Canadian ACA environment — data never leaves Canada.
- **Third-party connectors:** Shopify, Google Ads, Zoho store data in their own regions. Maestria only caches OAuth tokens; no personal customer data is replicated.
- **PIPEDA / Quebec Law 25 (Bill 64):** No personal information beyond operator profile is stored in Maestria's SQLite DB. PII fields (email, name) are sourced at runtime from `@nzila/platform-auth`.

---

## 5. Encryption

| Layer                  | Mechanism                                                         |
|------------------------|-------------------------------------------------------------------|
| Transport              | TLS 1.3 (enforced by Azure Container Apps ingress)               |
| SQLite at rest         | ACA persistent volume encrypted at rest (Azure-managed keys)     |
| OAuth tokens           | Stored in SQLite; volume encryption provides at-rest protection  |
| Secrets (API keys)     | Azure Key Vault + environment variables; never in source code     |
| Session cookies        | `nzila_session` — HttpOnly, Secure, SameSite=Strict              |

---

## 6. OWASP Top 10 Mitigations

| Risk                            | Mitigation                                                                                 |
|---------------------------------|--------------------------------------------------------------------------------------------|
| A01 Broken Access Control       | `authorizeRequest()` on every route; least-privilege `Permission` types per role          |
| A02 Cryptographic Failures      | TLS 1.3 in transit; AES-256 at rest via Azure; Argon2id password hashing (platform-auth)  |
| A03 Injection                   | No raw SQL strings; parameterized SQLite statements via `DatabaseSync`                     |
| A04 Insecure Design             | RBAC enforced at handler level; schema validation on all API inputs                        |
| A05 Security Misconfiguration   | Secrets in Key Vault; no default credentials; no debug endpoints in production             |
| A06 Vulnerable Components       | `pnpm audit` + Snyk CI gate; `tooling/security/supply-chain-policy.ts` with waivers       |
| A07 Auth/Identity Failures      | `@nzila/platform-auth` — Argon2id + PG sessions; account lockout after 5 failures         |
| A08 Software Integrity Failures | Turbo remote cache + SHA-pinned deps; lefthook pre-commit checks                          |
| A09 Logging/Monitoring Failures | `kpi_events` audit log; `/api/metrics` endpoint; monitoring dashboard at `/internal/monitoring` |
| A10 SSRF                        | Connector OAuth URLs are allowlisted constants; no user-supplied URLs in fetch calls       |

---

## 7. Secret Management

**Development:**
- `.env.local` (gitignored) — local secrets only
- `MAESTRIA_DB_PATH`, `MAESTRIA_API_KEY_SALT`, connector OAuth client IDs/secrets

**Staging / Production:**
- Azure Key Vault (`nzila-staging-kv`) — referenced via ACA secret references
- Never committed to source control; no hardcoded fallbacks in production paths
- Rotation process: update Key Vault secret → `az containerapp secret set` → redeploy

**Required env vars:**
```
MAESTRIA_DB_PATH=          # Absolute path to SQLite file on persistent volume
AUTH_SECRET=               # NextAuth / platform-auth signing secret
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
```

---

## 8. Incident Response Outline

| Phase        | Actions                                                                                                    |
|--------------|------------------------------------------------------------------------------------------------------------|
| **Detect**   | Alert on 5xx spike (`/api/metrics` error rate > 5% in 5 min); Azure Monitor log alerts                   |
| **Contain**  | Disable affected ACA container app replica; rotate compromised secrets in Key Vault                        |
| **Assess**   | Review `kpi_events` audit log for scope of unauthorized access; preserve SQLite snapshot for forensics     |
| **Notify**   | Notify client (Shop Moi Ça) within 72 hours per PIPEDA breach notification requirements                   |
| **Recover**  | Restore from latest `.sqlite.bak`; re-validate connector OAuth tokens; redeploy clean image               |
| **Post-mortem** | Document root cause, timeline, and control improvements; update waivers if CVE was known               |

**Contact:** security@nzila.ca | Emergency escalation: Nzila platform team Slack `#security-incidents`
