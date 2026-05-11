# Nzila OS — Shared Services

## Overview

The platform layer provides shared services that all apps consume through typed interfaces. Each service has a well-defined contract, an in-memory implementation for development/testing, and is designed for backend substitution in production.

## Platform Auth (`@nzila/platform-auth`)

Shared authentication and authorization layer that wraps Clerk and provides platform-level abstractions.

### Key Exports

| Export | Purpose |
|--------|---------|
| `resolveIdentityFromClerk()` | Maps Clerk auth to `AuthenticatedIdentity` |
| `hasPlatformRole()` | Role hierarchy check |
| `hasPermission()` / `hasAllPermissions()` | Permission check |
| `canAccessModule()` | Module access check (role + entitlement + enablement) |
| `requireAuth()` | Guard: throws if not authenticated |
| `requireOrgScopeGuard()` | Guard: throws if no org context |
| `buildOrgContext()` | Constructs `OrgContext` from auth identity |
| `createPublicRouteMatcher()` | Public route detection for middleware |

### Usage

```typescript
import { requireAuth, buildOrgContext } from '@nzila/platform-auth';

export async function serverAction(formData: FormData) {
  const identity = await requireAuth();
  const orgCtx = buildOrgContext(identity, orgId);
  // ... proceed with org-scoped operation
}
```

## Platform Notifications (`@nzila/platform-notifications`)

Multi-channel notification service with org-scoped delivery.

### Interface

```typescript
interface NotificationService {
  send(input: SendNotificationInput): Promise<Notification>;
  listUnread(orgId: string, userId: string): Promise<Notification[]>;
  markRead(orgId: string, notificationId: string): Promise<void>;
  markAllRead(orgId: string, userId: string): Promise<void>;
  getUnreadCount(orgId: string, userId: string): Promise<UnreadCount>;
}
```

### Channels

- `in_app` — Real-time in-app notifications
- `email` — Email delivery
- `sms` — SMS delivery
- `push` — Push notifications

## Platform Billing (`@nzila/platform-billing`)

Entitlement and subscription management with tier-based feature gating.

### Tiers

| Tier | Features |
|------|----------|
| `free` | Dashboard, basic reports |
| `starter` | + Document generation, email notifications |
| `professional` | + Advanced analytics, API access, custom workflows |
| `enterprise` | + SSO, audit trail, custom branding, priority support |
| `government` | + Data residency, compliance reports, sovereign hosting |

### Interface

```typescript
interface BillingService {
  getSubscription(orgId: string): Promise<Subscription | null>;
  upsertSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  checkEntitlement(orgId: string, featureKey: string): Promise<Entitlement>;
  listEntitlements(orgId: string): Promise<Entitlement[]>;
  canAccessModule(orgId: string, moduleId: string): Promise<boolean>;
}
```

## Audit (`@nzila/audit`)

SHA-256 hash-chain append-only audit trail. Every state-changing operation creates an audit entry with org scope, actor identity, and a chain hash linking to the previous entry.

## Events (`@nzila/events`)

EventBus and EventEmitter for domain events. Platform-level events are typed via `@nzila/platform-contracts/platform-event`.
