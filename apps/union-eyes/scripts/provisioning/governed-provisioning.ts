import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

export type Scope = 'UE_OPERATIONAL' | 'FINANCIAL_SERVICE'
export type RoleClass =
  | 'MIGRATION_ADMIN'
  | 'APPLICATION_RUNTIME'
  | 'SYSTEM_OR_INTERNAL_RUNTIME'
  | 'FINANCIAL_MIGRATION'
  | 'FINANCIAL_RUNTIME'
export interface TargetContract {
  databaseActors: {
    DATABASE_ACTOR_ID: string
    ACTOR_PURPOSE: string
    DATABASE_SCOPE_ID: Scope
    TARGET_ID: string
    ROLE_CLASS: RoleClass
    SEARCH_PATH_CONTRACT_ID: string
    HOST_BINDING: string
    PORT_BINDING: string
    DATABASE_NAME_BINDING: string
  }[]
  searchPathContracts: { SEARCH_PATH_CONTRACT_ID: string; SEARCH_PATH: string[] }[]
}
export interface BootstrapContract {
  CONTRACT_VERSION: string
  roleContract: {
    ROLE_CLASS: RoleClass
    DATABASE_SCOPE: string
    PRINCIPAL_NAME: string
    ROTATION_AUTHORITY: string
    CREATION_AUTHORITY: string
  }[]
  extensionDoctrine: { MANDATORY_EXTENSIONS: string[]; VECTOR_DECISION_ID: string }
  governanceDecisionObligations: { DECISION_ID: string; STATUS: string }[]
}
export interface RoleSpec {
  ROLE_CLASS: RoleClass
  DATABASE_SCOPE_ID: Scope
  PRINCIPAL_BINDING: string
  FROZEN_REQUIRED_NAME: string | null
  LOGIN_EXPECTATION: 'NOLOGIN'
  LOGIN_PRINCIPAL_BINDING: string
  AUTHENTICATION_AND_ROTATION_AUTHORITY: 'EXTERNAL_SECRET_DEPLOYMENT_AUTHORITY_NOT_W3'
  BYPASSRLS_EXPECTATION: 'NO'
  SUPERUSER_EXPECTATION: 'NO'
  CREATEDB_EXPECTATION: 'NO'
  CREATEROLE_EXPECTATION: 'NO'
  REPLICATION_EXPECTATION: 'NO'
  INHERIT_EXPECTATION: 'NO'
  OWNERSHIP_EXPECTATION: string
  SEARCH_PATH_CONTRACT_IDS: string[]
  TEMP_EXPECTATION: 'DENIED'
  DATABASE_CONNECT_EXPECTATION: 'GRANT_NAMED_ONLY'
  SCHEMA_USAGE_EXPECTATION: 'public USAGE'
  SCHEMA_CREATE_EXPECTATION: 'public CREATE' | 'DENIED'
  MAY_OWN_DOMAIN_TABLES: boolean
  MAY_OWN_PLATFORM_HELPERS: boolean
  MAY_OWN_FINANCIAL_TABLES: boolean
  ROTATION_AUTHORITY: string
  CREATION_AUTHORITY: string
  ROLE_MEMBERSHIP_EXPECTATION: 'EXACT_EXTERNAL_LOGIN_TO_AUTHORIZATION_ROLE_ONLY'
  POST_BOOTSTRAP_USAGE_EXPECTATION: string
}
export interface ExtensionSpec {
  EXTENSION: string
  DATABASE_SCOPE_ID: Scope
  INSTALL_SCHEMA: 'public'
  REQUIRED_BEFORE: 'DEPENDENT_OPERATIONAL_MIGRATIONS'
  INSTALL_AUTHORITY: string
  MANDATORY: true
  FAILURE_POLICY: 'FAIL_FAST'
  VERSION_POLICY: 'PLATFORM_PROVIDED_VERSION'
  RELOCATION_POLICY: 'NEVER_MOVE_EXISTING; explicit SCHEMA on install; availability/control metadata must support public placement'
}
export interface TargetDescriptor {
  TARGET_ID: string
  DATABASE_SCOPE_ID: Scope
  DATABASE_ACTOR_ID: string
  ROLE_CLASS: RoleClass
  SEARCH_PATH_CONTRACT_ID: string
  HOST_BINDING: string
  PORT_BINDING: string
  DATABASE_NAME_BINDING: string
  ENVIRONMENT_ID: string
  HOST: string
  PORT: number
  DATABASE_NAME: string
  SEARCH_PATH: string[]
}
export interface BindingPacket {
  targets: TargetDescriptor[]
  principals: Record<RoleClass, string>
  loginPrincipals: Record<RoleClass, string>
  executorPrincipal: string
}
export interface MembershipEdge {
  grantedRole: string
  memberRole: string
  adminOption: boolean
  setOption: boolean
}
export interface DelegationBinding {
  ROLE_CLASS: RoleClass
  DATABASE_SCOPE_ID: Scope
  AUTHORIZATION_ROLE: string
  LOGIN_PRINCIPAL: string
}
export interface RoleDescriptor {
  name: string
  login: boolean
  superuser: boolean
  bypassRls: boolean
  createDb: boolean
  createRole: boolean
  replication: boolean
  inherit: boolean
  memberships: string[]
  memberRoles: string[]
  ownedObjects: string[]
}
export interface ExtensionDescriptor {
  name: string
  available: boolean
  platformVersion: string | null
  supportsPublicPlacement: boolean
  installed: null | { schema: string; version: string }
}
export interface PrivilegeDescriptor {
  principal: string
  connect: boolean
  temp: boolean
  databaseCreate: boolean
  schemaUsage: boolean
  schemaCreate: boolean
  grantOptions: boolean
  ownsDatabase: boolean
  ownsPublicSchema: boolean
}
export interface Snapshot {
  target: TargetDescriptor
  currentUser: string
  currentRole: string
  temporaryNamespacePresent: boolean
  roles: RoleDescriptor[]
  membershipEdges: MembershipEdge[]
  extensions: ExtensionDescriptor[]
  privileges: PrivilegeDescriptor[]
  publicPrivileges: {
    connect: boolean
    temp: boolean
    databaseCreate: boolean
    schemaUsage: boolean
    schemaCreate: boolean
    functionExecuteDefaults: boolean
  }
  defaultPrivileges: {
    creator: string
    publicFunctionExecute: boolean
    unauthorizedRecipients: string[]
  }[]
}
export interface Operation {
  ID: string
  KIND:
    | 'CREATE_ROLE_IF_ABSENT'
    | 'INSTALL_EXTENSION_IF_ABSENT'
    | 'PRIVILEGE_BOUNDARY'
    | 'GRANT_MEMBERSHIP_IF_ABSENT'
  SQL: string
  ROLE_CLASS?: RoleClass
  EXTENSION?: string
}
export interface ProvisioningPlan {
  DATABASE_SCOPE_ID: Scope
  TARGET: TargetDescriptor
  EXECUTOR_PRINCIPAL: string
  ROLE_SPECS: RoleSpec[]
  PRINCIPALS: Partial<Record<RoleClass, string>>
  DELEGATION_BINDINGS: DelegationBinding[]
  DELEGATION_BINDING_STATE: 'EXTERNALLY_BOUND_OFFLINE_NOT_AUTHENTICATED'
  EXTENSION_SPECS: ExtensionSpec[]
  OPERATIONS: Operation[]
  VERIFY_SQL: { ID: string; SQL: string; PARAMETER_BINDINGS: string[] }[]
  GOVERNANCE_BLOCKERS: string[]
  PLAN_SHA256: string
  SQL_SHA256: string
}
export interface SingleClient {
  snapshot(plan: ProvisioningPlan): Promise<Snapshot>
  execute(sql: string): Promise<void>
}
export interface TransactionAdapter {
  transaction<T>(work: (client: SingleClient) => Promise<T>): Promise<T>
}
export class ProvisioningError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'ProvisioningError'
  }
}
function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ProvisioningError(code)
}
function booleanFields(value: object, fields: string[]): boolean {
  return fields.every((key) => typeof Reflect.get(value, key) === 'boolean')
}
export function quoteIdentifier(value: string, registeredExtension = false): string {
  requireCondition(
    typeof value === 'string' &&
      /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(value) &&
      (!value.toLowerCase().startsWith('pg_') ||
        (registeredExtension && ['pg_trgm'].includes(value))) &&
      value.toLowerCase() !== 'public',
    'UNSAFE_OR_RESERVED_IDENTIFIER',
  )
  return `"${value}"`
}
export function safeFailure(error: unknown): string {
  return error instanceof ProvisioningError ? error.code : 'PROVISIONING_FAILED_DETAILS_REDACTED'
}
export function rejectSecretFields(value: unknown): void {
  if (typeof value === 'string') {
    requireCondition(
      !/postgres(?:ql)?:\/\/|password\s*=|token\s*=|secret\s*=/i.test(value),
      'SECRET_VALUE_OR_CONNECTION_STRING_REJECTED',
    )
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      requireCondition(
        !/password|token|connectionstring|connectionurl|credentialvalue|secretvalue|databaseurl/i.test(
          key.replaceAll('_', ''),
        ),
        'SECRET_FIELD_REJECTED',
      )
      rejectSecretFields(child)
    }
  }
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const roleDecision = 'UE-1B3CA1G-DECISION-4e0fdb9b7d80bdb5'
const vectorDecision = 'UE-1B3CA1G-DECISION-7e108c57ea428e21'

export function specifications(canonical: BootstrapContract, target: TargetContract) {
  requireCondition(
    canonical.roleContract.length === 5 &&
      new Set(canonical.roleContract.map((r) => r.ROLE_CLASS)).size === 5,
    'ROLE_UNIVERSE_DRIFT',
  )
  requireCondition(
    hash([...canonical.extensionDoctrine.MANDATORY_EXTENSIONS].sort()) ===
      hash(['btree_gin', 'pg_trgm', 'pgcrypto', 'uuid-ossp']),
    'EXTENSION_UNIVERSE_DRIFT',
  )
  const roles: RoleSpec[] = canonical.roleContract.map((r) => {
    const scope: Scope = r.DATABASE_SCOPE === 'union-eyes' ? 'UE_OPERATIONAL' : 'FINANCIAL_SERVICE'
    const creator = ['MIGRATION_ADMIN', 'FINANCIAL_MIGRATION'].includes(r.ROLE_CLASS)
    return {
      ROLE_CLASS: r.ROLE_CLASS,
      DATABASE_SCOPE_ID: scope,
      PRINCIPAL_BINDING: `${r.ROLE_CLASS}_PRINCIPAL`,
      FROZEN_REQUIRED_NAME:
        r.ROLE_CLASS === 'APPLICATION_RUNTIME'
          ? 'union_eyes_runtime'
          : r.ROLE_CLASS === 'SYSTEM_OR_INTERNAL_RUNTIME'
            ? 'union_eyes_system'
            : null,
      LOGIN_EXPECTATION: 'NOLOGIN',
      LOGIN_PRINCIPAL_BINDING: `${r.ROLE_CLASS}_LOGIN_PRINCIPAL`,
      AUTHENTICATION_AND_ROTATION_AUTHORITY: 'EXTERNAL_SECRET_DEPLOYMENT_AUTHORITY_NOT_W3',
      BYPASSRLS_EXPECTATION: 'NO',
      SUPERUSER_EXPECTATION: 'NO',
      CREATEDB_EXPECTATION: 'NO',
      CREATEROLE_EXPECTATION: 'NO',
      REPLICATION_EXPECTATION: 'NO',
      INHERIT_EXPECTATION: 'NO',
      OWNERSHIP_EXPECTATION: creator
        ? 'Governed producer only, never runtime; exact delegation/owner approval required before apply'
        : 'No database/schema/domain/platform/financial ownership',
      SEARCH_PATH_CONTRACT_IDS: target.databaseActors
        .filter((a) => a.ROLE_CLASS === r.ROLE_CLASS)
        .map((a) => a.SEARCH_PATH_CONTRACT_ID),
      TEMP_EXPECTATION: 'DENIED',
      DATABASE_CONNECT_EXPECTATION: 'GRANT_NAMED_ONLY',
      SCHEMA_USAGE_EXPECTATION: 'public USAGE',
      SCHEMA_CREATE_EXPECTATION: creator ? 'public CREATE' : 'DENIED',
      MAY_OWN_DOMAIN_TABLES: r.ROLE_CLASS === 'MIGRATION_ADMIN',
      MAY_OWN_PLATFORM_HELPERS: r.ROLE_CLASS === 'MIGRATION_ADMIN',
      MAY_OWN_FINANCIAL_TABLES: r.ROLE_CLASS === 'FINANCIAL_MIGRATION',
      ROTATION_AUTHORITY: 'NOT_APPLICABLE_TO_NOLOGIN_AUTHORIZATION_ROLE',
      CREATION_AUTHORITY: r.CREATION_AUTHORITY,
      ROLE_MEMBERSHIP_EXPECTATION: 'EXACT_EXTERNAL_LOGIN_TO_AUTHORIZATION_ROLE_ONLY',
      POST_BOOTSTRAP_USAGE_EXPECTATION: creator
        ? 'No permanent application/runtime use; separately approved delegation/credential activation only'
        : 'Bounded object grants only after W4/W6/W7 materialization; no ALL PRIVILEGES',
    }
  })
  const extensions: ExtensionSpec[] = canonical.extensionDoctrine.MANDATORY_EXTENSIONS.map(
    (name) => ({
      EXTENSION: name,
      DATABASE_SCOPE_ID: 'UE_OPERATIONAL',
      INSTALL_SCHEMA: 'public',
      REQUIRED_BEFORE: 'DEPENDENT_OPERATIONAL_MIGRATIONS',
      INSTALL_AUTHORITY:
        'Separately approved provisioning operator on same target/client; install privilege prerequisite, never runtime role escalation',
      MANDATORY: true,
      FAILURE_POLICY: 'FAIL_FAST',
      VERSION_POLICY: 'PLATFORM_PROVIDED_VERSION',
      RELOCATION_POLICY:
        'NEVER_MOVE_EXISTING; explicit SCHEMA on install; availability/control metadata must support public placement',
    }),
  )
  const blockers = [roleDecision, vectorDecision].filter(
    (id) =>
      canonical.governanceDecisionObligations.find((d) => d.DECISION_ID === id)?.STATUS !==
      'APPROVED_AND_IMPLEMENTED_IN_W3_CONTRACT',
  )
  return {
    roles,
    extensions,
    blockers,
    VECTOR_EXTENSION_DISPOSITION: blockers.includes(vectorDecision)
      ? ('GOVERNANCE_DECISION_REQUIRED' as const)
      : ('OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED' as const),
    DELEGATION_BINDING_STATE: 'NOT_RUNTIME_BOUND' as const,
  }
}

function physicalKey(t: TargetDescriptor) {
  return hash([t.HOST.toLowerCase().replace(/\.$/, ''), t.PORT, t.DATABASE_NAME])
}
export function validateBindings(
  packet: BindingPacket,
  contract: TargetContract,
  roles: RoleSpec[],
): void {
  rejectSecretFields(packet)
  requireCondition(packet.loginPrincipals, 'FAIL_MISSING_PRINCIPAL_BINDING')
  requireCondition(
    Object.keys(packet).sort().join(',') === 'executorPrincipal,loginPrincipals,principals,targets',
    'UNEXPECTED_BINDING_FIELDS_OR_AMBIENT_ADAPTER',
  )
  requireCondition(packet.targets.length === 2, 'EXACT_TWO_SCOPE_TARGETS_REQUIRED')
  for (const scope of ['UE_OPERATIONAL', 'FINANCIAL_SERVICE'] as const) {
    const matches = packet.targets.filter((t) => t.DATABASE_SCOPE_ID === scope)
    requireCondition(matches.length === 1, 'MISSING_OR_DUPLICATE_SCOPE')
    const t = matches[0]
    requireCondition(
      Object.keys(t).sort().join(',') ===
        [
          'TARGET_ID',
          'DATABASE_SCOPE_ID',
          'DATABASE_ACTOR_ID',
          'ROLE_CLASS',
          'SEARCH_PATH_CONTRACT_ID',
          'HOST_BINDING',
          'PORT_BINDING',
          'DATABASE_NAME_BINDING',
          'ENVIRONMENT_ID',
          'HOST',
          'PORT',
          'DATABASE_NAME',
          'SEARCH_PATH',
        ]
          .sort()
          .join(','),
      'CONFLICTING_OR_UNEXPECTED_TARGET_COMPONENTS',
    )
    const actor = contract.databaseActors.find(
      (a) =>
        a.ACTOR_PURPOSE ===
        (scope === 'UE_OPERATIONAL' ? 'PROVISIONING' : 'FINANCIAL_PROVISIONING'),
    )
    requireCondition(actor && actor.DATABASE_SCOPE_ID === scope, 'PROVISIONING_ACTOR_MISSING')
    for (const key of [
      'TARGET_ID',
      'DATABASE_ACTOR_ID',
      'ROLE_CLASS',
      'SEARCH_PATH_CONTRACT_ID',
      'HOST_BINDING',
      'PORT_BINDING',
      'DATABASE_NAME_BINDING',
    ] as const) {
      requireCondition(t[key] === actor[key], 'TARGET_CONTRACT_MISMATCH')
    }
    requireCondition(
      typeof t.HOST === 'string' && t.HOST.length > 0 && t.HOST.trim() === t.HOST,
      'HOST_REQUIRED',
    )
    const host = t.HOST.toLowerCase().replace(/\.$/, '')
    requireCondition(
      isIP(host) > 0 ||
        (host.length <= 253 &&
          host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))),
      'HOST_INVALID',
    )
    requireCondition(
      Number.isInteger(t.PORT) && t.PORT > 0 && t.PORT <= 65535,
      'EXPLICIT_PORT_REQUIRED',
    )
    quoteIdentifier(t.DATABASE_NAME)
    requireCondition(
      typeof t.ENVIRONMENT_ID === 'string' && /^[A-Za-z0-9_-]+$/.test(t.ENVIRONMENT_ID),
      'ENVIRONMENT_REQUIRED',
    )
    const path = contract.searchPathContracts.find(
      (p) => p.SEARCH_PATH_CONTRACT_ID === t.SEARCH_PATH_CONTRACT_ID,
    )
    requireCondition(
      path &&
        hash(t.SEARCH_PATH) === hash(path.SEARCH_PATH) &&
        hash(t.SEARCH_PATH) === hash(['pg_catalog']),
      'PROVISIONING_PATH_MISMATCH',
    )
  }
  requireCondition(
    packet.targets[0].ENVIRONMENT_ID === packet.targets[1].ENVIRONMENT_ID,
    'CROSS_ENVIRONMENT_REJECTED',
  )
  requireCondition(
    physicalKey(packet.targets[0]) !== physicalKey(packet.targets[1]),
    'CROSS_SCOPE_TARGET_COLLISION',
  )
  requireCondition(Object.keys(packet.principals).length === 5, 'EXACT_PRINCIPAL_BINDINGS_REQUIRED')
  const names = roles.map((r) => {
    const name = packet.principals[r.ROLE_CLASS]
    quoteIdentifier(name)
    requireCondition(
      !r.FROZEN_REQUIRED_NAME || name === r.FROZEN_REQUIRED_NAME,
      'FROZEN_ROLE_NAME_MISMATCH',
    )
    return name
  })
  requireCondition(new Set(names).size === 5, 'CROSS_SCOPE_PRINCIPAL_COLLISION')
  requireCondition(
    packet.loginPrincipals && Object.keys(packet.loginPrincipals).length === 5,
    'FAIL_MISSING_PRINCIPAL_BINDING',
  )
  const logins = roles.map((r) => {
    const name = packet.loginPrincipals[r.ROLE_CLASS]
    requireCondition(typeof name === 'string' && name.length > 0, 'FAIL_MISSING_PRINCIPAL_BINDING')
    quoteIdentifier(name)
    return name
  })
  requireCondition(
    new Set([...names, ...logins]).size === 10,
    'LOGIN_AUTHORIZATION_OR_SCOPE_COLLISION',
  )
  quoteIdentifier(packet.executorPrincipal)
  requireCondition(
    ![...names, ...logins].includes(packet.executorPrincipal),
    'PROVISION_OPERATOR_MUST_BE_SEPARATE',
  )
}

export function buildPlan(
  scope: Scope,
  packet: BindingPacket,
  canonical: BootstrapContract,
  target: TargetContract,
): ProvisioningPlan {
  const { roles, extensions, blockers } = specifications(canonical, target)
  validateBindings(packet, target, roles)
  const t = packet.targets.find((candidate) => candidate.DATABASE_SCOPE_ID === scope)
  requireCondition(t, 'SCOPE_TARGET_REQUIRED')
  const selected = roles.filter((r) => r.DATABASE_SCOPE_ID === scope)
  const ext = extensions.filter((e) => e.DATABASE_SCOPE_ID === scope)
  const operations: Operation[] = selected.map((r) => ({
    ID: `CREATE-${r.ROLE_CLASS}`,
    KIND: 'CREATE_ROLE_IF_ABSENT',
    ROLE_CLASS: r.ROLE_CLASS,
    SQL: `CREATE ROLE ${quoteIdentifier(packet.principals[r.ROLE_CLASS])} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;`,
  }))
  for (const e of ext)
    operations.push({
      ID: `EXTENSION-${e.EXTENSION}`,
      KIND: 'INSTALL_EXTENSION_IF_ABSENT',
      EXTENSION: e.EXTENSION,
      SQL: `CREATE EXTENSION ${quoteIdentifier(e.EXTENSION, true)} WITH SCHEMA "public";`,
    })
  const db = quoteIdentifier(t.DATABASE_NAME)
  operations.push(
    {
      ID: 'PUBLIC-DATABASE-BOUNDARY',
      KIND: 'PRIVILEGE_BOUNDARY',
      SQL: `REVOKE CONNECT, TEMPORARY, CREATE ON DATABASE ${db} FROM PUBLIC;`,
    },
    {
      ID: 'PUBLIC-SCHEMA-BOUNDARY',
      KIND: 'PRIVILEGE_BOUNDARY',
      SQL: 'REVOKE USAGE, CREATE ON SCHEMA "public" FROM PUBLIC;',
    },
  )
  for (const r of selected) {
    const name = quoteIdentifier(packet.principals[r.ROLE_CLASS])
    const statements = [
      `REVOKE TEMPORARY, CREATE ON DATABASE ${db} FROM ${name};`,
      `GRANT CONNECT ON DATABASE ${db} TO ${name};`,
      `GRANT USAGE ON SCHEMA "public" TO ${name};`,
      `${r.SCHEMA_CREATE_EXPECTATION === 'DENIED' ? 'REVOKE CREATE ON SCHEMA "public" FROM' : 'GRANT CREATE ON SCHEMA "public" TO'} ${name};`,
    ]
    if (r.SCHEMA_CREATE_EXPECTATION === 'public CREATE') {
      statements.push(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${name} REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`,
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${name} IN SCHEMA "public" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;`,
      )
    }
    for (let i = 0; i < statements.length; i++)
      operations.push({
        ID: `BOUNDARY-${r.ROLE_CLASS}-${i + 1}`,
        KIND: 'PRIVILEGE_BOUNDARY',
        SQL: statements[i],
      })
  }
  for (const r of selected)
    operations.push({
      ID: `DELEGATE-${r.ROLE_CLASS}`,
      KIND: 'GRANT_MEMBERSHIP_IF_ABSENT',
      ROLE_CLASS: r.ROLE_CLASS,
      SQL: `GRANT ${quoteIdentifier(packet.principals[r.ROLE_CLASS])} TO ${quoteIdentifier(packet.loginPrincipals[r.ROLE_CLASS])};`,
    })
  const verifySql = [
    {
      ID: 'TARGET',
      SQL: "SELECT pg_catalog.current_database() AS database_name, CURRENT_USER AS current_user, CURRENT_ROLE AS current_role, pg_catalog.current_setting('search_path') AS search_path, pg_catalog.pg_my_temp_schema() <> 0 AS temporary_namespace_present;",
      PARAMETER_BINDINGS: [],
    },
    {
      ID: 'ROLE-ATTRIBUTES',
      SQL: 'SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication, rolinherit FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname;',
      PARAMETER_BINDINGS: ['scope authorization and external login principal names'],
    },
    {
      ID: 'ROLE-MEMBERSHIPS',
      SQL: "SELECT granted.rolname AS granted_role, member.rolname AS member_role, m.admin_option, COALESCE((pg_catalog.to_jsonb(m)->>'set_option')::boolean, true) AS set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles granted ON granted.oid = m.roleid JOIN pg_catalog.pg_roles member ON member.oid = m.member ORDER BY granted_role, member_role, m.grantor;",
      PARAMETER_BINDINGS: [
        'Complete cluster membership graph, including every edge touching either authorization roles or bound login principals; never filter away extra/nested/cross-scope edges',
      ],
    },
    {
      ID: 'OWNERSHIP',
      SQL: 'SELECT r.rolname, d.dbid, d.classid, d.objid FROM pg_catalog.pg_shdepend d JOIN pg_catalog.pg_roles r ON r.oid = d.refobjid WHERE d.deptype = $1 AND r.rolname = ANY($2::text[]) ORDER BY r.rolname, d.dbid, d.classid, d.objid;',
      PARAMETER_BINDINGS: ['o', 'scope principal names; includes shared/cross-database ownership'],
    },
    {
      ID: 'EFFECTIVE-PRIVILEGES',
      SQL: "SELECT r.rolname, pg_catalog.has_database_privilege(r.oid, pg_catalog.current_database(), 'CONNECT') AS connect, pg_catalog.has_database_privilege(r.oid, pg_catalog.current_database(), 'TEMP') AS temp, pg_catalog.has_database_privilege(r.oid, pg_catalog.current_database(), 'CREATE') AS database_create, pg_catalog.has_schema_privilege(r.oid, 'public', 'USAGE') AS schema_usage, pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE') AS schema_create FROM pg_catalog.pg_roles r WHERE r.rolname = ANY($1::text[]) ORDER BY r.rolname;",
      PARAMETER_BINDINGS: ['scope principal names'],
    },
    {
      ID: 'DATABASE-PUBLIC-ACL',
      SQL: "SELECT a.* FROM pg_catalog.pg_database d CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(d.datacl, pg_catalog.acldefault('d', d.datdba))) a WHERE d.datname = pg_catalog.current_database();",
      PARAMETER_BINDINGS: [],
    },
    {
      ID: 'SCHEMA-PUBLIC-ACL',
      SQL: "SELECT a.* FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) a WHERE n.nspname = 'public';",
      PARAMETER_BINDINGS: [],
    },
    {
      ID: 'EXTENSIONS',
      SQL: 'SELECT e.extname, e.extversion, n.nspname FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = ANY($1::text[]) ORDER BY e.extname;',
      PARAMETER_BINDINGS: ['mandatory scope extension names'],
    },
    {
      ID: 'EXTENSION-AVAILABILITY',
      SQL: 'SELECT name, version, installed, superuser, trusted, relocatable, schema FROM pg_catalog.pg_available_extension_versions WHERE name = ANY($1::text[]) ORDER BY name, version;',
      PARAMETER_BINDINGS: [
        'mandatory scope extension names; resolve platform default/version and public compatibility',
      ],
    },
    {
      ID: 'EXTENSION-DEFAULT-VERSION',
      SQL: 'SELECT name, default_version FROM pg_catalog.pg_available_extensions WHERE name = ANY($1::text[]) ORDER BY name;',
      PARAMETER_BINDINGS: ['mandatory scope extension names'],
    },
    {
      ID: 'DEFAULT-PRIVILEGES',
      SQL: 'SELECT r.rolname AS creator, d.defaclnamespace, d.defaclobjtype, a.* FROM pg_catalog.pg_default_acl d JOIN pg_catalog.pg_roles r ON r.oid = d.defaclrole CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a WHERE r.rolname = ANY($1::text[]) ORDER BY creator, d.defaclnamespace, d.defaclobjtype, a.grantee, a.privilege_type;',
      PARAMETER_BINDINGS: [
        'all scoped creator principals; absent global function row implies PostgreSQL PUBLIC EXECUTE default',
      ],
    },
  ]
  const plan = {
    DATABASE_SCOPE_ID: scope,
    TARGET: t,
    EXECUTOR_PRINCIPAL: packet.executorPrincipal,
    ROLE_SPECS: selected,
    PRINCIPALS: Object.fromEntries(
      selected.map((r) => [r.ROLE_CLASS, packet.principals[r.ROLE_CLASS]]),
    ),
    DELEGATION_BINDINGS: roles.map((r) => ({
      ROLE_CLASS: r.ROLE_CLASS,
      DATABASE_SCOPE_ID: r.DATABASE_SCOPE_ID,
      AUTHORIZATION_ROLE: packet.principals[r.ROLE_CLASS],
      LOGIN_PRINCIPAL: packet.loginPrincipals[r.ROLE_CLASS],
    })),
    DELEGATION_BINDING_STATE: 'EXTERNALLY_BOUND_OFFLINE_NOT_AUTHENTICATED' as const,
    EXTENSION_SPECS: ext,
    OPERATIONS: operations,
    VERIFY_SQL: verifySql,
    GOVERNANCE_BLOCKERS: blockers,
    SQL_SHA256: hash(operations.map((o) => [o.ID, o.SQL])),
  }
  return { ...plan, PLAN_SHA256: hash(plan) }
}

export function roleDisposition(
  existing: RoleDescriptor | undefined,
  name: string,
): 'CREATE' | 'ACCEPT' {
  if (!existing) return 'CREATE'
  requireCondition(
    booleanFields(existing, [
      'login',
      'superuser',
      'bypassRls',
      'createDb',
      'createRole',
      'replication',
      'inherit',
    ]) &&
      [existing.memberships, existing.memberRoles, existing.ownedObjects].every(
        (r) => Array.isArray(r) && r.every((v) => typeof v === 'string'),
      ),
    'INCOMPLETE_ROLE_DESCRIPTOR',
  )
  requireCondition(
    existing.name === name &&
      !existing.login &&
      !existing.superuser &&
      !existing.bypassRls &&
      !existing.createDb &&
      !existing.createRole &&
      !existing.replication &&
      !existing.inherit,
    'ROLE_ATTRIBUTE_DRIFT',
  )
  return 'ACCEPT'
}
export function extensionDisposition(
  existing: ExtensionDescriptor | undefined,
): 'INSTALL' | 'ACCEPT' {
  requireCondition(
    existing &&
      existing.available === true &&
      typeof existing.platformVersion === 'string' &&
      existing.platformVersion.length > 0 &&
      existing.supportsPublicPlacement === true,
    'MANDATORY_EXTENSION_UNAVAILABLE_OR_SCHEMA_UNSUPPORTED',
  )
  if (!existing.installed) return 'INSTALL'
  requireCondition(
    existing.installed.schema === 'public' &&
      existing.installed.version === existing.platformVersion,
    'EXTENSION_SCHEMA_OR_PLATFORM_VERSION_DRIFT',
  )
  return 'ACCEPT'
}
export type MembershipState =
  | 'EXPECTED_MEMBERSHIP_PRESENT'
  | 'EXPECTED_MEMBERSHIP_MISSING'
  | 'UNEXPECTED_EXTRA_MEMBER'
  | 'UNEXPECTED_REVERSE_MEMBERSHIP'
  | 'UNEXPECTED_NESTED_MEMBERSHIP'
  | 'UNEXPECTED_CROSS_SCOPE_MEMBERSHIP'
  | 'UNEXPECTED_RUNTIME_TO_MIGRATION_MEMBERSHIP'
  | 'ADMIN_OPTION_DRIFT'
  | 'SET_OPTION_DRIFT'
export function membershipVerificationModel(plan: ProvisioningPlan, snapshot: Snapshot) {
  requireCondition(Array.isArray(snapshot.membershipEdges), 'INCOMPLETE_MEMBERSHIP_DESCRIPTOR')
  for (const edge of snapshot.membershipEdges)
    requireCondition(
      typeof edge.grantedRole === 'string' &&
        typeof edge.memberRole === 'string' &&
        booleanFields(edge, ['adminOption', 'setOption']),
      'INCOMPLETE_MEMBERSHIP_DESCRIPTOR',
    )
  const edges = snapshot.membershipEdges
  requireCondition(
    new Set(edges.map((e) => hash([e.grantedRole, e.memberRole]))).size === edges.length,
    'DUPLICATE_MEMBERSHIP_EDGE',
  )
  return plan.DELEGATION_BINDINGS.map((binding) => {
    const expected = edges.find(
      (e) =>
        e.grantedRole === binding.AUTHORIZATION_ROLE && e.memberRole === binding.LOGIN_PRINCIPAL,
    )
    const extras = edges.filter(
      (e) =>
        [e.grantedRole, e.memberRole].some((n) =>
          [binding.AUTHORIZATION_ROLE, binding.LOGIN_PRINCIPAL].includes(n),
        ) && e !== expected,
    )
    const states: MembershipState[] = []
    for (const edge of extras) {
      const otherBindings = plan.DELEGATION_BINDINGS.filter(
        (b) =>
          b !== binding &&
          [edge.grantedRole, edge.memberRole].some((n) =>
            [b.AUTHORIZATION_ROLE, b.LOGIN_PRINCIPAL].includes(n),
          ),
      )
      if (otherBindings.some((b) => b.DATABASE_SCOPE_ID !== binding.DATABASE_SCOPE_ID))
        states.push('UNEXPECTED_CROSS_SCOPE_MEMBERSHIP')
      else if (plan.DELEGATION_BINDINGS.some((b) => b.AUTHORIZATION_ROLE === edge.memberRole))
        states.push(
          edge.grantedRole === binding.LOGIN_PRINCIPAL
            ? 'UNEXPECTED_REVERSE_MEMBERSHIP'
            : 'UNEXPECTED_NESTED_MEMBERSHIP',
        )
      else if (
        plan.DELEGATION_BINDINGS.some(
          (b) => b.ROLE_CLASS.includes('MIGRATION') && b.AUTHORIZATION_ROLE === edge.grantedRole,
        ) &&
        plan.DELEGATION_BINDINGS.some(
          (b) => !b.ROLE_CLASS.includes('MIGRATION') && b.LOGIN_PRINCIPAL === edge.memberRole,
        )
      )
        states.push('UNEXPECTED_RUNTIME_TO_MIGRATION_MEMBERSHIP')
      else states.push('UNEXPECTED_EXTRA_MEMBER')
    }
    if (expected?.adminOption) states.push('ADMIN_OPTION_DRIFT')
    if (expected && !expected.setOption) states.push('SET_OPTION_DRIFT')
    if (!states.length)
      states.push(expected ? 'EXPECTED_MEMBERSHIP_PRESENT' : 'EXPECTED_MEMBERSHIP_MISSING')
    return {
      ...binding,
      EXPECTED_LOGIN_IS_MEMBER: expected ? 'YES' : 'NO',
      ADMIN_OPTION: expected?.adminOption ? 'YES' : 'NO',
      EXTRA_MEMBERS: extras,
      REVERSE_OR_NESTED_EDGES: extras.filter((e) =>
        plan.DELEGATION_BINDINGS.some((b) => e.memberRole === b.AUTHORIZATION_ROLE),
      ),
      CROSS_SCOPE_EDGES: extras.filter((e) =>
        plan.DELEGATION_BINDINGS.some(
          (b) =>
            b.DATABASE_SCOPE_ID !== binding.DATABASE_SCOPE_ID &&
            [e.grantedRole, e.memberRole].some((n) =>
              [b.AUTHORIZATION_ROLE, b.LOGIN_PRINCIPAL].includes(n),
            ),
        ),
      ),
      STATES: [...new Set(states)],
    }
  })
}
function validateMemberships(plan: ProvisioningPlan, snapshot: Snapshot, requirePresent: boolean) {
  const model = membershipVerificationModel(plan, snapshot)
  for (const result of model) {
    for (const state of result.STATES)
      requireCondition(
        state === 'EXPECTED_MEMBERSHIP_PRESENT' || state === 'EXPECTED_MEMBERSHIP_MISSING',
        state,
      )
    if (requirePresent && result.DATABASE_SCOPE_ID === plan.DATABASE_SCOPE_ID)
      requireCondition(result.EXPECTED_LOGIN_IS_MEMBER === 'YES', 'EXPECTED_MEMBERSHIP_MISSING')
  }
  for (const role of snapshot.roles) {
    if (
      !plan.DELEGATION_BINDINGS.some((b) =>
        [b.AUTHORIZATION_ROLE, b.LOGIN_PRINCIPAL].includes(role.name),
      )
    )
      continue
    requireCondition(
      [role.memberships, role.memberRoles].every(
        (list) => Array.isArray(list) && list.every((v) => typeof v === 'string'),
      ),
      'INCOMPLETE_ROLE_DESCRIPTOR',
    )
    const incoming = snapshot.membershipEdges
      .filter((e) => e.grantedRole === role.name)
      .map((e) => e.memberRole)
    const outgoing = snapshot.membershipEdges
      .filter((e) => e.memberRole === role.name)
      .map((e) => e.grantedRole)
    requireCondition(
      hash([...role.memberRoles].sort()) === hash(incoming.sort()) &&
        hash([...role.memberships].sort()) === hash(outgoing.sort()),
      'MEMBERSHIP_CATALOG_PROJECTION_DRIFT',
    )
  }
}
function validateSnapshotTarget(plan: ProvisioningPlan, snapshot: Snapshot): void {
  requireCondition(
    hash(snapshot.target) === hash(plan.TARGET) &&
      snapshot.currentUser === plan.EXECUTOR_PRINCIPAL &&
      snapshot.currentRole === plan.EXECUTOR_PRINCIPAL &&
      snapshot.temporaryNamespacePresent === false,
    'CONNECTED_TARGET_ROLE_OR_TEMP_DRIFT',
  )
  requireCondition(
    new Set(snapshot.roles.map((r) => r.name)).size === snapshot.roles.length,
    'DUPLICATE_ROLE_DESCRIPTOR',
  )
  requireCondition(
    new Set(snapshot.extensions.map((e) => e.name)).size === snapshot.extensions.length,
    'DUPLICATE_EXTENSION_DESCRIPTOR',
  )
  requireCondition(
    new Set(snapshot.privileges.map((p) => p.principal)).size === snapshot.privileges.length,
    'DUPLICATE_PRIVILEGE_DESCRIPTOR',
  )
  requireCondition(
    new Set(snapshot.defaultPrivileges.map((p) => p.creator)).size ===
      snapshot.defaultPrivileges.length,
    'DUPLICATE_DEFAULT_PRIVILEGE_DESCRIPTOR',
  )
  requireCondition(
    booleanFields(snapshot.publicPrivileges, [
      'connect',
      'temp',
      'databaseCreate',
      'schemaUsage',
      'schemaCreate',
      'functionExecuteDefaults',
    ]) &&
      snapshot.privileges.every((p) =>
        booleanFields(p, [
          'connect',
          'temp',
          'databaseCreate',
          'schemaUsage',
          'schemaCreate',
          'grantOptions',
          'ownsDatabase',
          'ownsPublicSchema',
        ]),
      ) &&
      snapshot.defaultPrivileges.every(
        (p) =>
          typeof p.publicFunctionExecute === 'boolean' && Array.isArray(p.unauthorizedRecipients),
      ),
    'INCOMPLETE_PRIVILEGE_DESCRIPTOR',
  )
}
function validatePreexisting(plan: ProvisioningPlan, snapshot: Snapshot): void {
  validateSnapshotTarget(plan, snapshot)
  validateMemberships(plan, snapshot, false)
  for (const binding of plan.DELEGATION_BINDINGS.filter(
    (b) => b.DATABASE_SCOPE_ID === plan.DATABASE_SCOPE_ID,
  )) {
    const login = snapshot.roles.find((r) => r.name === binding.LOGIN_PRINCIPAL)
    requireCondition(login, 'EXTERNAL_LOGIN_PRINCIPAL_ABSENT')
    requireCondition(
      booleanFields(login, [
        'login',
        'superuser',
        'bypassRls',
        'createDb',
        'createRole',
        'replication',
        'inherit',
      ]) && Array.isArray(login.ownedObjects),
      'INCOMPLETE_ROLE_DESCRIPTOR',
    )
    requireCondition(
      login.login &&
        !login.superuser &&
        !login.bypassRls &&
        !login.createDb &&
        !login.createRole &&
        !login.replication,
      'EXTERNAL_LOGIN_ATTRIBUTE_DRIFT',
    )
  }
  for (const spec of plan.ROLE_SPECS) {
    const name = plan.PRINCIPALS[spec.ROLE_CLASS]
    requireCondition(name, 'PRINCIPAL_REQUIRED')
    const role = snapshot.roles.find((r) => r.name === name)
    roleDisposition(role, name)
    if (role && !spec.MAY_OWN_DOMAIN_TABLES && !spec.MAY_OWN_FINANCIAL_TABLES) {
      requireCondition(role.ownedObjects.length === 0, 'RUNTIME_OWNERSHIP_DRIFT')
    }
    const privileges = snapshot.privileges.find((p) => p.principal === name)
    requireCondition(
      !privileges ||
        (!privileges.ownsDatabase && !privileges.ownsPublicSchema && !privileges.grantOptions),
      'NAMED_OWNER_OR_GRANT_OPTION_DRIFT',
    )
    const defaults = snapshot.defaultPrivileges.find((p) => p.creator === name)
    requireCondition(
      !defaults || defaults.unauthorizedRecipients.length === 0,
      'UNEXPECTED_DEFAULT_PRIVILEGE_RECIPIENT',
    )
  }
  for (const e of plan.EXTENSION_SPECS)
    extensionDisposition(snapshot.extensions.find((x) => x.name === e.EXTENSION))
}
export function verifySnapshot(plan: ProvisioningPlan, snapshot: Snapshot): void {
  validatePreexisting(plan, snapshot)
  validateMemberships(plan, snapshot, true)
  requireCondition(
    Object.values(snapshot.publicPrivileges).every((v) => v === false),
    'PUBLIC_INHERITED_PRIVILEGE_DRIFT',
  )
  for (const spec of plan.ROLE_SPECS) {
    const name = plan.PRINCIPALS[spec.ROLE_CLASS]
    requireCondition(
      snapshot.roles.some((r) => r.name === name),
      'ROLE_ABSENT',
    )
    const p = snapshot.privileges.find((r) => r.principal === name)
    requireCondition(
      p &&
        p.connect &&
        !p.temp &&
        !p.databaseCreate &&
        p.schemaUsage &&
        p.schemaCreate === (spec.SCHEMA_CREATE_EXPECTATION === 'public CREATE') &&
        !p.grantOptions &&
        !p.ownsDatabase &&
        !p.ownsPublicSchema,
      'EFFECTIVE_DATABASE_SCHEMA_PRIVILEGE_DRIFT',
    )
    if (spec.SCHEMA_CREATE_EXPECTATION === 'public CREATE') {
      const defaults = snapshot.defaultPrivileges.find((r) => r.creator === name)
      requireCondition(
        defaults && !defaults.publicFunctionExecute && defaults.unauthorizedRecipients.length === 0,
        'DEFAULT_PRIVILEGE_DRIFT',
      )
    }
  }
  for (const e of plan.EXTENSION_SPECS) {
    requireCondition(
      extensionDisposition(snapshot.extensions.find((x) => x.name === e.EXTENSION)) === 'ACCEPT',
      'EXTENSION_ABSENT',
    )
  }
}

export async function executePlan(
  plan: ProvisioningPlan,
  adapter: TransactionAdapter,
  mode: 'apply' | 'verify',
): Promise<void> {
  requireCondition(plan.GOVERNANCE_BLOCKERS.length === 0, 'GOVERNANCE_DECISIONS_PENDING')
  const { PLAN_SHA256, ...body } = plan
  requireCondition(hash(body) === PLAN_SHA256, 'PLAN_DIGEST_DRIFT')
  await adapter.transaction(async (client) => {
    // W8 supplies a single authenticated, target-pinned client and transaction;
    // all catalog comparisons precede the first mutation.
    const before = await client.snapshot(plan)
    if (mode === 'verify') {
      verifySnapshot(plan, before)
      return
    }
    validatePreexisting(plan, before)
    for (const operation of plan.OPERATIONS) {
      if (operation.KIND === 'CREATE_ROLE_IF_ABSENT') {
        const name = operation.ROLE_CLASS && plan.PRINCIPALS[operation.ROLE_CLASS]
        requireCondition(name, 'PRINCIPAL_REQUIRED')
        if (
          roleDisposition(
            before.roles.find((r) => r.name === name),
            name,
          ) === 'ACCEPT'
        )
          continue
      } else if (operation.KIND === 'INSTALL_EXTENSION_IF_ABSENT') {
        if (
          extensionDisposition(before.extensions.find((e) => e.name === operation.EXTENSION)) ===
          'ACCEPT'
        )
          continue
      } else if (operation.KIND === 'GRANT_MEMBERSHIP_IF_ABSENT') {
        const binding = plan.DELEGATION_BINDINGS.find((b) => b.ROLE_CLASS === operation.ROLE_CLASS)
        requireCondition(
          binding && binding.DATABASE_SCOPE_ID === plan.DATABASE_SCOPE_ID,
          'DELEGATION_SCOPE_DRIFT',
        )
        if (
          before.membershipEdges.some(
            (e) =>
              e.grantedRole === binding.AUTHORIZATION_ROLE &&
              e.memberRole === binding.LOGIN_PRINCIPAL,
          )
        )
          continue
      }
      await client.execute(operation.SQL)
    }
    verifySnapshot(plan, await client.snapshot(plan))
  })
}

export function planTemplates(canonical: BootstrapContract, target: TargetContract) {
  const spec = specifications(canonical, target)
  const principals = Object.fromEntries(
    spec.roles.map((r) => [
      r.ROLE_CLASS,
      r.FROZEN_REQUIRED_NAME ?? `REQUIRED_${r.ROLE_CLASS}_PRINCIPAL`,
    ]),
  )
  function principal(roleClass: RoleClass): string {
    const name = principals[roleClass]
    requireCondition(typeof name === 'string', 'TEMPLATE_PRINCIPAL_MISSING')
    return name
  }
  const targets: TargetDescriptor[] = (['UE_OPERATIONAL', 'FINANCIAL_SERVICE'] as const).map(
    (scope) => {
      const actor = target.databaseActors.find(
        (a) =>
          a.ACTOR_PURPOSE ===
          (scope === 'UE_OPERATIONAL' ? 'PROVISIONING' : 'FINANCIAL_PROVISIONING'),
      )
      requireCondition(actor, 'TEMPLATE_TARGET_MISSING')
      return {
        TARGET_ID: actor.TARGET_ID,
        DATABASE_SCOPE_ID: scope,
        DATABASE_ACTOR_ID: actor.DATABASE_ACTOR_ID,
        ROLE_CLASS: actor.ROLE_CLASS,
        SEARCH_PATH_CONTRACT_ID: actor.SEARCH_PATH_CONTRACT_ID,
        HOST_BINDING: actor.HOST_BINDING,
        PORT_BINDING: actor.PORT_BINDING,
        DATABASE_NAME_BINDING: actor.DATABASE_NAME_BINDING,
        ENVIRONMENT_ID: 'UNBOUND_TEMPLATE',
        HOST: 'unbound.invalid',
        PORT: 1,
        DATABASE_NAME: `REQUIRED_${scope}_DATABASE`,
        SEARCH_PATH: ['pg_catalog'],
      }
    },
  )
  const packet: BindingPacket = {
    targets,
    principals: {
      MIGRATION_ADMIN: principal('MIGRATION_ADMIN'),
      APPLICATION_RUNTIME: principal('APPLICATION_RUNTIME'),
      SYSTEM_OR_INTERNAL_RUNTIME: principal('SYSTEM_OR_INTERNAL_RUNTIME'),
      FINANCIAL_MIGRATION: principal('FINANCIAL_MIGRATION'),
      FINANCIAL_RUNTIME: principal('FINANCIAL_RUNTIME'),
    },
    loginPrincipals: {
      MIGRATION_ADMIN: 'REQUIRED_MIGRATION_ADMIN_LOGIN',
      APPLICATION_RUNTIME: 'REQUIRED_APPLICATION_RUNTIME_LOGIN',
      SYSTEM_OR_INTERNAL_RUNTIME: 'REQUIRED_SYSTEM_RUNTIME_LOGIN',
      FINANCIAL_MIGRATION: 'REQUIRED_FINANCIAL_MIGRATION_LOGIN',
      FINANCIAL_RUNTIME: 'REQUIRED_FINANCIAL_RUNTIME_LOGIN',
    },
    executorPrincipal: 'REQUIRED_PROVISIONING_OPERATOR',
  }
  return targets.map((t) => {
    const plan = buildPlan(t.DATABASE_SCOPE_ID, packet, canonical, target)
    return {
      DATABASE_SCOPE_ID: plan.DATABASE_SCOPE_ID,
      TARGET_CONTRACT: {
        TARGET_ID: t.TARGET_ID,
        DATABASE_ACTOR_ID: t.DATABASE_ACTOR_ID,
        ROLE_CLASS: t.ROLE_CLASS,
        HOST_BINDING: t.HOST_BINDING,
        PORT_BINDING: t.PORT_BINDING,
        DATABASE_NAME_BINDING: t.DATABASE_NAME_BINDING,
        SEARCH_PATH_CONTRACT_ID: t.SEARCH_PATH_CONTRACT_ID,
      },
      PRINCIPAL_PLACEHOLDERS: plan.PRINCIPALS,
      DELEGATION_BINDINGS: plan.DELEGATION_BINDINGS,
      DELEGATION_BINDING_STATE: 'NOT_RUNTIME_BOUND',
      OPERATIONS: plan.OPERATIONS,
      VERIFY_SQL: plan.VERIFY_SQL,
      SQL_SHA256: plan.SQL_SHA256,
      TEMPLATE_SHA256: hash([plan.OPERATIONS, plan.VERIFY_SQL]),
      EXECUTABLE: 'NO; placeholders are not principal approvals or endpoint bindings',
      GOVERNANCE_BLOCKERS: plan.GOVERNANCE_BLOCKERS,
    }
  })
}
