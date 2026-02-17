# Uniontech Vertical — Technical Architecture

**Nzila Corp** | Last Updated: February 2026

---

## 1. Architecture Overview

Uniontech operates two production platforms under a shared infrastructure backbone:

| Platform | Stack | DB Entities | RLS Policies | Migration Complexity |
|----------|-------|-------------|-------------|---------------------|
| **Union Eyes** | Django 5.x, Azure PostgreSQL Flexible Server | 4,773 | 238 | EXTREME |
| **DiasporaCore (C3UO)** | Node.js 20, Next.js 14, Drizzle ORM | 485 | 42 | EXTREME |

**Deployment target:** Azure Container Apps (ACA) with Azure Front Door CDN, Redis Cache, and Azure Blob Storage.

---

## 2. Union Eyes — Django 5 Architecture

### 2.1 Application Layer

```
┌─────────────────────────────────────────────────────┐
│                   Azure Front Door (CDN)             │
├─────────────────────────────────────────────────────┤
│              Azure Container Apps (ACA)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Django 5  │  │ Celery   │  │ ML Pipeline      │  │
│  │ ASGI App  │  │ Workers  │  │ (Azure ML)       │  │
│  └─────┬────┘  └─────┬────┘  └────────┬─────────┘  │
│        │             │                │              │
│  ┌─────▼─────────────▼────────────────▼──────────┐  │
│  │         Azure PostgreSQL Flexible Server       │  │
│  │         (4,773 entities, 238 RLS policies)     │  │
│  └───────────────────────────────────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Redis    │  │ Blob     │  │ Azure Key Vault  │  │
│  │ Cache    │  │ Storage  │  │ (secrets)        │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2 Django 5 Design Decisions

| Decision | Rationale |
|----------|----------|
| **ASGI (Daphne/Uvicorn)** over WSGI | WebSocket support for real-time election results, grievance notifications |
| **Django REST Framework + drf-spectacular** | OpenAPI 3.1 spec generation for Backbone contract validation |
| **django-tenants** (schema-per-tenant) | True data isolation for union locals; complements RLS for row-level filtering within shared schemas |
| **Celery + Azure Service Bus** | Async task queue for pension calculations, report generation, bulk email campaigns |
| **Django 5 async views** | Non-blocking I/O for dashboard data aggregation across multiple entity queries |

### 2.3 Entity Model Organization (4,773 Entities)

| Domain Module | Entity Count | Key Models |
|--------------|-------------|------------|
| Membership | 847 | Member, MembershipTier, DuesRecord, MemberHistory, Dependent |
| Grievances | 623 | Grievance, GrievanceStep, Arbitration, Evidence, Outcome |
| CBA Management | 512 | Agreement, Clause, ClauseVersion, Interpretation, Precedent |
| Elections | 389 | Election, Ballot, Candidate, VoteRecord, ElectionResult |
| Pension & Benefits | 478 | PensionPlan, Contribution, BenefitClaim, ActuarialSnapshot, Forecast |
| Financial Ops | 634 | Transaction, Budget, DuesCollection, Expense, FinancialReport |
| Campaigns & Organizing | 356 | Campaign, Drive, CardSign, Canvass, SentimentSurvey |
| Communications | 298 | Message, Broadcast, Template, NotificationPreference |
| Administration | 636 | Union, Local, Officer, Role, Permission, AuditLog, Config |

---

## 3. Multi-Tenant Security — 238 RLS Policies

### 3.1 RLS Architecture

Row-Level Security is implemented at the PostgreSQL level to guarantee tenant isolation independent of application logic:

```sql
-- Example: Membership table RLS
CREATE POLICY membership_isolation ON members.member
    USING (union_id = current_setting('app.current_union_id')::uuid);

-- Example: Cross-local read for federation officers
CREATE POLICY federation_read ON members.member
    FOR SELECT
    USING (
        union_id = current_setting('app.current_union_id')::uuid
        OR EXISTS (
            SELECT 1 FROM admin.federation_membership fm
            WHERE fm.local_union_id = members.member.union_id
            AND fm.federation_id = current_setting('app.current_federation_id')::uuid
        )
    );
```

### 3.2 RLS Policy Distribution

| Category | Policy Count | Description |
|----------|-------------|-------------|
| Tenant isolation (base) | 98 | One per major table — `union_id` match |
| Role-based read | 52 | Officer-level access, steward-level access, member self-service |
| Cross-local (federation) | 34 | National/federation officers can read across affiliated locals |
| Financial data | 28 | Treasurer/financial officer restrictions; audit-locked records |
| PII protection | 16 | SSN, SIN, banking details — restricted columns via RLS + column masking |
| Election integrity | 10 | Ballot secrecy; results sealed until certified |

### 3.3 RLS Testing Strategy

- Automated test suite: 238 tests (1:1 policy-to-test mapping)
- Cross-tenant leakage detection in CI/CD pipeline
- Quarterly manual penetration testing against RLS boundaries
- Regression suite runs on every migration that touches `auth`, `members`, or `finance` schemas

---

## 4. ML Pipeline Architecture

### 4.1 Infrastructure

| Component | Service | Purpose |
|-----------|---------|---------|
| Feature Store | Azure ML Feature Store | Precomputed features: member tenure, dues consistency, grievance frequency |
| Training | Azure ML Compute Clusters | GPU-enabled for NLP (CBA analysis); CPU for tabular models |
| Serving | Azure ML Managed Endpoints | Real-time inference for pension scoring; batch for churn prediction |
| Experiment Tracking | MLflow (Azure ML integrated) | Model versioning, hyperparameter tracking, A/B deployment |

### 4.2 Model Registry

| Model | Type | Input Features | Output | Refresh Cadence |
|-------|------|---------------|--------|----------------|
| Pension Health Score | Gradient Boosted Trees (XGBoost) | Contribution history, plan terms, market indices, member age/tenure | 0–100 health score + confidence interval | Monthly |
| Member Churn Prediction | Logistic Regression + SHAP | Dues payment patterns, grievance outcomes, meeting attendance, tenure | Churn probability (30/60/90 day) | Weekly |
| CBA Clause Extraction | Fine-tuned BERT | CBA document text | Structured clause objects (wages, hours, benefits, seniority) | On-demand (per document upload) |
| Arbitration Outcome Predictor | Random Forest | Clause type, jurisdiction, arbitrator history, grievance facts | Win/loss probability | Quarterly |

---

## 5. DiasporaCore (C3UO) — Node.js Architecture

### 5.1 Stack Details

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 (App Router) | SSR for SEO, client components for banking UI |
| API | Node.js 20, Express 5 | REST + WebSocket for real-time balance updates |
| ORM | Drizzle ORM | Type-safe schema; migration-first approach; 485 entity definitions |
| Database | Azure PostgreSQL Flexible Server | Separate instance from Union Eyes; FINTRAC audit requirements |
| Payments | Nuvei / Flutterwave | CAD origination, multi-corridor payout |
| KYC | Onfido / Jumio | Document verification, biometric matching, PEP/sanctions screening |

### 5.2 Drizzle ORM Patterns

```typescript
// Multi-currency wallet schema pattern
export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(), // ISO 4217
  balance: decimal('balance', { precision: 18, scale: 8 }).default('0').notNull(),
  availableBalance: decimal('available_balance', { precision: 18, scale: 8 }).default('0').notNull(),
  holdBalance: decimal('hold_balance', { precision: 18, scale: 8 }).default('0').notNull(),
  status: walletStatusEnum('status').default('active').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userCurrencyIdx: uniqueIndex('wallet_user_currency_idx').on(table.userId, table.currency),
}));
```

---

## 6. Backbone Migration Plan

### 6.1 Migration Scope

| Platform | Entities | Estimated Duration | Migration Type |
|----------|---------|-------------------|---------------|
| Union Eyes | 4,773 entities, 238 RLS policies | 12–16 weeks | Automated (Backbone orchestrator) |
| DiasporaCore | 485 entities | 4–6 weeks | Automated (Backbone orchestrator) |

### 6.2 Migration Phases

1. **Schema Analysis (Week 1–2):** Backbone scans all Django models / Drizzle schemas; generates dependency graph; identifies circular references among 4,773 entities
2. **Contract Generation (Week 2–4):** API contracts auto-generated from DRF serializers and Drizzle schemas; OpenAPI 3.1 specs validated
3. **RLS Policy Migration (Week 3–6):** All 238 RLS policies extracted, tested, and re-applied with Backbone tenant context injection
4. **Data Migration (Week 4–10):** Staged migration with rollback checkpoints; zero-downtime cutover using logical replication
5. **Integration Testing (Week 8–14):** Cross-service contract tests; RLS leakage tests; ML pipeline reconnection
6. **Validation & Cutover (Week 14–16):** Shadow traffic; data integrity checksums; final cutover with <5 minute downtime window

### 6.3 EXTREME Complexity Factors

- 4,773 entities with deep cross-module foreign key relationships (avg. 3.2 FKs per entity)
- 238 RLS policies with conditional logic referencing session variables
- ML pipeline dependencies on specific table structures and materialized views
- Django custom managers and querysets that embed business logic in ORM layer
- Celery task serialization formats tied to model structure

---

## 7. Infrastructure — Azure Services

| Service | Purpose | Configuration |
|---------|---------|--------------|
| Azure Container Apps | Application hosting (Django, Node.js, Celery workers) | Min 2 replicas, autoscale to 10; VNET integrated |
| Azure PostgreSQL Flexible Server | Primary database (both platforms) | General Purpose D4s_v3; 512 GB storage; HA with zone redundancy |
| Azure Cache for Redis | Session management, query caching, Celery broker | Premium P1; 6 GB; persistence enabled |
| Azure Blob Storage | Document storage (CBAs, evidence, KYC docs) | Hot tier; immutable storage for compliance docs; geo-redundant |
| Azure Front Door | CDN, WAF, SSL termination | Custom domains; DDoS protection; geo-filtering |
| Azure Key Vault | Secrets, certificates, encryption keys | HSM-backed for financial data encryption keys |
| Azure Monitor + App Insights | Observability, APM, custom metrics | Union KPI dashboards; RLS violation alerting |
| Azure ML | ML model training, serving, feature store | Managed compute clusters; managed online endpoints |

**Data residency:** Primary region Azure Canada Central (Toronto). US workloads in Azure US East for LMRDA/ERISA compliance. No cross-border data transfer for Canadian union PII.

---

*Document owner: Engineering & Architecture | Review cycle: Quarterly architecture review board*
