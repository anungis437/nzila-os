# Nzila OS — Org Scope Model

## Overview

The `org_scope` is the single multi-tenancy primitive for the entire Nzila OS platform. Every request, mutation, query, and event MUST be scoped to an organization. Cross-org access is denied by default.

## Canonical Types

### OrgContext

The `OrgContext<R>` type from `@nzila/org` is the canonical representation:

```typescript
interface OrgContext<R extends string = string> {
  orgId: string;        // The org scope identifier
  userId: string;       // Authenticated user
  role: R;              // User's role within this org
  permissions: string[]; // Granted permissions
  actorId: string;      // Actor identifier (user or service account)
}
```

### OrgScope (Contract)

The `OrgScope` schema in `@nzila/platform-contracts/org-scope` defines the org entity:

```typescript
const orgScopeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  status: z.enum(['active', 'suspended', 'deactivated']),
  tier: z.enum(['free', 'starter', 'professional', 'enterprise', 'government']),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});
```

## Guards (Fail-Closed)

### requireOrgScope(ctx)

Asserts that an `OrgContext` is present and valid. Throws `OrgScopeRequiredError` if null/undefined.

```typescript
import { requireOrgScope } from '@nzila/org/guards';

export async function updateMember(ctx: OrgContext | null, memberId: string) {
  requireOrgScope(ctx); // Throws if missing — fail closed
  // ctx is now guaranteed non-null
}
```

### assertSameOrg(ctx, targetOrgId)

Prevents cross-org data access. Throws `OrgAccessDeniedError` if orgIds differ.

```typescript
import { assertSameOrg } from '@nzila/org/guards';

export async function getDocument(ctx: OrgContext, document: { orgId: string }) {
  assertSameOrg(ctx, document.orgId); // Prevents cross-org leak
}
```

### requirePermission(ctx, permission)

Checks that the actor has a specific permission within their org scope.

### requireRole(ctx, ...roles)

Checks that the actor's role is in the allowed set.

### withOrgScope(fn)

Higher-order guard that wraps a function with org scope enforcement:

```typescript
const safeUpdate = withOrgScope(async (ctx: OrgContext, data: UpdateInput) => {
  // ctx is guaranteed valid
});
```

## Legacy Compatibility

The `@nzila/org/legacy` module provides adapters for legacy field names:

| Legacy Field | Canonical Field |
|-------------|----------------|
| `tenantId` | `orgId` |
| `workspaceId` | `orgId` |
| `organizationId` | `orgId` |
| `accountId` | `orgId` |

```typescript
import { extractOrgIdFromLegacy } from '@nzila/org/legacy';

const orgId = extractOrgIdFromLegacy(legacyRequest);
// Checks tenantId, workspaceId, organizationId, accountId → orgId
```

## Cross-Org Access (Invariant CROSS_ORG_DENY_001)

Cross-org data access is **always denied** unless:

1. The actor has `platform_admin` role
2. A specific federated data-sharing agreement exists
3. The access goes through the audited federation layer

Every cross-org attempt is logged in the audit trail.
