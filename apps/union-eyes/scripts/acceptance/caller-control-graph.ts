import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { folder, root } from '../bootstrap-v2/source'

// Auth/session side-effect relations every guarded call touches; not caller business mutations.
const SIDE_EFFECT_ONLY_TABLES = new Set([
  'user_sessions',
  'auth_audit_log',
  'mfa_challenges',
  'mfa_totp',
  'organization_members',
  'users',
  'UNRESOLVED_DYNAMIC_SQL',
  'UNRESOLVED_TABLE:auditLogs',
])

/**
 * Static caller -> entry guard -> actor/org binding -> database context mapping for every root
 * caller in the application actor map. A caller is COVERED when its source path is bound to a
 * recognised shared control; callers that bypass a shared control or use privileged authority
 * directly are EXCEPTIONS that require direct runtime proof (they are never counted as covered).
 */
type Guard =
  | 'WITH_API'
  | 'WITH_API_PUBLIC'
  | 'WITH_API_CRON'
  | 'LEGACY_ROLE_WRAPPER'
  | 'ORGANIZATION_MIDDLEWARE'
  | 'REQUIRE_API_AUTH'
  | 'WEBHOOK_SIGNATURE'
  | 'EXTERNAL_MATTER_GRANT'
  | 'SERVER_ACTION_SESSION'
  | 'DIRECT_AUTH_ONLY'
  | 'NONE'

const GUARD_PATTERNS: [Guard, RegExp][] = [
  ['WITH_API_CRON', /withApi\s*\(\s*\{[^}]*cron\s*:\s*true/s],
  ['WITH_API_PUBLIC', /withApi\s*\(\s*\{[^}]*required\s*:\s*false/s],
  ['WITH_API', /\bwithApi\s*\(/],
  ['ORGANIZATION_MIDDLEWARE', /\bwithOrganizationAuth\s*\(/],
  [
    'LEGACY_ROLE_WRAPPER',
    /\b(withRoleAuth|withMinRole|withAdminAuth|withSystemAdminAuth|withApiAuth|withAnyRole|withEnhancedRoleAuth)\s*\(/,
  ],
  [
    'REQUIRE_API_AUTH',
    /\b(requireApiAuth|requireUserForOrganization|requireUser|requireSystemAdmin|getCurrentUser)\s*\(/,
  ],
  ['EXTERNAL_MATTER_GRANT', /\bwithExternalMatterResourceAuth\s*\(/],
  ['WEBHOOK_SIGNATURE', /verify\w*(Signature|Webhook)\w*\s*\(|WEBHOOK_SECRET|constructEvent\s*\(/],
  ['SERVER_ACTION_SESSION', /\bcreateSecureServerAction\s*\(|['"]use server['"]/],
  ['DIRECT_AUTH_ONLY', /\bauth\s*\(\s*\)/],
]

function classifyGuard(source: string): Guard {
  for (const [guard, pattern] of GUARD_PATTERNS) if (pattern.test(source)) return guard
  return 'NONE'
}

function classifyContext(source: string) {
  const system =
    /\bwithSystemContext\s*\(|\bwithSystemRLSContext\s*\(|\bwithPlatformAdminRLSContext\s*\(/.test(
      source,
    )
  const tenant = /\bwithRLSContext\s*\(/.test(source)
  const explicit = /\bwithExplicitUserContext\s*\(/.test(source)
  return { system, tenant, explicit }
}

interface ControlBinding {
  control: string
  basis: string
}

// Callers that do not use a recognised wrapper are bound statically, by source path, to the
// shared control that governs them. Every binding names its basis so it can be audited; a mutating
// caller that matches no binding fails generation (there is no silent "unmapped" bucket).
const PATH_BINDINGS: [RegExp, ControlBinding][] = [
  [
    /\/api\/auth\/(forgot-password|invite\/accept|magic-link\/verify|reset-password)\//,
    {
      control: 'AUTH_TOKEN_FLOW',
      basis:
        'single-use hashed token or credential possession is the authorization; AUTH service owns it',
    },
  ],
  [
    /\/api\/(icra|ocra|oci)\/|\/api\/workbook\/start\/|\/api\/pilot\/apply\/route|\/api\/communications\/(track|unsubscribe)\//,
    {
      control: 'CAPABILITY_OR_PUBLIC_INTAKE_SYSTEM_CONTRACT',
      basis:
        'pseudonymous capability or public intake; writes only through relation-specific SYSTEM contracts (system-mutation-contracts)',
    },
  ],
  [
    /\/api\/(workbook\/\[id\]\/(claim|memory-holders)|icra\/\[assessmentId\]\/claim)\//,
    {
      control: 'CANONICAL_SESSION_INLINE',
      basis:
        'canonical auth() session plus owner or single-use claim-token check inside the handler',
    },
  ],
  [
    /\/api\/(cases|portal\/dues\/pay|admin\/users\/\[userId\])\//,
    {
      control: 'CANONICAL_SESSION_INLINE',
      basis:
        'canonical auth() session, organization resolved from the session, tenant RLS or platform-authority check inside the handler',
    },
  ],
  [
    /\/api\/rewards\/cron\//,
    { control: 'CRON_CREDENTIAL', basis: 'timing-safe CRON_SECRET bearer comparison' },
  ],
  [
    /\/api\/staging-proof\//,
    {
      control: 'ENVIRONMENT_GATE',
      basis: 'isAuthorizedStagingProofEnvironment and nonce authorization; 404 otherwise',
    },
  ],
  [
    /\/services\/financial-service\//,
    {
      control: 'SEPARATE_SERVICE_BOUNDARY',
      basis:
        'independent service with its own database and process; outside the Union Eyes Django/RLS boundary',
    },
  ],
  [
    /\/db\/queries\/member-employment-queries\.ts$/,
    {
      control: 'TENANT_RLS_TRANSACTION',
      basis:
        'server-only query helper, not a Server Action. Callers must pass the grant object registered by authorizeEmploymentAccess. Mutations run inside withRLSContext for that organization. Individual compensation is projected from discloseCompensation on that grant.',
    },
  ],
]

function bindControl(
  guard: Guard,
  sourcePath: string,
  source: string,
  seen = new Set<string>(),
): ControlBinding | null {
  const wrapper: Record<string, ControlBinding> = {
    WITH_API: {
      control: 'WITH_API',
      basis: 'withApi wrapper (auth, rate limit, validation, tenant RLS)',
    },
    WITH_API_PUBLIC: {
      control: 'WITH_API_PUBLIC',
      basis: 'withApi required:false; public by design',
    },
    WITH_API_CRON: { control: 'CRON_CREDENTIAL', basis: 'withApi auth.cron credential' },
    LEGACY_ROLE_WRAPPER: {
      control: 'ROLE_AUTHORIZATION',
      basis: 'role wrapper over canonical session',
    },
    ORGANIZATION_MIDDLEWARE: {
      control: 'TENANT_RLS_TRANSACTION',
      basis: 'withOrganizationAuth canonical org plus RLS transaction',
    },
    REQUIRE_API_AUTH: {
      control: 'CANONICAL_SESSION_INLINE',
      basis: 'requireApiAuth or requireUser',
    },
    WEBHOOK_SIGNATURE: { control: 'WEBHOOK_SIGNATURE', basis: 'provider signature verification' },
    EXTERNAL_MATTER_GRANT: {
      control: 'EXTERNAL_MATTER_GRANT',
      basis: 'withExternalMatterResourceAuth matter grant',
    },
    SERVER_ACTION_SESSION: { control: 'CANONICAL_SESSION_INLINE', basis: 'server action session' },
  }
  if (wrapper[guard]) return wrapper[guard]
  const delegate = /from\s*'(\.\.?\/[^']*\/route)'/.exec(source)
  if (delegate && !seen.has(sourcePath)) {
    seen.add(sourcePath)
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(sourcePath), delegate[1] + '.ts'),
    )
    try {
      const delegateSource = readFileSync(path.join(root, ...target.split('/')), 'utf8')
      const inner = bindControl(classifyGuard(delegateSource), target, delegateSource, seen)
      if (inner)
        return {
          control: 'DELEGATED_TO_GUARDED_ROUTE',
          basis: `delegates to ${target} (${inner.control})`,
        }
    } catch {
      // fall through to path bindings
    }
  }
  for (const [pattern, binding] of PATH_BINDINGS)
    if (pattern.test('/' + sourcePath.replace(/^apps\/union-eyes\//, ''))) return binding
  return null
}

const IDENTITY_MUTATION =
  /\.(insert|update|delete)\(\s*(organizationMembers|users|profiles|userRoles|memberRoles|userSessions|organizationUsers)\b/
const FINANCIAL =
  /(dues|billing|invoice|payment|remittance|expense|budget|ledger|donation|fee|per_capita|payroll|stipend|tax)/i
const SENSITIVE_OPERATIONS = new Set(['INSERT', 'UPDATE', 'DELETE'])

export function buildCallerControlGraph() {
  const actorMap = JSON.parse(
    readFileSync(path.join(folder, 'UE_V2_APPLICATION_ACTOR_MAP.json'), 'utf8'),
  ) as {
    actors: {
      id: string
      kind: string
      sourcePath: string
      export: string
      sourceSha256: string
      tables?: { name: string; operation: string }[]
    }[]
  }
  const callers = actorMap.actors.map((actor) => {
    const source = readFileSync(path.join(root, ...actor.sourcePath.split('/')), 'utf8')
    const guard = classifyGuard(source)
    const context = classifyContext(source)
    const mutatedTables = [
      ...new Set(
        (actor.tables ?? [])
          .filter(
            (table) =>
              SENSITIVE_OPERATIONS.has(table.operation) &&
              !/^UNRESOLVED/.test(table.name) &&
              !SIDE_EFFECT_ONLY_TABLES.has(table.name),
          )
          .map((table) => table.name),
      ),
    ]
    const exceptionReasons: string[] = []
    if (['NONE', 'DIRECT_AUTH_ONLY', 'WITH_API_PUBLIC'].includes(guard))
      exceptionReasons.push('BYPASSES_SHARED_AUTHORIZATION_GUARD')
    if (guard === 'WITH_API_CRON' || guard === 'WEBHOOK_SIGNATURE')
      exceptionReasons.push('NON_HUMAN_CREDENTIAL_GUARD')
    if (context.system) exceptionReasons.push('PRIVILEGED_SYSTEM_AUTHORITY')
    if (context.tenant && context.explicit) exceptionReasons.push('MANUAL_DATABASE_CONTEXT')
    if (IDENTITY_MUTATION.test(source)) exceptionReasons.push('IDENTITY_OR_MEMBERSHIP_MUTATION')
    if (mutatedTables.some((table) => FINANCIAL.test(table)))
      exceptionReasons.push('FINANCIAL_MUTATION')
    const mutating = mutatedTables.length > 0
    const binding = bindControl(guard, actor.sourcePath, source)
    const sharedControlBound = !['NONE', 'DIRECT_AUTH_ONLY'].includes(guard)
    if (mutating && !binding)
      throw new Error(`UE_CALLER_CONTROL_UNBOUND_MUTATING_CALLER:${actor.sourcePath}`)
    return {
      id: actor.id,
      kind: actor.kind,
      sourcePath: actor.sourcePath,
      sourceSha256: actor.sourceSha256,
      guard,
      databaseContext: context.system
        ? 'SYSTEM_ROLE_CONTEXT'
        : context.tenant || context.explicit
          ? 'TENANT_RLS_CONTEXT_IN_SOURCE'
          : ['WITH_API', 'LEGACY_ROLE_WRAPPER', 'ORGANIZATION_MIDDLEWARE'].includes(guard)
            ? 'TENANT_RLS_CONTEXT_FROM_SHARED_GUARD'
            : 'NO_DATABASE_CONTEXT_IN_SOURCE',
      mutating,
      mutatedTables,
      sharedControlBound,
      boundControl: binding?.control ?? null,
      bindingBasis: binding?.basis ?? null,
      exceptionReasons,
      controlClass: `${guard}|${
        context.system
          ? 'SYSTEM'
          : context.tenant
            ? 'TENANT_IN_SOURCE'
            : ['WITH_API', 'LEGACY_ROLE_WRAPPER', 'ORGANIZATION_MIDDLEWARE'].includes(guard)
              ? 'TENANT_FROM_GUARD'
              : 'NONE'
      }`,
    }
  })
  const classes = new Map<string, number>()
  for (const caller of callers)
    classes.set(caller.controlClass, (classes.get(caller.controlClass) ?? 0) + 1)
  const mutatingCallers = callers.filter((caller) => caller.mutating)
  const exceptions = callers.filter((caller) => caller.exceptionReasons.length)
  const mutatingExceptions = exceptions.filter((caller) => caller.mutating)
  const reasonCounts: Record<string, number> = {}
  for (const caller of mutatingExceptions)
    for (const reason of caller.exceptionReasons)
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
  const summary = {
    rootCallers: callers.length,
    mutatingRootCallers: mutatingCallers.length,
    mutatingWithSharedControlPath: mutatingCallers.filter((caller) => caller.sharedControlBound)
      .length,
    mutatingBoundToControl: mutatingCallers.filter((caller) => caller.boundControl).length,
    mutatingUnmapped: mutatingCallers.filter((caller) => !caller.boundControl).length,
    controlBindingCounts: Object.fromEntries(
      [...new Set(mutatingCallers.map((caller) => caller.boundControl!))]
        .sort()
        .map((control) => [
          control,
          mutatingCallers.filter((caller) => caller.boundControl === control).length,
        ]),
    ),
    mutatingWithoutControlPath: mutatingCallers.filter((caller) => !caller.sharedControlBound)
      .length,
    controlClasses: [...classes.entries()]
      .map(([controlClass, count]) => ({ controlClass, count }))
      .sort((a, b) => b.count - a.count),
    mutatingExceptionCallers: mutatingExceptions.length,
    mutatingExceptionReasonCounts: reasonCounts,
  }
  return { summary, callers }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const graph = buildCallerControlGraph()
  const target = process.argv[2]
  const body = `${JSON.stringify(graph, null, 2)}\n`
  if (target) writeFileSync(target, body)
  process.stdout.write(
    `${JSON.stringify({ ...graph.summary, digest: createHash('sha256').update(body).digest('hex') })}\n`,
  )
}
