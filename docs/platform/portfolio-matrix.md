# Nzila OS — Portfolio Matrix

> Canonical classification of every app in the Nzila OS monorepo.

_Tier source of truth: [platform-contracts registry](../../packages/platform-contracts/src/registry.ts). Last reconciled: April 2026._

---

## Legend

| Tier | Meaning |
|------|---------|
| **PRODUCTION** | Production tier in canonical app registry |
| **PILOT** | Pilot tier in canonical app registry |
| **INCUBATING** | Incubating tier in canonical app registry |
| **EXPERIMENTAL** | Experimental tier in canonical app registry |

---

## App Classification

| App | Framework | Code Files | Deps | Tier | Revenue Ready | Strategic Role |
|-----|-----------|------------|------|------|--------------|----------------|
| **union-eyes** | Next.js + Django | 3 028 | 15 | PRODUCTION | Yes | Union case management — grievance lifecycle, bargaining, evidence-sealed audit trails |
| **flow** | Next.js | 316 | 24 | PRODUCTION | Yes | Commerce vertical — orders, invoicing, inventory, supplier management |
| **console** | Next.js | 205 | 30 | PRODUCTION | — | Internal operations — governance, compliance, analytics, proof-center |
| **web** | Next.js | 60 | 10 | PRODUCTION | — | Public marketing site — landing pages, resources |
| **control-plane** | Next.js | 154 | 26 | PILOT | Planned | Platform governance — multi-tenant, anomaly detection, workflow orchestration |
| **partners** | Next.js | 100 | 14 | PILOT | Planned | Partner portal — deals, commissions, certifications |
| **cfo** | Next.js | 233 | 21 | PILOT | Planned | Finance dashboard — ledger, tax, AI advisory, QuickBooks/Plaid integrations |
| **zonga** | Next.js + Django | 393 | 22 | INCUBATING | Planned | Music distribution, streaming, royalty management — Africa-first |
| **agrimo** | Next.js + Django | 97 | 23 | INCUBATING | Planned | Field operations — harvest tracking, production, logistics, warehousing |
| **trade** | Next.js | 51 | 14 | INCUBATING | Planned | Cross-border trade — deals, shipments, commissions |
| **cora** | Next.js | 37 | 17 | INCUBATING | Planned | Agricultural intelligence — yield forecasting, price signals, risk analysis |
| **nacp-exams** | Next.js | 59 | 15 | INCUBATING | Planned | Anti-corruption examination and assessment platform |
| **mobility** | Next.js | 36 | 14 | INCUBATING | Planned | Investment migration advisory — case management, KYC/AML |
| **mobility-client-portal** | Next.js | 32 | 8 | EXPERIMENTAL | No | Client portal for migration applicants |
| **abr** | Next.js + Django | 202 | 14 | EXPERIMENTAL | No | Agricultural compliance audits, analytics, AI services |
| **platform-admin** | Next.js | 27 | 22 | EXPERIMENTAL | No | Internal admin — intelligence services management |
| **orchestrator-api** | Fastify | 26 | 7 | EXPERIMENTAL | No | Workflow orchestration API — job dispatch, proof-center |

---

## Summary by Tier

| Tier | Count | Total Code Files |
|------|-------|-----------------|
| PRODUCTION | 4 | 3 609 |
| PILOT | 3 | 487 |
| INCUBATING | 6 | 673 |
| EXPERIMENTAL | 4 | 287 |
| **Total** | **17** | **5 022** |

---

## Notes

### Classification authority

- Tier values are derived from the canonical app registry in `packages/platform-contracts/src/registry.ts`.
- Revenue readiness is shown as operational planning state, not as a legal or audit certification.

### Portfolio communication rule

- External investor/sales collateral must not override canonical tiering without an explicit dated exception record.

---

## Platform Adoption

All 17 apps use `@nzila/platform-auth`. 13 of 17 use `@nzila/platform-shell`.

Exceptions (documented in [platform-exceptions.yaml](../../governance/platform-exceptions.yaml)):

- **orchestrator-api**: Fastify server, not Next.js — no shell or auth needed
- **web**: Public marketing site — shell not applicable
- **mobility-client-portal**: Standalone client portal — shell not applicable
