# Union Eyes RBAC Reality Map

Last updated: 2026-05-01
Source files reviewed:
- `apps/union-eyes/lib/api-auth-guard.ts`
- `apps/union-eyes/lib/auth/rbac-server.ts`
- `apps/union-eyes/lib/auth/roles.ts`
- `apps/union-eyes/lib/api/with-api.ts`
- `apps/union-eyes/db/schema/organization-members-schema.ts`
- `apps/union-eyes/db/schema/domains/member/user-management.ts`
- `apps/union-eyes/app/api/**/route.ts`

## 1) Actual authorization model (what exists)

### 1.1 Role sources (in resolution order)
1. `PLATFORM_ADMIN_USER_IDS` env override -> `app_owner`
2. `SUPER_ADMIN_EMAILS` -> `app_owner`
3. `organization_members.role` for active membership in resolved org
4. Auth metadata fallback (`publicMetadata.role`, `publicMetadata.nzilaRole` mappings)
5. Default fallback: `member`

### 1.2 Role systems currently present
- `ROLE_HIERARCHY` in `api-auth-guard.ts` (min-role checks for API wrappers)
- `UserRole` enum + `ROLE_PERMISSIONS` in `lib/auth/roles.ts` (permission catalog)
- Enterprise multi-role tables/views (`role_definitions`, `member_roles`, permission exceptions, audit logs) in `db/queries/enhanced-rbac-queries.ts`

### 1.3 Actual role list discovered
- App ops/system: `app_owner`, `coo`, `cto`, `platform_lead`, `customer_success_director`, `support_manager`, `data_analytics_manager`, `billing_manager`, `integration_manager`, `compliance_manager`, `security_manager`, `support_agent`, `data_analyst`, `billing_specialist`, `integration_specialist`, `content_manager`, `training_coordinator`, `system_admin`
- Congress/federation: `clc_executive`, `clc_staff`, `fed_executive`, `fed_staff`, `national_officer`
- Union org: `admin`, `president`, `vice_president`, `secretary_treasurer`, `chief_steward`, `officer`, `clerk`, `steward`, `bargaining_committee`, `health_safety_rep`, `member`
- Legacy aliases still mapped: `super_admin`, `guest`, `union_officer`, `union_steward`, `local_president`, `dept_steward`, `platform_admin`, etc.

## 2) Permission model reality

### 2.1 Role-based checks in route layer
- Common pattern: `withApi({ auth: { required: true, minRole: '<role>' } })`
- Legacy pattern: `requireApiAuth({ orgScoped, roles })` and/or `hasMinRole('<role>')`

### 2.2 Permission-based checks
- `ROLE_PERMISSIONS` exists with granular permissions (claims/member/voting/finance/admin/platform)
- Runtime route enforcement is mostly role-minimum based, not uniformly permission-key based

Status: `PARTIALLY_IMPLEMENTED`

## 3) Org membership and tenancy structure

- `organization_members` table: canonical org-scoped membership (`user_id`, `organization_id`, `role`, `status`)
- `user_management.organization_users` table: additional org-user role/permissions mapping
- Org resolution uses `getOrganizationIdForUser(userId)`; direct `auth().orgId` must not be used as app org UUID
- API wrappers can enforce org context (`requireOrg` in `withApi`, `orgScoped: true` in legacy guards)

## 4) Route-level authorization rules (observed)

Observed route auth patterns in `app/api/**/route.ts`:
- `member` minimum for read/common dashboard endpoints
- `steward` minimum for many operational writes and cognition endpoints
- `admin` / `platform_lead` / `vice_president` for elevated surfaces
- Mixed old/new wrappers coexist (`withApi`, `withOrganizationAuth`, `requireApiAuth`, `hasMinRole`)

Status: `IMPLEMENTED_WITH_MIXED_PATTERNS`

## 5) UE roles vs platform-admin vs auditor

### UE roles
- Functional labor workflows are primarily mediated by union roles (`member`, `steward`, `officer`, `admin`, etc.) and hierarchy.

### Platform-admin roles
- Platform/global overrides map to elevated UE roles (`platform_admin`/super-admin pathways -> `app_owner` or equivalent high-level access).

### Auditor access
- Dedicated `auditor` role not found as canonical runtime role in RBAC resolution path.
- Some audit APIs/services exist, but explicit auditor persona contract is not uniformly defined.

Status: `NOT_IMPLEMENTED` for dedicated auditor role mapping.

## 6) Multi-role behavior

- Enterprise query layer supports multiple active roles and merged permissions (`getMemberRoles`, `getMemberEffectivePermissions`, highest role level).
- Route-level wrappers are still mostly single-effective-role/min-role checks.

Status: `PARTIALLY_IMPLEMENTED`

## 7) QA-gate critical unresolved items (must fail closed)

- Endpoint-by-endpoint permission-key parity is not fully implemented yet; runtime enforcement is primarily role-based.
- Route-to-authorityScope mappings exist for some critical mutations but are not complete across all UE API surfaces.
- Dedicated auditor least-privilege runtime role mapping is not yet implemented in the primary RBAC resolution path.

Gate policy:
- If any unresolved critical item remains for critical stories, QA gate result must be `NO-GO`.
