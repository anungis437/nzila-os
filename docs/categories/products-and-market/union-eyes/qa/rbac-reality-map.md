# Union Eyes RBAC Reality Map

Last updated: 2026-05-01
Repository scope: apps/union-eyes

## 1. Actual roles discovered

Roles observed in runtime auth and role catalogs:
- app_owner
- coo
- cto
- platform_lead
- customer_success_director
- support_manager
- data_analytics_manager
- billing_manager
- integration_manager
- compliance_manager
- security_manager
- support_agent
- data_analyst
- billing_specialist
- integration_specialist
- content_manager
- training_coordinator
- system_admin
- clc_executive
- clc_staff
- fed_executive
- fed_staff
- national_officer
- admin
- president
- vice_president
- secretary_treasurer
- chief_steward
- officer
- clerk
- steward
- bargaining_committee
- health_safety_rep
- member

Role resolution precedence:
1. PLATFORM_ADMIN_USER_IDS or SUPER_ADMIN_EMAILS elevated mapping
2. organization_members.role for active org membership
3. metadata fallback mapping
4. default member fallback

## 2. Actual permissions/scopes discovered

Authorization in UE routes is primarily minRole-based with explicit route scopes in QA inventory.
Observed authority scopes used for QA-critical workflows:
- claims:create
- claims:read_assigned
- claims:transition
- claims:assign
- claims:update_status
- claims:comment
- documents:upload
- audit:read
- audit:export
- roles:manage
- intelligence:executive_read
- intelligence:dashboard_read
- session:read

## 3. Actual seeded QA users

Deterministic seeded users from apps/union-eyes/tests/fixtures/test-users.ts:
- ue-qa-member-primary (member, primary org)
- ue-qa-steward-primary (steward, primary org)
- ue-qa-admin-primary (admin, primary org)
- ue-qa-member-secondary (member, secondary org)
- ue-qa-steward-secondary (steward, secondary org)
- ue-qa-auditor-readonly (compliance_manager, primary org, read-only profile)
- ue-qa-ux-tester-001 (member, isolated UX org, external tester profile)
- ue-qa-member-suspended (member, primary org, inactive)

## 4. Actual organization memberships

Deterministic org fixtures from apps/union-eyes/tests/fixtures/test-orgs.ts:
- 11111111-1111-4111-8111-111111111111 (ue-qa-primary)
- 22222222-2222-4222-8222-222222222222 (ue-qa-secondary)
- 33333333-3333-4333-8333-333333333333 (ue-qa-ux-sandbox)
- 44444444-4444-4444-8444-444444444444 (ue-prod-like-guardrail)

Organization mapping is seeded in:
- organization_members
- organization_users
- auth_organization_users

## 5. Route-level auth rules

QA-critical route expectations are defined in:
- apps/union-eyes/tests/api/_qa-route-inventory.ts

Critical route examples and expected boundaries:
- app/api/workflow/transition/route.ts: steward/admin allowed; member/auditor/external tester denied.
- app/api/workbench/assign/route.ts: steward/admin allowed; member/auditor/external tester denied.
- app/api/claims/route.ts (POST): member/steward/admin allowed; unauthenticated denied.
- app/api/claims/[id]/status/route.ts: steward/admin allowed; member denied.
- app/api/exports/route.ts: auditor/admin conditional only; external tester denied.
- app/api/admin/update-role/route.ts: admin conditional; all non-admin personas denied.

## 6. Platform-admin vs UE tenant boundary

Platform-admin elevation is a global override and is not equivalent to tenant role membership.
Boundary contract:
- Platform admin identity can map to elevated role but still must honor org scoping on tenant data routes.
- UE tenant authorization remains org-scoped through organization membership checks.
- Cross-org traversal is never implicitly granted by tenant role alone.

## 7. Auditor/read-only boundary

Canonical dedicated "auditor" runtime role is not separately resolved in the primary RBAC resolver.
QA policy uses compliance_manager read-only persona as auditor profile.
Boundary contract:
- Read-only persona may access allowed audit/case read surfaces.
- Read-only persona must be denied all case or role mutations.
- Read-only persona must be denied cross-org access and unauthorized export actions.

## 8. External UX tester boundary

External tester profile:
- deterministic user id: ue-qa-ux-tester-001
- org: ue-qa-ux-sandbox only
- role: member (restricted)
- metadata: externalTester=true, monitored=true, sandboxOnly=true

Boundary contract:
- Allowed: login, constrained UX flows within isolated org.
- Denied: platform-admin surfaces, role management, cross-org access, privileged audit export.
- Tester actions must be auditable.

## 9. Known non-critical gaps

- Runtime auth is still mixed between minRole wrappers and permission-based checks.
- Some legacy routes still use older guard wrappers.
- Auditor persona is represented via compliance_manager read-only profile rather than a dedicated auditor enum.

## 10. Critical blockers

None detected for UX/pilot critical auth path documentation.
All pilot-critical routes in QA inventory have explicit auth expectations and no unknown markers.
