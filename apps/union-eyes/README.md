# Union-Eyes

> Full-stack union case management platform — grievance lifecycle, collective bargaining, evidence-sealed audit trails, and leadership analytics. Built for Canadian labour unions operating under federal and provincial employment law.

[![CI](https://github.com/anungis437/nzila-os/actions/workflows/ci.yml/badge.svg)](https://github.com/anungis437/nzila-os/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](apps/union-eyes/tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Django](https://img.shields.io/badge/Django-5-092E20)](https://djangoproject.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)
[![Tests](https://img.shields.io/badge/Tests-7%2C669_passing-brightgreen?style=for-the-badge)](../../vitest.config.ts)
[![Security](https://img.shields.io/badge/Security-10%2F10-brightgreen?style=for-the-badge)](#security-verification)
[![Compliance](https://img.shields.io/badge/Compliance-GDPR_%7C_PIPEDA_%7C_AODA-blue?style=for-the-badge)](#security)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Surface](#api-surface)
- [Database](#database)
- [Testing](#testing)
- [Observability](#observability)
- [Security](#security)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [CAPE Pilot](#cape-pilot)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Union-Eyes is the case management vertical of the [Nzila OS](../../README.md) platform. It serves Canadian unions — both traditional (steward-led) and professional (LRO-led, e.g. CAPE) — with a dual-stack architecture: **Next.js 16** for the frontend and API layer, **Django 5** as the authoritative backend for domain data.

### Why Union-Eyes?

- **Purpose-built for Canadian labour law** — grievance workflows, arbitration timelines, and compliance rules are native, not bolted on
- **Dual-stack architecture** — React/Next.js speed for the UI with Django's proven ORM as the authoritative data layer, enforced by contract tests
- **Evidence integrity by default** — SHA-256 hash-chained audit trails + AES-256 HMAC–sealed evidence packs hold up in arbitration proceedings
- **Protocol-aware** — steward-led, LRO-led, national-rep-led, or officer-led workflows; one platform, every union type
- **Enterprise-grade security** — Row-Level Security on every table, field-level encryption, 12 hardened HTTP headers, Gitleaks + CodeQL on every PR
- **Federation-scale** — CLC hierarchy support for locals, regionals, nationals, and sector-wide analytics across thousands of members

### What Union-Eyes Does

Union members, stewards, labour relations officers, and union leadership use Union-Eyes to:

- **File and track grievances** through a full lifecycle (intake → triage → investigation → mediation → arbitration → settlement/closure)
- **Manage collective bargaining** — CBA tracking, clause libraries, precedent case law
- **Run union elections** with auditable voting
- **Administer strike funds & dues** — payment processing, arrears, financial reporting
- **Ensure compliance** — GDPR, provincial privacy, Indigenous data sovereignty, accessibility
- **Generate sealed evidence packs** — tamper-evident audit bundles for arbitration and regulatory proceedings
- **Monitor health & safety** — workplace incident tracking, JOHS committees, hazard reporting
- **Coordinate federation-level operations** — CLC hierarchy, cross-local analytics, sector-wide insights

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│   Browser (React 19)  │  Mobile (responsive)  │  API consumers  │
└──────────┬────────────┴───────────┬────────────┴────────────────┘
           │                        │
           ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS 16 (port 3003)                       │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ App Router  │  │ 120+ API     │  │ Server Actions         │  │
│  │ 53 dashboard│  │ routes       │  │ 10 action files        │  │
│  │ pages       │  │ (/api/...)   │  │ (form mutations)       │  │
│  └─────────────┘  └──────┬───────┘  └────────────────────────┘  │
│                          │                                      │
│  ┌───────────────────────┴──────────────────────────────────┐   │
│  │  Middleware Stack                                        │   │
│  │  Edge: Clerk JWT → i18n → route protection               │   │
│  │  DB:   RLS context (app.current_user_id per txn)         │   │
│  │  App:  RBAC (hasRole / isSystemAdmin)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────┬─────────────────────────────────┬────────────────────┘
           │ Drizzle ORM (read replicas,     │ REST calls
           │ non-authoritative writes)       │
           ▼                                 ▼
┌────────────────────┐        ┌──────────────────────────────────┐
│   PostgreSQL 15    │◄───────│       DJANGO 5 (port 8000)      │
│                    │        │   Authoritative data layer        │
│  90+ schema tables │        │   ┌────────────────────────────┐ │
│  Row-Level Security│        │   │ grievances/  bargaining/   │ │
│  Audit hash chains │        │   │ billing/     compliance/   │ │
│                    │        │   │ unions/      analytics/    │ │
│                    │        │   │ ai_core/     auth_core/    │ │
│                    │        │   └────────────────────────────┘ │
│                    │        │   Celery workers × 4             │
│                    │        │   (email, SMS, reports, ops)     │
└────────────────────┘        └──────────────────────────────────┘
           │                                 │
           ▼                                 ▼
┌────────────────────┐        ┌──────────────────────────────────┐
│   Redis 7          │        │   Azure Blob Storage             │
│   Rate limiting    │        │   Evidence packs (sealed)        │
│   Session cache    │        │   Document uploads               │
│   BullMQ queues    │        │   Compliance snapshots           │
└────────────────────┘        └──────────────────────────────────┘
```

### Stack Authority Rule

Django is the **authoritative** data layer. The Next.js frontend may read via Drizzle ORM but must not mutate domain data directly — this is enforced by [contract tests](../../tooling/contract-tests/) on every CI run.

---

## Features

### Core Case Management

| Feature | Description |
|---------|-------------|
| **Grievance lifecycle** | Intake → triage → investigation → mediation → arbitration → settlement/closure |
| **Protocol-aware assignment** | Configurable per org: steward-led (default), LRO-led (CAPE), national-rep-led (CUPE), officer-led |
| **Case queue & workbench** | Steward/LRO dashboard with priority sorting, status filters, org scoping |
| **Precedent engine** | Case law search + citation linking for arbitration prep |
| **Settlement recommendations** | ML-informed settlement scoring and outcome prediction |
| **Evidence packs** | Tamper-evident bundles: SHA-256 hash chain, AES-256 HMAC seal, Azure Blob immutable storage |

### Collective Bargaining & Governance

| Feature | Description |
|---------|-------------|
| **CBA management** | Track collective agreements, expiry, renewal status |
| **Clause library** | Searchable clause repository with manual cross-CBA comparison capability |
| **Election management** | Auditable nomination and voting workflows |
| **Governance dashboard** | Policy compliance, executive oversight, committee tracking |
| **Federation management** | CLC hierarchy — locals, regionals, nationals, sectors |

### Finance & Membership

| Feature | Description |
|---------|-------------|
| **Dues collection** | Stripe / PayPal / Whop integration, arrears tracking |
| **Strike fund** | Fund accounting, disbursement workflow |
| **Member management** | Profiles, status tracking, transfer, seniority |
| **Financial reporting** | Revenue, expenses, fund balances, tax slips |
| **Pension administration** | Joint trust FMV, contribution tracking |

### Health, Safety & Compliance

| Feature | Description |
|---------|-------------|
| **Incident tracking** | Workplace incidents, near-misses, hazard reports |
| **JOHS committees** | Joint Occupational Health & Safety committee management |
| **Worksite inspections** | Scheduled inspection workflows with findings |
| **Compliance engine** | GDPR, provincial privacy, Indigenous data sovereignty, accessibility |
| **Compliance snapshots** | Hash-chained point-in-time compliance attestations |

### Leadership & Analytics

| Feature | Description |
|---------|-------------|
| **Leadership dashboard** | KPIs: open cases, avg resolution time, win rate, member satisfaction, evidence seal rate, pilot health |
| **Sector analytics** | Cross-local and cross-union trend analysis |
| **Movement insights** | Pattern detection across federated union data |
| **AI intelligence** | RAG-powered case research, AI-assisted drafting (budget-capped, governed) |

### Communications & Integrations

| Feature | Description |
|---------|-------------|
| **Employer communications** | Tracked correspondence with employer contacts |
| **Email / SMS / Push** | Resend, Twilio, Firebase FCM |
| **Calendar sync** | External calendar integration (deadlines, hearings) |
| **Document management** | PDF generation (PDFKit, jsPDF), DOCX parsing, Excel export |
| **SCIM provisioning** | Enterprise SSO + directory sync |

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 16.1** | App Router, Server Components, Server Actions |
| **React 19** | UI rendering |
| **TypeScript** | Strict mode |
| **Tailwind CSS 4** | Styling |
| **Radix UI** | 15+ accessible primitives |
| **TipTap** | Rich text editing |
| **Chart.js + Recharts** | Data visualisation |
| **Framer Motion** | Animations |
| **next-intl** | i18n (English + French) |
| **Clerk** | Authentication + organisation management |

### Backend

| Technology | Purpose |
|------------|---------|
| **Django 5** | Authoritative data layer, REST API |
| **Django REST Framework** | API serialization |
| **Celery + Redis** | Async task queues (email, SMS, reports, ops) |
| **Celery Beat** | Scheduled jobs (django-celery-beat) |
| **Gunicorn** | WSGI server (4 workers) |

### Data & Infrastructure

| Technology | Purpose |
|------------|---------|
| **PostgreSQL 15** | Primary database, Row-Level Security |
| **Drizzle ORM** | TypeScript schema + migrations + query builder |
| **Redis 7** | Rate limiting, caching, BullMQ job queue |
| **Azure Blob Storage** | Evidence packs, documents, compliance snapshots |
| **Azure Key Vault** | Encryption key management, rotation |

### Observability & Security

| Technology | Purpose |
|------------|---------|
| **OpenTelemetry** | Distributed tracing (full stack) |
| **Sentry** | Error tracking (server + edge + client) |
| **Structured logging** | Zero `console.*` calls — all via structured logger |
| **CSP + 12 security headers** | HSTS preload, X-Frame DENY, COEP/COOP/CORP |
| **Gitleaks + TruffleHog** | Secret scanning (CI + pre-commit) |

### Platform Packages (from Nzila OS)

| Package | Usage |
|---------|-------|
| `@nzila/os-core` | Policy engine, telemetry, evidence, config |
| `@nzila/ai-sdk` | AI client (no direct provider imports allowed) |
| `@nzila/ml-sdk` | ML client (model registry, drift monitoring) |
| `@nzila/db` | Shared Drizzle schema |
| `@nzila/blob` | Azure Blob abstraction |
| `@nzila/evidence` | Evidence pack seal & verify |
| `@nzila/payments-stripe` | Stripe integration |
| `@nzila/ui` | Shared component library |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10
- **Python** ≥ 3.11 (for Django backend)
- **PostgreSQL** 15+
- **Redis** 7+
- **Clerk account** — [clerk.com](https://clerk.com)

### 1. Install dependencies

```bash
# From the monorepo root
pnpm install

# Django backend
cd apps/union-eyes/backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
# Next.js
cp apps/union-eyes/.env.example apps/union-eyes/.env.local

# Django
cp apps/union-eyes/backend/.env.example apps/union-eyes/backend/.env
```

Key variables to set:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk auth |
| `CLERK_SECRET_KEY` | Yes | Clerk server-side auth |
| `PGHOST` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Redis for rate limiting + queues |
| `DJANGO_SECRET_KEY` | Yes | Django security |
| `AZURE_OPENAI_ENDPOINT` + `_API_KEY` | Optional | AI features |
| `STRIPE_SECRET_KEY` | Optional | Payment processing |
| `EVIDENCE_SEAL_KEY` | Optional | Evidence pack HMAC sealing |

See [`.env.example`](.env.example) for the full variable reference.

### 3. Set up the database

```bash
# Run Drizzle migrations (TypeScript schema)
pnpm --filter @nzila/union-eyes db:migrate

# Or push schema directly (development)
pnpm --filter @nzila/union-eyes db:push

# Django migrations
cd apps/union-eyes/backend
python manage.py migrate
```

### 4. Run

```bash
# Next.js frontend (port 3003)
pnpm --filter @nzila/union-eyes dev

# Django backend (port 8000)
cd apps/union-eyes/backend
python manage.py runserver

# Or use Docker Compose for the full stack
cd apps/union-eyes/backend
docker compose up
```

Open [http://localhost:3003](http://localhost:3003).

### 5. Explore the database

```bash
pnpm --filter @nzila/union-eyes db:studio
```

Opens Drizzle Studio for visual schema exploration.

---

## Project Structure

```
apps/union-eyes/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # i18n routes (en/fr)
│   │   ├── dashboard/            # 53 dashboard pages
│   │   │   ├── grievances/       #   Grievance management
│   │   │   ├── bargaining/       #   Collective bargaining
│   │   │   ├── health-safety/    #   H&S incidents, JOHS
│   │   │   ├── federation/       #   CLC hierarchy
│   │   │   ├── members/          #   Member management
│   │   │   ├── voting/           #   Elections
│   │   │   ├── strike-fund/      #   Fund accounting
│   │   │   ├── compliance/       #   Compliance engine
│   │   │   ├── analytics/        #   Reporting & insights
│   │   │   ├── pilot/            #   Pilot onboarding
│   │   │   ├── workbench/        #   Steward/LRO workbench
│   │   │   └── ...               #   40+ more modules
│   │   └── (marketing)/          # Public pages
│   └── api/                      # 120+ API route handlers
│       ├── grievances/           #   CRUD + workflow transitions
│       ├── cases/                #   Case assignment & queue
│       ├── pilot/                #   Pilot health, checklist
│       ├── leadership/           #   KPI dashboard data
│       ├── employers/            #   Employer contacts & comms
│       ├── health-safety/        #   Incident reporting API
│       ├── evidence/             #   Evidence pack operations
│       └── ...                   #   110+ more endpoints
├── backend/                      # Django 5 (authoritative)
│   ├── grievances/               #   Grievance domain model
│   ├── bargaining/               #   CBA engine
│   ├── billing/                  #   Dues & payments
│   ├── compliance/               #   Compliance rules
│   ├── ai_core/                  #   AI capabilities
│   ├── services/                 #   Integration control plane
│   └── tests/                    #   Django test suite
├── components/                   # React components (100+ directories)
│   ├── grievances/               #   Grievance forms & views
│   ├── federation/               #   12+ federation components
│   ├── health-safety/            #   19 H&S components
│   ├── dashboard/                #   Dashboard widgets
│   ├── leadership/               #   KPI cards, charts
│   └── ...                       #   domains mirror app/ structure
├── db/                           # Drizzle schema & migrations
│   ├── schema/                   #   90+ schema files
│   │   ├── domains/              #   Domain sub-schemas
│   │   │   ├── health-safety/    #     11 tables, RLS
│   │   │   ├── federation/       #     CLC hierarchy, 8 tables
│   │   │   ├── pilot/            #     Pilot onboarding state
│   │   │   └── ...               #     15+ domain schemas
│   │   ├── grievances.ts         #   Core grievance tables
│   │   ├── audit.ts              #   Audit event log
│   │   └── ...                   #   Case, member, election, etc.
│   └── migrations/               #   SQL migration files
├── lib/                          # ~200+ utility modules
│   ├── case-assignment-engine.ts #   Protocol-aware assignment
│   ├── evidence.ts               #   Evidence pack builder
│   ├── integrations/             #   Integration framework
│   ├── payment-processor/        #   Stripe/PayPal/Square abstraction
│   ├── pilot/                    #   Pilot scoring & demo data
│   ├── representation/           #   Union representation protocols
│   ├── security/                 #   Encryption, CSRF, rate limiting
│   └── monitoring/               #   Health checks, metrics
├── services/                     # 24 domain services
│   ├── governance-service.ts     #   Policy compliance
│   ├── financial-service.ts      #   Financial operations
│   ├── pki-signature-service.ts  #   Digital signatures
│   └── ...                       #   21 more services
├── hooks/                        # React hooks
├── contexts/                     # React contexts
├── emails/                       # React Email templates
├── e2e/                          # Playwright E2E tests
├── docs/                         # Architecture & planning docs
├── scripts/                      # Evidence pipeline scripts
└── config/                       # nginx, public API routes
```

---

## API Surface

Union-Eyes exposes **120+ API route groups** under `/api/`. All routes enforce:

1. **Authentication** — Clerk JWT validation (edge middleware)
2. **Organisation scoping** — every query/mutation scoped to `orgId`
3. **RBAC** — role checks via `authorize()` from `@nzila/os-core/policy`
4. **Audit logging** — material actions emit hash-chained audit events

### Key API Groups

| Endpoint Group | Methods | Description |
|----------------|---------|-------------|
| `/api/grievances` | CRUD + transitions | Grievance lifecycle management |
| `/api/cases` | GET, POST, PATCH | Case queue, assignment, status |
| `/api/pilot/health` | GET | Pilot health score + metrics |
| `/api/pilot/checklist` | GET, PATCH | Onboarding checklist state |
| `/api/leadership/kpis` | GET | Leadership dashboard KPIs |
| `/api/employers` | CRUD | Employer contacts + communications |
| `/api/evidence` | POST, GET | Evidence pack seal & export |
| `/api/health-safety` | CRUD | Incident reports, inspections, JOHS |
| `/api/members` | CRUD | Member profiles, status, transfers |
| `/api/bargaining` | CRUD | CBA tracking, clauses |
| `/api/voting` | POST, GET | Election management |
| `/api/dues` | GET, POST | Dues calculation, arrears |
| `/api/compliance` | GET | Compliance snapshots |
| `/api/analytics` | GET | Reporting & trend data |

See [app/api/health-safety/README.md](app/api/health-safety/README.md) for a comprehensive API endpoint example with request/response documentation.

---

## Database

### Schema Overview

**90+ tables** across 20+ domains, all org-scoped with Row-Level Security.

| Domain | Key Tables | Notes |
|--------|------------|-------|
| Grievances | `grievances`, `grievance_workflow`, `grievance_assignments` | Hash-chained audit on every transition |
| Health & Safety | 11 tables (incidents, inspections, JOHS, hazards…) | [Full docs](db/schema/domains/health-safety/README.md) |
| Federation | 8 tables (CLC hierarchy, locals, regionals, sectors) | [Full docs](db/schema/domains/federation/README.md) |
| Members | `members`, `member_profiles`, `pending_profiles` | Seniority, transfers |
| Elections | `elections`, `ballots`, `votes` | Auditable |
| Finance | `dues`, `strike_fund`, `payments`, `tax_slips` | Stripe-linked |
| Audit | `audit_events`, `evidence_packs` | Append-only, hash-chained |
| Compliance | `compliance_snapshots`, `gdpr_requests` | Provincial privacy |

### Migrations

```bash
pnpm --filter @nzila/union-eyes db:generate   # Generate from schema changes
pnpm --filter @nzila/union-eyes db:migrate    # Apply pending migrations
pnpm --filter @nzila/union-eyes db:studio     # Visual explorer
```

See [db/README.md](db/README.md) and [db/migrations/README.md](db/migrations/README.md).

---

## Testing

### Unit Tests (Vitest)

```bash
pnpm --filter @nzila/union-eyes test          # Run all unit tests
pnpm --filter @nzila/union-eyes test:services  # Service layer only
```

Tests run under the `union-eyes` Vitest project (workspace mode, `@` alias to app root).

### E2E Tests (Playwright)

```bash
pnpm --filter @nzila/union-eyes e2e           # Run Playwright suite
```

**16 E2E tests** covering 6 workflow groups:
- Grievance draft save & resume
- Grievance submission flow
- Pilot readiness checklist
- Leadership dashboard KPIs
- Employer communications
- Steward workbench

Auth-gated via `PLAYWRIGHT_TEST_AUTH=true` + `TEST_USER_ID`. See [playwright.config.ts](playwright.config.ts).

### Contract Tests (monorepo-wide)

```bash
# From monorepo root
pnpm contract-tests
```

Verifies stack authority (Django owns domain mutations), org-scoping, SDK boundaries, and 5,000+ architectural invariants.

---

## Observability

Union-Eyes ships with a 3-layer observability stack, initialised in [`instrumentation.ts`](instrumentation.ts):

| Layer | Tool | What |
|-------|------|------|
| **Tracing** | OpenTelemetry | Distributed traces across Next.js + Django + Celery |
| **Errors** | Sentry | Server, edge, and client error capture with `onRequestError` |
| **Metrics** | `@nzila/os-core` | SLO counters (error rate, latency, availability) |
| **Logging** | Structured logger | JSON logs, zero `console.*` — production-safe |
| **Health** | `/api/health`, `/api/ready` | Liveness + readiness probes |

### Startup Checks

On boot, Union-Eyes validates:
1. Environment variables (fail-fast in production)
2. Database connectivity
3. Redis connectivity (fail-closed — rate-limited endpoints reject all if Redis is down)

---

## Security

### Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| **Edge** | Clerk JWT verification on every request |
| **Database** | PostgreSQL RLS with `app.current_user_id` session variable per transaction |
| **Application** | RBAC — `hasRole()`, `isSystemAdmin()`, `hasRoleInOrganization()` |
| **Webhook** | Signature verification (Clerk, Stripe, cron) |

### Security Headers (12)

CSP (no `unsafe-eval`), HSTS preload, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy strict-origin, COEP/COOP/CORP, Permissions-Policy (geolocation/camera/microphone denied).

### Evidence Integrity

Evidence packs are sealed with AES-256 HMAC (`EVIDENCE_SEAL_KEY`) and stored in Azure Blob immutable storage. The audit event table uses append-only hash chaining — altering any past record breaks the chain.

### Scanning

| Scanner | Scope | Trigger |
|---------|-------|---------|
| Gitleaks + TruffleHog | Secret detection | Every PR + pre-commit |
| CodeQL | Static analysis (TS + Python) | Every PR + weekly |
| Trivy | Container images | Dockerfile changes + weekly |
| `pnpm audit` | Dependency CVEs | Every PR + weekly |

### Security Verification

| Suite | Tests | Pass Rate |
|-------|-------|-----------|
| **RLS isolation** | 40/40 | 100% |
| **Field-level encryption** | 40/40 | 100% |
| **RBAC enforcement** | All routes | ✅ |
| **CSRF / webhook sigs** | All endpoints | ✅ |
| **Aggregate** | **80/80** | **100%** |

Security rating: **10/10** — zero known vulnerabilities, full encryption + RLS coverage, all scanning gates green.

---

## Development Status

| Phase | Milestone | Status |
|-------|-----------|--------|
| 1 | Foundation — auth, DB, RLS, project skeleton | ✅ Complete |
| 2 | Core case management — grievances, members, CBA | ✅ Complete |
| 3 | Finance — dues, strike fund, payments | ✅ Complete |
| 4 | Communications — email, SMS, push, calendar | ✅ Complete |
| 5 | Analytics — dashboards, KPIs, sector analytics | ✅ Complete |
| 6 | Compliance — GDPR, evidence packs, audit chains | ✅ Complete |
| 7 | Health & Safety — incidents, JOHS, inspections | ✅ Complete |
| 8 | Federation — CLC hierarchy, cross-local analytics | ✅ Complete |
| 9 | CAPE Pilot — LRO workflow, pilot scoring, demo | ✅ Complete |
| 10 | Release Candidate — hardening, docs, validation | 🔄 In progress |

---

## Test Coverage

| Category | Coverage | Tests |
|----------|----------|-------|
| **Security (encryption + RLS)** | 100% | 80/80 ✅ |
| **API routes** | 85%+ | 120+ ✅ |
| **React components** | 75%+ | 200+ ✅ |
| **Services & utilities** | 90%+ | 150+ ✅ |
| **E2E workflows** | 6 flows | 16 tests ✅ |
| **Contract tests** | 5,000+ | invariants ✅ |
| **Monorepo total** | — | 7,669 passing ✅ |

---

## Deployment

### Docker (recommended)

```bash
cd apps/union-eyes/backend
docker compose up --build
```

Starts: PostgreSQL 15, Redis 7, Django (Gunicorn, 4 workers), Celery (4 workers + Beat), Next.js.

### Azure SWA (CI/CD)

The `deploy-union-eyes.yml` GitHub Actions workflow deploys on push to `main`. Requires:
- `AZURE_SWA_TOKEN_UE`
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`

### Evidence Pipeline

```bash
pnpm --filter @nzila/union-eyes evidence:collect   # Gather artifacts
pnpm --filter @nzila/union-eyes evidence:seal      # HMAC seal
pnpm --filter @nzila/union-eyes evidence:verify    # Verify integrity
pnpm --filter @nzila/union-eyes evidence:all       # Full pipeline
```

### Environment-Specific Configuration

| Environment | Database | Key Vault | Auth | Monitoring |
|-------------|----------|-----------|------|------------|
| **Development** | Local PostgreSQL | Optional (fallback key) | Clerk dev | Console logs |
| **Staging** | Azure PostgreSQL | Required | Clerk staging | Sentry (staging) |
| **Production** | Azure PostgreSQL + RLS | Required | Clerk prod | OTel + Sentry + Azure Monitor |

### Deployment Checklist

**Pre-deployment:**

- [ ] All environment variables configured (see `.env.example`)
- [ ] Database connection tested with RLS policies active
- [ ] Redis accessible + rate limiting functional
- [ ] Security tests passing (80/80)
- [ ] Contract tests passing (`pnpm contract-tests`)
- [ ] Evidence pipeline verified (`evidence:verify`)
- [ ] SSL/TLS certificates configured

**Post-deployment:**

- [ ] `/api/health` returns OK
- [ ] `/api/ready` returns OK (DB + Redis)
- [ ] Clerk auth flow verified
- [ ] Sentry error tracking active
- [ ] OTel traces flowing
- [ ] Evidence pack seal + verify round-trip
- [ ] RLS isolation confirmed (cross-org query returns 0 rows)

---

## Environment Variables

See [`.env.example`](.env.example) for the complete reference. Grouped by concern:

| Group | Variables | Required |
|-------|-----------|----------|
| **Auth** | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes |
| **Database** | `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGPORT`, `PGSSLMODE` | Yes |
| **Redis** | `REDIS_URL` | Yes |
| **Django** | `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` | Yes |
| **AI** | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` | No |
| **Payments** | Stripe (secret + webhook + Connect), PayPal, Whop | No |
| **Email** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | No |
| **SMS** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | No |
| **Push** | `FCM_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | No |
| **Encryption** | `AZURE_KEY_VAULT_URL`, `FALLBACK_ENCRYPTION_KEY`, `KEY_ROTATION_ENABLED` | Prod |
| **Evidence** | `EVIDENCE_SEAL_KEY` | Prod |
| **Platform** | `SUPER_ADMIN_ORG_ID`, `PLATFORM_ADMIN_USER_IDS`, `BACKBONE_API_URL` | No |

---

## CAPE Pilot

Union-Eyes is preparing for a **4-week controlled pilot with CAPE** (Canadian Association of Professional Employees), a federal union of ~25,000 members using an **LRO-led** (Labour Relations Officer) workflow.

### Pilot Documentation

| Document | Purpose |
|----------|---------|
| [CAPE Pilot Playbook](docs/CAPE-PILOT-PLAYBOOK.md) | Week-by-week deployment guide, training plan, success metrics |
| [CAPE Pilot Audit Report](docs/CAPE-PILOT-AUDIT-REPORT.md) | Technical readiness assessment (score: 8.5/10, verdict: Pilot Ready) |
| [CAPE Demo Flow](docs/CAPE-DEMO-FLOW.md) | 7-minute demo sequence for leadership |

### Representation Protocol

Union-Eyes supports configurable representation protocols per organisation:

| Preset | Primary Role | Used By |
|--------|-------------|---------|
| `steward-led` | Shop steward | Traditional unions (default) |
| `lro-led` | Labour Relations Officer | CAPE, professional unions |
| `national-rep-led` | National representative | CUPE, large nationals |
| `officer-led` | Primary officer | Small locals |

Configure via the representation protocol API. See [lib/representation/](lib/representation/).

---

## Contributing

Union-Eyes is part of the Nzila OS monorepo. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full guide.

### Key Rules

1. **Django is authoritative** — do not mutate domain data via Drizzle/Next.js API routes
2. **Org-scope everything** — every query and mutation must include `orgId`
3. **Audit material actions** — use `withAudit()` guards on state-changing API routes
4. **No direct AI/ML imports** — use `@nzila/ai-sdk` and `@nzila/ml-sdk`
5. **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`
6. **All PRs must pass** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm contract-tests`

### Development Workflow

```bash
git checkout -b feat/my-feature
# Make changes
pnpm lint && pnpm typecheck && pnpm test
git commit -m "feat(union-eyes): add feature description"
git push -u origin feat/my-feature
# Create PR → CI gates → review → merge
```

---

## License

Proprietary — Nzila Digital Ventures. All rights reserved.

---

## Related Documentation

### Platform

| Document | Link |
|----------|------|
| Nzila OS README | [README.md](../../README.md) |
| Business Overview | [README.business.md](../../README.business.md) |
| Architecture | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Repo Contract | [docs/repo-contract/](../../docs/repo-contract/) |
| Security Policy | [SECURITY.md](../../SECURITY.md) |
| Changelog | [CHANGELOG.md](../../CHANGELOG.md) |

### Union-Eyes Internals

| Category | Key Documents |
|----------|--------------|
| **API** | [Health & Safety API](app/api/health-safety/README.md) |
| **Components** | [Federation components](components/federation/README.md) |
| **Database** | [Schema guide](db/README.md), [Migrations](db/migrations/README.md) |
| **Integrations** | [Framework guide](lib/integrations/README.md), [Payment processor](lib/payment-processor/README.md) |
| **CAPE Pilot** | [Playbook](docs/CAPE-PILOT-PLAYBOOK.md), [Audit report](docs/CAPE-PILOT-AUDIT-REPORT.md), [Demo flow](docs/CAPE-DEMO-FLOW.md) |
| **Security** | [SECURITY.md](../../SECURITY.md), [Governance](../../governance/) |
| **Operations** | [Runbooks](../../ops/runbooks/), [Incident response](../../ops/incident-response/) |

---

## Support

| Need | Channel |
|------|---------|
| Bug reports | [GitHub Issues](https://github.com/anungis437/nzila-os/issues) — include repro steps, env details, logs |
| Feature requests | [GitHub Discussions](https://github.com/anungis437/nzila-os/discussions) |
| Security issues | See [SECURITY.md](../../SECURITY.md) — private disclosure only |
| Documentation | This README, [docs/](docs/), [Nzila OS docs](../../docs/) |
