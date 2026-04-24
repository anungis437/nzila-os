# Nzila OS — Platform Unification Migration Notes

## What Changed

The platform unification introduces shared infrastructure packages that replace per-app bespoke implementations. This document tracks the migration path.

## New Packages

| Package | Status | Purpose |
|---------|--------|---------|
| `@nzila/platform-contracts` | **Extended** | 12 new contract modules added to existing package |
| `@nzila/org` | **Extended** | Zod schemas, guards, legacy adapters added |
| `@nzila/platform-auth` | **New** | Shared auth/authorization layer |
| `@nzila/platform-shell` | **New** | Module registry, shell context, UI components |
| `@nzila/platform-notifications` | **New** | Notification service interface |
| `@nzila/platform-billing` | **New** | Billing/entitlement service interface |

## Migration Steps (Per App)

### Step 1: Replace bespoke auth guards

**Before** (app-local):

```typescript
// apps/console/lib/api-guards.ts
import { auth } from '@clerk/nextjs/server';

export async function requireOrgAccess() {
  const { orgId, userId } = await auth();
  if (!orgId) throw new Error('No org');
  // ...
}
```

**After** (shared):

```typescript
import { requireAuth, requireOrgScopeGuard } from '@nzila/platform-auth';

export async function handleAction() {
  const identity = await requireAuth();
  const orgCtx = requireOrgScopeGuard(identity, requestedOrgId);
  // ...
}
```

### Step 2: Replace bespoke error responses

**Before**:

```typescript
return Response.json({ error: 'Not found' }, { status: 404 });
```

**After**:

```typescript
import { createPlatformError, getHttpStatus } from '@nzila/platform-contracts/error';

const error = createPlatformError('NOT_FOUND', 'Resource not found');
return Response.json(error, { status: getHttpStatus('NOT_FOUND') });
```

### Step 3: Replace bespoke mutation responses

**Before**:

```typescript
return { success: true, data: result };
```

**After**:

```typescript
import { ok, fail } from '@nzila/platform-contracts/mutation';

return ok(result, { auditId: auditEntry.id });
```

### Step 4: Add shell layout

Wrap each app's root layout with `ShellProvider` and `ShellLayout` from `@nzila/platform-shell`.

### Step 5: Replace legacy org field names

Use `extractOrgIdFromLegacy()` from `@nzila/org/legacy` during migration from `tenantId`, `workspaceId`, etc.

## What NOT to Change

- **Do NOT merge app databases** — Each app keeps its own schema namespace
- **Do NOT remove app-specific domain logic** — Only replace shared infrastructure
- **Do NOT change existing API routes** — Add platform error envelopes alongside, then migrate callers
- **Do NOT remove Clerk** — `@nzila/platform-auth` wraps Clerk, not replaces it

## Deferred Items

- Real notification delivery (email/SMS providers)
- Real billing integration (Stripe)
- Shell theming (dark mode)
- Federated cross-org data sharing
- Module hot-loading
