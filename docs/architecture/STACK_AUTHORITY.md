# Nzila OS — Stack Authority Rules

> **Status**: Normative  
> **Enforced by**: `tooling/contract-tests/stack-authority.test.ts`  
> **Owner**: `@nzila/platform`  
> **Last reviewed**: 2025-02-26

---

## Purpose

This document formally designates the **authoritative data layer** for every
application in the monorepo. Where an app has both a Django backend and a
TypeScript/Drizzle data layer, exactly **one** must be designated as the
source of truth for domain mutations. The other layer is secondary (read-only,
cache, or proxy).

This eliminates the "dual-write" risk where two DB engines diverge, simplifies
audit trails, and lets contract tests enforce structural invariants.

---

## 1. Authority Designations

| App | Authority | Primary Data Layer | Secondary Layer | Notes |
|-----|-----------|-------------------|-----------------|-------|
| **console** | **TS/Drizzle** | `createScopedDb` + `platformDb` | — | **Reference implementation** |
| **cfo** | **TS/Drizzle** | `createScopedDb` + `createAuditedScopedDb` + `platformDb` | — | Console-aligned |
| **partners** | **TS/Drizzle** | `createAuditedScopedDb` + `platformDb` | — | Console-aligned + entitlements |
| **nacp-exams** | **TS/Drizzle** | `platformDb` + `resolveOrgContext` | — | Clean vertical |
| **zonga** | **TS/Drizzle** | `@nzila/db` + `resolveOrgContext` | — | ESLint-enforced `createScopedDb` |
| **shop-quoter** | **TS/Drizzle** | `db` + `platformDb` | — | Migration to `createScopedDb` pending |
| **web** | **None** | No DB | — | Static/marketing |
| **orchestrator-api** | **TS/Drizzle** | Lazy `getDb()` (Fastify) | — | API-key authed, not a business app |
| **union-eyes** | **Django** | Django ORM (12 apps) | TS/Drizzle (read proxy) | See §2 |
| **abr** | **Django** | Django ORM (10 apps) | TS wired but not active | See §2 |

---

## 2. Dual-Stack Rules (UE, ABR)

For apps where **Django is authoritative**:

### 2.1. TS layer MUST NOT perform domain mutations

The TS (Next.js) layer may:
- **Read** from `@nzila/db` for UI rendering, caching, or dashboards
- **Forward** mutations to Django via `djangoProxy()` (UE) or equivalent
- **Use** `withRLSContext` for org-scoped reads

The TS layer MUST NOT:
- Insert, update, or delete domain rows via Drizzle
- Bypass Django by writing directly to shared tables
- Maintain its own shadow schema that conflicts with Django models

### 2.2. Auth & Org Isolation

Django-authoritative apps enforce auth and org isolation in **both** layers:
- Django: `ClerkJWTMiddleware` → `OrganizationIsolationMiddleware` → `AuditLogMiddleware`
- TS: `auth()` / `requireAuth()` / `requireAdmin()` → Clerk JWT

Neither layer may serve unauthenticated requests for protected resources.

### 2.3. Audit Trail

- Django: `AuditLogMiddleware` captures all mutations automatically
- TS: `createAuditedScopedDb()` for any TS-side writes (exception cases only)
- Both layers' audit streams MUST reference the same `organizationId`

### 2.4. Proxy is the Boundary

When Django is authoritative, the TS→Django proxy (`djangoProxy()`) is the
formal API boundary. TS code calls the proxy; Django handles the mutation.

**Non-proxy direct DB writes from TS constitute a contract violation.**

---

## 3. TS-Authoritative Rules (Console, CFO, Partners, etc.)

For apps where **TS/Drizzle is authoritative**:

### 3.1. Canonical DB Access

All domain queries and mutations MUST go through:
- `createScopedDb(entityId)` — for org-scoped tables
- `createAuditedScopedDb({orgId, actorId})` — for audited mutations  
- `platformDb` — for platform-level (non-org-scoped) tables

Direct `db` imports from `@nzila/db` are restricted by ESLint (`no-shadow-db`).

### 3.2. No Django Backend

These apps have no Django component. Domain logic lives in:
- Server actions (`'use server'` files)
- API routes (`app/api/`)
- Shared packages (`@nzila/*`)

---

## 4. Enforcement

### 4.1. Contract Test: `stack-authority.test.ts`

The invariant `STACK_AUTHORITY_001` verifies:

1. **Django-authoritative apps** (UE, ABR): TS layer MUST NOT contain
   Drizzle mutation imports (`db.insert`, `db.update`, `db.delete`,
   `drizzle-orm/insert`, etc.) outside of read-only or audited-scoped
   patterns.

2. **TS-authoritative apps**: MUST NOT contain Django proxy calls or
   Python ORM imports.

3. **No new Django backends**: Any app not in the Django-authority list
   must not introduce a Django backend without updating this document
   and the governance exceptions.

### 4.2. Governance Exceptions

Exceptions are tracked in `governance/exceptions/stack-authority.json`.
Each exception has an owner, justification, and expiry date.

### 4.3. ESLint Rules

- `no-shadow-db`: Blocks direct `db` imports in app code (TS-authority apps)
- `no-shadow-ai`: Blocks direct AI provider imports
- `no-shadow-ml`: Blocks direct ML provider imports

---

## 5. Migration Roadmap

### UE → Consolidated Stack

| Phase | Target | Description |
|-------|--------|-------------|
| **Phase 1** (current) | Auth consolidation | All TS actions use `requireAuth()` from rbac-server. No raw `auth()` for mutations. |
| **Phase 2** | Read-path alignment | All TS reads go through `withRLSContext` or `createScopedDb`, never raw `db.query` |
| **Phase 3** | Mutation boundary | All domain mutations routed through `djangoProxy()`. No direct Drizzle inserts. |
| **Phase 4** | Single-authority decision | Evaluate: migrate Django apps to TS/Drizzle or commit to Django as permanent authority |

### ABR → Formal Boundary

| Phase | Target | Description |
|-------|--------|-------------|
| **Phase 1** (current) | Document Django as authority | This document ✓ |
| **Phase 2** | Add proxy | Introduce `djangoProxy()` in ABR for formal TS→Django boundary |
| **Phase 3** | Block TS writes | Contract test blocks Drizzle mutations in ABR TS layer |

---

## Appendix: Django App Inventory

### Union Eyes (12 Django apps)
`ai_core`, `analytics`, `auth_core`, `bargaining`, `billing`,
`compliance`, `content`, `core`, `grievances`, `notifications`,
`services`, `unions`

### ABR (10 Django apps)
`ai_core`, `analytics`, `auth_core`, `billing`, `compliance`,
`content`, `core`, `notifications`, `services`, `apps.core`
