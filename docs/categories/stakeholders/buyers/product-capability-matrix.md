# Nzila OS — Product Capability Matrix

> Enterprise buyer reference for feature coverage, deployment readiness, and integration compatibility across the Nzila portfolio.
>
> Authority: `governance/portfolio/product-catalog.json` · Updated: 2026-04-17

---

## 1. Portfolio Tier Definitions

| Tier | Label | Commercial Posture |
|------|-------|--------------------|
| TIER 1 | Flagship Revenue | Pilot-safe. Buyer-ready. Active proposals and pipeline. |
| TIER 2 | Strategic Growth | Pilot-capable. Low external proof. Investment target. |
| TIER 3 | Internal Platform | Not sold. Powers TIER 1–2. Internal operator use only. |
| TIER 4 | Incubation | Domain exploration. No pilot commitments. |
| TIER 5 | Frozen | No active investment. Awaiting formal sunset decision. |

---

## 2. TIER 1 — Flagship Products

### Union Eyes (Labour Operations Platform)

| Capability Domain | Feature | Status |
|-------------------|---------|--------|
| Grievance Management | Case creation, lifecycle FSM, assignment, routing | ✅ Full |
| Evidence Management | Document upload, hash-chained sealing, audit trail | ✅ Full |
| Representation | Organizer dashboards, member representation views | ✅ Full |
| Collective Bargaining | CBA module, negotiation tracking, clause management | ✅ Full |
| Member Portal | Member-facing case status, notifications, history | ✅ Full |
| SLA Tracking | Response and resolution deadlines, breach detection | ✅ Full |
| Orchestrated Automation | Evidence seal jobs, SLA escalation workflows | ✅ Wired |
| Analytics & Reporting | Case metrics, resolution rates, organizer workload | ✅ Full |
| Multi-org / RBAC | Org-scoped roles, Entra SSO, password auth | ✅ Full |
| Audit Hardening | Hash-chained evidence, compliance snapshots | ✅ Full |
| AI Assistance | Case summarisation, recommendation engine | 🟡 Partial |
| Mobile Responsiveness | Responsive web (no native app) | ✅ Full |

**Commercial summary**: Pilot-safe. `can_claim_pilot_ready: true`, `can_claim_audit_hardened: true`. Score: 8.6.

---

### Flow (SMB Operations Platform)

| Capability Domain | Feature | Status |
|-------------------|---------|--------|
| CRM | Contact management, pipeline stages, activity log | ✅ Full |
| Quoting | Quote builder, PDF generation, approval workflow | ✅ Full |
| Invoicing | Invoice generation, line items, payment status | ✅ Full |
| Orders | Order lifecycle FSM, fulfilment tracking | ✅ Full |
| Purchase Orders | PO creation, supplier management, receipt | ✅ Full |
| Inventory | Stock levels, reorder thresholds, warehouse | ✅ Full |
| Production | Production batch tracking, yield management | ✅ Full |
| Shipments | Shipment tracking, carrier integration stubs | ✅ Full |
| Orchestrated Automation | Invoice reminder dispatch, org onboarding triggers | ✅ Wired |
| Shopify Integration | Product sync, order import | ✅ Full |
| Zoho CRM Integration | Contact sync, pipeline bridge | 🟡 Partial |
| Stripe Payments | Payment link, webhook receipt | ✅ Full |
| AI-Assisted Pricing | Margin analysis, profitability scoring | 🟡 Partial |
| Multi-org / RBAC | Org-scoped roles, Entra SSO | ✅ Full |

**Commercial summary**: Pilot-ready. `can_claim_pilot_ready: true`, `can_claim_audit_hardened: true`. Score: 7.9.

---

## 3. TIER 2 — Strategic Growth Products

| Product | Primary Capability | Pilot-Ready | Score | Gap to TIER 1 |
|---------|--------------------|-------------|-------|---------------|
| CFO | Finance dashboard, QuickBooks, Plaid, tax calendar | ✅ Yes | 7.2 | External pilot proof |
| Partners | Channel partner portal, deal registration, commissions | ✅ Yes | 6.8 | External pilot proof |
| Zonga | Music distribution, artist management, royalties | ❌ No | 5.8 | External validation, market entry |

---

## 4. TIER 3 — Internal Platform (not sold directly)

| Product | Role | Availability |
|---------|------|--------------|
| Console | Internal governance hub, operator dashboards | Internal only |
| Control Plane | System governance, multi-tenant health, compliance | Internal only |
| Orchestrator API | Shared workflow runtime, idempotency engine | Internal only |
| Web | Marketing and documentation front door | Public |

---

## 5. Integration Compatibility

### Authentication & Identity

| Integration | Union Eyes | Flow | CFO | Partners |
|-------------|------------|------|-----|----------|
| Entra SSO (Azure AD) | ✅ | ✅ | ✅ | ✅ |
| Email/Password (Argon2id) | ✅ | ✅ | ✅ | ✅ |
| SAML | ❌ | ❌ | ❌ | ❌ |
| SCIM | ❌ | ❌ | ❌ | ❌ |

### Data & Finance

| Integration | Union Eyes | Flow | CFO |
|-------------|------------|------|-----|
| PostgreSQL | ✅ | ✅ | ✅ |
| QuickBooks | ❌ | ❌ | ✅ |
| Plaid | ❌ | ❌ | ✅ |
| Stripe | 🟡 | ✅ | ❌ |
| Shopify | ❌ | ✅ | ❌ |
| Zoho CRM | ❌ | 🟡 | ❌ |

### Infrastructure

| Integration | Status |
|-------------|--------|
| Azure Container Apps | ✅ Staging deployed |
| Azure Key Vault | ✅ Active |
| Azure OpenAI | ✅ Active (gpt-4.1-mini, whisper, text-embedding-3-small) |
| Azure Blob Storage | ✅ Active |
| PostgreSQL Flexible Server | ✅ Active |

---

## 6. Deployment Models

See [deployment-models.md](deployment-models.md) for full detail.

| Model | Availability | SLA |
|-------|--------------|-----|
| Managed cloud (Azure Canada) | ✅ Available | See SLA doc |
| Self-hosted (container) | 🟡 Possible, not officially supported | Customer-managed |
| On-premise | ❌ Not supported | N/A |

---

## 7. Security & Compliance Capabilities

| Capability | Status |
|------------|--------|
| Audit-hardened evidence sealing | ✅ Active (hash-chained, Ed25519-signed) |
| Argon2id password hashing (OWASP params) | ✅ Active |
| Account lockout (5 failed → 15-min lock) | ✅ Active |
| Session management (opaque tokens) | ✅ Active |
| Dependency vulnerability scanning (pnpm audit) | ✅ CI-gated |
| SBOM generation | ✅ Available |
| Procurement proof bundle (signed ZIP) | ✅ Available |
| Pen test plan | ✅ Documented (`docs/governance/pentest-plan.md`) |
| Vulnerability disclosure policy | ✅ Published |
| OWASP Top 10 code review | ✅ CI-enforced |
| CSRF protection | ✅ Active |
| Rate limiting | ✅ Active |

---

## 8. Claim Permissions by Product

| Product | Production Deploy | Enterprise Ready | Pilot Ready | Audit Hardened |
|---------|------------------|-----------------|-------------|----------------|
| union-eyes | ❌ | ❌ | ✅ | ✅ |
| flow | ❌ | ❌ | ✅ | ✅ |
| cfo | ❌ | ❌ | ✅ | ✅ |
| partners | ❌ | ❌ | ✅ | ✅ |
| zonga | ❌ | ❌ | ❌ | ❌ |
| console | ❌ | ❌ | ❌ | ✅ |
| control-plane | ❌ | ❌ | ❌ | ✅ |
| orchestrator-api | ❌ | ❌ | ❌ | ✅ |

> **Policy**: No `can_claim_production_deployment` or `can_claim_enterprise_ready` flag will be set until external measured evidence exists. All claims are CI-gated against `governance/portfolio/product-catalog.json`.
