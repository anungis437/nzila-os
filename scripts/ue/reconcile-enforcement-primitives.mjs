import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const directory = 'docs/union-eyes/reality-remediation/'
const censusFile = `${directory}PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.json`
const carryForwardFile = `${directory}PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.json`
const jsonFile = `${directory}PHASE_1B_2B1_ENFORCEMENT_PRIMITIVE_SEMANTICS.json`
const markdownFile = `${directory}PHASE_1B_2B1_ENFORCEMENT_PRIMITIVE_SEMANTICS.md`
const source = (file) => path.resolve(root, ...file.split('/'))
const digest = (value) => createHash('sha256').update(value).digest('hex')
const readJson = (file) => {
  const bytes = readFileSync(source(file))
  return { value: JSON.parse(bytes.toString('utf8')), sha256: digest(bytes) }
}

const { value: census, sha256: censusSha256 } = readJson(censusFile)
const { value: carryForward, sha256: carryForwardSha256 } = readJson(carryForwardFile)
const { value: previousRegistry } = readJson(jsonFile)
const primitiveArraySha256 = digest(JSON.stringify(previousRegistry.PRIMITIVES))
const expectedPrimitiveArraySha256 =
  'dd2a7b990956870b0ada147b75c1696207687229c748ac3276bb610a6555aace'
assert.equal(census.ENTRIES.length, 1910)
assert.equal(new Set(census.ENTRIES.map((entry) => entry.ENTRY_ID)).size, 1910)
assert.equal(census.STATE.PHASE_1B_2A, 'CENSUS_COMPLETE')
assert.equal(census.STATE.PHASE_1B_2B_STARTED, 'NO')
assert.equal(census.STATE.PHASE_1B_2B, 'AUTHORIZED')
assert.equal(carryForward.records.length, 56)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.STATIC_WORK_BEFORE_R2C, 56)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.TARGETLESS_EFFECTS_ADJUDICATED, 56)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.TARGETLESS_EFFECT_STATIC_WORK_AFTER_R2C, 0)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD, 13)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD, 0)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.STATIC_WORK_AFTER_R2C, 0)
assert.equal(carryForward.EXCLUSIVE_ACCOUNTING.INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS, 56)
assert.equal(carryForward.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_RESOLVED_TARGETS, 43)
assert.equal(carryForward.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_KNOWN_TARGET_DEFECTS, 0)
assert.equal(carryForward.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_TARGET_SOURCE_CEILING, 13)
assert.equal(carryForward.EXCLUSIVE_ACCOUNTING.EFFECT_TARGET_STATIC_WORK_REMAINING, 0)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD, 247)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD, 207)
assert.equal(carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD, 3)
assert.equal(carryForward.STATE.PHASE_1B_1, 'SOURCE_CEILING_ACCEPTED')
assert.equal(carryForward.STATE.PHASE_1B_2_AUTHORIZATION_CENSUS, 'AUTHORIZED')
assert.equal(carryForward.STATE.PHASE_1B_2_STARTED, 'NO')
assert.equal(census.PHASE_1B_1_FROZEN_STATE.PHASE_1B_1, 'SOURCE_CEILING_ACCEPTED')
assert.equal(census.STATE.PHASE_1B_2B, 'AUTHORIZED')
assert.equal(census.STATE.PHASE_1B_2B_STARTED, 'NO')
assert.equal(previousRegistry.PRIMITIVES.length, 20)
assert.equal(primitiveArraySha256, expectedPrimitiveArraySha256)
assert.equal(new Set(previousRegistry.PRIMITIVES.map((item) => item.PRIMITIVE_ID)).size, 20)
assert.equal(previousRegistry.EXCLUDED_OR_UNRESOLVED_CENSUS_SIGNALS.length, 8)

const primitiveDefinitions = [
  {
    id: 'UE-B2B1-PRIMITIVE-001',
    domain: 'AUTHENTICATION',
    symbol: 'auth',
    file: 'packages/platform-auth/src/entra/server.ts',
    importFrom: ['@nzila/platform-auth/entra/server', '@/lib/api-auth-guard'],
    behavior:
      'Resolves the active identity from the accepted staging-acceptance path, optional PG-session path, then the Entra/NextAuth path; returns user, organization, role, provider, and session metadata.',
    failure:
      'Optional-provider errors are caught so resolution can continue; the function can return an unauthenticated result when no provider resolves. Runtime identity was not exercised.',
    fallback:
      'Provider order is the fallback chain. The acceptance path is documented as identity-only; downstream authorization remains separate.',
    calls: ['resolveAcceptanceAuthUser', 'getAuthUser', 'getServerSession'],
    order:
      'Identity resolution entry point; internal provider order is acceptance, PG session, then Entra/NextAuth.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-002',
    domain: 'AUTHENTICATION',
    symbol: 'currentUser',
    file: 'packages/platform-auth/src/entra/server.ts',
    importFrom: ['@nzila/platform-auth/entra/server'],
    behavior:
      'Returns the current provider user profile where available; used alongside auth() when profile or metadata fields are needed.',
    failure:
      'Provider failures may be caught by the caller; this source pass does not establish runtime identity availability.',
    fallback:
      'Caller-specific fallback behavior is recorded in the calling primitive when applicable.',
    calls: ['auth'],
    order: 'Profile lookup; not by itself an organization-membership or authorization check.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-003',
    domain: 'AUTHENTICATION',
    symbol: 'getCurrentUser',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior:
      'Resolves a Union Eyes AuthUser from PG session auth first, then the platform provider path, and supplements the result with application role and organization data.',
    failure:
      'The PG lookup path can fall through; membership lookup failure can preserve a default member role. A nullable result is possible.',
    fallback:
      'PG session authentication precedes the platform authentication path; role lookup can fall back to member.',
    calls: ['getAuthUser', 'auth', 'currentUser'],
    order: 'App-level identity resolution entry point, separate from role authorization.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-004',
    domain: 'ORGANIZATION_CONTEXT',
    symbol: 'getOrganizationIdForUser',
    file: 'apps/union-eyes/lib/organization-utils.ts',
    importFrom: ['@/lib/organization-utils'],
    behavior:
      'Resolves an application organization identifier for a user through the organization utility path.',
    failure:
      'Callers may catch lookup errors and retain auth metadata or return an error; no runtime membership result was checked.',
    fallback:
      'Several callers retain provider metadata organization context when lookup fails; behavior is caller-specific.',
    calls: ['db'],
    order:
      'Organization resolution; it does not by itself establish that a requested resource belongs to that organization.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-005',
    domain: 'ROLE_PERMISSION',
    symbol: 'hasMinRole',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior:
      'Resolves the user and application organization, then compares the database role level with the requested minimum role.',
    failure:
      'Catches errors and returns false, including unresolved identity, organization, and role lookup failures.',
    fallback:
      'No access-granting fallback is present in the inspected function; errors resolve to false.',
    calls: ['auth', 'getUserRole', 'getOrganizationIdForUser', 'getRoleLevel'],
    order: 'Identity → organization lookup → canonical role lookup → hierarchy comparison.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-006',
    domain: 'ADMIN_AUTHORIZATION',
    symbol: 'isSystemAdmin',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior: 'Checks the system-administrator flag for an explicit or authenticated user ID.',
    failure: 'Logs exceptions and returns false.',
    fallback: 'No positive fallback is present in the inspected helper.',
    calls: ['auth', 'db'],
    order: 'Identity → system-admin flag query.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-007',
    domain: 'ADMIN_AUTHORIZATION',
    symbol: 'requireSystemAdmin',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior: 'Calls isSystemAdmin and throws when the check is false.',
    failure:
      'Throws a system-administrator-required error on denial; downstream HTTP mapping is caller-specific.',
    fallback: 'None observed.',
    calls: ['isSystemAdmin'],
    order: 'System-admin check → throw on false.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-008',
    domain: 'AUTHENTICATION',
    symbol: 'requireUser',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior: 'Requires an authenticated user and a resolved application user context.',
    failure:
      'Throws Unauthorized when auth has no user ID and Forbidden when the application user context cannot be resolved.',
    fallback: 'None observed.',
    calls: ['auth', 'getUserContext'],
    order: 'Identity → user-context lookup → return or throw.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-009',
    domain: 'ORGANIZATION_MEMBERSHIP',
    symbol: 'requireUserForOrganization',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior:
      'Requires an authenticated or explicitly supplied user ID and a user context for the specified organization.',
    failure:
      'Throws Unauthorized when no user ID exists and Forbidden when organization-specific user context is unresolved.',
    fallback:
      'An explicitly supplied user ID takes precedence over resolving the ID again from auth().',
    calls: ['auth', 'getUserContextForOrganization'],
    order: 'User ID → organization-specific context lookup → return or throw.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-010',
    domain: 'AUTHENTICATION',
    symbol: 'requireAuth',
    file: 'apps/union-eyes/lib/auth/rbac-server.ts',
    importFrom: ['@/lib/auth/rbac-server'],
    behavior:
      'Requires a current authenticated user and returns the user ID with the resolved application role.',
    failure:
      'Throws when identity or role resolution is unavailable; exact caller error mapping varies.',
    fallback: 'Role resolution follows the rbac-server path; no runtime role was tested.',
    calls: ['getCurrentUserRole'],
    order: 'Identity → role resolution → return or throw.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-011',
    domain: 'ADMIN_AUTHORIZATION',
    symbol: 'requireAdmin',
    file: 'apps/union-eyes/lib/auth/rbac-server.ts',
    importFrom: ['@/lib/auth/rbac-server'],
    behavior:
      'Requires an authenticated user and applies the rbac-server administrative-role condition.',
    failure: 'Throws when the user is missing or the administrative condition is not met.',
    fallback: 'None observed.',
    calls: ['requireAuth'],
    order: 'requireAuth → administrative-role condition.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-012',
    domain: 'API_AUTHENTICATION_WRAPPER',
    symbol: 'withApiAuth',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior:
      'Wraps an API handler with route/public/cron classification and optional auth requirement.',
    failure: 'Returns 401 for failed cron authentication, missing identity, or auth exceptions.',
    fallback:
      'Public routes and routes configured with requireAuth=false proceed without user authentication; cron routes use cron-secret verification.',
    calls: ['auth', 'verifyCronAuth', 'handler'],
    order: 'Route classification → cron check or user auth → handler.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-013',
    domain: 'ROLE_PERMISSION_WRAPPER',
    symbol: 'withRoleAuth',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior:
      'Deprecated wrapper that authenticates, resolves organization context, checks an exact role, and then invokes the handler.',
    failure:
      'Authentication failures return 401; role denial returns 403. Organization lookup failure can fall back to provider metadata.',
    fallback:
      'Organization lookup errors retain user.organizationId; the role check uses the helper’s application role path.',
    calls: [
      'withApiAuth',
      'getCurrentUser',
      'getOrganizationIdForUser',
      'hasRole',
      'handler',
      'auditLog',
    ],
    order:
      'withApiAuth → identity → organization → exact-role check → handler → asynchronous audit for selected role tiers.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-014',
    domain: 'ROLE_PERMISSION_WRAPPER',
    symbol: 'withRoleAuth',
    file: 'apps/union-eyes/lib/role-middleware.ts',
    importFrom: ['@/lib/role-middleware'],
    behavior:
      'Wraps organization authentication, loads organization membership, checks the configured role hierarchy, and invokes the handler.',
    failure:
      'Missing membership or insufficient role returns 403; unexpected failures inside this role wrapper return 500.',
    fallback:
      'If the user is not in the active organization, a configured super-admin organization membership may allow admin/super_admin access.',
    calls: ['withOrganizationAuth', 'getMemberByUserId', 'hasRolePermission', 'handler'],
    order: 'Organization authentication → membership lookup → role/super-admin check → handler.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-015',
    domain: 'ROLE_PERMISSION_WRAPPER',
    symbol: 'withMinRole',
    file: 'apps/union-eyes/lib/api-auth-guard.ts',
    importFrom: ['@/lib/api-auth-guard'],
    behavior:
      'Deprecated minimum-role wrapper that authenticates, resolves organization context, checks role hierarchy, and then invokes the handler.',
    failure:
      'No user or failed minimum-role check returns an authorization response; role-check exceptions in hasMinRole return false.',
    fallback:
      'Organization lookup errors can retain auth metadata organization; access is not granted by that fallback alone.',
    calls: [
      'withApiAuth',
      'getCurrentUser',
      'getOrganizationIdForUser',
      'hasMinRole',
      'handler',
      'auditLog',
    ],
    order:
      'withApiAuth → identity → organization → minimum-role check → handler → asynchronous audit for selected role tiers.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-016',
    domain: 'ORGANIZATION_MEMBERSHIP_WRAPPER',
    symbol: 'withOrganizationAuth',
    file: 'apps/union-eyes/lib/organization-middleware.ts',
    importFrom: ['@/lib/organization-middleware'],
    behavior:
      'Requires a user, resolves organization under an authenticated system-sentinel RLS context, then checks organization membership and runs the handler in organization RLS context.',
    failure: 'Maps Unauthorized to 401, Forbidden to 403, and logs/maps unexpected errors to 500.',
    fallback: 'No organization-metadata fallback is present in the inspected wrapper.',
    calls: [
      'requireUser',
      'withRLSContext',
      'getOrganizationIdForUser',
      'requireUserForOrganization',
      'handler',
    ],
    order:
      'requireUser → system-sentinel RLS org resolution → org-scoped RLS → membership check → handler.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-017',
    domain: 'RLS_CONTEXT',
    symbol: 'withRLSContext',
    file: 'apps/union-eyes/lib/db/with-rls-context.ts',
    importFrom: ['@/lib/db/with-rls-context'],
    behavior:
      'Runs an operation in a transaction with authenticated user context and transaction-local PostgreSQL RLS settings; an explicit context map requires a non-empty organizationId.',
    failure:
      'Throws when user identity is absent, when explicit organization context is invalid, or when default organization resolution is absent.',
    fallback:
      'Default org resolution tries provider org metadata and then currentUser metadata; lookup exceptions do not bypass the missing-org failure.',
    calls: ['auth', 'currentUser', 'db.transaction', 'set_config', 'tenantContextStorage'],
    order:
      'Validate supplied context → auth → resolve/enforce organization (or system sentinel) → transaction-local context → callback.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-018',
    domain: 'PRIVILEGED_DATABASE_CONTEXT',
    symbol: 'withSystemContext',
    file: 'apps/union-eyes/lib/db/with-rls-context.ts',
    importFrom: ['@/lib/db/with-rls-context'],
    behavior:
      'Runs work on systemDb in a transaction associated with the union_eyes_system database role, clears context variables, and scopes module-level db access to the transaction.',
    failure: 'Database transaction or callback errors propagate from the inspected implementation.',
    fallback:
      'No tenant-connection fallback is described; system authority depends on the explicitly named database role policies.',
    calls: ['systemDb.transaction', 'set_config', 'systemContextStorage'],
    order:
      'System-role transaction → clear local user/org variables → bind system transaction → callback.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-019',
    domain: 'ENTITLEMENT_CHECK',
    symbol: 'checkEntitlement',
    file: 'apps/union-eyes/lib/services/entitlements.ts',
    importFrom: ['@/lib/services/entitlements'],
    behavior:
      'Checks an organization subscription tier and feature list, and checks available credits for credit-requiring features.',
    failure:
      'Unknown organization and disallowed feature return denied results; caught failures are logged and return a denied result.',
    fallback: 'Missing/unknown subscription tier defaults to free.',
    calls: ['db', 'getOrganizationCredits'],
    order: 'Organization lookup → tier feature decision → optional credit check.',
  },
  {
    id: 'UE-B2B1-PRIMITIVE-020',
    domain: 'ENTITLEMENT_CHECK',
    symbol: 'requireEntitlement',
    file: 'apps/union-eyes/services/platform-economics/entitlement-guard.ts',
    importFrom: ['@/services/platform-economics/entitlement-guard'],
    behavior:
      'Checks a module entitlement for an organization and returns the entitlement result only when allowed.',
    failure:
      'Denied results are audited and then raised as EntitlementError; audit failures are not converted to a successful entitlement.',
    fallback: 'None observed.',
    calls: ['checkModuleEntitlement', 'auditLog'],
    order: 'Module entitlement check → failure audit and throw on denial → return on allowance.',
  },
]

const exposures = previousRegistry.PRIMITIVES
assert.equal(exposures.length, 20)
assert(exposures.every((primitive) => primitive.ENTRY_EXPOSURE_COUNT > 0))
assert.equal(new Set(exposures.map((primitive) => primitive.PRIMITIVE_ID)).size, 20)
assert.deepEqual(
  exposures.map((primitive) => [primitive.PRIMITIVE_ID, primitive.SYMBOL]),
  primitiveDefinitions.map((primitive) => [primitive.id, primitive.symbol]),
)

const notModeledSignals = previousRegistry.EXCLUDED_OR_UNRESOLVED_CENSUS_SIGNALS.map((item) => ({
  ...item,
  CATEGORY:
    item.REASON === 'Identifier or constant signal, not a callable primitive.'
      ? 'NON_CALLABLE_IDENTIFIER_OR_CONSTANT'
      : 'UNRESOLVED_CENSUS_SIGNAL',
}))
const sourceRangeRecords = census.ENTRIES.reduce(
  (count, entry) => count + (entry.BOUNDARY_EVIDENCE?.length ?? 0),
  0,
)
assert.equal(sourceRangeRecords, 1910)

const registry = {
  PHASE: 'PHASE_1B_2B1_ENFORCEMENT_PRIMITIVE_SEMANTICS',
  STATE: {
    PHASE_1A: 'SOURCE_CEILING_ACCEPTED',
    PHASE_1B_1: 'SOURCE_CEILING_ACCEPTED',
    PHASE_1B_2A: 'CENSUS_COMPLETE',
    PHASE_1B_2B1: 'SOURCE_CEILING_ACCEPTED',
    PHASE_1B_2B1_GATE: 'SOURCE_CEILING',
    PHASE_1B_2B2: 'AUTHORIZED',
    PHASE_1B_2B2_STARTED: 'NO',
    PHASE_1C_STARTED: 'NO',
    PHASE_1D_STARTED: 'NO',
    PHASE_2_STARTED: 'NO',
    STATIC_WORK_REMAINING: carryForward.STATIC_WORK_ACCOUNTING.STATIC_WORK_AFTER_R2C,
    R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS:
      carryForward.EXCLUSIVE_ACCOUNTING.INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS,
    R2C_TARGETLESS_EFFECT_CHAINS_RESOLVED:
      carryForward.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_RESOLVED_TARGETS,
    R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD,
    R2C_TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD,
    TARGETLESS_EFFECT_STATIC_WORK_REMAINING:
      carryForward.STATIC_WORK_ACCOUNTING.TARGETLESS_EFFECT_STATIC_WORK_AFTER_R2C,
    RESOLVED_PRIMITIVE_SEMANTICS: exposures.length,
    CENSUS_TO_REUSABLE_PRIMITIVE_LINKAGE: 'SOURCE_CEILING',
    PRIMITIVE_SOURCE_MODEL: 'SOURCE_ONLY_STATIC_CALLSITE_REGISTRY',
    PRIMITIVE_SOURCE_MODEL_QUALIFICATION:
      'Static callsites preserve the accepted source-only primitive semantics; no complete wrapper-boundary or privileged-database-path linkage is established.',
    AUTHORITY_SOURCE_CEILING_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD,
    AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD,
    R2B_AUTHORITY_SOURCE_CEILING_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD,
    R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD,
    FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD,
    AUTHORIZATION_PROVEN: 'NO',
    ORG_SCOPE_ENFORCEMENT_PROVEN: 'NO',
    RLS_CORRECTNESS_PROVEN: 'NO',
    AUDIT_COMPLETENESS_PROVEN: 'NO',
    RUNTIME_PROVEN: 'NO',
    PRODUCT_READY: 'NO',
  },
  ACCEPTED_INPUT_SHA256: {
    [censusFile]: censusSha256,
    [carryForwardFile]: carryForwardSha256,
  },
  DENOMINATOR: {
    ACCEPTED_CENSUS_ENTRIES: census.ENTRIES.length,
    UNIQUE_ENTRY_IDS: new Set(census.ENTRIES.map((entry) => entry.ENTRY_ID)).size,
    SOURCE_RANGE_RECORDS_PRESERVED: sourceRangeRecords,
    SOURCE_RESOLVED_CALLABLE_PRIMITIVES: exposures.length,
    WRAPPER_BOUNDARY_GRAPH_RECORDS: census.WRAPPER_BOUNDARY_GRAPH.length,
    PRIVILEGED_DATABASE_PATHS_RECORDED: census.PRIVILEGED_DATABASE_PATHS?.length ?? 0,
  },
  METHOD: {
    SCOPE:
      'Preserved source-only registry of callable authentication, organization, role/admin, RLS-context, and entitlement primitives from the accepted Phase 1B.2a boundary evidence.',
    SOURCE_READ_POLICY:
      'This normalization does not reopen application source or derive new call references. It retains the frozen primitive array and verifies its pre-normalization SHA-256 digest.',
    CLASSIFICATION_POLICY:
      'Descriptions record observed implementation behavior and failure/fallback paths. They do not certify correctness, effective authorization, runtime reachability, or security sufficiency.',
    LIMITATIONS: [
      'The accepted census has an empty WRAPPER_BOUNDARY_GRAPH and no recorded PRIVILEGED_DATABASE_PATHS. This registry therefore cannot claim complete wrapper composition or privileged-database-path coverage.',
      'Import paths, source declarations, and static call sites do not prove runtime reachability or successful enforcement.',
      'No resource-permission callable or independently verified privileged-database path is established by this extracted denominator; do not interpret that as absence in runtime.',
      'The source ranges establish only direct calls to the listed helpers; hidden indirection, dynamic behavior, external middleware, database policies, and runtime identity remain outside this registry.',
      'Census signal names not represented as source-resolved callable primitives are preserved below as excluded signals, not silently treated as enforced controls.',
    ],
    NOT_EVALUATED: [
      'Runtime authentication or authorization',
      'Database roles, policies, RLS behavior, and effective query results',
      'Authorization sufficiency for any route, action, organization, resource, or user',
      'Migration execution, database writes, or product remediation',
    ],
  },
  PRIMITIVES: exposures.map((primitive) => ({
    ...primitive,
  })),
  EXCLUDED_OR_UNRESOLVED_CENSUS_SIGNALS: notModeledSignals,
  PRIMITIVE_ARRAY_INTEGRITY: {
    PRE_NORMALIZATION_SHA256: expectedPrimitiveArraySha256,
    POST_NORMALIZATION_SHA256: primitiveArraySha256,
    PRESERVED: 'YES',
  },
  PRESERVATION_ASSERTIONS: {
    SOURCE_RESOLVED_PRIMITIVE_SEMANTICS: exposures.length,
    R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS:
      carryForward.EXCLUSIVE_ACCOUNTING.INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS,
    R2C_TARGETLESS_EFFECT_CHAINS_RESOLVED:
      carryForward.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_RESOLVED_TARGETS,
    R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD,
    R2C_TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD,
    TARGETLESS_EFFECT_STATIC_WORK_REMAINING:
      carryForward.STATIC_WORK_ACCOUNTING.TARGETLESS_EFFECT_STATIC_WORK_AFTER_R2C,
    AUTHORITY_SOURCE_CEILING_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD,
    AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD,
    FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD:
      carryForward.STATIC_WORK_ACCOUNTING.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD,
    CENSUS_TO_REUSABLE_PRIMITIVE_LINKAGE: 'SOURCE_CEILING',
    PHASE_1B_2B2_STARTED: 'NO',
    APPLICATION_SOURCE_MODIFIED: 'NO',
    APPLICATION_SOURCE_REOPENED: 'NO',
    RUNTIME_DATABASE_INSPECTED: 'NO',
    MIGRATION_EXECUTED: 'NO',
    DATABASE_WRITE_EXECUTED: 'NO',
  },
  NEXT_AUTHORIZED_SCOPE: {
    PHASE_1B_2B2: 'AUTHORIZED_NOT_STARTED',
    NOTE: 'This registry does not start the next phase.',
  },
}

function renderMarkdown(data) {
  const rows = data.PRIMITIVES.map(
    (item) =>
      `| ${item.PRIMITIVE_ID} | ${item.DOMAIN} | \`${item.SYMBOL}\` | ${item.ENTRY_EXPOSURE_COUNT} | [${item.IMPLEMENTATION.FILE}](../../../${item.IMPLEMENTATION.FILE})#L${item.IMPLEMENTATION.SYMBOL_DECLARATION_LINE} |`,
  ).join('\n')
  const excluded = data.EXCLUDED_OR_UNRESOLVED_CENSUS_SIGNALS.map(
    (item) => `| \`${item.SIGNAL}\` | ${item.CATEGORY} | ${item.REASON} |`,
  ).join('\n')
  const limitations = data.METHOD.LIMITATIONS.map((item) => `- ${item}`).join('\n')
  return `# Phase 1B.2b1 — Enforcement Primitive Semantics

## Gate

\`\`\`
PHASE_1B_2B1 = SOURCE_CEILING_ACCEPTED
PHASE_1B_2B1_GATE = SOURCE_CEILING
PHASE_1B_2B2 = AUTHORIZED
PHASE_1B_2B2_STARTED = NO
\`\`\`

The accepted census contains ${data.DENOMINATOR.ACCEPTED_CENSUS_ENTRIES} entries (${data.DENOMINATOR.UNIQUE_ENTRY_IDS} unique IDs). The frozen registry preserves ${data.DENOMINATOR.SOURCE_RESOLVED_CALLABLE_PRIMITIVES} source-resolved primitive semantics. Its source model is \`${data.STATE.PRIMITIVE_SOURCE_MODEL}\`; the qualification is: ${data.STATE.PRIMITIVE_SOURCE_MODEL_QUALIFICATION} The census-to-reusable-primitive linkage remains \`${data.STATE.CENSUS_TO_REUSABLE_PRIMITIVE_LINKAGE}\`. The B2B1 gate therefore remains \`SOURCE_CEILING\`; this does not negate the ${data.DENOMINATOR.SOURCE_RESOLVED_CALLABLE_PRIMITIVES} preserved primitive semantics.

The primitive array's pre-normalization and post-normalization SHA-256 digests are both \`${data.PRIMITIVE_ARRAY_INTEGRITY.PRE_NORMALIZATION_SHA256}\`. Preservation asserted: \`${data.PRIMITIVE_ARRAY_INTEGRITY.PRESERVED}\`.

## Callable primitive registry

| Primitive | Domain | Symbol | Entry exposures | Implementation anchor |
|---|---|---|---:|---|
${rows}

Each JSON record includes the exact census entry IDs and evidence call-site lines, import paths, implementation declaration anchor and file digest, observed invocation order, dependencies, behavior, failures, and fallback behavior. Exposure counts represent static source references only.

## Census signals not resolved as callable primitives

| Signal | Category | Treatment |
|---|---|---|
${excluded || '| None | All observed signal names map to a callable primitive. |'}

## R2C accounting and carry-forward state

\`\`\`
R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS = ${data.PRESERVATION_ASSERTIONS.R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS}
R2C_TARGETLESS_EFFECT_CHAINS_RESOLVED = ${data.PRESERVATION_ASSERTIONS.R2C_TARGETLESS_EFFECT_CHAINS_RESOLVED}
R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD = ${data.PRESERVATION_ASSERTIONS.R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD}
R2C_TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD = ${data.PRESERVATION_ASSERTIONS.R2C_TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD}
TARGETLESS_EFFECT_STATIC_WORK_REMAINING = ${data.PRESERVATION_ASSERTIONS.TARGETLESS_EFFECT_STATIC_WORK_REMAINING}
AUTHORITY_SOURCE_CEILING_CARRY_FORWARD = ${data.PRESERVATION_ASSERTIONS.AUTHORITY_SOURCE_CEILING_CARRY_FORWARD}
AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD = ${data.PRESERVATION_ASSERTIONS.AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD}
FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD = ${data.PRESERVATION_ASSERTIONS.FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD}
STATIC_WORK_REMAINING = ${data.STATE.STATIC_WORK_REMAINING}
PHASE_1B_2B2 = AUTHORIZED
PHASE_1B_2B2_STARTED = NO
PHASE_1C_STARTED = NO
PHASE_1D_STARTED = NO
PHASE_2_STARTED = NO
\`\`\`

The ${data.PRESERVATION_ASSERTIONS.R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS}-chain figure is R2C's historical input denominator, not remaining static work. R2C resolved ${data.PRESERVATION_ASSERTIONS.R2C_TARGETLESS_EFFECT_CHAINS_RESOLVED} chains, carried ${data.PRESERVATION_ASSERTIONS.R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD} target-resolution source ceilings, established ${data.PRESERVATION_ASSERTIONS.R2C_TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD} new target defects, and left ${data.STATE.STATIC_WORK_REMAINING} static work remaining.

## Limitations

${limitations}

No application source was reopened or modified for this state normalization. No runtime authentication, authorization, database, migration, or database-write validation was performed. The registry is not evidence of authorization correctness, RLS correctness, audit completeness, or product readiness.
`
}

const outputs = new Map([
  [jsonFile, `${JSON.stringify(registry, null, 2)}\n`],
  [markdownFile, renderMarkdown(registry)],
])

const check = process.argv.includes('--check')
for (const [file, content] of outputs) {
  const options = (await resolveConfig(source(file))) ?? {}
  const formatted = await format(content, { ...options, filepath: source(file) })
  if (check) {
    assert.equal(readFileSync(source(file), 'utf8'), formatted, `Out of date: ${file}`)
  } else {
    writeFileSync(source(file), formatted)
  }
}

console.log(
  `${check ? 'Verified' : 'Generated'} ${exposures.length} primitive records from ${census.ENTRIES.length} census entries; gate=${registry.STATE.PHASE_1B_2B1_GATE}.`,
)
