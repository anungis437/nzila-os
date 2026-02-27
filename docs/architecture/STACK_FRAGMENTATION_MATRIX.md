# Nzila OS — Stack Fragmentation Matrix

> **Purpose**: Authoritative source-of-truth map per app for world-class alignment.  
> **Generated**: 2026-02-26  
> **Status**: Living document — update when app architectures change.

---

## 1. Per-App Matrix

| App | Django Backend | TS DB Layer (`@nzila/db`) | Auth Pattern | DB Access Pattern | Org Context | Source of Truth |
|-----|:-:|:-:|---|---|---|---|
| **union-eyes** | **Y** (12 Django apps) | **Y** (local `@/db` Drizzle + `@nzila/db`) | `auth()` (Clerk) + custom RBAC (`api-auth-guard.ts`), `withApiAuth()`, `requireUser()`, `requireRole()` | **Dual**: Local Drizzle `db` (via `@/db/db.ts`), `createAuditedScopedDb` / `createScopedDb` (via `@nzila/db`), `createOrgScopedQuery` (Supabase adapter), `djangoProxy()` to Django REST | Clerk `auth().orgId` + `assertOrgId()` | **Split** — no single authoritative layer |
| **abr** | **Y** (10 Django apps) | **Y** (dep on `@nzila/db`, no direct TS DB queries in app code yet) | `auth()` (Clerk) + `authenticateUser()` (simple) | Django REST API (via backend services). TS layer has `@nzila/db` wired in `package.json`/`tsconfig` but actual DB queries go through Django `auth_core` middleware. No `django-proxy.ts` file — Django is accessed differently. | Django `OrganizationIsolationMiddleware` | **Django backend** is primary; TS layer is thin |
| **nacp-exams** | N | **Y** | `auth()` (Clerk) + `resolveOrgContext()` + `authenticateUser()` | `platformDb.execute()` (raw SQL via `@nzila/db/platform`) | `resolveOrgContext()` → `NacpOrgContext` | **TS/Drizzle** (`@nzila/db`) |
| **zonga** | N | **Y** | `auth()` (Clerk) + `resolveOrgContext()` + `authenticateUser()` | `@nzila/db` (health checks). ESLint enforces `createScopedDb` over raw client. | `resolveOrgContext()` → `ZongaOrgContext` | **TS/Drizzle** (`@nzila/db`) |
| **cfo** | N | **Y** | `auth()` (Clerk) + `getUserRole()` (platform RBAC) + `requireEntityAccess()` + entity membership checks | `platformDb.execute()` (raw SQL), `createScopedDb`, `createAuditedScopedDb`, `withAudit` — all from `@nzila/db` | Clerk `auth()` + `entityMembers` table lookup | **TS/Drizzle** (`@nzila/db`) — console-aligned |
| **console** | N | **Y** | `auth()` (Clerk) + `getUserRole()` (platform RBAC `NzilaRole`) + `requireEntityAccess()` + `getEntityMembership()` | `platformDb`, `createScopedDb`, `createAuditedScopedDb`, `withAudit` — all from `@nzila/db` | Clerk `auth()` + `entityMembers` table | **TS/Drizzle** (`@nzila/db`) — **reference implementation** |
| **partners** | N | **Y** | `auth()` (Clerk) + `requireAuth()` + `requirePartnerEntityAccess()` + `hasRole()` / `hasAnyRole()` (partner-specific roles) + tier gates | `platformDb` (via `@nzila/db/platform`), `createAuditedScopedDb`, `createScopedDb`, `withAudit`, entity membership checks | Clerk org → `partners` + `partnerEntities` table (entitlement-gated) | **TS/Drizzle** (`@nzila/db`) |
| **shop-quoter** | N | **Y** | `auth()` (Clerk) + `authenticateUser()` (simple) | `db` + schema imports from `@nzila/db` (direct `db.query`), `platformDb.execute()` for AI actions | Clerk `auth()` (basic) | **TS/Drizzle** (`@nzila/db`) |
| **web** | N | **N** (stub only) | `auth()` (Clerk) + `authenticateUser()` (stub) | **None** — `withAudit` is a forward-declaration stub. No `@nzila/db` dependency. | N/A (public site) | **No DB** — static/marketing |
| **orchestrator-api** | N | **Y** (lazy init) | API key (`ORCHESTRATOR_API_KEY`) via `authenticateRequest()` + `x-request-id` / `x-actor` headers | Lazy Drizzle client (`getDb()`) using `@nzila/db/schema` — only when `DATABASE_URL` set | Header-based (`x-actor`) | **TS/Drizzle** (Fastify, not Next.js) |

---

## 2. Django Backend Deep Dive

### 2.1 Union Eyes — Django Apps (12)

| # | Django App | URL Prefix | Handles |
|---|-----------|------------|---------|
| 1 | `apps.core` | — | Core models |
| 2 | `ai_core` | `/api/ai_core/` | AI/ML pipeline (inference, embeddings) |
| 3 | `analytics` | `/api/analytics/` | Reporting & analytics endpoints |
| 4 | `auth_core` | `/api/auth_core/` | Clerk JWT validation, user sync, org isolation middleware |
| 5 | `bargaining` | `/api/bargaining/` | Collective bargaining management |
| 6 | `billing` | `/api/billing/` | Subscription & billing |
| 7 | `compliance` | `/api/compliance/` | Compliance tracking |
| 8 | `content` | `/api/content/` | CMS / content management |
| 9 | `core` | `/api/core/` | Core domain (cases, members) |
| 10 | `grievances` | `/api/grievances/` | Grievance filing & tracking |
| 11 | `notifications` | `/api/notifications/` | Notification delivery |
| 12 | `unions` | `/api/unions/` | Union entity management |
| 13 | `services` | `/api/services/`, `/api/tasks/` | Service API + Celery task enqueue |

> **Note**: UE also has `django_celery_beat` and `django_celery_results` for async task processing.

**Django middleware stack**:
- `ClerkJWTMiddleware` — validates Clerk tokens
- `OrganizationIsolationMiddleware` — enforces org scoping
- `AuditLogMiddleware` — automatic audit logging

### 2.2 ABR — Django Apps (10)

| # | Django App | URL Prefix | Handles |
|---|-----------|------------|---------|
| 1 | `apps.core` | — | Core models |
| 2 | `ai_core` | `/api/ai_core/` | AI/ML pipeline |
| 3 | `analytics` | `/api/analytics/` | Reporting |
| 4 | `auth_core` | `/api/auth_core/` | Clerk JWT + org isolation |
| 5 | `billing` | `/api/billing/` | Billing |
| 6 | `compliance` | `/api/compliance/` | Compliance tracking |
| 7 | `content` | `/api/content/` | CMS |
| 8 | `core` | `/api/core/` | Core domain |
| 9 | `notifications` | `/api/notifications/` | Notifications |
| 10 | `services` | `/api/services/` | Service API endpoints |

**Django middleware stack**: Identical to UE — `ClerkJWTMiddleware` + `OrganizationIsolationMiddleware` + `AuditLogMiddleware`.

### 2.3 Django vs TS Layer — What Each Handles

| Concern | UE: Django | UE: TS (Next.js) | ABR: Django | ABR: TS (Next.js) |
|---------|-----------|-------------------|-------------|-------------------|
| Domain models | Primary (Django ORM) | Secondary (Drizzle `@/db` schema) | Primary (Django ORM) | Dependency wired but not heavily used |
| Auth / JWT validation | `ClerkJWTMiddleware` | `auth()` from Clerk + `api-auth-guard.ts` | `ClerkJWTMiddleware` | `auth()` from Clerk |
| Org isolation | `OrganizationIsolationMiddleware` | `assertOrgId()` + `createOrgScopedQuery()` | `OrganizationIsolationMiddleware` | N/A (delegates to Django) |
| Audit logging | `AuditLogMiddleware` | `createAuditedScopedDb()` | `AuditLogMiddleware` | N/A |
| AI/ML inference | `ai_core` app | `@nzila/ai-sdk` client | `ai_core` app | `@nzila/ai-sdk` client |
| API proxying | Serves REST directly | `djangoProxy()` forwards to Django | Serves REST directly | No proxy — unclear boundary |
| Celery tasks | Yes (beat + results) | N/A | No | N/A |

---

## 3. Auth Pattern Taxonomy

| Pattern | Used By | Description |
|---------|---------|-------------|
| `auth()` (Clerk) | **All apps** | Base Clerk session — `userId`, `orgId`, `orgRole` |
| `authenticateUser()` | ABR, NACP, Zonga, Shop-Quoter, UE, Console, CFO, Partners, Web | Simple guard returning `{ok, userId}` or 401 |
| `resolveOrgContext()` | NACP-Exams, Zonga | Maps Clerk org to typed app-specific context with role + permissions |
| `getUserRole()` (platform RBAC) | Console, CFO | Reads `publicMetadata.nzilaRole` from Clerk — returns `NzilaRole` |
| `requireEntityAccess()` | Console, CFO, Partners | Authenticates + checks `entity_members` table membership |
| `requireAuth()` / `requirePartnerEntityAccess()` | Partners | Partner-specific: role check + `partner_entities` entitlement lookup |
| `withApiAuth()` / `requireUser()` / `requireRole()` | UE | Custom full-stack auth guard module (`api-auth-guard.ts`) with role hierarchy |
| `withRequestContext()` | ABR, NACP, Zonga, Shop-Quoter | OS-core `AsyncLocalStorage` wrapper for request tracing |
| API key auth | Orchestrator-API | `ORCHESTRATOR_API_KEY` bearer/header validation |

---

## 4. DB Access Pattern Taxonomy

| Pattern | Used By | Description |
|---------|---------|-------------|
| `createScopedDb(entityId)` | Console, CFO, UE, Partners | **Canonical** — entity-scoped Drizzle DAL, auto WHERE-injects `entity_id` |
| `createAuditedScopedDb({orgId, actorId})` | Console, CFO, UE, Partners | Scoped DAL + automatic audit emission on mutations |
| `withAudit(scopedDb, ctx)` | Console, CFO, UE, Partners | Wrap mutations with audit trail |
| `platformDb` / `platformDb.execute()` | Console, CFO, Partners, NACP, Shop-Quoter | Unscoped platform-level DB (for non-org-scoped tables like `partners`, `entity_members`) |
| `db` (direct Drizzle) | UE (`@/db/db.ts`), Shop-Quoter (`@nzila/db`) | Direct Drizzle client — **no auto-scoping** |
| `createOrgScopedQuery()` | UE | Supabase-style adapter, adds `.eq('organization_id', orgId)` manually |
| Django ORM | UE, ABR | Python-side DB access via Django models — org isolation via middleware |
| `djangoProxy()` | UE | Forwards Next.js API requests to Django REST backend |
| `getDb()` (lazy) | Orchestrator-API | Lazy Drizzle init — only when `DATABASE_URL` present |
| Stub / None | Web | No DB — `withAudit` is a no-op forward-declaration |

---

## 5. Existing Documented Rules (Source of Truth)

### From `ARCHITECTURE.md`
- "Apps Consume, Not Bypass" — apps use `@nzila/ai-sdk` and `@nzila/ml-sdk`, never provider SDKs directly.
- "Entitlements as Data" — via `partner_entities` rows, no hardcoded IDs.

### From `docs/architecture/ORG_ISOLATION.md`
- **4-Layer Enforcement**: DB FK → Scoped DAL → Contract Tests → ESLint
- `createScopedDb(entityId)` is the canonical way to access org-scoped data
- `rawDb` from `@nzila/db/raw` is **blocked by ESLint** in `apps/*`

### From `docs/architecture/VERTICAL_SCAFFOLDING.md`
- `nzila create-vertical` generates governance-complete apps
- Every scaffolded vertical includes: Clerk middleware, `createScopedDb`, `withAudit`, no-shadow-db ESLint

### From `docs/architecture/ENFORCEMENT_SUMMARY.md`
- 5-layer enforcement: Schema → Runtime DAL → Boot-time → Lint → CI
- 384 contract tests + 27 unit tests
- INV-06 through INV-14 codify structural invariants

### From `docs/platform/APP_ADOPTION_GUIDE.md`
- Required deps: `@nzila/os-core` + `@nzila/db`
- Required CI: contract tests, evidence collection, lint, typecheck

---

## 6. Fragmentation Risk Assessment

### Critical Fragmentation: `union-eyes`

UE has the most significant stack fragmentation:

1. **Dual DB engines** — Django ORM (Python, 12+ apps) AND Drizzle (TS, `@/db` local schema + `@nzila/db`)
2. **Dual auth stacks** — Django `ClerkJWTMiddleware` AND Next.js `auth()` + massive custom `api-auth-guard.ts` (1643 lines)
3. **Dual org isolation** — Django `OrganizationIsolationMiddleware` AND TS `assertOrgId()` + `createOrgScopedQuery()`
4. **Dual audit** — Django `AuditLogMiddleware` AND TS `createAuditedScopedDb()`
5. **Proxy layer** — `djangoProxy()` forwards some Next.js routes to Django, but not all
6. **No documented authoritative source** — no doc says "Django is truth" or "Drizzle is truth"

### Moderate Fragmentation: `abr`

ABR has the same Django backend structure but the TS layer is thinner:
- Django backend has 10 apps with its own ORM models
- TS layer has `@nzila/db` as a dependency but no `django-proxy.ts` and minimal direct TS DB queries
- No clear boundary documentation

### Low Fragmentation: Platform-Aligned Apps

These apps follow the canonical NzilaOS pattern:
- **console** — Reference implementation. `createScopedDb` + `platformDb` + `getUserRole()`.
- **cfo** — Console-aligned. Same patterns.
- **partners** — Console-aligned with partner-specific entitlement gates.

### Minimal Fragmentation: Newer Verticals

- **nacp-exams**, **zonga** — Clean `resolveOrgContext()` pattern, `platformDb` for queries.
- **shop-quoter** — Uses `@nzila/db` directly (some raw `db.query`, some `platformDb.execute()`).
- **web** — No DB at all.
- **orchestrator-api** — Fastify, API key auth, lazy DB — appropriately different (not a business app).

---

## 7. Recommendations for World-Class Alignment

| Priority | Action | Affected Apps |
|----------|--------|---------------|
| **P0** | Document "Django is authoritative for domain data" or "Migrate to TS/Drizzle" for UE and ABR | union-eyes, abr |
| **P0** | Consolidate UE's auth to one stack (recommend: TS `@nzila/db` + `createScopedDb` as canonical, Django as API backend only) | union-eyes |
| **P1** | Adopt `resolveOrgContext()` or `requireEntityAccess()` uniformly across all apps | nacp-exams, zonga, shop-quoter |
| **P1** | Replace `platformDb.execute()` raw SQL with typed Drizzle queries where possible | cfo, nacp-exams, shop-quoter |
| **P2** | Add `django-proxy.ts` to ABR if Django is meant to be the data layer (parity with UE) | abr |
| **P2** | Shop-quoter: migrate from direct `db` imports to `createScopedDb` for org isolation | shop-quoter |
| **P3** | Deprecate UE's `@/db/` local schema in favor of `@nzila/db` shared schema | union-eyes |
