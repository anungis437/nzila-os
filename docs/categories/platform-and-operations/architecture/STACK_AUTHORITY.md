# Nzila OS — Stack Authority Rules

> **Status**: Normative  
> **Enforced by**: `tooling/contract-tests/stack-authority.test.ts`  
> **Owner**: `@nzila/platform`  
> **Last reviewed**: 2025-02-26
> **UE current-source reconciliation**: 2026-11-18 UTC; qualification remains separate below.

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
| **cora** | **TS/Drizzle** | `@nzila/agri-db` + `resolveOrgContext` | — | Cooperative management vertical |
| **partners** | **TS/Drizzle** | `createAuditedScopedDb` + `platformDb` | — | Console-aligned + entitlements |
| **agrimo** | **TS/Drizzle** | `@nzila/agri-db` + `resolveOrgContext` | — | Agricultural traceability vertical |
| **nacp-exams** | **TS/Drizzle** | `platformDb` + `resolveOrgContext` | — | Clean vertical |
| **trade** | **TS/Drizzle** | `@nzila/trade-db` + `resolveOrgContext` | — | Cross-border trade vertical |
| **zonga** | **TS/Drizzle** | `@nzila/db` + `resolveOrgContext` | — | ESLint-enforced `createScopedDb` |
| **flow** | **TS/Drizzle** | `createScopedDb` + `createAuditedScopedDb` + control-layer | — | Full commerce vertical |
| **veridian-admin** | **TS/Drizzle** | Next.js server actions + scoped shared platform packages | — | Healthcare operations admin surface |
| **veridian-care** | **TS/Drizzle** | Next.js server actions + scoped shared platform packages | — | Clinical workflow and care coordination surface |
| **veridian-site** | **TS/Drizzle** | Next.js app router + platform-shared packages | — | Public-facing Veridian marketing and trust surface |
| **web** | **None** | No DB | — | Static/marketing |
| **orchestrator-api** | **TS/Drizzle** | Lazy `getDb()` (Fastify) | — | API-key authed, not a business app |
| **nzila-hq** | **TS/Drizzle** | `server/db/client.ts` (Drizzle) | — | INCUBATING executive cockpit — scoped DB, PILOT promotion gate |
| **union-eyes** | **Current TS/Drizzle execution contract** | Verified canonical session, authority kernel, scoped services and PostgreSQL physical guards | Retained Django model/schema sources and explicitly admitted framework sidecar | See §2.5; no blanket raw-write authority |
| **abr** | **Django** | Django ORM (10 apps) | TS wired but not active | See §2 |

---

## 2. Django-Authoritative Rules (ABR)

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

### 2.5. Union Eyes current source authority

Union Eyes is classified as TS-authoritative in the existing contract test.
Its retained Django backend is a declared sidecar, not an alternate grant of
authority to mutate every Django-managed table. Django declarations still
produce schema inputs; execution privileges come from the current admitted
table/column/function contracts and physical guards. Contained compatibility
viewsets remain denied. Moving a guarded operation back to a legacy Django
viewset does not satisfy this boundary.

Ordinary application operations must preserve the real canonical identity,
active private membership and selected organization through the transaction.
Action-specific kernel decisions and current resource facts remain required;
neither a role title, a UI link, a caller-supplied organization nor a SYSTEM
connection creates business authority. Writes retain required history and
audit in their original transaction, including refusal and rollback behavior.
Services receiving a transaction must use that transaction rather than opening
another connection for a protected write.

The platform NAR store has a separate connection and storage/signature
contract. Its persistence service must preserve that connection and acknowledge
only the signed record it actually stored. Wrapping that connection in the
application database's SYSTEM context would not establish platform authority.
Canonical tenant audit/proof persistence retains its own transaction boundary.

Current implementation sources include `apps/union-eyes/lib/authority`,
`apps/union-eyes/db/auth`, and
`apps/union-eyes/scripts/bootstrap-v2/current-authority.ts`. The current source
plan declares exact producers and privilege contracts; it does not prove a
deployment or a user journey. Legacy identity GUCs and flag-off compatibility
paths cannot bypass the current session and physical persistence guards.

The sole canonical UE qualification record is
[UE_V2_BASE_ACTION_COVERAGE.json](../../../union-eyes/staging/UE_V2_BASE_ACTION_COVERAGE.json).
This architecture reconciliation supplies no qualification, promotion,
institutional adoption, finance feature, or Step 2 acceptance. Historical
evidence remains historical.

---

## 3. TS-Authoritative Rules (Console, CFO, Partners, etc.)

For apps where **TS/Drizzle is authoritative**:

### 3.1. Canonical DB Access

All domain queries and mutations MUST go through:

- `createScopedDb(orgId)` — for org-scoped tables
- `createAuditedScopedDb({orgId, actorId})` — for audited mutations  
- `platformDb` — for platform-level (non-org-scoped) tables

Direct `db` imports from `@nzila/db` are restricted by ESLint (`no-shadow-db`).

### 3.2. No Django Backend

These apps do not introduce a new Django mutation authority. Union Eyes retains
the explicitly bounded model/framework sidecar described in §2.5. Domain logic lives in:

- Server actions (`'use server'` files)
- API routes (`app/api/`)
- Shared packages (`@nzila/*`)

---

## 4. Enforcement

### 4.1. Contract Test: `stack-authority.test.ts`

The invariant `STACK_AUTHORITY_001` verifies:

1. **Django-authoritative apps** (ABR): TS layer MUST NOT contain
   Drizzle mutation imports (`db.insert`, `db.update`, `db.delete`,
   `drizzle-orm/insert`, etc.) outside of read-only or audited-scoped
   patterns.

2. **TS-authoritative apps**: MUST NOT introduce an undeclared Django backend.
   UE's retained sidecar follows §2.5; its existing audited-context and AST
   mutation checks remain enforced.

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

### UE current contract and qualification

The earlier proxy-every-mutation roadmap is superseded by the current
source-owned execution boundary in §2.5. It must not revive denied compatibility
writers or replace canonical authority with a legacy proxy to satisfy an expired
exception.

| Boundary | Required implementation |
|----------|-------------------------|
| Identity and organization | Real canonical session and private membership, bound to each actual transaction |
| Business authority | Current action/resource kernel decisions and explicit source-backed relationships or mandates |
| Persistence | Exact admitted roles/ACLs/RLS and physical guards; required audit/history commit or roll back with the write |
| Qualification | Exact-candidate programme evidence recorded in the canonical UE coverage artifact; source designation alone proves none |

### ABR → Formal Boundary

| Phase | Target | Description |
|-------|--------|-------------|
| **Phase 1** (current) | Document Django as authority | This document ✓ |
| **Phase 2** | Add proxy | Introduce `djangoProxy()` in ABR for formal TS→Django boundary |
| **Phase 3** | Block TS writes | Contract test blocks Drizzle mutations in ABR TS layer |

---

## Appendix: Django App Inventory

### UnionEyes (12 Django apps)

`ai_core`, `analytics`, `auth_core`, `bargaining`, `billing`,
`compliance`, `content`, `core`, `grievances`, `notifications`,
`services`, `unions`

### ABR (10 Django apps)

`ai_core`, `analytics`, `auth_core`, `billing`, `compliance`,
`content`, `core`, `notifications`, `services`, `apps.core`
