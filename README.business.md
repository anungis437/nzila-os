# Nzila OS — Business Overview

## What Is Nzila OS?

Nzila OS is the digital backbone of Nzila Digital Ventures — a single platform that powers every product line, from agriculture and commerce to trade and finance. It is not a standalone product sold to customers; it is the internal operating system that all Nzila ventures run on.

Every business action that matters — a payment, a trade, a harvest record, an insurance claim — flows through Nzila OS with a tamper-evident audit trail, role-based access control, and automated compliance checks.

---

## Business Domains

### Agriculture (Pondu + Cora)

End-to-end digitisation of agricultural supply chains in Sub-Saharan Africa.

| Capability | Description |
|------------|-------------|
| **Producer management** | Register and manage smallholder farmer profiles |
| **Harvest & lot tracking** | Record harvests, assign lot numbers, track quality grades |
| **Warehouse operations** | Intake, storage, and dispatch with full traceability |
| **Shipment management** | Track goods from warehouse to buyer |
| **Payment processing** | Mobile-money payouts to producers |
| **Yield intelligence** | Predict yields, estimate losses, calculate payouts |
| **Price analytics** | Market price feeds and trend analysis |
| **Traceability** | Farm-to-buyer evidence chains (hash-verified) |
| **Weather integration** | External weather data for risk assessment |

**Apps**: Pondu (field operations), Cora (intelligence dashboard)

### Commerce

Unified commerce engine supporting multiple product verticals.

| Capability | Description |
|------------|-------------|
| **Product quoting** | Multi-vertical quoting engine (including legacy ShopMoiÇa bridge) |
| **Order lifecycle** | State-machine-driven order management |
| **Pricing engine** | Configurable pricing rules and calculations |
| **Governance** | Automated compliance checks on commerce actions |
| **Audit** | Full audit trail on all commerce mutations |

**Apps**: Shop Quoter

### Trade

Cross-border trade management and vehicle commerce.

| Capability | Description |
|------------|-------------|
| **Trade operations** | End-to-end trade deal management |
| **Vehicle commerce** | Specialised workflows for vehicle trading |
| **External adapters** | Integration with trade-related external systems |

**App**: Trade

### Finance (CFO)

Financial control and reporting across all ventures.

| Capability | Description |
|------------|-------------|
| **Stripe integration** | Payment processing and webhook handling |
| **QuickBooks sync** | Automated bookkeeping via QBO OAuth integration |
| **Tax calendar** | Obligation tracking and deadline management |
| **Foreign exchange** | FX rate management |
| **Financial dashboard** | Consolidated view of financial health |

**App**: CFO

### Case Management (Union-Eyes)

Investigations, compliance cases, and regulatory interactions.

**App**: Union-Eyes

### Professional Exams (NACP)

Examination administration and candidate management.

**App**: NACP Exams

### Partner Portal

Self-service portal for external partners with row-level access gating — partners see only the entities they are entitled to.

**App**: Partners

---

## What Makes Nzila OS Different

### 1. Everything Is Audited

Every significant action — creating a trade, approving a payment, sealing a compliance report — generates a tamper-evident audit record. These records form a hash chain: altering any past record breaks the chain and is immediately detectable.

### 2. Evidence Packs

For high-stakes business events (contract completions, regulatory filings, compliance checks), Nzila OS generates **evidence packs** — bundled proof artifacts stored in immutable cloud storage. Each pack includes the action, the actor, the timestamp, supporting documents, and a cryptographic seal.

### 3. Organisation-Scoped Multi-Tenancy

All data is isolated by organisation. There is no "default" organisation, no global data, no cross-tenant leakage. This is enforced at the code level, the database level, and verified by automated tests on every commit.

### 4. Automated Compliance Gates

Before any release reaches production, automated checks verify:
- **SLO metrics** — error rates, latency, and availability meet thresholds
- **Contract tests** — 5,000+ invariant checks confirm architectural rules are intact
- **Security scans** — dependency vulnerabilities, secret leaks, container image risks
- **Governance checks** — policy compliance automation

### 5. AI & ML Under Control

All AI and machine learning capabilities are centrally managed with:
- Per-application **AI profiles** with budget caps
- A **model registry** with approval workflows and drift monitoring
- Enforced SDK boundaries — no app can call an AI provider directly

---

## Governance & Compliance

| Area | How It Works |
|------|-------------|
| **Corporate governance** | Strategy and policy documents maintained as source-controlled files in `governance/` |
| **Security** | Automated scanning (dependencies, secrets, containers, static analysis) on every PR and weekly |
| **Incident response** | Documented playbooks with severity classification and escalation paths |
| **Business continuity** | Disaster recovery and business continuity plans maintained alongside code |
| **Change management** | Formal change request templates and approval workflows |
| **RBAC** | Five platform roles: Platform Admin, Studio Admin, Ops, Analyst, Viewer |

---

## Technology Stack (Non-Technical Summary)

| Layer | Technology | Why |
|-------|-----------|-----|
| **Web applications** | Next.js (React) | Fast, modern web framework used by most large platforms |
| **Domain backends** | Django (Python) | Mature framework for complex business logic (agriculture, case management) |
| **Database** | PostgreSQL via Drizzle ORM / Django ORM | Industry-standard relational database |
| **Authentication** | Clerk | Enterprise-grade identity and access management |
| **Cloud hosting** | Microsoft Azure | Enterprise cloud — Static Web Apps, Blob Storage, Key Vault |
| **Payments** | Stripe | Industry-standard payment processing |
| **Accounting** | QuickBooks Online | Automated bookkeeping sync |
| **Communications** | Email, SMS, Push | Multi-channel notifications |
| **CRM** | HubSpot | Customer relationship management |
| **ChatOps** | Slack + Microsoft Teams | Operational notifications and automation |

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Applications | 13 |
| Shared packages | 58+ |
| Contract test invariants | 5,000+ |
| CI/CD pipelines | 15 |
| Automated security gates | 5 (dependency audit, secret scan, CodeQL, Trivy, red-team) |

---

## Who Uses What

| Role | Primary Apps | Access Level |
|------|-------------|--------------|
| **Platform Admin** | Console, all apps | Full access — platform configuration, governance, user management |
| **Studio Admin** | Console, domain apps | Operational management within assigned domains |
| **Ops** | Console, domain apps | Day-to-day operations, incident response |
| **Analyst** | Console, CFO, Cora | Read access to analytics, reporting, dashboards |
| **Viewer** | Console | Read-only access to documentation and status pages |
| **Partner** | Partners portal | Scoped access to entitled entities only |

---

## Contact

- **Security issues**: security@nzila.app
- **General**: See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflows

---

*Nzila Digital Ventures — All rights reserved.*
