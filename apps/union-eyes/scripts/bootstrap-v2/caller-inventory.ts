import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { deriveTypeScriptCallerGraph } from './caller-graph'
import { classifyRootCaller, summarizeBuckets } from './caller-buckets'
import { proveCurrentApplicationStartup } from './backend-application'
import { hash, root, type V2Plan } from './source'
import { financeEntries } from '../../db/rls-storage-authority/finance'
import { financialServiceLatentEntries } from '../../db/rls-storage-authority/financial-service-latent'
import { scanAdditionalDeclarationFiles } from '../schema-duplicate-table-scan'

const app = path.join(root, 'apps', 'union-eyes')
const docs = path.join(root, 'docs', 'union-eyes', 'bootstrap-v2')
const slash = (file: string) => file.replaceAll('\\', '/')

function filesWithin(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', 'dist', '__tests__'].includes(entry.name)) return []
    const file = path.join(directory, entry.name)
    return entry.isDirectory()
      ? filesWithin(file)
      : entry.isFile() && file.endsWith('.ts') && !/[.](test|spec)[.]ts$/.test(file)
        ? [file]
        : []
  })
}

function testFilesWithin(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory()
      ? testFilesWithin(file)
      : entry.isFile() && /\.(?:test|spec)\.[jt]sx?$/.test(entry.name)
        ? [file]
        : []
  })
}

function resolveTestImport(testFile: string, specifier: string) {
  const resolvedBase = specifier.startsWith('@/')
    ? path.join(app, specifier.slice(2))
    : path.resolve(path.dirname(testFile), specifier)
  for (const candidate of [
    resolvedBase,
    `${resolvedBase}.ts`,
    `${resolvedBase}.tsx`,
    path.join(resolvedBase, 'index.ts'),
    path.join(resolvedBase, 'index.tsx'),
  ])
    if (existsSync(candidate)) return slash(path.relative(root, candidate))
  return null
}

function collectCurrentTestBindings(callerSourcePaths: readonly string[]) {
  const callers = new Set(callerSourcePaths)
  const bindings = new Map<string, Set<string>>()
  const add = (sourcePath: string, testPath: string) => {
    if (!callers.has(sourcePath)) return
    const current = bindings.get(sourcePath) ?? new Set<string>()
    current.add(testPath)
    bindings.set(sourcePath, current)
  }
  const genericRouteTests = [
    'apps/union-eyes/app/api/__tests__/all-routes-import-matrix.test.ts',
    'apps/union-eyes/app/api/__tests__/all-routes-smoke.test.ts',
  ]
  for (const sourcePath of callerSourcePaths)
    if (sourcePath.startsWith('apps/union-eyes/app/api/') && sourcePath.endsWith('/route.ts'))
      for (const testPath of genericRouteTests) add(sourcePath, testPath)
  const importPattern =
    /(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const testFile of [
    ...testFilesWithin(app),
    ...testFilesWithin(path.join(app, 'services', 'financial-service', 'src', 'tests')),
  ]) {
    const source = readFileSync(testFile, 'utf8')
    const testPath = slash(path.relative(root, testFile))
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2]
      if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('@/'))) continue
      const resolved = resolveTestImport(testFile, specifier)
      if (resolved) add(resolved, testPath)
    }
  }
  return bindings
}

type ExecutedQualification = {
  receipt: string
  executedCases: string[]
  authMechanism: string
  actorClass: string
  organizationBinding: string
  databaseConnectionClass: string
  databaseRoleOrContext: string
  rlsEnforcement: string
  serviceSystemAuthority: string
}

// Built per call so no process-global mutable lookup state exists at module scope.
function buildExecutedQualifications(): Map<string, ExecutedQualification> {
  return new Map<string, ExecutedQualification>([
    [
      'apps/union-eyes/app/api/auth/login/route.ts#POST',
      {
        receipt: 'artifacts/ue-v2-next-runtime-acceptance.json',
        executedCases: ['wrong-password-denied', 'password-login'],
        authMechanism: 'PASSWORD_CREDENTIAL_EXCHANGE',
        actorClass: 'UNAUTHENTICATED',
        organizationBinding: 'NONE_PRE_ORGANIZATION_SELECTION',
        databaseConnectionClass: 'AUTH_DATABASE',
        databaseRoleOrContext: 'AUTH_EXECUTOR_SESSION_LOOKUP_AND_CHALLENGE_ISSUANCE',
        rlsEnforcement: 'AUTH_CONTEXT_HASH_SCOPED_LOOKUPS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/auth/mfa/challenge/route.ts#POST',
      {
        receipt: 'artifacts/ue-v2-next-runtime-acceptance.json',
        executedCases: [
          'invalid-mfa-code-denied',
          'real-totp-challenge',
          'consumed-mfa-challenge-denied',
        ],
        authMechanism: 'MFA_CHALLENGE_TOKEN',
        actorClass: 'UNAUTHENTICATED_MFA_CHALLENGE',
        organizationBinding: 'NONE_PRE_ORGANIZATION_SELECTION',
        databaseConnectionClass: 'AUTH_DATABASE',
        databaseRoleOrContext: 'AUTH_EXECUTOR_CHALLENGE_CONSUMPTION_AND_SESSION_ISSUANCE',
        rlsEnforcement: 'AUTH_CONTEXT_HASH_SCOPED_LOOKUPS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/users/me/organizations/route.ts#GET',
      {
        receipt: 'artifacts/ue-v2-organization-selection-native-tests.json',
        executedCases: [
          'enumerates only active private memberships despite forged public administrator metadata and legacy cookies',
          'returns an authenticated empty canonical list for a private profile with no memberships',
          'denies inactive-profile, revoked-session, expired-session and actor-mismatch before creating a replacement session',
        ],
        authMechanism: 'SESSION_COOKIE_OR_SIGNED_PROVIDER_BRIDGE',
        actorClass: 'AUTHENTICATED_UNSELECTED_OR_MEMBER',
        organizationBinding: 'CANONICAL_ACTIVE_PRIVATE_MEMBERSHIPS',
        databaseConnectionClass: 'OPERATIONAL_DATABASE_PLUS_AUTH_DATABASE',
        databaseRoleOrContext: 'withCanonicalOrganizationBinding + currentUser/auth session executor',
        rlsEnforcement: 'CANONICAL_MEMBERSHIP_BINDING_AND_OPERATIONAL_RLS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/organizations/switch/route.ts#POST',
      {
        receipt: 'artifacts/ue-v2-organization-selection-native-tests.json',
        executedCases: [
          'rotates the bearer, preserves exact PostgreSQL expiry and binds the next request to the selected organization',
          'denies foreign or unknown target without replacing the bearer',
          'allows recovery from a revoked current membership without manufacturing authority',
        ],
        authMechanism: 'SESSION_COOKIE_OR_SIGNED_PROVIDER_BRIDGE',
        actorClass: 'AUTHENTICATED_MEMBER_OR_ADMIN',
        organizationBinding: 'EXPLICIT_TARGET_SELECTION_AGAINST_CANONICAL_MEMBERSHIPS',
        databaseConnectionClass: 'AUTH_DATABASE_PLUS_OPERATIONAL_DATABASE',
        databaseRoleOrContext: 'rebindSessionOrganization + canonical selection binder',
        rlsEnforcement: 'CANONICAL_MEMBERSHIP_BINDING_AND_OPERATIONAL_RLS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/organizations/tree/route.ts#GET',
      {
        receipt: 'artifacts/ue-v2-organization-selection-native-tests.json',
        executedCases: ['returns only private-member organizations in the canonical hierarchy tree'],
        authMechanism: 'SESSION_COOKIE_OR_SIGNED_PROVIDER_BRIDGE',
        actorClass: 'AUTHENTICATED_MEMBER_OR_ADMIN',
        organizationBinding: 'CANONICAL_ACTIVE_PRIVATE_MEMBERSHIPS',
        databaseConnectionClass: 'OPERATIONAL_DATABASE_PLUS_AUTH_DATABASE',
        databaseRoleOrContext: 'withCanonicalOrganizationBinding + metadata reader',
        rlsEnforcement: 'CANONICAL_MEMBERSHIP_BINDING_AND_OPERATIONAL_RLS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/organizations/[id]/path/route.ts#GET',
      {
        receipt: 'artifacts/ue-v2-organization-selection-native-tests.json',
        executedCases: [
          'returns owned hierarchy ancestors without granting a new organization context',
          'reports partial ancestry rather than exposing unowned organization metadata',
          'denies a foreign hierarchy path instead of an empty-success result',
        ],
        authMechanism: 'SESSION_COOKIE_OR_SIGNED_PROVIDER_BRIDGE',
        actorClass: 'AUTHENTICATED_MEMBER_OR_ADMIN',
        organizationBinding: 'CANONICAL_ACTIVE_PRIVATE_MEMBERSHIPS',
        databaseConnectionClass: 'OPERATIONAL_DATABASE_PLUS_AUTH_DATABASE',
        databaseRoleOrContext: 'withCanonicalOrganizationBinding + hierarchy metadata reader',
        rlsEnforcement: 'CANONICAL_MEMBERSHIP_BINDING_AND_OPERATIONAL_RLS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/notifications/preferences/route.ts#GET',
      {
        receipt: 'artifacts/ue-v2-next-runtime-acceptance.json',
        executedCases: [
          'anonymous-preferences-denied',
          'ordinary-preference-reload',
          'inactive-membership-denied',
        ],
        authMechanism: 'PASSWORD_SESSION_COOKIE_AFTER_MFA',
        actorClass: 'ORDINARY_MEMBER',
        organizationBinding: 'CANONICAL_SELECTED_ORGANIZATION',
        databaseConnectionClass: 'OPERATIONAL_DATABASE',
        databaseRoleOrContext: 'withApi canonical member context',
        rlsEnforcement: 'TENANT_AND_SELF_SCOPED_RLS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/notifications/preferences/route.ts#PUT',
      {
        receipt: 'artifacts/ue-v2-next-runtime-acceptance.json',
        executedCases: [
          'ordinary-preference-write',
          'ordinary-preference-reload',
          'inactive-membership-denied',
        ],
        authMechanism: 'PASSWORD_SESSION_COOKIE_AFTER_MFA',
        actorClass: 'ORDINARY_MEMBER',
        organizationBinding: 'CANONICAL_SELECTED_ORGANIZATION',
        databaseConnectionClass: 'OPERATIONAL_DATABASE',
        databaseRoleOrContext: 'withApi canonical member context',
        rlsEnforcement: 'TENANT_AND_SELF_SCOPED_RLS',
        serviceSystemAuthority: 'NO_SYSTEM_CONTEXT',
      },
    ],
    [
      'apps/union-eyes/app/api/organizations/route.ts#POST',
      {
        receipt: 'artifacts/ue-v2-next-runtime-acceptance.json',
        executedCases: [
          'ordinary-system-write-denied',
          'system-actor-without-selected-membership-denied',
          'authorized-system-organization-write',
        ],
        authMechanism: 'PASSWORD_SESSION_COOKIE_AFTER_MFA',
        actorClass: 'PLATFORM_ADMIN_WITH_SELECTED_MEMBERSHIP',
        organizationBinding: 'CANONICAL_SELECTED_ORGANIZATION',
        databaseConnectionClass: 'OPERATIONAL_DATABASE',
        databaseRoleOrContext: 'requireSystemAdmin + withSystemContext',
        rlsEnforcement: 'SYSTEM_CONTEXT_BYPASSES_TENANT_RLS_AFTER_ADMIN_GATE',
        serviceSystemAuthority: 'SYSTEM_CONTEXT_REQUIRED',
      },
    ],
    [
      'apps/union-eyes/services/financial-service/src/index.ts#process',
      {
        receipt: 'artifacts/ue-v2-financial-index-startup-test.json',
        executedCases: [
          'starts owned jobs on listen and wires security middleware before routes',
          'VALID_WRITE_NA_PROCESS_BOOTSTRAP',
          'FORGED_USER_OR_ORG_NA_PROCESS_BOOTSTRAP',
        ],
        authMechanism: 'PROCESS_BOOTSTRAP',
        actorClass: 'SYSTEM_SERVICE',
        organizationBinding: 'NONE_PROCESS_BOOT',
        databaseConnectionClass: 'FINANCIAL_DATABASE',
        databaseRoleOrContext: 'FINANCIAL_DATABASE_URL distinct runtime role',
        rlsEnforcement: 'SERVICE_LOGIC_AND_SEPARATE_CONNECTION_SCOPE',
        serviceSystemAuthority: 'SCHEDULED_WORKFLOW_SYSTEM_CONTEXT',
      },
    ],
  ])
}

function compilerConfig(file: string) {
  const config = ts.readConfigFile(file, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(file))
  if (parsed.errors.length)
    throw new Error(
      parsed.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
        .join('\n'),
    )
  return parsed
}

function deriveSourceContext(caller: {
  id: string
  kind: string
  sourcePath: string
  roots: string[]
}) {
  if (caller.id === 'apps/union-eyes/services/financial-service/src/index.ts#process')
    return {
      authMechanism: 'PROCESS_BOOTSTRAP',
      actorClass: 'SYSTEM_SERVICE',
      organizationBinding: 'NONE_PROCESS_BOOT',
      databaseConnectionClass: 'FINANCIAL_DATABASE',
      databaseRoleOrContext: 'FINANCIAL_DATABASE_URL distinct runtime role',
      rlsEnforcement: 'SERVICE_LOGIC_AND_SEPARATE_CONNECTION_SCOPE',
      serviceSystemAuthority: 'SCHEDULED_WORKFLOW_SYSTEM_CONTEXT',
    }
  if (caller.sourcePath.startsWith('apps/union-eyes/actions/'))
    return {
      authMechanism: 'NEXT_SERVER_ACTION_SESSION',
      actorClass: 'AUTHENTICATED_SERVER_ACTION_USER',
      organizationBinding: 'CALLER_CONTEXT_OR_HELPER_BOUND',
      databaseConnectionClass: 'OPERATIONAL_DATABASE',
      databaseRoleOrContext: 'SERVER_ACTION_RUNTIME_CONTEXT',
      rlsEnforcement: 'OPERATIONAL_TENANT_RLS',
      serviceSystemAuthority: 'SOURCE_CALL_RECONCILIATION_REQUIRED',
    }
  if (caller.sourcePath.startsWith('apps/union-eyes/db/queries/'))
    return {
      authMechanism: 'INHERITED_FROM_CALLER',
      actorClass: 'INHERITED_FROM_CALLER',
      organizationBinding: 'INHERITED_FROM_CALLER',
      databaseConnectionClass: 'OPERATIONAL_DATABASE',
      databaseRoleOrContext: 'QUERY_HELPER_UNDER_CALLER_CONTEXT',
      rlsEnforcement: 'CALLER_CONTEXT_RLS',
      serviceSystemAuthority: 'INHERITED_FROM_CALLER',
    }
  const source = readFileSync(path.join(root, ...caller.sourcePath.split('/')), 'utf8')
  const roleMatch = source.match(/withRoleAuth\(\s*['"`]([^'"`]+)['"`]/)
  const authMechanism = source.includes('withApiAuth(')
    ? 'NEXT_HTTP_WITH_API_AUTH'
    : roleMatch
      ? `NEXT_HTTP_WITH_ROLE_AUTH(${roleMatch[1]})`
      : source.includes('withOrganizationAuth(')
        ? 'NEXT_HTTP_WITH_ORGANIZATION_AUTH'
        : source.includes('auth(')
          ? 'NEXT_HTTP_DIRECT_AUTH'
          : 'NEXT_HTTP_ROUTE'
  const actorClass = roleMatch
    ? `MIN_ROLE_${roleMatch[1].toUpperCase()}`
    : caller.sourcePath.includes('/admin/')
      ? 'PLATFORM_ADMIN_OR_ROUTE_SPECIFIC_ELEVATED'
      : caller.sourcePath.includes('/auth/')
        ? 'UNAUTHENTICATED_OR_CHALLENGE_BOUND'
        : 'AUTHENTICATED_ROUTE_USER'
  const organizationBinding =
    caller.sourcePath.includes('/organizations/') || caller.sourcePath.includes('/notifications/')
      ? 'CANONICAL_ORGANIZATION_CONTEXT_OR_EXPLICIT_SELECTION'
      : source.includes('organizationId')
        ? 'ROUTE_OR_CALLER_CONTEXT_ORGANIZATION_REQUIRED'
        : 'ROUTE_SPECIFIC_OR_NONE'
  return {
    authMechanism,
    actorClass,
    organizationBinding,
    databaseConnectionClass: 'OPERATIONAL_DATABASE',
    databaseRoleOrContext: source.includes('withSystemContext(')
      ? 'SYSTEM_CONTEXT_AFTER_ROUTE_GATE'
      : source.includes('withRLSContext(')
        ? 'TENANT_RLS_CONTEXT'
        : 'ROUTE_HANDLER_OR_HELPER_CONTEXT',
    rlsEnforcement: source.includes('withSystemContext(')
      ? 'SYSTEM_CONTEXT_BYPASS_AFTER_GATE'
      : 'OPERATIONAL_TENANT_RLS_OR_HELPER_BOUNDARY',
    serviceSystemAuthority: source.includes('withSystemContext(')
      ? 'SYSTEM_CONTEXT_REQUIRED'
      : 'NO_EXPLICIT_SYSTEM_CONTEXT',
  }
}

export function generateCallerInventories(wheelhouse: string) {
  const operationalConfig = compilerConfig(path.join(app, 'tsconfig.json'))
  const financialConfig = compilerConfig(
    path.join(app, 'services', 'financial-service', 'tsconfig.json'),
  )
  const packageFile = path.join(app, 'services', 'financial-service', 'package.json')
  const packageSource = readFileSync(packageFile, 'utf8')
  const executablePackage: { name: string; main?: string; scripts?: Record<string, string> } =
    JSON.parse(packageSource)
  if (!executablePackage.main) throw new Error('UE_V2_FINANCIAL_EXECUTABLE_MAIN_REQUIRED')
  const financialEntry = slash(
    path.relative(root, path.resolve(path.dirname(packageFile), executablePackage.main)),
  )
  const program = ts.createProgram(
    [...new Set([...operationalConfig.fileNames, ...financialConfig.fileNames])],
    { ...operationalConfig.options, noEmit: true, incremental: false },
  )
  const graph = deriveTypeScriptCallerGraph(program, root, [financialEntry])
  const typeScriptRootCallers = graph.roots
    .map((rootEntry) => {
      const transitive = graph.callers.filter((caller) => caller.roots.includes(rootEntry.id))
      if (!transitive.length) return null
      const mutations = transitive.flatMap((caller) => caller.mutations)
      const sourceSha256 = graph.sourceDigests[rootEntry.path]
      if (!sourceSha256) throw new Error(`UE_V2_ROOT_SOURCE_DIGEST_REQUIRED:${rootEntry.path}`)
      return {
        id: rootEntry.id,
        kind: rootEntry.kind,
        sourcePath: rootEntry.path,
        sourceSha256,
        export: rootEntry.export,
        roots: [rootEntry.id],
        transitiveCallers: transitive.map((caller) => caller.id),
        mutations,
      }
    })
    .filter((caller): caller is NonNullable<typeof caller> => Boolean(caller))
  const currentTestBindings = collectCurrentTestBindings(
    typeScriptRootCallers.map((caller) => caller.sourcePath),
  )
  const syntacticErrors = program.getSyntacticDiagnostics()
  if (syntacticErrors.length)
    throw new Error(
      syntacticErrors
        .map(
          (error) =>
            `${error.file?.fileName}:${error.start}:${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`,
        )
        .join('\n'),
    )
  const django = proveCurrentApplicationStartup(wheelhouse)
  if (!django.executionInventory) throw new Error('UE_V2_CURRENT_FRAMEWORK_INVENTORY_REQUIRED')
  const planSource = readFileSync(
    path.join(docs, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),
    'utf8',
  )
  const plan: V2Plan = JSON.parse(planSource)
  const qualifications = {
    runtimeQualification: 'NOT_QUALIFIED' as 'NOT_QUALIFIED' | 'QUALIFIED_BY_EXECUTED_CASES',
    proofReceipt: null,
    checks: {
      authorizedMutationAndReload: 'NOT_PROVEN',
      foreignOrganizationReadCreateUpdateDelete: 'NOT_PROVEN',
      forgedActorAndOrganization: 'NOT_PROVEN',
      missingInactiveAndInvalidMembership: 'NOT_PROVEN',
      unauthorizedSystem: 'NOT_PROVEN',
      boundedAuthorizedSystem: 'NOT_PROVEN',
      actorProvenance: 'NOT_PROVEN',
      rollbackAndIdempotency: 'NOT_PROVEN',
    },
  }
  const canonical = new Map(plan.tables.map((table) => [table.name, table]))
  const executedQualifications = buildExecutedQualifications()
  const actors = typeScriptRootCallers.map((caller) => {
    const qualification = executedQualifications.get(caller.id)
    const sourceContext = deriveSourceContext(caller)
    const testBindings = [...(currentTestBindings.get(caller.sourcePath) ?? [])].sort()
    const tables = caller.mutations.map((mutation) => {
      const table = canonical.get(mutation.table.replace(/^public[.]/, ''))
      return {
        name: mutation.table,
        operation: mutation.operation,
        canonicalAuthority: table?.authority ?? null,
        authoritySource: table?.source ?? null,
        authoritySourceDigest: table?.sourceDigest ?? null,
      }
    })
    return {
      id: caller.id,
      kind: caller.kind,
      export: caller.export,
      sourcePath: caller.sourcePath,
      sourceSha256: caller.sourceSha256,
      roots: caller.roots,
      database: caller.roots.some((entry) => entry === `${financialEntry}#process`)
        ? 'FINANCIAL_OR_TRANSITIVE_REQUIRES_CONNECTION_RECONCILIATION'
        : 'OPERATIONAL_OR_TRANSITIVE_REQUIRES_CONNECTION_RECONCILIATION',
      currentTestBindings: testBindings,
      callerActorClass: qualification?.actorClass ?? sourceContext.actorClass,
      authenticationMode: qualification?.authMechanism ?? sourceContext.authMechanism,
      organizationBinding: qualification?.organizationBinding ?? sourceContext.organizationBinding,
      databaseConnectionClass:
        qualification?.databaseConnectionClass ?? sourceContext.databaseConnectionClass,
      databaseRoleOrContext:
        qualification?.databaseRoleOrContext ?? sourceContext.databaseRoleOrContext,
      rlsEnforcement: qualification?.rlsEnforcement ?? sourceContext.rlsEnforcement,
      serviceSystemAuthority:
        qualification?.serviceSystemAuthority ?? sourceContext.serviceSystemAuthority,
      tables,
      ...qualifications,
      proofReceipt: qualification?.receipt ?? null,
      executedCases: qualification?.executedCases ?? [],
      runtimeQualification: qualification
        ? 'QUALIFIED_BY_EXECUTED_CASES'
        : qualifications.runtimeQualification,
      classification: classifyRootCaller({
        id: caller.id,
        kind: caller.kind,
        sourcePath: caller.sourcePath,
        export: caller.export,
        tables,
        runtimeQualification: qualification
          ? 'QUALIFIED_BY_EXECUTED_CASES'
          : qualifications.runtimeQualification,
      }),
    }
  })
  const financialAuthorities = new Map(
    [...financeEntries, ...financialServiceLatentEntries].map((entry) => [entry.table, entry]),
  )
  const inferredFinancialTables = plan.tables.filter((table) =>
    table.columns.some(
      (column) =>
        /amount|balance|currency|payment|dues|revenue|invoice|fee|credit|debit|stipend/i.test(
          column.name,
        ) && /numeric|decimal|money|bigint|integer|varchar|text/i.test(column.type),
    ),
  )
  const activeTypeScriptFinancialTables = new Set(
    actors
      .filter(
        (actor) =>
          actor.sourcePath.startsWith('apps/union-eyes/services/financial-service/') ||
          actor.sourcePath.startsWith('apps/union-eyes/services/platform-economics/') ||
          actor.roots.some((entry) => entry === `${financialEntry}#process`),
      )
      .flatMap((actor) =>
        actor.tables
          .map((table) => table.name.replace(/^public[.]/, ''))
          .filter((name) => !name.startsWith('UNRESOLVED_')),
      ),
  )
  const activePythonFinancialTables = new Set(
    django.executionInventory.mutationGraph.callers
      .filter((caller) => caller.source.includes('/backend/billing/'))
      .flatMap((caller) =>
        caller.mutations
          .map((mutation) => mutation.table.replaceAll('"', '').replace(/^public[.]/, ''))
          .filter((name) => !name.startsWith('UNRESOLVED_')),
      ),
  )
  const activeFrameworkFinancialTables = new Set(
    django.executionInventory.routes
      .filter((route) =>
        String(route.binding?.source || route.viewBinding?.source || '').includes(
          '/backend/billing/',
        ),
      )
      .map((route) => route.table.replaceAll('"', '').replace(/^public[.]/, ''))
      .filter((name) => !name.startsWith('UNRESOLVED_')),
  )
  const financialNames = new Set([
    ...activeTypeScriptFinancialTables,
    ...activePythonFinancialTables,
    ...activeFrameworkFinancialTables,
  ])
  const serviceSchemaFiles = filesWithin(
    path.join(app, 'services', 'financial-service', 'src', 'db'),
  )
  const serviceDeclarations = [...scanAdditionalDeclarationFiles(serviceSchemaFiles)].map(
    ([table, declarations]) => ({
      table,
      declarations,
    }),
  )
  const financialRootPattern =
    /^apps\/union-eyes\/(?:(?:services\/financial-service\/src\/index\.ts)|(?:app\/api\/(?:billing|finance|payments|donations|remittances|arrears|dues|strike-funds|stipends|pension)\/)|(?:actions\/(?:stripe-actions|whop-actions|credits-actions|profiles-actions|rewards-actions)\.ts))/
  const obviousNonFinancialRootPattern =
    /^apps\/union-eyes\/app\/api\/(?:auth\/|organizations\/|users\/me\/organizations\/|notifications\/)/
  const financialCallers = actors.filter(
    (actor) =>
      financialRootPattern.test(actor.sourcePath) ||
      actor.roots.some((entry) => entry === `${financialEntry}#process`) ||
      (!obviousNonFinancialRootPattern.test(actor.sourcePath) &&
        actor.tables.some((table) => financialNames.has(table.name.replace(/^public[.]/, '')))),
  )
  const sourceDigests = {
    ...graph.sourceDigests,
    ...django.sourceDigests,
    [slash(path.relative(root, packageFile))]: hash(packageSource),
    ...Object.fromEntries(
      [
        path.join(app, 'tsconfig.json'),
        path.join(app, 'services', 'financial-service', 'tsconfig.json'),
        path.join(app, 'services', 'financial-service', 'src', 'db', 'connection-scope.ts'),
        path.join(app, 'db', 'rls-storage-authority', 'finance.ts'),
        path.join(app, 'db', 'rls-storage-authority', 'financial-service-latent.ts'),
        path.join(app, 'scripts', 'bootstrap-v2', 'caller-graph.ts'),
        path.join(app, 'scripts', 'bootstrap-v2', 'caller-inventory.ts'),
        path.join(app, 'scripts', 'bootstrap-v2', 'current_application.py'),
      ].map((file) => [slash(path.relative(root, file)), hash(readFileSync(file, 'utf8'))]),
    ),
  }
  const candidateDigest = hash(
    JSON.stringify(Object.entries(sourceDigests).sort(([a], [b]) => a.localeCompare(b))),
  )
  const bucketExecutions = readdirSync(docs)
    .filter((name) => /^UE_V2_ROUTE_BUCKET_EXECUTION\..+\.json$/.test(name))
    .map((name) => {
      const report = JSON.parse(readFileSync(path.join(docs, name), 'utf8')) as {
        bucket: { bucket: string; count: number; reason: string }
        candidateDigest: string
        executedRoutes: number
        passCount: number
        failCount: number
      }
      return {
        file: name,
        bucket: report.bucket.bucket,
        bucketCount: report.bucket.count,
        candidateDigest: report.candidateDigest,
        executedRoutes: report.executedRoutes,
        passCount: report.passCount,
        failCount: report.failCount,
      }
    })
  const runtimeQualifiedCallers = actors.filter(
    (actor) => actor.runtimeQualification === 'QUALIFIED_BY_EXECUTED_CASES',
  ).length
  const common = {
    lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
    contractVersion: '2.0',
    candidateDigest,
    sourcePlanDigest: hash(planSource),
    status: 'NOT_PROVEN',
    denominatorComplete: false,
    denominatorStatus: 'REACHABILITY_AND_DYNAMIC_DISPATCH_RECONCILIATION_REQUIRED',
    runtimeQualifiedCallers,
    observedCandidateCallers: typeScriptRootCallers.length,
    callerBuckets: summarizeBuckets(
      actors.map((actor) => ({
        id: actor.id,
        kind: typeScriptRootCallers.find((caller) => caller.id === actor.id)?.kind ?? 'UNKNOWN',
        sourcePath: actor.sourcePath,
        export: typeScriptRootCallers.find((caller) => caller.id === actor.id)?.export ?? 'UNKNOWN',
        tables: actor.tables,
        runtimeQualification: actor.runtimeQualification,
      })),
    ),
    bucketExecutions,
    sourceDigests,
    historicalProofTransferred: false,
  }
  const inventory = {
    ...common,
    roots: graph.roots,
    callers: typeScriptRootCallers,
    callGraphNodes: graph.callers,
    framework: django.executionInventory,
    unreachableDirectWriters: graph.unreachableDirectWriters,
    unresolvedReachableCalls: graph.unresolvedReachableCalls,
    limitations: graph.limitations,
  }
  const actorMap = {
    ...common,
    actors,
    frameworkActors: django.executionInventory.routes.map((route) => ({
      ...route,
      callerActorClass:
        route.permissionClasses.length > 0
          ? `DJANGO_PERMISSIONS:${route.permissionClasses.join(',')}`
          : 'DJANGO_FRAMEWORK_DEFAULT_PERMISSION_SET',
      authenticationMode: 'DJANGO_REST_FRAMEWORK_AUTHENTICATION',
      organizationBinding: 'DJANGO_REQUEST_OR_VIEWSET_SCOPE_RECONCILIATION_REQUIRED',
      databaseConnectionClass: 'DJANGO_DEFAULT_DATABASE',
      databaseRoleOrContext: 'DJANGO_ROUTER_AND_VIEWSET_EXECUTION',
      rlsEnforcement: 'DJANGO_SQL_SCOPE_OR_DATABASE_POLICY_RECONCILIATION_REQUIRED',
      serviceSystemAuthority: route.methodCandidateOnly
        ? 'DJANGO_MUTATION_ROUTE_SCOPE_RECONCILIATION_REQUIRED'
        : 'DJANGO_READ_ROUTE_SCOPE_RECONCILIATION_REQUIRED',
      ...qualifications,
    })),
    pythonActors: django.executionInventory.mutationGraph.callers.map((caller) => ({
      ...caller,
      databaseScope: 'CURRENT_DJANGO_ROUTER_RECONCILIATION_REQUIRED',
      callerActorClass: 'PYTHON_CALL_GRAPH_REACHABLE_CALLER',
      authenticationMode: 'INHERITED_FROM_DJANGO_ROOT_OR_CELERY_TASK',
      organizationBinding: 'INHERITED_FROM_DJANGO_ROOT_OR_TASK_CONTEXT',
      databaseConnectionClass: 'DJANGO_DEFAULT_DATABASE',
      databaseRoleOrContext: 'DJANGO_ORM_OR_TASK_EXECUTION_CONTEXT',
      rlsEnforcement: 'DJANGO_SQL_SCOPE_OR_DATABASE_POLICY_RECONCILIATION_REQUIRED',
      serviceSystemAuthority: 'INHERITED_FROM_DJANGO_ROOT_OR_TASK_CONTEXT',
      ...qualifications,
    })),
  }
  const finance = {
    ...common,
    executablePackage: {
      ...executablePackage,
      source: slash(path.relative(root, packageFile)),
      entry: financialEntry,
    },
    deploymentReachability: 'REQUIRES_CURRENT_DEPLOYMENT_RECONCILIATION_NOT_ASSUMED_LATENT',
    independentDatabaseAuthority: 'services/financial-service/src/db/connection-scope.ts',
    independentDatabaseRuntimeQualification: 'PARTIAL_PROVEN_BY_CURRENT_TESTS',
    independentProofs: {
      connectionAndRoleSeparation: {
        receipt: 'artifacts/ue-v2-financial-scope-unit-tests.json',
        evidence: 'services/financial-service/src/tests/unit/connection-scope.test.ts',
        result: 'PASS',
      },
      ownedHttpBoundary: {
        receipt: 'artifacts/ue-v2-financial-qualification-boundary-tests.json',
        evidence: 'scripts/bootstrap-v2/financial-http-boundary.test.ts',
        result: 'PASS',
      },
      startupProcessWiring: {
        receipt: 'artifacts/ue-v2-financial-index-startup-test.json',
        evidence: 'services/financial-service/src/tests/unit/index-startup.test.ts',
        result: 'PASS',
      },
      servicePackageRegression: {
        receipt: 'artifacts/ue-v2-financial-scope-unit-tests.json',
        evidence: 'financial-service package unit suite',
        result: 'PASS_563_TESTS_30_FILES',
      },
    },
    crossDatabaseAtomicity: 'NOT_CLAIMED',
    tables: [...financialNames].sort().map((name) => ({
      name,
      canonical: canonical.get(name) ?? null,
      historicalAuthority: financialAuthorities.get(name) ?? null,
      selectionEvidence: [
        ...(financialAuthorities.has(name) ? ['EXISTING_FINANCIAL_STORAGE_AUTHORITY'] : []),
        ...(inferredFinancialTables.some((table) => table.name === name)
          ? ['CURRENT_FINANCIAL_COLUMN_CANDIDATE']
          : []),
        ...(serviceDeclarations.some(
          (declaration) => declaration.table.replace(/^public[.]/, '') === name,
        )
          ? ['CURRENT_FINANCIAL_SERVICE_DECLARATION']
          : []),
      ],
      ...qualifications,
    })),
    serviceDeclarations,
    callers: financialCallers,
    frameworkCallers: django.executionInventory.routes.filter((route) =>
      financialNames.has(route.table.replaceAll('"', '').replace(/^public[.]/, '')),
    ),
    pythonCallers: django.executionInventory.mutationGraph.callers.filter((caller) =>
      caller.mutations.some((mutation) =>
        financialNames.has(mutation.table.replaceAll('"', '').replace(/^public[.]/, '')),
      ),
    ),
    limitations: [
      'Financial-column inference is conservative discovery, not a complete semantic scope decision.',
      'Historical LATENT_UNREACHABLE entries do not establish current executable or deployment exclusion.',
      'Independent database/role configuration is only partially proven; complete scoped transaction, audit persistence, rollback and table-by-table actor qualification remain open.',
      'No runtime qualification is transferred from table-only native probes or earlier candidates.',
    ],
  }
  const runtimeQualifiedFinancialCallers = finance.callers.filter(
    (caller) => caller.runtimeQualification === 'QUALIFIED_BY_EXECUTED_CASES',
  ).length
  const outputs = [
    [
      'UE_V2_MUTATING_CALLER_INVENTORY',
      inventory,
      typeScriptRootCallers.map(
        (caller) =>
          `| ${caller.id} | ${caller.roots.length} | ${caller.mutations.map((mutation) => `${mutation.operation} ${mutation.table}`).join(', ')} | ${actors.find((actor) => actor.id === caller.id)?.runtimeQualification ?? 'NOT_PROVEN'} |`,
      ),
    ],
    [
      'UE_V2_APPLICATION_ACTOR_MAP',
      actorMap,
      actors.map(
        (actor) =>
          `| ${actor.id} | ${actor.roots.length} | ACTOR ${actor.callerActorClass}; AUTH ${actor.authenticationMode}; ORG ${actor.organizationBinding}; DB ${actor.databaseConnectionClass}; ROLE ${actor.databaseRoleOrContext}; RLS ${actor.rlsEnforcement} | ${actor.runtimeQualification} |`,
      ),
    ],
    [
      'UE_V2_FINANCIAL_SCOPE_AUTHORITY',
      finance,
      finance.tables.map(
        (table) => `| ${table.name} | - | ${table.selectionEvidence.join(', ')} | NOT_PROVEN |`,
      ),
    ],
  ] as const
  for (const [name, document, rows] of outputs) {
    const financeProofLines =
      name === 'UE_V2_FINANCIAL_SCOPE_AUTHORITY'
        ? [
            '',
            '## Independent financial proofs currently on file',
            '',
            '- `services/financial-service/src/tests/unit/connection-scope.test.ts` → dedicated financial connection/role separation PASS.',
            '- `scripts/bootstrap-v2/financial-http-boundary.test.ts` → owned HTTP/auth/idempotency/webhook boundary PASS.',
            '- `services/financial-service/src/tests/unit/index-startup.test.ts` → process startup wiring PASS.',
            '- `financial-service` package unit suite → 563/563 tests across 30 files PASS.',
          ]
        : []
    writeFileSync(path.join(docs, `${name}.json`), JSON.stringify(document, null, 2) + '\n')
    writeFileSync(
      path.join(docs, `${name}.md`),
      [
        `# ${name.replaceAll('_', ' ')}`,
        '',
        '**Status: NOT_PROVEN. The complete mutating-caller denominator is not established.**',
        '',
        `Candidate source digest: \`${candidateDigest}\`.`,
        `Source-plan digest: \`${common.sourcePlanDigest}\`.`,
        '',
        'Generated by `apps/union-eyes/scripts/bootstrap-v2/caller-inventory.ts`.',
        'This is source discovery and unresolved qualification accounting, not final acceptance.',
        'Bucket execution receipts below are SMOKE_ONLY unless a caller is explicitly marked QUALIFIED_BY_EXECUTED_CASES.',
        'No historical component result is promoted to current runtime evidence.',
        '',
        `TypeScript candidate callers: ${typeScriptRootCallers.length}; runtime-qualified callers: ${runtimeQualifiedCallers}.`,
        `Financial-scope callers: ${finance.callers.length}; financial runtime-qualified callers: ${runtimeQualifiedFinancialCallers}.`,
        `Resolved Django route-method bindings: ${django.executionInventory.routes.length}; decorated task candidates: ${django.executionInventory.taskCandidates.length}.`,
        `Actual registered Celery tasks: ${django.executionInventory.registeredTasks.length}; beat schedule entries: ${django.executionInventory.scheduledTasks.length}.`,
        `Conservative reachable Python mutation callers: ${django.executionInventory.mutationGraph.callers.length}; framework-owned route roots: ${django.executionInventory.frameworkOwnedRoutes.length}.`,
        '',
        '## Root bucket classification',
        '',
        '| Bucket | Count | Evidence basis |',
        '| --- | ---: | --- |',
        ...common.callerBuckets.map(
          (bucket) => `| ${bucket.bucket} | ${bucket.count} | ${bucket.reason} |`,
        ),
        '',
        '## Executed bucket receipts',
        '',
        '| Bucket | Candidate digest | Executed routes | Smoke passed | Smoke failed | Receipt |',
        '| --- | --- | ---: | ---: | ---: | --- |',
        ...common.bucketExecutions.map(
          (bucket) =>
            `| ${bucket.bucket} | \`${bucket.candidateDigest}\` | ${bucket.executedRoutes} | ${bucket.passCount} | ${bucket.failCount} | ${bucket.file} |`,
        ),
        ...financeProofLines,
        '',
        '| Caller or table | Root paths | Evidence or outstanding authority | Runtime |',
        '| --- | ---: | --- | --- |',
        ...rows,
        '',
        '## Outstanding reconciliation',
        '',
        '- Reconcile injected/dynamic calls, inherited framework handlers, admin actions, signals and executable process roots.',
        '- Python transitive edges and actual Celery registrations are discovery evidence, not runtime mutation or actor proof.',
        '- Reconcile financial semantic scope and independent service/database execution.',
        '- Execute each retained caller with real restricted actors, denial cases, provenance, reload and rollback checks.',
        '- Bind all retained runtime receipts to one unchanged final source digest.',
        '',
        `Machine-readable detail: [${name}.json](./${name}.json).`,
        '',
      ].join('\n'),
    )
  }
  return {
    status: common.status,
    candidateDigest,
    denominatorComplete: false,
    typescriptCandidateCallers: typeScriptRootCallers.length,
    djangoRouteBindings: django.executionInventory.routes.length,
    taskCandidates: django.executionInventory.taskCandidates.length,
    financialCandidateTables: finance.tables.length,
    runtimeQualifiedCallers,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const wheelhouse = process.env.UE_V2_WHEELHOUSE
  if (!wheelhouse || !path.isAbsolute(wheelhouse))
    throw new Error('UE_V2_OFFLINE_WHEELHOUSE_REQUIRED')
  console.log(JSON.stringify(generateCallerInventories(wheelhouse)))
}
