# NzilaOS — Runtime Endpoint Classification

> Machine-authoritative classification of every server-side entrypoint by
> sensitivity tier, domain, and required governance controls.
>
> **Total surface area:** 1,382 entrypoints across 17 apps.

---

## Classification Tiers

| Tier | Label | Description | Required Controls |
|------|-------|-------------|-------------------|
| **P0** | Critical | Financial mutations, payment webhooks, AI actions, break-glass, voting, governance elections, audit-chain operations | enforcement, governance, audit, observability, security (all 5) |
| **P1** | High | Write operations (CRUD create/update/delete), cron jobs, external integrations, bulk imports, signature handling | enforcement, audit, observability, security |
| **P2** | Medium | Read operations returning sensitive/PII data, analytics, dashboards, reports | observability, security |
| **P3** | Low | Health checks, public metadata, static content endpoints | observability |

---

## App-Level Classification Summary

| App | Total Routes | P0 | P1 | P2 | P3 | Primary Domain |
|-----|-------------|----|----|----|----|----------------|
| abr | 2 | 0 | 1 | 0 | 1 | Isolation proof |
| cfo | 8 | 2 | 3 | 2 | 1 | Financial evidence |
| console | 72 | 18 | 28 | 20 | 6 | Platform admin/AI/finance |
| control-plane | 19 | 4 | 8 | 6 | 1 | Architecture governance |
| cora | 1 | 0 | 0 | 0 | 1 | Read-only analytics |
| flow | 16 | 4 | 6 | 4 | 2 | Quotes/webhooks |
| mobility | 1 | 0 | 0 | 0 | 1 | Health only |
| mobility-client-portal | 1 | 0 | 0 | 0 | 1 | Health only |
| nacp-exams | 3 | 0 | 1 | 1 | 1 | Exam sessions |
| orchestrator-api | 7 | 2 | 3 | 1 | 1 | Workflow orchestration |
| partners | 5 | 0 | 2 | 2 | 1 | Partner commissions |
| platform-admin | 1 | 0 | 0 | 0 | 1 | Health only |
| agrimo | 1 | 0 | 0 | 0 | 1 | Health only |
| trade | 1 | 0 | 0 | 0 | 1 | Health only |
| union-eyes | 1,235 | 142 | 486 | 412 | 195 | Labour relations platform |
| web | 5 | 0 | 1 | 3 | 1 | Public governance status |
| zonga | 4 | 0 | 2 | 1 | 1 | Creator marketplace |
| **TOTAL** | **1,382** | **172** | **541** | **452** | **217** | |

---

## Detailed P0 (Critical) Endpoint Classification

### console (18 P0 endpoints)

| Route | Reason |
|-------|--------|
| `admin/break-glass` | Emergency privilege escalation |
| `admin/idempotency-cleanup` | Data mutation cleanup |
| `admin/retention/run` | Data retention execution |
| `ai/actions/approve` | AI action approval — governance gate |
| `ai/actions/execute` | AI action execution — autonomous ops |
| `ai/actions/propose` | AI action proposal — pre-action control |
| `ai/actions/finance/stripe-monthly-reports` | AI-driven financial reporting |
| `audit/tamper-status` | Audit chain integrity |
| `audit/verify-chain` | Chain verification endpoint |
| `audit/verify-entity-chain` | Entity-level chain verification |
| `finance/close` | Financial period close |
| `finance/governance-links` | Finance-governance linkage |
| `finance/indirect-tax` | Tax computation mutations |
| `finance/tax` | Tax mutations |
| `governance/votes` | Governance voting |
| `stripe/checkout` | Payment initiation |
| `stripe/webhooks` | Payment webhook handler |
| `webhooks/stripe` | Duplicate payment webhook path |

### flow (4 P0 endpoints)

| Route | Reason |
|-------|--------|
| `governance/telemetry` | Governance telemetry mutations |
| `quotes/ai` | AI-driven quoting |
| `shopify/webhook` | External payment webhook |
| `zoho/webhook` | External CRM webhook |

### control-plane (4 P0 endpoints)

| Route | Reason |
|-------|--------|
| `agents/execute` | Agent execution — autonomous ops |
| `governance/evaluate` | Policy evaluation engine |
| `governance/policies` | Policy mutation |
| `intelligence/analyze` | Intelligence analysis — classification decisions |

### orchestrator-api (2 P0 endpoints)

| Route | Reason |
|-------|--------|
| `commands` | Workflow command execution |
| `proof-center` | Provenance attestation |

### union-eyes (142 P0 endpoints)

Major P0 clusters:

| Domain | Count | Examples |
|--------|-------|---------|
| **Payments/Billing** | 18 | `billing/subscriptions`, `payments/webhooks/stripe`, `payments/webhooks/paypal`, `stripe/webhooks`, `whop/webhooks`, `whop/create-checkout` |
| **Voting/Elections** | 12 | `voting/sessions/*/vote`, `voting/sessions/*/results`, `governance/council-elections`, `governance/elections` |
| **Financial/Tax** | 14 | `tax/t4a`, `tax/t106`, `tax/slips`, `tax/rl-1`, `tax/cra-export`, `tax/cope-receipts`, `financial/reports`, `financial/vendors` |
| **AI Operations** | 16 | `ai/summarize`, `ai/classify`, `ai/extract-clauses`, `ai/copilot`, `ai/match-precedents`, `ai/semantic-search`, `ai/mamba` |
| **Strike Fund** | 10 | `strike/disbursements`, `strike/funds`, `strike/stipends`, `strike/eligibility` |
| **Governance** | 14 | `governance/golden-share`, `governance/reserved-matters`, `governance/board-packets`, `governance/policies`, `governance/mission-audits` |
| **Signatures** | 6 | `signatures/webhooks/docusign`, `webhooks/signatures` |
| **Emergency** | 8 | `emergency/activate`, `emergency/recovery`, `emergency/pipeda` |
| **Enterprise** | 10 | `enterprise/DSR`, `enterprise/SSO`, `enterprise/webhooks`, `enterprise/integrations` |
| **Cron (financial)** | 6 | `cron/monthly-dues`, `cron/monthly-per-capita`, `cron/sla-watchdog` |
| **GDPR** | 4 | `gdpr/consents`, `gdpr/requests` |
| **Compliance** | 8 | `compliance/audit-logs`, `compliance/alerts`, `compliance/validate` |
| **Bulk operations** | 6 | `bulk-import`, `claims/bulk` |
| **Grievances** | 10 | `grievances/assign`, `grievances/recommend-steward`, `grievances/suggest-clauses` |

---

## Webhook Handlers (26 total — all classified P0 or P1)

| App | Path | Tier | Reason |
|-----|------|------|--------|
| console | `stripe/webhooks` | P0 | Payment mutations |
| console | `webhooks/stripe` | P0 | Payment mutations |
| flow | `shopify/webhook` | P0 | External payment |
| flow | `zoho/webhook` | P0 | External CRM |
| union-eyes | `enterprise/webhooks` | P0 | Enterprise integration |
| union-eyes | `integrations/webhooks` | P1 | Integration events |
| union-eyes | `integrations/shopify/webhooks` | P0 | Payment |
| union-eyes | `payments/webhooks/paypal` | P0 | Payment mutations |
| union-eyes | `payments/webhooks/stripe` | P0 | Payment mutations |
| union-eyes | `signatures/webhooks/docusign` | P0 | Legal signatures |
| union-eyes | `stripe/webhooks` | P0 | Payment mutations |
| union-eyes | `webhooks/clc` | P1 | Labour council events |
| union-eyes | `webhooks/signatures` | P0 | Legal signatures |
| union-eyes | `webhooks/stripe` | P0 | Payment mutations |
| union-eyes | `whop/webhooks` | P0 | Payment mutations |
| union-eyes | v2 mirrors of above | Same | Same |

---

## Cron/Scheduled Tasks (21 total — P0 or P1)

| Path | Tier | Reason |
|------|------|--------|
| `cron/sla-watchdog` | P0 | SLA breach — triggers escalation |
| `cron/monthly-dues` | P0 | Financial mutations |
| `cron/monthly-per-capita` | P0 | Financial computation |
| `cron/analytics/daily-metrics` | P1 | Data aggregation |
| `cron/education-reminders` | P1 | Notification dispatch |
| `cron/external-data-sync` | P1 | External data sync |
| `cron/overdue-notifications` | P1 | Notification dispatch |
| `cron/process-messages` | P1 | Queue processing |
| `cron/process-notifications` | P1 | Queue processing |
| `cron/scheduled-reports` | P1 | Report generation |
| `rewards/cron` | P1 | Rewards processing |
| v2 mirrors of above | Same | Same |

---

## Server Actions

| App | File | Tier | Reason |
|-----|------|------|--------|
| flow | `lib/actions.ts` | P1 | Server action mutations |

---

## Framework-Specific Notes

### Next.js Apps (16)

- API routes at `app/api/*/route.ts`
- Each `route.ts` can export `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Enforcement wrapping: `createEnforcedHandler` around each handler export

### Fastify App (orchestrator-api)

- Route modules registered via plugin pattern
- Enforcement wrapping: Fastify `preHandler` hook with enforcement pipeline

---

## Coverage Gap Analysis

| Control | Current Apps Using | Required For | Gap |
|---------|-------------------|-------------|-----|
| `@nzila/enforcement` | **0 / 17** | All P0+P1 routes | 713 endpoints |
| `@nzila/governance` | **0 / 17** | All P0 routes | 172 endpoints |
| `@nzila/audit` | **0 / 17** | All P0+P1 routes | 713 endpoints |
| `@nzila/observability` | **0 / 17** | All routes | 1,382 endpoints |
| `@nzila/security` | **0 / 17** | All P0+P1+P2 routes | 1,165 endpoints |
| `@nzila/ai-control` | **0 / 17** | All AI routes | ~32 endpoints |
| `@nzila/contracts` | **0 / 17** | All event-emitting routes | ~200 endpoints |
| `@nzila/events` | **0 / 17** | All event-emitting routes | ~200 endpoints |

**Current enforcement adoption: 0%.** All 1,382 server entrypoints are ungoverned.
