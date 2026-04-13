---
title: Developer Guide
description: How to build on top of the Nzila platform — authentication patterns, API conventions, shared packages, and local development setup.
category: Developer Guide
order: 1
date: 2026-02-01
---

## Prerequisites

Before developing within the Nzila monorepo you will need:

- **Node.js** ≥ 20 (LTS)
- **pnpm** ≥ 9
- **Python** ≥ 3.12 (for Django-backed apps)
- **Docker** (for local PostgreSQL + services)
- A Microsoft Entra External ID tenant for authentication keys

---

## Repository structure

The repo is a **pnpm + Turborepo** workspace. All packages are installed from the root:

```bash
# Install all dependencies (all packages + apps)
pnpm install

# Run all dev servers in parallel
pnpm dev

# Build everything (Turborepo handles incremental caching)
pnpm build
```

Key directories:

| Path | Contents |
|------|----------|
| `apps/web` | Public-facing marketing site (Next.js) |
| `apps/abr` | ABR Insights app — hybrid Next.js + Django |
| `apps/union-eyes` | UnionEyes platform — hybrid Next.js + Django |
| `packages/db` | Shared Drizzle ORM schema + migrations |
| `packages/os-core` | Core utilities: evidence sealing, hash chains, audit helpers |
| `packages/ui` | Shared React component library |
| `content/public` | Markdown files rendered on this resources page |

---

## Authentication

All apps use **`@nzila/platform-auth`** with Microsoft Entra External ID. The middleware automatically protects server routes.

### Protecting a route (Next.js App Router)

```typescript
// middleware.ts
import { authMiddleware, createRouteMatcher } from '@nzila/platform-auth/entra/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/resources(.*)',
  '/sign-in(.*)',
]);

export default authMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});
```

### Reading the current org in a Server Component

```typescript
import { auth } from '@nzila/platform-auth/entra/server';

export default async function DashboardPage() {
  const { orgId, userId } = await auth();
  if (!orgId) throw new Error('No org context');

  // orgId is the authoritative identifier — never derive it from request params
  const data = await db
    .select()
    .from(events)
    .where(eq(events.orgId, orgId));

  return <EventList items={data} />;
}
```

> **Org isolation rule:** `orgId` must always come from the authenticated session (auth JWT). Never accept it from query params, request bodies, or cookies.

---

## Database access

### Shared DB (Drizzle ORM)

The shared schema lives in `packages/db`. Import the scoped client in app code:

```typescript
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@nzila/db';
import { auditEvents } from '@nzila/db/schema';
import { eq } from 'drizzle-orm';

export async function getOrgAuditLog(orgId: string, userId: string) {
  return withRLSContext(db, orgId, userId, async (scopedDb) => {
    return scopedDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, orgId))
      .orderBy(auditEvents.createdAt);
  });
}
```

`withRLSContext` sets `app.current_org_id` and `app.current_user_id` as PostgreSQL session variables before executing the callback, enabling RLS policies to enforce isolation at the database layer.

### Writing with audit

All mutations should go through `withAudit`:

```typescript
import { withAudit } from '@nzila/db/audit';

await withAudit(scopedDb, {
  orgId,
  userId,
  action: 'member.invite',
  orgId: newMemberId,
}, async (db) => {
  await db.insert(orgMembers).values({ orgId, userId: newMemberId });
});
```

The audit wrapper:
- Emits an `audit_events` row automatically
- **Blocks the mutation** if the audit emit fails (`[AUDIT:MANDATORY]`)
- Extends the hash chain for the emitted event

---

## Running tests

```bash
# Unit + contract tests (all packages)
pnpm test

# Contract tests only
pnpm contract-tests

# Python tests (ABR + UE backends)
python -m pytest apps/abr/backend -v
python -m pytest apps/union-eyes/backend -v

# Watch mode (single package)
cd apps/web && pnpm test --watch
```

Contract tests live in `tooling/contract-tests/` and enforce invariants that span the full stack — org isolation, audit coverage, seal integrity, etc.

---

## Adding a new shared package

```bash
# Scaffold the directory
mkdir packages/my-package
cd packages/my-package

# Create package.json
pnpm init

# Reference it from an app
# In apps/web/package.json:
# "@nzila/my-package": "workspace:*"
```

All shared packages should export a `src/index.ts` entry point and include a `tsconfig.json` that extends `@nzila/config/tsconfig/base`.

---

## CI pipeline overview

Every pull request runs:

1. **Secret scan** (Gitleaks + TruffleHog) — blocks on any detected secret
2. **Dependency audit** — blocks on CRITICAL CVEs
3. **Type check** — `pnpm typecheck` across all packages
4. **Lint** — ESLint with org-isolation rules enforced
5. **Unit tests** — Vitest + pytest
6. **Contract tests** — cross-stack invariant validation
7. **Evidence pack** — collect → seal → verify (blocking)
8. **Trivy scan** — container + filesystem CVE scan

The `governance-gate` job requires all 8 upstream jobs to pass before merge is permitted.
