# Nzila OS — Integration Readiness Matrix

> Maps each platform product's integration readiness for common enterprise buyer evaluation criteria.
> Use during technical due diligence and RFP response.
>
> Updated: 2026-04-17

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Ready | Available today in staging |
| 🟡 Partial | Available but incomplete or not fully tested |
| 🔜 Roadmap | Planned for future release |
| ❌ Not planned | Not on the roadmap |

---

## 1. Identity & Access Management

| Requirement | Union Eyes | Flow | CFO | Partners | Notes |
|-------------|------------|------|-----|---------|-------|
| Email / password auth | ✅ | ✅ | ✅ | ✅ | Argon2id, OWASP params |
| Azure AD (Entra) SSO | ✅ | ✅ | ✅ | ✅ | OAuth2 / OIDC |
| Google SSO | ❌ | ❌ | ❌ | ❌ | Not planned |
| SAML 2.0 | 🔜 | 🔜 | 🔜 | 🔜 | Post-GA roadmap |
| SCIM provisioning | 🔜 | 🔜 | 🔜 | 🔜 | Post-GA roadmap |
| MFA (Microsoft Authenticator) | ✅ | ✅ | ✅ | ✅ | Via Entra (policy-enforced) |
| MFA (TOTP) | ❌ | ❌ | ❌ | ❌ | Not planned (Entra-delegated) |
| Role-based access control | ✅ | ✅ | ✅ | ✅ | Org-scoped |
| IP allowlisting | ❌ | ❌ | ❌ | ❌ | Container Apps network rules possible |

---

## 2. Data Integration

| Requirement | Union Eyes | Flow | CFO | Notes |
|-------------|------------|------|-----|-------|
| PostgreSQL native | ✅ | ✅ | ✅ | All apps |
| REST API (read) | ✅ | ✅ | ✅ | Standard HTTP JSON |
| REST API (write) | ✅ | ✅ | ✅ | Auth-gated |
| Webhooks (outbound) | 🟡 | 🟡 | ❌ | Partial implementation |
| Webhooks (inbound) | ✅ | ✅ | 🟡 | Stripe, Shopify handlers |
| CSV export | ✅ | ✅ | 🟡 | Core entities |
| JSON export | ✅ | ✅ | ✅ | Via API |
| Bulk import | 🟡 | 🟡 | ❌ | CSV upload in some domains |
| Real-time streaming | ❌ | ❌ | ❌ | Not planned (pilot phase) |

---

## 3. Finance & Payments

| Integration | CFO | Flow | Union Eyes | Notes |
|-------------|-----|------|------------|-------|
| QuickBooks Online | ✅ | ❌ | ❌ | Two-way sync |
| Plaid (bank data) | ✅ | ❌ | ❌ | Read-only reconciliation |
| Xero | 🟡 | ❌ | ❌ | Partial |
| Stripe (payments) | ❌ | ✅ | 🟡 | Flow: full; UE: dues processing |
| PayPal | ❌ | ❌ | 🟡 | Webhook verification only |
| ACH / direct debit | ❌ | ❌ | ❌ | Roadmap |

---

## 4. Commerce & Operations

| Integration | Flow | Notes |
|-------------|------|-------|
| Shopify (products + orders) | ✅ | Full bidirectional sync |
| Zoho CRM | 🟡 | Contact + pipeline sync (partial) |
| Salesforce | ❌ | Not planned |
| HubSpot | 🟡 | Web app lead forms (partial) |
| WooCommerce | ❌ | Not planned |

---

## 5. Communication & Notifications

| Channel | Union Eyes | Flow | Notes |
|---------|------------|------|-------|
| Email (transactional) | ✅ | ✅ | Azure Communication Services / SMTP |
| In-app notifications | ✅ | 🟡 | UE full; Flow partial |
| SMS | ❌ | ❌ | Roadmap |
| WhatsApp | ❌ | ❌ | Roadmap |
| Slack | ❌ | ❌ | Roadmap |
| Calendar (Google / Outlook) | 🟡 | ❌ | UE: partial sync |

---

## 6. AI & Intelligence

| Capability | Union Eyes | Flow | CFO | Notes |
|------------|------------|------|-----|-------|
| GPT-4.1-mini (Azure OpenAI) | ✅ | ✅ | 🟡 | Case summary, pricing assist |
| Text embeddings | ✅ | ❌ | ❌ | Semantic search in UE |
| Whisper (voice transcription) | ✅ | ❌ | ❌ | Evidence capture |
| Custom model fine-tuning | ❌ | ❌ | ❌ | Not planned |
| On-premise LLM | ❌ | ❌ | ❌ | Not planned |

---

## 7. Compliance & Audit

| Requirement | Platform-wide | Notes |
|-------------|---------------|-------|
| Audit log (immutable) | ✅ | Hash-chained evidence bundles |
| GDPR data export | ✅ | CSV/JSON export per org |
| GDPR data deletion | 🟡 | Manual process; self-service roadmap |
| SOC 2 Type II | ❌ | Post-GA roadmap |
| ISO 27001 | ❌ | Post-GA roadmap |
| HIPAA | ❌ | Not planned |
| FedRAMP | ❌ | Not planned |
| POPIA (South Africa) | 🟡 | Architecture aligned; not formally certified |

---

## 8. Observability & Operations (Buyer-Visible)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Status page | ❌ | Roadmap |
| Uptime history | 🟡 | Azure Monitor internal |
| Incident notifications | ❌ | Roadmap (Slack/email) |
| SLA reporting | ❌ | Roadmap |
| Custom dashboards | ❌ | Roadmap |

---

## 9. Developer & API Experience

| Feature | Status | Notes |
|---------|--------|-------|
| OpenAPI / Swagger spec | 🟡 | Internal only |
| API versioning | 🟡 | Via `x-api-version` header convention |
| SDK / client library | ❌ | Not provided |
| Sandbox environment | 🟡 | Dev environment available for partners |
| Webhook signature verification | ✅ | HMAC on inbound webhooks |
| Rate limiting | ✅ | Active on all public routes |

---

## Summary — Buyer Readiness Score

| Product | Auth | Data | Finance | Notifications | AI | Compliance |
|---------|------|------|---------|---------------|-----|------------|
| union-eyes | ✅ | ✅ | 🟡 | ✅ | ✅ | 🟡 |
| flow | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡 |
| cfo | ✅ | ✅ | ✅ | ❌ | 🟡 | 🟡 |
| partners | ✅ | 🟡 | ❌ | ❌ | ❌ | 🟡 |
