# Union Eyes Security And RBAC Audit

## Verdict

GO WITH RESTRICTIONS.

The platform has several strong building blocks for a CUPE pilot: RLS-aware data access, explicit case/document authorization services, audit logging, defensibility export logic, and a newer case API family that resolves organization context through `getOrganizationIdForUser()`. The blocker is consistency. Legacy wrappers and route families still coexist with the hardened path, and some of those legacy layers make unsafe assumptions about organization scope.

## High Severity Findings

1. `lib/organization-middleware.ts` treats organization existence as sufficient access. `validateOrganizationAccess()` currently returns true for any existing organization after a placeholder comment. If that helper is used on a request-derived org ID, tenant isolation depends on callers never misusing it.
2. `lib/api-auth-guard.ts` still sets `organizationId` for `requireApiAuth({ orgScoped: true })` from `auth().orgId`. Repository guidance in the same file explicitly says this value is an Entra security-group GUID, not the app-level organization UUID. That means org-scoped routes that trust this context are structurally risky.
3. The app still exposes overlapping auth patterns: `withApi`, `requireApiAuth`, `withRoleAuth`, `withOrganizationAuth`, and role helpers that do not all resolve organization scope the same way. For a first live deployment, that duplication raises regression risk every time a route is added or changed.

## Medium Severity Findings

1. `app/[locale]/dashboard/admin/layout.tsx` grants admin-surface access to `officer` and above, not true admin-only users. That may be intentional for union operations, but it broadens who can access pages labeled as admin.
2. The legacy claims routes remain in service while the newer case routes are more robust. This creates an avoidable split-brain security model.
3. Some privacy-sensitive services, such as `lib/services/case-timeline-service.ts`, still include placeholder comments that would be unacceptable if activated in a live member-facing path.

## Positive Controls

1. `app/api/cases/intake/route.ts` uses authentication, entitlement gating, CUPE vocabulary validation, idempotency hashing, audit logging, evidence building, and explicit organization resolution.
2. `lib/services/document-authorization-service.ts` and `lib/services/document-governance-service.ts` show a real privacy-label model rather than ad hoc document exposure.
3. Evidence export and audit routes in the newer case API path are materially better than the legacy claims path.

## Pilot Controls Required

1. Disable or hide the legacy member entry points that still depend on `/api/claims` and `/api/upload`.
2. Stop using `validateOrganizationAccess()` as a permissive org check. Replace it with explicit membership validation.
3. Remove `auth().orgId` as an org-scoping source for route authorization.
4. Standardize new pilot-critical routes on the newer case API/auth pattern only.
5. Run authenticated denial-path tests for cross-org and wrong-role access before pilot launch.

## Launch Position

Union Eyes is not ready for an unrestricted multi-role live deployment. It can support a restricted CUPE pilot if the live path is forced onto the newer case APIs and the legacy member intake path is disabled until fixed.
