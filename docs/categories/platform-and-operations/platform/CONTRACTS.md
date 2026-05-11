# Nzila OS — Platform Contracts

## Overview

`@nzila/platform-contracts` defines the canonical Zod schemas and TypeScript types that all packages and apps use. These contracts ensure type-safe communication across the platform without direct coupling between apps.

## Contract Modules

### Identity (`./identity`)

- `UserIdentity` — Core user identity (id, email, name, imageUrl)
- `SessionIdentity` — Session context (userId, sessionId, expiresAt)
- `UserDisplayProfile` — Display-safe user profile

### Org Scope (`./org-scope`)

- `OrgScopeId` — Branded string type for type-safe org identifiers
- `OrgScope` — Org entity (id, name, slug, status, tier)
- `OrgScopeMembership` — User membership in an org
- `OrgScopeRoleAssignment` — Role assignment within an org
- `OrgScopedActorContext` — Actor identity scoped to an org
- `OrgScopedRequestContext` — Full request context with correlation

### Roles (`./role`)

- `PlatformRole` — Union: `app_owner | platform_admin | org_admin | org_member | org_viewer | service_account`
- `RoleDefinition` — Role with permissions and hierarchy level
- `meetsRoleRequirement()` — Hierarchy comparison

### Error Envelope (`./error`)

- `PlatformErrorCode` — 10 standard error codes
- `PlatformError` — Canonical error shape with code, category, retryable flag
- `createPlatformError()` — Factory with automatic category/retryable mapping
- `getHttpStatus()` — Maps error code to HTTP status

### Module Registry (`./module-registry`)

- `ModuleRegistration` — Static module definition (id, name, basePath, tier, roles, etc.)
- `ModuleManifest` — Runtime-resolved module with accessibility status
- `ModuleTier` — Lifecycle tier enum

### Pagination (`./pagination`)

- `PaginatedList<T>` — Offset-based pagination envelope
- `CursorList<T>` — Cursor-based pagination envelope
- `PaginationInput` — Standard pagination request params
- `buildPaginationMeta()` — Helper to construct metadata

### Mutation (`./mutation`)

- `ActionResult<T>` — Success envelope with data + audit ID
- `ActionFailure` — Failure envelope with error code/message
- `ActionResponse<T>` — Union of success | failure
- `ok()` / `fail()` — Factory functions

### Platform Events (`./platform-event`)

17 typed event types covering org lifecycle, module operations, user management, and system events.

### Notification (`./notification`)

- `Notification` — Notification entity with channels and priority
- `UnreadCount` — Aggregated unread counts

### Entitlement (`./entitlement`)

- `Entitlement` — Feature access check result
- `Subscription` — Org subscription with tier and status
- `PlanTier` / `SubscriptionStatus` — Enums

### File Metadata (`./file-metadata`)

- `FileMetadata` — Org-scoped file metadata

### Audit Event (`./audit-event`)

- `PlatformAuditEvent` — Platform-level audit event
- `PlatformAuditInput` — Input for creating audit entries

## Usage

```typescript
// Import specific contracts
import { type PlatformRole, meetsRoleRequirement } from '@nzila/platform-contracts/role';
import { createPlatformError, getHttpStatus } from '@nzila/platform-contracts/error';
import { ok, fail } from '@nzila/platform-contracts/mutation';

// Or import everything from barrel
import { type PlatformRole, createPlatformError, ok } from '@nzila/platform-contracts';
```
