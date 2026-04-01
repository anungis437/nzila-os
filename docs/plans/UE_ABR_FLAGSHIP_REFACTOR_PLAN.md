# UE & ABR Flagship Refactoring Plan

**Date:** 2026-02-17  
**Priority:** IMMEDIATE — Go-to-Market flagships  
**Objective:** Refactor Union Eyes (CLC movement) and ABR Insights (partnerships) into clean, scaffold-ready repos that run flawlessly on the Nzila Backbone architecture

---

## Strategic Context

| Product | Vertical | GTM Driver | Current State | Target |
|---------|----------|------------|---------------|--------|
| **Union Eyes (UE)** | UnionTech / Justice & Equity | Real CLC movement — active union organizing tool | Massive Next.js 15 monolith, Drizzle ORM, Clerk auth, 130+ API routes | Clean Next.js frontend + Django Backbone API |
| **ABR Insights** | EdTech / Anti-Racism | Partnership-ready learning platform | Next.js 16.1, Supabase Auth, ingestion CLI, AI coaching | Clean Next.js frontend + Django Backbone API |

Both are **revenue-critical flagships** that need to work flawlessly before any other vertical migration begins.

---

## Phase 1: Codebase Audit & Extraction (Week 1)

### 1.1 Union Eyes Deep Audit

| Task | Details |
|------|---------|
| **Schema extraction** | Extract all Drizzle schemas from `db/schema/` → document every table, relation, index |
| **API route inventory** | Map all 130+ `app/api/` routes → categorize into backbone-shared vs UE-specific |
| **Auth flow mapping** | Document Clerk middleware chain, RBAC roles, permission gates |
| **Supabase legacy cleanup** | Identify what still uses `supabase/` vs Drizzle — mark for removal |
| **Service dependency map** | Map all `services/` and `lib/` → identify backbone candidates |
| **Queue/worker inventory** | Document BullMQ jobs, IoRedis consumers, background processing |
| **AI/ML pipeline audit** | Map TensorFlow.js models, Azure OpenAI calls, retraining flows |
| **Compliance inventory** | List all PCI/AML/ISO scripts and evidence generators |

**Output:** `automation/data/ue-audit-report.json`

### 1.2 ABR Insights Deep Audit

| Task | Details |
|------|---------|
| **Schema extraction** | Extract Supabase migration SQL → document all tables, RLS policies |
| **API route inventory** | Map all 18 API route groups → categorize into backbone-shared vs ABR-specific |
| **Auth flow mapping** | Document Supabase Auth + SAML + MSAL → plan Clerk migration |
| **Ingestion pipeline** | Audit `ingestion/src/cli.ts` → plan Django management command equivalent |
| **Hook audit** | Map all 5 custom hooks → identify reusable vs product-specific |
| **AI integration** | Document Azure OpenAI + embeddings usage patterns |
| **i18n audit** | Map EN/FR content structure → plan Django i18n integration |

**Output:** `automation/data/abr-audit-report.json`

---

## Phase 2: Backbone Service Extraction (Week 2)

### 2.1 Shared Services Identification

Cross-reference UE and ABR to identify backbone-shared services:

```
BACKBONE SHARED (build once, used by both)
├── auth/                 ← Clerk integration (UE has it, ABR migrates to it)
│   ├── middleware
│   ├── RBAC engine
│   └── session management
├── billing/              ← Stripe (both use it)
│   ├── subscriptions
│   ├── webhooks
│   └── entitlements
├── ai/                   ← Azure OpenAI (both use it)
│   ├── chat completions
│   ├── embeddings
│   └── content moderation
├── email/                ← React Email + Resend (both use it)
│   ├── templates
│   └── delivery
├── analytics/            ← Event tracking (both need it)
│   ├── events
│   └── dashboards
├── compliance/           ← Audit logging (both need it)
│   ├── audit trail
│   └── consent management
└── notifications/        ← In-app + push (both need it)
    ├── channels
    └── preferences
```

### 2.2 Product-Specific Isolation

```
UE-SPECIFIC (stays in UE repo)              ABR-SPECIFIC (stays in ABR repo)
├── unions/                                  ├── courses/
├── grievances/                              ├── tribunal-cases/
├── bargaining/                              ├── achievements/
├── strike-fund/                             ├── ce-credits/
├── pension-processor/                       ├── certificates/
├── insurance-adapter/                       ├── ai-coach/
├── calendar/                                ├── ingestion/
├── elections/                               ├── quiz/
├── dues/                                    └── blog/
├── cases/
├── governance/
└── trust/
```

---

## Phase 3: New Repo Structure (Week 2-3)

### 3.1 Target Repo: `nzila-union-eyes`

```
nzila-union-eyes/
├── .github/
│   └── workflows/
│       ├── ci.yml                    ← From scaffold ci-cd/
│       ├── cd-staging.yml
│       └── cd-production.yml
├── frontend/                         ← Next.js 15 (cleaned)
│   ├── app/
│   │   ├── (public)/                ← Landing, marketing
│   │   ├── (auth)/                  ← Clerk flows
│   │   ├── (dashboard)/             ← Member dashboard
│   │   ├── (admin)/                 ← Admin panel
│   │   └── api/                     ← BFF routes (proxy to backbone)
│   ├── components/
│   │   ├── ui/                      ← Radix UI kit (shared)
│   │   ├── union/                   ← UE-specific components
│   │   ├── governance/
│   │   ├── finance/
│   │   └── cases/
│   ├── lib/
│   │   ├── api-client.ts            ← Backbone API client
│   │   ├── auth/                    ← Clerk hooks/utilities
│   │   ├── types/                   ← TypeScript types (generated from OpenAPI)
│   │   └── utils/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── Dockerfile
│   └── vitest.config.ts
├── backend/                          ← Django app (UE-specific logic)
│   ├── unions/                      ← Union management models/views
│   ├── grievances/                  ← Grievance tracking
│   ├── bargaining/                  ← Collective bargaining
│   ├── finance/                     ← Dues, strike fund, trust
│   ├── governance/                  ← Elections, voting
│   ├── cases/                       ← Case management
│   ├── pension/                     ← Pension processor
│   ├── insurance/                   ← Insurance adapter
│   ├── calendar/                    ← Events/scheduling
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── infra/
│   ├── bicep/                       ← Azure Bicep modules
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── e2e/
│   ├── playwright.config.ts
│   └── tests/
└── README.md
```

### 3.2 Target Repo: `nzila-abr-insights`

```
nzila-abr-insights/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd-staging.yml
│       └── cd-production.yml
├── frontend/                         ← Next.js 16 → 15 (stable aligned)
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/                  ← Clerk flows (migrated from Supabase Auth)
│   │   ├── (dashboard)/
│   │   ├── (courses)/               ← LMS
│   │   ├── (cases)/                 ← Tribunal explorer
│   │   └── api/                     ← BFF routes
│   ├── components/
│   │   ├── ui/
│   │   ├── courses/
│   │   ├── cases/
│   │   ├── achievements/
│   │   └── ai/
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── auth/                    ← Clerk (replaces Supabase Auth)
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── Dockerfile
│   └── vitest.config.ts
├── backend/                          ← Django app (ABR-specific logic)
│   ├── courses/                     ← LMS models/views
│   ├── tribunal/                    ← Tribunal case data
│   ├── achievements/                ← Badges, CE credits
│   ├── certificates/               ← Certificate generation
│   ├── ai_coach/                    ← AI coaching logic
│   ├── ingestion/                   ← Data ingestion (from CLI → management command)
│   ├── quiz/                        ← Quiz engine
│   ├── blog/                        ← Content management
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── infra/
│   ├── bicep/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── e2e/
│   ├── playwright.config.ts
│   └── tests/
└── README.md
```

---

## Phase 4: Critical Migration Tasks (Week 3-5)

### 4.1 ABR Auth Migration: Supabase Auth → Clerk

**This is the highest-risk task.** ABR has deep Supabase Auth integration:

| Current (Supabase Auth) | Target (Clerk) | Migration Steps |
|--------------------------|-----------------|-----------------|
| `@supabase/ssr` cookie auth | Clerk `@clerk/nextjs` middleware | Replace middleware chain |
| Supabase RLS policies | Django permissions + Clerk JWT verification | Rewrite all RLS as Django permissions |
| SAML SSO via `@node-saml` | Clerk Enterprise SSO (SAML built-in) | Configure in Clerk dashboard |
| MSAL Azure AD via `@azure/msal-node` | Clerk Social/Enterprise connection | Configure in Clerk dashboard |
| `lib/auth/` (Supabase auth helpers) | `lib/auth/` (Clerk auth helpers) | Rewrite auth utility layer |
| User metadata in Supabase `auth.users` | User metadata in Clerk + Django User model | Migrate user data |

**Risk mitigations:**
- Run parallel auth (Supabase + Clerk) during transition
- Migrate users in batches with rollback capability
- E2E test every auth flow before cutover

### 4.2 UE Database Migration: Drizzle → Django ORM

| Current (Drizzle ORM + PostgreSQL) | Target (Django ORM + Azure PostgreSQL) | Steps |
|-------------------------------------|----------------------------------------|-------|
| `db/schema/*.ts` (TypeScript schemas) | `models.py` per Django app | Auto-generate Django models from Drizzle schema |
| `db/migrations/` (Drizzle migrations) | Django migrations | Generate initial Django migration from models |
| `db/queries/` (typed queries) | Django QuerySet / Manager methods | Rewrite as Pythonic ORM queries |
| `db/seeds/` | Django fixtures / management commands | Convert seed data |
| `db/functions/` (DB functions) | Django DB functions / raw SQL | Port PostgreSQL functions |

### 4.3 Frontend Cleanup

**UE Frontend:**
- Remove `supabase/` directory entirely
- Remove Supabase client code from `lib/`
- Replace direct DB calls with Backbone API client calls
- Keep Clerk auth (already native)
- Audit and prune unused 130+ API routes → consolidate to BFF pattern

**ABR Frontend:**
- Downgrade Next.js 16.1 → 15.x (stable, aligned with UE)
- Remove all `@supabase/*` packages
- Replace Supabase Auth with Clerk
- Replace direct Supabase queries with Backbone API client calls
- Port ingestion CLI to Django management command

---

## Phase 5: Scaffold Population (Parallel with Phase 3-4)

### 5.1 `tech-repo-scaffold/django-backbone/`

```
django-backbone/
├── config/
│   ├── settings/
│   │   ├── base.py              ← Shared settings
│   │   ├── development.py
│   │   ├── staging.py
│   │   └── production.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── auth_core/               ← Clerk JWT verification, RBAC
│   ├── billing/                 ← Stripe subscriptions, webhooks
│   ├── ai_core/                 ← Azure OpenAI, pgvector
│   ├── analytics/               ← Event tracking, metrics
│   ├── compliance/              ← Audit logging, consent
│   ├── notifications/           ← Email, SMS, push
│   ├── integrations/            ← OAuth, webhooks, API keys
│   └── content/                 ← Knowledge base, i18n
├── manage.py
├── requirements/
│   ├── base.txt
│   ├── development.txt
│   ├── production.txt
│   └── test.txt
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── README.md
```

### 5.2 `tech-repo-scaffold/ci-cd/`

```
ci-cd/
├── github-actions/
│   ├── ci-django.yml            ← Lint, test, typecheck for Django
│   ├── ci-nextjs.yml            ← Lint, test, typecheck for Next.js
│   ├── cd-staging.yml           ← Deploy to Azure staging
│   ├── cd-production.yml        ← Deploy to Azure production (manual gate)
│   ├── security-scan.yml        ← Trivy + Gitleaks + SBOM
│   └── e2e-tests.yml            ← Playwright on staging
├── scripts/
│   ├── deploy.sh
│   ├── deploy.ps1
│   └── deploy.py                ← Cross-platform deploy script
└── README.md
```

### 5.3 `tech-repo-scaffold/infra-as-code/`

```
infra-as-code/
├── bicep/
│   ├── main.bicep               ← Orchestrator
│   ├── modules/
│   │   ├── container-app.bicep
│   │   ├── postgres.bicep
│   │   ├── redis.bicep
│   │   ├── key-vault.bicep
│   │   ├── container-registry.bicep
│   │   └── monitoring.bicep
│   └── parameters/
│       ├── dev.bicepparam
│       ├── staging.bicepparam
│       └── prod.bicepparam
├── scripts/
│   ├── provision.sh
│   ├── provision.ps1
│   └── provision.py
└── README.md
```

---

## Phase 6: Validation & Go-Live Readiness (Week 5-6)

### 6.1 Quality Gates (Both Products)

| Gate | Criteria | Tool |
|------|----------|------|
| **TypeScript strict** | Zero `any` types, strict mode | `tsc --noEmit` |
| **Lint clean** | Zero ESLint errors | `eslint --max-warnings=0` |
| **Unit tests** | >80% coverage | Vitest (frontend) + pytest (backend) |
| **E2E tests** | All critical flows pass | Playwright |
| **Security scan** | Zero high/critical CVEs | Trivy + npm audit |
| **Build success** | Clean Docker build | `docker build` |
| **API contract** | OpenAPI spec validates | `openapi-generator validate` |
| **Performance** | <500ms p95 API latency | k6 load tests |

### 6.2 UE Go-Live Checklist

- [ ] All union management CRUD operations work end-to-end
- [ ] Clerk auth with full RBAC (admin/steward/member) functional
- [ ] Stripe billing flows (dues, subscriptions) work
- [ ] Grievance/case management pipeline works
- [ ] Pension processor runs correctly
- [ ] Calendar sync (Google/Outlook) functional
- [ ] Email notifications (Resend) delivering
- [ ] AI features (Azure OpenAI) responding correctly
- [ ] Docker builds succeed for both frontend and backend
- [ ] CI/CD pipeline green on all checks
- [ ] Staging deployment successful
- [ ] Load test passes (100 concurrent users)

### 6.3 ABR Go-Live Checklist

- [ ] All course CRUD and enrollment flows work
- [ ] Clerk auth replaces Supabase Auth completely (incl. SAML)
- [ ] Tribunal case explorer loads and filters correctly
- [ ] AI Coach responds with Azure OpenAI
- [ ] CE credit tracking and certificate generation work
- [ ] Achievement/badge system functional
- [ ] Quiz engine works with scoring
- [ ] Bilingual (EN/FR) content renders correctly
- [ ] Data ingestion pipeline works as Django management command
- [ ] Stripe subscription/entitlement flows work
- [ ] Docker builds succeed
- [ ] CI/CD pipeline green
- [ ] Staging deployment successful
- [ ] Load test passes (200 concurrent users)

---

## Execution Timeline

```
Week 1  ─── Audit & Extraction ───────────────────────────
              ├── UE deep audit → ue-audit-report.json
              ├── ABR deep audit → abr-audit-report.json
              └── Shared service identification

Week 2  ─── Scaffold + Structure ─────────────────────────
              ├── Populate tech-repo-scaffold (Django, CI/CD, IaC)
              ├── Create nzila-union-eyes repo structure
              ├── Create nzila-abr-insights repo structure
              └── Backbone shared services skeleton

Week 3  ─── Core Migration ───────────────────────────────
              ├── ABR: Supabase Auth → Clerk migration
              ├── UE: Drizzle → Django ORM model generation
              ├── Both: Backbone API client setup
              └── Both: Frontend cleanup (remove legacy deps)

Week 4  ─── Feature Completion ───────────────────────────
              ├── UE: All product-specific Django apps
              ├── ABR: All product-specific Django apps
              ├── Both: E2E test suites
              └── Both: CI/CD pipelines

Week 5  ─── Integration Testing ──────────────────────────
              ├── Both: Full E2E test runs
              ├── Both: Docker builds + staging deploy
              ├── Both: Load testing
              └── Both: Security scanning

Week 6  ─── Go-Live Prep ────────────────────────────────
              ├── Both: Production deployment prep
              ├── Both: Data migration scripts
              ├── Both: Monitoring setup
              └── Both: Documentation finalization
```

---

## Automation Tooling Additions Needed

To support this refactoring, the following must be added to `automation/`:

### New Generators

1. **`generators/code_generator.py`** — Auto-generates Django models from:
   - Drizzle TypeScript schemas (UE)
   - Supabase SQL migrations (ABR)
   - Outputs: `models.py`, `serializers.py`, `views.py`, `urls.py`

2. **`generators/dependency_analyzer.py`** — Maps:
   - npm dependency trees for both codebases
   - Cross-module import graphs
   - Backbone vs product-specific classification

3. **`generators/progress_tracker.py`** — Tracks:
   - Per-platform migration progress
   - Quality gate status
   - Blockers and risk items

### New Scaffold Populators

4. **`generators/scaffold_populator.py`** — Generates:
   - Django project from template
   - CI/CD workflows from template
   - Bicep modules from template
   - README and docs

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ABR auth migration breaks user sessions | HIGH | HIGH | Parallel auth, batch migration, rollback plan |
| UE schema complexity causes model errors | MEDIUM | HIGH | Automated schema-to-model generation with manual review |
| Next.js 16 → 15 downgrade breaks ABR features | LOW | MEDIUM | Feature-by-feature compatibility testing |
| Backbone API not ready when frontends need it | MEDIUM | HIGH | Mock API server for frontend development |
| Data loss during database migration | LOW | CRITICAL | Backup, dry-run migration, checksums |
| CI/CD pipeline failures block deployment | MEDIUM | MEDIUM | Local Docker build as fallback |

---

## Success Criteria

1. **UE** runs end-to-end on `nzila-union-eyes` repo with Django backend + Next.js frontend
2. **ABR** runs end-to-end on `nzila-abr-insights` repo with Django backend + Next.js frontend
3. Both use **Clerk auth** exclusively (no Supabase Auth)
4. Both connect to **Azure PostgreSQL** via Django ORM (no Drizzle, no Supabase client)
5. Both have **>80% test coverage** and **zero high CVEs**
6. Both deploy via **GitHub Actions → Azure Container Apps**
7. Both share **backbone services** (auth, billing, AI, email, analytics)
8. CLC movement can use UE immediately for real union organizing
9. ABR partnerships can demo a clean, production-ready platform
