# Uniontech Vertical — Product Roadmap 2026–2028

**Nzila Corp** | Last Updated: February 2026

---

## 1. Roadmap Overview

Two parallel product tracks with shared infrastructure milestones:

- **Union Eyes** — Labor union operating system (Django 5 + Azure PostgreSQL, 4,773 DB entities, 238 RLS policies)
- **DiasporaCore (C3UO)** — Diaspora banking platform (Node.js + Next.js, 485 DB entities)

Both undergo **Backbone migration** (EXTREME complexity, 12–16 weeks automated) as a prerequisite to roadmap execution.

---

## 2. Union Eyes — Quarterly Roadmap

### Phase 1: Foundation (Q1–Q2 2026)

| Quarter | Milestone | Features | Success Criteria |
|---------|-----------|----------|-----------------|
| **Q1 2026** | Core Platform Stabilization | Membership CRUD, grievance workflow engine, CBA document vault, union directory | 3 pilot unions onboarded; <2s page load; zero data leakage across tenants |
| **Q2 2026** | Elections & Governance Module | Nomination workflows, ballot generation, vote tallying, compliance audit logs, officer term tracking | 1 union election conducted end-to-end; Canada Labour Code s.38–s.54 compliance verified |

**Dependencies:** Backbone migration completion (Q1); Azure ACA deployment pipeline; RLS policy audit (238 policies validated)

### Phase 2: Intelligence Layer (Q3–Q4 2026)

| Quarter | Milestone | Features | Success Criteria |
|---------|-----------|----------|-----------------|
| **Q3 2026** | Financial Operations | Dues collection, expense tracking, budget forecasting, financial reporting (LM-2/LM-3 templates for US), treasurer dashboards | 5 unions processing dues; reconciliation accuracy >99.5% |
| **Q4 2026** | ML Pipeline v1 — Pension Forecasting | Pension health scoring, contribution gap analysis, retirement readiness projections, actuarial scenario modeling | Pension forecast accuracy within 5% of actuarial benchmarks; PBSA/ERISA compliance |

**Dependencies:** Financial data model (47 entities); ML infrastructure (Azure ML workspace, feature store); pension administrator API integrations

### Phase 3: Analytics & Mobile (Q1–Q2 2027)

| Quarter | Milestone | Features | Success Criteria |
|---------|-----------|----------|-----------------|
| **Q1 2027** | Advanced Analytics Dashboard | Membership growth trends, grievance resolution heatmaps, campaign effectiveness scoring, churn prediction (ML v2) | Dashboard NPS >40; churn prediction AUC >0.80 |
| **Q2 2027** | Mobile App v1 (iOS/Android) | Shop steward field tools — grievance intake (photo/voice), member lookup, push notifications, offline sync | 500+ MAU within 90 days of launch; offline-first sync <30s latency on reconnect |

**Dependencies:** React Native or Flutter decision (Q4 2026); CDN + blob storage for media; push notification infrastructure (Azure Notification Hub)

### Phase 4: U.S. Expansion & Scale (Q3 2027 – Q4 2028)

| Quarter | Milestone | Features | Success Criteria |
|---------|-----------|----------|-----------------|
| **Q3 2027** | U.S. Regulatory Compliance | LMRDA reporting (LM-2, LM-3, LM-4), OLMS electronic filing, ERISA pension compliance, US-specific election rules | OLMS filing acceptance; 3 US union pilots |
| **Q4 2027** | CBA Intelligence Engine v2 | NLP-powered CBA clause comparison, arbitration outcome prediction, pattern bargaining analytics, multi-jurisdiction clause library | Clause extraction F1 >0.85; used in 10+ active negotiations |
| **Q1 2028** | Campaign & Organizing Platform | Organizing drive management, card signing workflows, NLRB/CIRB petition tracking, canvassing tools, member sentiment analysis | 2 organizing campaigns supported end-to-end |
| **Q2–Q4 2028** | Enterprise Federation Tier | Multi-local hierarchy management, national-level dashboards, cross-local benchmarking, federated data governance | 1 national union (10+ locals) on platform; federation-level reporting live |

---

## 3. DiasporaCore (C3UO) — Quarterly Roadmap

### Phase 1: Regulatory Foundation (Q1–Q2 2026)

| Quarter | Milestone | Features | Success Criteria |
|---------|-----------|----------|-----------------|
| **Q1 2026** | FINTRAC Compliance & KYC/AML | Identity verification (Jumio/Onfido integration), PEP/sanctions screening, transaction monitoring, suspicious activity reporting | FINTRAC MSB registration submitted; KYC pass rate >90% |
| **Q2 2026** | Core Banking MVP | Multi-currency wallets (CAD, USD, EUR, XAF, NGN), account management, internal transfers, savings groups (tontines/njangi) | 200 beta users; $50K+ in wallet balances |

**Dependencies:** Banking-as-a-Service partner (Nuvei or Marqeta); FINTRAC registration; 485 DB entities migrated via Backbone

### Phase 2: Remittance Corridors (Q3 2026 – Q2 2027)

| Quarter | Milestone | Features | Success Criteria |
|---------|-----------|----------|-----------------|
| **Q3 2026** | Corridor 1: Canada → Nigeria | NGN payouts via Flutterwave/Paystack; competitive FX rates; instant delivery | 500 transactions/month; avg. transfer <$500; delivery <24h |
| **Q4 2026** | Corridor 2: Canada → Cameroon/DRC | XAF/CDF payouts; mobile money integration (MTN MoMo, Airtel Money) | 300 transactions/month |
| **Q1 2027** | Corridor 3: US → Pan-African | USD origination; 5 additional destination countries (Kenya, Ghana, Senegal, Ethiopia, South Africa) | 1,000 transactions/month |
| **Q2 2027** | Savings Groups v2 + Micro-lending | Group savings automation, rotating credit (chit funds), micro-loan disbursement, repayment tracking | 50 active savings groups; $200K+ in group balances |

### Phase 3: White-Label & Scale (Q3 2027 – Q4 2028)

| Quarter | Milestone | Features | Success Criteria |
|---------|-----------|----------|-----------------|
| **Q3 2027** | White-Label Platform | Multi-tenant branding, partner admin console, API-first architecture, custom compliance modules | 1 white-label partner signed |
| **Q4 2027** | Credit Scoring & Financial Health | Alternative credit scoring (remittance history, savings behavior), financial literacy content, credit builder products | Credit score model accuracy >75% |
| **Q1–Q4 2028** | Scale & Regulatory Expansion | UK FCA registration, EU PSD2 compliance, expanded corridors (15+ countries), institutional partnerships | 10,000+ active users; $5M+ monthly remittance volume |

---

## 4. Shared Infrastructure Milestones

| Timeline | Milestone | Scope |
|----------|-----------|-------|
| **Q1 2026** | Backbone Migration (Union Eyes) | 4,773 entities, 238 RLS policies; 12–16 week automated migration; Django 5 + Drizzle ORM patterns |
| **Q1 2026** | Backbone Migration (DiasporaCore) | 485 entities; Node.js + Next.js; API contract generation |
| **Q2 2026** | CI/CD Pipeline v2 | Azure DevOps pipelines; staging/prod parity; automated RLS regression tests |
| **Q3 2026** | Observability Stack | Azure Monitor, Application Insights, custom union KPI dashboards, SLA alerting |
| **Q4 2026** | SOC 2 Type II Preparation | Evidence collection, control implementation, auditor engagement |
| **Q2 2027** | Multi-region Deployment | Azure Canada Central (primary) + US East (US unions); data residency enforcement |

---

## 5. Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Backbone migration delays (EXTREME complexity) | Blocks all Q2+ milestones | Medium | Parallel manual migration path; dedicated 3-person migration squad |
| FINTRAC registration delays | DiasporaCore launch blocked | Medium | Engage compliance counsel early; submit Q1 2026 |
| Union procurement cycles (6–12 months) | Revenue targets slip | High | Build pipeline 2x target; focus on smaller locals for quick wins |
| ML model accuracy below threshold | Pension module credibility risk | Medium | Partner with actuarial firm for model validation; conservative confidence intervals |
| Mobile app store approval delays | Q2 2027 launch risk | Low | Begin Apple/Google review process 8 weeks early; pre-clear financial features |

---

*Document owner: Product & Engineering | Review cycle: Monthly sprint reviews, quarterly roadmap refresh*
