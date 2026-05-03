# Union Eyes External Tester Containment

Last updated: 2026-05-01

## Profile

Deterministic external UX tester profile:
- userId: ue-qa-ux-tester-001
- email: ue.qa.ux.tester@nzila.test
- isolated organization id: 33333333-3333-4333-8333-333333333333
- role: member (restricted)
- metadata: externalTester=true, monitored=true, sandboxOnly=true

## Allowed Routes

- /api/auth/user-role
- /api/claims
- /api/claims/[id]
- /api/claims/[id]/updates

## Denied Routes

- /api/admin/update-role
- /api/admin/users
- /api/exports
- /api/audits
- /api/workbench/assign

## Allowed UI Flows

- Login and session validation
- Intake submission in isolated UX org
- View own case
- View own case updates

## Blocked UI Flows

- Platform admin surfaces
- Role management
- Cross-org audit export
- Production-like organization data access

## Audit Tracking Expectation

Every external tester mutation must include actor id, org id, request id, route id, and authorization decision metadata in audit evidence.

## Provisioning Checklist

1. Run pnpm ue:seed:test-env.
2. Validate deterministic user exists: ue-qa-ux-tester-001.
3. Validate org membership includes only ue-qa-ux-sandbox.
4. Validate denied route list is active through API coverage.
5. Run pnpm ue:qa:gate -- --target ux before issuing access.

## Access Window

- accessStartDate: 2026-05-01
- accessEndDate: 2026-08-01
- extensionPolicy: requires explicit human approver update

## Revocation Checklist

1. Disable auth account for ue-qa-ux-tester-001.
2. Remove isolated org membership in organization tables.
3. Invalidate active sessions.
4. Rotate temporary credential seed.
5. Export and archive tester audit trail.

## Allowed Test Scenarios

- Controlled UX walk-throughs for intake and own-case navigation
- Error-state and denied-state UX validation
- Accessibility and clarity review inside isolated sandbox data

## Prohibited Actions

- Any admin or platform-level action
- Role or membership management
- Cross-org access attempts outside approved scripts
- Export of audit packs from non-isolated org data

## Incident Procedure

1. Immediately revoke tester account and sessions.
2. Capture request and audit evidence artifacts.
3. Open security/governance incident ticket.
4. Run cross-org exposure triage checklist.
5. Require human approval before re-enabling tester access.
