# Union Eyes release: shared platform dependencies

Union Eyes V2 depends on three shared packages: `@nzila/platform-auth`, `@nzila/db` and `@nzila/org`. Only files with a direct dependency are in this release; each is listed with its justification. Nothing else from these packages is included.

## Not in this release (owner decision: Cora is not part of Union Eyes)

- `packages/platform-auth/src/cora-acceptance-auth.ts` (+ tests) and its exports
- `packages/platform-auth/src/source-disclosure.ts` (+ test) and its exports
- `packages/db/src/schema/cora-evidence.ts`, `cora-farmer360.ts`, `methodology.ts` and their schema-index exports
- `packages/db/drizzle/0039_cora_evidence_foundation.sql`, `0040_cora_farmer360.sql`
- `packages/db/bootstrap/*acceptance*.sql` (Cora and platform-authz acceptance fixtures)
- `*.acceptance.test.ts` (require the separate platform-authz acceptance database)

## Known residual

The shared auth DB boundary still contains an insert-only pre-identity audit channel literally named `cora-acceptance` (`packages/db/src/auth-storage-authority/execution-boundary.ts`, `bootstrap-sql.ts`) and its UE runtime proof in `scripts/bootstrap-v2/auth-runtime.ts`. It is part of the qualified Union Eyes auth security boundary and is dormant (the only caller, `cora-acceptance-auth.ts`, is not in this release). Renaming or removing it changes the qualified authority and is a separate follow-up, not part of this release.

## Included shared files

| File | Justification | Direct importer (example) |
| --- | --- | --- |
| `packages/db/drizzle/0041_platform_authorization_authority.sql` | Package export map or schema migration for an included shared module. |  |
| `packages/db/package.json` | Package export map or schema migration for an included shared module. |  |
| `packages/db/src/__tests__/platform-authorization.schema.test.ts` | Unit test of an included shared source file. |  |
| `packages/db/src/audit-hash.ts` | Imported by another included shared file; required to compile it. | `packages/db/src/authorization-audit.ts` |
| `packages/db/src/auth-client.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts`, `apps/union-eyes/scripts/bootstrap-v2/organization-selection-native.test.ts`, `apps/union-eyes/scripts/bootstrap-v2/runtime-security-native.test.ts` |
| `packages/db/src/auth-storage-authority/bootstrap-sql.ts` | Imported by another included shared file; required to compile it. | `packages/db/src/auth-storage-authority/index.ts` |
| `packages/db/src/auth-storage-authority/execution-boundary.ts` | Imported by another included shared file; required to compile it. | `packages/db/src/auth-client.ts`, `packages/db/src/auth-storage-authority/bootstrap-sql.ts`, `packages/db/src/auth-storage-authority/index.ts` |
| `packages/db/src/auth-storage-authority/index.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-sql.ts` |
| `packages/db/src/auth-storage-authority/org-session-authority.ts` | Imported by another included shared file; required to compile it. | `packages/db/src/auth-storage-authority/bootstrap-sql.ts`, `packages/db/src/auth-storage-authority/index.ts` |
| `packages/db/src/auth-storage-authority/privilege-expectations.ts` | Imported by another included shared file; required to compile it. | `packages/db/src/auth-storage-authority/bootstrap-sql.ts`, `packages/db/src/auth-storage-authority/index.ts` |
| `packages/db/src/auth-storage-authority/role-prerequisites.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/framework-native.test.ts`, `apps/union-eyes/scripts/bootstrap-v2/framework-sql.ts`, `apps/union-eyes/scripts/bootstrap-v2/minimum-installer.ts` |
| `packages/db/src/authorization-audit.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/authorization-context.ts` |
| `packages/db/src/org-registry.ts` | Imported by another included shared file; required to compile it. | `packages/db/src/index.ts`, `packages/db/src/__tests__/runtime.test.ts` |
| `packages/db/src/schema/index.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/mfa/enroll/route.ts`, `apps/union-eyes/app/api/cases/intake/route.ts`, `apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts` |
| `packages/db/src/schema/platform-authorization.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-fixture.ts`, `apps/union-eyes/scripts/bootstrap-v2/source.ts` |
| `packages/org/src/context/guards.ts` | Imported by another included shared file; required to compile it. | `packages/org/src/context/guards.test.ts`, `packages/org/src/index.ts` |
| `packages/platform-auth/package.json` | Package export map or schema migration for an included shared module. |  |
| `packages/platform-auth/README.md` | Package export map or schema migration for an included shared module. |  |
| `packages/platform-auth/src/__tests__/bearer-org-binding.test.ts` | Unit test of an included shared source file. |  |
| `packages/platform-auth/src/acceptance-auth.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/organization-selection-native.test.ts` |
| `packages/platform-auth/src/acceptance-trust.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/index.ts` |
| `packages/platform-auth/src/auth-db.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/lib/auth/canonical-context.ts`, `apps/union-eyes/lib/auth/canonical-organization-selection.ts`, `apps/union-eyes/lib/auth/__tests__/canonical-context.test.ts` |
| `packages/platform-auth/src/authorization-context.test.ts` | Unit test of an included shared source file. |  |
| `packages/platform-auth/src/authorization-context.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/authorization-context.test.ts`, `packages/platform-auth/src/authorization-store.ts`, `packages/platform-auth/src/provider-identity.ts` |
| `packages/platform-auth/src/authorization-store.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/authorization-context.ts` |
| `packages/platform-auth/src/complete-auth.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/invites/service.ts`, `packages/platform-auth/src/magic-link/service.ts` |
| `packages/platform-auth/src/entra/config.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/[...nextauth]/route.ts`, `apps/union-eyes/app/api/__tests__/all-routes-import-matrix.test.ts`, `apps/union-eyes/app/api/__tests__/all-routes-smoke.test.ts` |
| `packages/platform-auth/src/entra/server.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/actions/admin-actions.ts`, `apps/union-eyes/actions/analytics-actions.ts`, `apps/union-eyes/actions/member-employment-actions.ts` |
| `packages/platform-auth/src/entra/types.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/entra/adapter.ts`, `packages/platform-auth/src/entra/client.tsx`, `packages/platform-auth/src/entra/components/onboarding-guard.tsx` |
| `packages/platform-auth/src/index.ts` | Package public entry point (barrel) used by Union Eyes imports; Cora and source-disclosure exports removed. |  |
| `packages/platform-auth/src/invites/handlers.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/invite/accept/route.ts`, `apps/union-eyes/app/api/__tests__/auth-remaining-wrappers.route.test.ts` |
| `packages/platform-auth/src/invites/service.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/lifecycle/service.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/magic-link/handlers.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/magic-link/verify/route.ts`, `apps/union-eyes/app/api/__tests__/auth-remaining-wrappers.route.test.ts` |
| `packages/platform-auth/src/magic-link/service.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/mfa/handlers.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/mfa/challenge/route.ts` |
| `packages/platform-auth/src/mfa/service.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/org-binding.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/lib/api/with-api.ts`, `apps/union-eyes/lib/api/__tests__/with-api-canonical.test.ts`, `apps/union-eyes/lib/api-auth-guard.ts` |
| `packages/platform-auth/src/password/auth-service.test.ts` | Unit test of an included shared source file. |  |
| `packages/platform-auth/src/password/auth-service.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/password/handlers.test.ts` | Unit test of an included shared source file. |  |
| `packages/platform-auth/src/password/handlers.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/login/route.ts`, `apps/union-eyes/app/api/auth/logout/route.ts`, `apps/union-eyes/app/api/auth/me/route.ts` |
| `packages/platform-auth/src/password/index.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/forgot-password/route.ts`, `apps/union-eyes/app/api/__tests__/auth-forgot-password.route.test.ts`, `apps/union-eyes/lib/auth/auth-service.ts` |
| `packages/platform-auth/src/password/session.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/policy/admin.test.ts` | Unit test of an included shared source file. |  |
| `packages/platform-auth/src/policy/admin.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/app/api/auth/policy/route.ts`, `apps/union-eyes/app/api/__tests__/auth-policy.route.test.ts`, `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/policy/service.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/complete-auth.ts`, `packages/platform-auth/src/policy/admin.test.ts`, `packages/platform-auth/src/policy/admin.ts` |
| `packages/platform-auth/src/provider-identity.ts` | Imported directly by Union Eyes source (runtime, security control, bootstrap or test). | `apps/union-eyes/scripts/bootstrap-v2/auth-native.test.ts` |
| `packages/platform-auth/src/risk/assess.test.ts` | Unit test of an included shared source file. |  |
| `packages/platform-auth/src/risk/assess.ts` | Imported by another included shared file; required to compile it. | `packages/platform-auth/src/password/auth-service.test.ts`, `packages/platform-auth/src/password/auth-service.ts`, `packages/platform-auth/src/risk/assess.test.ts` |

`packages/db/src/org-registry.ts` additionally registers the three platform-authorization tables in `NON_ORG_SCOPED_TABLES` (required by the repository registry contract test); `tooling/db/schema-snapshot.json` is regenerated with the official `tooling/db/schema-snapshot.ts write`.

