---
title: RBAC & Permissions
description: Role-based access control model for the Nzila console.
category: Security
order: 2
---

# RBAC & Permissions

The console uses `@nzila/platform-auth` session data to enforce role-based access.

## How Roles Work

Each user has a `nzilaRole` resolved from their account profile. For email/password users, the role is stored in the database. For Entra SSO users, the role is derived from security group membership. The console reads this at request time via `auth()` from `@nzila/platform-auth`.

## Available Roles

| Role | Description |
|------|-------------|
| `platform_admin` | Full unrestricted access. Can manage users, deploy, and configure all systems. |
| `studio_admin` | Access to all content, analytics, and documentation. Cannot manage infrastructure. |
| `ops` | Operations — access to automation pipelines, deployments, and monitoring. |
| `analyst` | Read-only access to analytics dashboards and reports. |
| `viewer` | Read-only access to internal documentation only. |

## Assigning Roles

For email/password users, roles are assigned via the platform admin console or directly in the database.

For Entra SSO users, roles are managed via security groups in the Azure Portal:

1. Navigate to **Microsoft Entra ID** → **Groups**.
2. Add the user to the appropriate security group (e.g., `nzila-ops`, `nzila-analyst`).
3. The role is resolved automatically at sign-in via group claims.

## Code Reference

The RBAC utilities live in `apps/console/lib/rbac.ts`:

- `getUserRole()` — Returns the current user's role from session claims.
- `requireRole(...roles)` — Throws a 403 if the user doesn't have one of the specified roles.
- `hasRole(...roles)` — Returns a boolean without throwing.
