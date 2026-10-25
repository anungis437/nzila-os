/**
 * UE-CONV-A-006 residual list: every file in Union Eyes, the shared platform-auth package and the shared database
 * package that still mentions the retired identity provider (Clerk), with its classification. The list is held to the
 * repository by lib/auth/__tests__/identity-provider-residuals.test.ts: a NEW file mentioning the provider that is not
 * listed here fails the test, so the residual can only shrink.
 *
 * Classes:
 *   webhook_alias            deprecated Django route kept until the sender is confirmed (UE-CONV-A-007); fails closed in v2.
 *   legacy_env_detection     detection-only: logs that a legacy name is set; never reads or authenticates with it.
 *   legacy_metadata          emitted alongside the real key for an out-of-repo consumer; informational, never authority.
 *   physical_column          historical physical column / constraint / index name; the app-side field is already auth-named.
 *   hashed_contract_field    part of the audit hash-chain payload; renaming would break chain verification. Do not rename.
 *   compat_shim              Clerk-compatible export names / props / comments on the Entra layer; no in-repo importer of the Clerk names.
 *   dead_candidate           no importer anywhere in the repository (proved by the test); a shared package's exported surface,
 *                            so deletion needs the platform-auth owner's sign-off. NOT deleted here.
 *   domain_role              the union office of "Clerk" (drafts and dispatches correspondence); unrelated to the provider.
 *   historical_reference     names an applied migration or replay fixture; immutable.
 *   test_fixture             test data or a negative test (e.g. the provider string must be rejected).
 *   other_app_physical       column of a table owned by another Nzila app in the shared database package.
 */
export type ResidualClass =
  | 'webhook_alias'
  | 'legacy_env_detection'
  | 'legacy_metadata'
  | 'physical_column'
  | 'hashed_contract_field'
  | 'compat_shim'
  | 'dead_candidate'
  | 'domain_role'
  | 'historical_reference'
  | 'test_fixture'
  | 'other_app_physical'

export interface ProviderResidual {
  file: string
  kind: ResidualClass
  note: string
}

const r = (kind: ResidualClass, note: string, ...files: string[]): ProviderResidual[] => files.map((file) => ({ file, kind, note }))

export const PROVIDER_RESIDUALS: readonly ProviderResidual[] = [
  ...r('webhook_alias', 'Route webhooks/clerk/ -> deprecated_clerk_webhook -> auth_webhook (logs a deprecation per call); 401 without AUTH_WEBHOOK_SECRET.',
    'apps/union-eyes/backend/auth_core/views.py', 'apps/union-eyes/backend/auth_core/urls.py', 'apps/union-eyes/backend/auth_core/middleware.py'),
  ...r('legacy_env_detection', 'CLERK_* names are logged as unread legacy settings; X-Clerk-Secret-Key is logged and ignored.',
    'apps/union-eyes/backend/config/settings.py', 'apps/union-eyes/backend/auth_core/authentication.py'),
  ...r('legacy_metadata', 'metadata.clerkUserId is sent beside metadata.userId (same authenticated value) for an unverified external consumer.',
    'apps/union-eyes/app/api/whop/create-checkout/route.ts'),
  ...r('physical_column', 'Physical column clerk_user_id (auth user id) / clerk_organization_id; the Drizzle field is already authUserId. Rename needs a governed migration.',
    'apps/union-eyes/backend/auth_core/models.py', 'apps/union-eyes/backend/auth_core/admin.py', 'apps/union-eyes/db/schema/user-uuid-mapping-schema.ts',
    'apps/union-eyes/db/schema/domains/infrastructure/uuid-mapping.ts', 'apps/union-eyes/lib/utils/user-uuid-helpers.ts',
    'apps/union-eyes/services/financial-service/src/db/schema.ts', 'apps/union-eyes/services/financial-service/drizzle/schema.ts',
    'apps/union-eyes/services/financial-service/drizzle/0000_lucky_mole_man.sql', 'packages/db/src/schema/orgs.ts', 'packages/db/src/org-registry.ts', 'packages/db/src/platform.ts'),
  ...r('hashed_contract_field', 'actorClerkUserId is a member of the audit hash-chain payload; the name is part of the verified contract.',
    'packages/db/src/audit-hash.ts', 'packages/db/src/audit.ts', 'packages/db/src/authorization-audit.ts'),
  ...r('compat_shim', 'Clerk-compatible names, props or comments on the Entra layer (clerkClient, clerkMiddleware, useClerk, appearance props).',
    'packages/platform-auth/src/entra/server.ts', 'packages/platform-auth/src/entra/admin.ts', 'packages/platform-auth/src/entra/client.tsx',
    'packages/platform-auth/src/entra/middleware.ts', 'packages/platform-auth/src/entra/verify.ts', 'packages/platform-auth/src/entra/adapter.ts',
    'packages/platform-auth/src/entra/components/org-switcher.tsx', 'packages/platform-auth/src/entra/components/sign-in.tsx',
    'packages/platform-auth/src/entra/components/sign-up.tsx', 'packages/platform-auth/src/entra/components/user-button.tsx'),
  ...r('dead_candidate', 'resolveIdentityFromClerk / mapClerkOrgRole / verifyClerkWebhook have no importer in the repository; exported through platform-auth index.ts and the ./adapter and ./clerk-adapter subpaths.',
    'packages/platform-auth/src/clerk-adapter.ts', 'packages/platform-auth/src/clerk-webhook.ts', 'packages/platform-auth/src/index.ts'),
  ...r('domain_role', 'The union office "Clerk" (UserRole.CLERK); not the identity provider.',
    'apps/union-eyes/lib/auth/roles.ts', 'apps/union-eyes/lib/auth/platform-org-role.ts', 'apps/union-eyes/lib/dashboard/role-experience.ts',
    'apps/union-eyes/app/[locale]/dashboard/committees/[id]/committee-workspace.tsx', 'apps/union-eyes/app/[locale]/dashboard/committees/committees-page.tsx',
    'apps/union-eyes/app/[locale]/dashboard/correspondence/correspondence-dashboard.tsx', 'apps/union-eyes/db/schema/domains/documents/correspondence.ts'),
  ...r('historical_reference', 'Names an applied migration or replay fixture.',
    'apps/union-eyes/scripts/p4-authority-state.ts', 'apps/union-eyes/scripts/rls-enforcement/generate-rls-enforcement-migration.ts',
    'apps/union-eyes/scripts/rls-enforcement/p4-disposable-fixture.ts', 'apps/union-eyes/db/rls-storage-authority/finance.ts'),
  ...r('test_fixture', 'Test data, a domain-role fixture or a negative test.',
    'apps/union-eyes/app/api/__tests__/whop-create-checkout.route.test.ts', 'apps/union-eyes/backend/auth_core/tests.py', 'apps/union-eyes/backend/auth_core/tests_org_binding.py',
    'apps/union-eyes/db/__tests__/authority-kernel-harness.ts', 'apps/union-eyes/db/__tests__/authority-kernel-identity.pglite.test.ts',
    'apps/union-eyes/db/__tests__/authority-kernel-resources.pglite.test.ts', 'apps/union-eyes/db/__tests__/workaid-union-side.pglite.test.ts',
    'apps/union-eyes/lib/__tests__/clause-service.test.ts', 'apps/union-eyes/lib/__tests__/user-uuid-helpers.test.ts',
    'apps/union-eyes/lib/auth/__tests__/role-access-flows.test.ts', 'apps/union-eyes/lib/validation/__tests__/member-employment-schemas.test.ts',
    'apps/union-eyes/scripts/__tests__/p4-authority-state.postgres.test.ts', 'packages/platform-auth/src/authorization-context.acceptance.test.ts'),
  ...r('other_app_physical', 'clerk_org_id / clerk_user_id columns of tables owned by other Nzila apps in the shared database package.',
    'packages/db/src/cora-farmer360.ts', 'packages/db/src/schema/equity.ts', 'packages/db/src/schema/finance.ts', 'packages/db/src/schema/ml.ts',
    'packages/db/src/schema/operations.ts', 'packages/db/src/schema/partners.ts', 'packages/db/src/schema/payments.ts', 'packages/db/src/schema/tax.ts'),
]

/** Names whose only definitions are the dead candidates; the test proves nothing imports them. */
export const DEAD_CANDIDATE_EXPORTS = ['resolveIdentityFromClerk', 'mapClerkOrgRole', 'verifyClerkWebhook'] as const
