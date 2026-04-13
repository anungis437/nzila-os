# Nzila OS — Portfolio Matrix

> Canonical classification of every app in the Nzila OS monorepo.

_Auto-derived from [inventory.json](../../tooling/repo-inventory/output/inventory.json). Last updated: April 2026._

---

## Legend

| Tier | Meaning |
|------|---------|
| **FLAGSHIP** | Revenue-generating vertical, production-deployed, large codebase |
| **CORE** | Platform infrastructure or operational app, deployed to staging/prod |
| **SUPPORT** | Enablement/portal app—serves a specific audience, moderate scope |
| **INCUBATION** | Early-stage or experimental—small codebase, not yet revenue-ready |

---

## App Classification

| App | Framework | Code Files | Deps | Tier | Revenue Ready | Strategic Role |
|-----|-----------|------------|------|------|--------------|----------------|
| **union-eyes** | Next.js + Django | 3 028 | 15 | FLAGSHIP | Yes | Union case management — grievance lifecycle, bargaining, evidence-sealed audit trails |
| **zonga** | Next.js + Django | 393 | 22 | FLAGSHIP | Yes | Music distribution, streaming, royalty management — Africa-first |
| **flow** | Next.js | 316 | 24 | FLAGSHIP | Yes | Commerce vertical — orders, invoicing, inventory, supplier management |
| **cfo** | Next.js | 233 | 21 | FLAGSHIP | Yes | Finance dashboard — ledger, tax, AI advisory, QuickBooks/Plaid integrations |
| **console** | Next.js | 205 | 30 | CORE | — | Internal operations — governance, compliance, analytics, proof-center |
| **abr** | Next.js + Django | 202 | 14 | CORE | Planned | Agricultural compliance audits, analytics, AI services |
| **control-plane** | Next.js | 154 | 26 | CORE | — | Platform governance — multi-tenant, anomaly detection, workflow orchestration |
| **partners** | Next.js | 100 | 14 | SUPPORT | Planned | Partner portal — deals, commissions, certifications |
| **agrimo** | Next.js + Django | 97 | 23 | SUPPORT | Planned | Field operations — harvest tracking, production, logistics, warehousing |
| **web** | Next.js | 60 | 10 | CORE | — | Public marketing site — landing pages, resources |
| **nacp-exams** | Next.js | 59 | 15 | SUPPORT | Planned | Anti-corruption examination and assessment platform |
| **trade** | Next.js | 51 | 14 | SUPPORT | Planned | Cross-border trade — deals, shipments, commissions |
| **cora** | Next.js | 37 | 17 | INCUBATION | No | Agricultural intelligence — yield forecasting, price signals, risk analysis |
| **mobility** | Next.js | 36 | 14 | INCUBATION | No | Investment migration advisory — case management, KYC/AML |
| **mobility-client-portal** | Next.js | 32 | 8 | INCUBATION | No | Client portal for migration applicants |
| **platform-admin** | Next.js | 27 | 22 | CORE | — | Internal admin — intelligence services management |
| **orchestrator-api** | Fastify | 26 | 7 | CORE | — | Workflow orchestration API — job dispatch, proof-center |

---

## Summary by Tier

| Tier | Count | Total Code Files |
|------|-------|-----------------|
| FLAGSHIP | 4 | 3 970 |
| CORE | 5 | 614 |
| SUPPORT | 4 | 307 |
| INCUBATION | 4 | 131 |
| **Total** | **17** | **5 022** |

---

## Revenue Readiness Notes

### FLAGSHIP apps (production-deployed, revenue-generating)
- **union-eyes**: Largest app by far (3 028 files). Full-stack with Django backend. Subscription + per-seat pricing model ready.
- **zonga**: Music streaming platform with dedicated monetization layer (`zonga-monetization`, `zonga-economics`, `zonga-payments`). Creator payouts, platform fees, streaming revenue.
- **flow**: Commerce engine with Stripe integration, quoting, invoicing. Transaction-fee model ready via `commerce-core` + `pricing-engine`.
- **cfo**: Finance vertical with Plaid, Dext, Xero, QuickBooks integrations. Subscription-based SaaS model.

### INCUBATION apps (not yet revenue-ready)
- **cora**, **mobility**, **mobility-client-portal**: Small codebases (32–37 files). Promising verticals but need further development before commercialization.
- **platform-admin**: Internal tooling only — not customer-facing.

---

## Platform Adoption

All 17 apps use `@nzila/platform-auth`. 13 of 17 use `@nzila/platform-shell`.

Exceptions (documented in [platform-exceptions.yaml](../../governance/platform-exceptions.yaml)):
- **orchestrator-api**: Fastify server, not Next.js — no shell or auth needed
- **web**: Public marketing site — shell not applicable
- **mobility-client-portal**: Standalone client portal — shell not applicable
