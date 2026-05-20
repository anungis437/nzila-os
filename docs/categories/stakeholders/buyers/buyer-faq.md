# Nzila OS — Buyer FAQ

> Answers to the most common questions from enterprise buyers, procurement teams, and technical evaluators.
>
> Updated: 2026-04-17

---

## Product & Platform

**Q: What is Nzila OS?**  
Nzila OS is an enterprise software platform built on a shared operating system — a common runtime of authentication, governance, audit, orchestration, and observability that powers a portfolio of vertical products. Buyers get a production-quality platform rather than a standalone tool.

**Q: Which products are available for pilot today?**  
Union Eyes (labour operations) and Flow (SMB ops) are the two TIER 1 flagship products ready for pilot engagement. CFO and Partners are TIER 2 and can enter pilot conversations. See [product-capability-matrix.md](product-capability-matrix.md) for full details.

**Q: Is this a multi-org SaaS or a dedicated deployment?**  
The current staging deployment is multi-tenant with strict org-scoping. Each organisation's data is isolated at the database query level. Dedicated deployment (single-tenant) is available on request and discussed in the pilot agreement.

**Q: Are these products GA (generally available)?**  
No. All current deployments are pilot-phase. No product carries `can_claim_production_deployment: true` until externally measured pilot evidence exists. We do not make claims we cannot prove.

---

## Security & Compliance

**Q: How is authentication handled?**  
All products use `@nzila/platform-auth` — a dual-auth model supporting email/password (Argon2id with OWASP-recommended parameters) and Entra SSO (Azure AD) out of the box. Sessions use opaque tokens stored in PostgreSQL. Account lockout is enforced after 5 failed attempts.

**Q: Is data encrypted at rest and in transit?**  
Yes. Azure PostgreSQL Flexible Server encrypts data at rest by default. All traffic is HTTPS/TLS 1.2+. Secrets are stored in Azure Key Vault, never in environment variables at rest.

**Q: How are audit trails maintained?**  
Union Eyes uses hash-chained evidence bundles signed with Ed25519. The chain is deterministic and reproducible. The proof system powers the procurement pack export (signed ZIP with SHA-256 manifest).

**Q: Do you have SOC 2 / ISO 27001 certification?**  
Not yet. Certification is a post-GA roadmap item. We can provide our pentest plan, vulnerability disclosure policy, and procurement proof bundle during evaluation. See `docs/governance/pentest-plan.md`.

**Q: How do you handle security vulnerabilities?**  
We run automated dependency auditing (pnpm audit) in CI, enforce the OWASP Top 10 in code review, and maintain a public vulnerability disclosure policy at `docs/governance/vulnerability-disclosure-policy.md`. Critical CVEs are patched within 48 hours via pnpm overrides.

**Q: Can we get a SBOM (Software Bill of Materials)?**  
Yes. An SBOM can be generated from `scripts/generate-sbom.ts`. This is part of the procurement pack.

---

## Technical Integration

**Q: What does the integration architecture look like?**  
Products integrate with your existing systems via REST APIs and webhooks. The platform natively supports Entra SSO for enterprise identity, Stripe for payments, QuickBooks/Plaid for finance (CFO), and Shopify/Zoho for commerce (Flow).

**Q: Can we bring our own identity provider?**  
Azure AD (Entra) is natively supported. SAML and SCIM are not yet supported but are on the roadmap for enterprise GA. If you use Azure AD, no additional identity configuration is needed.

**Q: What databases does the platform use?**  
PostgreSQL (Azure Flexible Server, Canada Central) for all operational data. No vendor-proprietary datastores. The schema is managed with Drizzle ORM and all migrations are tracked and reversible.

**Q: Is there an API we can integrate with?**  
Yes. Each product exposes a REST API secured with the platform auth model. API key access for system-to-system integration is supported via the orchestrator API. Documentation is in `docs/api/` per product.

---

## Commercial

**Q: What is the pricing model?**  
Pilots are scoped and priced per pilot agreement. Commercial pricing is TBD post-pilot based on usage patterns and buyer requirements. We do not publish pricing until pilot evidence exists.

**Q: What does a pilot engagement look like?**  
A typical pilot runs 30–90 days and covers: environment provisioning, org/RBAC setup, a defined use-case scope, weekly check-ins, and an outcome review. Success criteria are agreed before the pilot begins. See [pilot-readiness-checklist.md](pilot-readiness-checklist.md) for the internal gate criteria.

**Q: How long does onboarding take?**  
From signed pilot agreement to first active user: 2–5 business days for Union Eyes and Flow. Complex RBAC setups or custom data import requirements add time.

**Q: What happens if the pilot does not convert?**  
All pilot data is exportable. We provide a data export before teardown. There is no lock-in penalty.

---

## Data & Privacy

**Q: Where is data stored?**  
Canada Central (Azure), by default. Data residency in other regions can be discussed for commercial contracts.

**Q: Who has access to our data?**  
Only designated platform operators. Nzila operates with role-based access controls internally. No third-party vendor has access to customer data except the infrastructure providers named in the procurement pack (Azure).

**Q: What is the data retention policy?**  
Operational data is retained for the duration of the contract plus 90 days. Backup data is retained for 7 days (configurable to 35 days). Deletion upon contract termination is performed within 30 days.

**Q: Can we export our data?**  
Yes. CSV/JSON exports are available from within the product UIs for all major data domains. Bulk exports via the API are available on request.
