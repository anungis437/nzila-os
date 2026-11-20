import { AUTHORITY_PHYSICAL_GUARDS } from '@/db/auth/authority-physical-guards'
import { CASE_SCOPE_PHYSICAL_GUARDS } from '@/db/auth/case-scope-physical-guards'
import { AUTHORITY_ISSUER_GUARDS } from '@/db/auth/authority-issuer-guards'
import { REWARD_NOMINATION_GUARDS } from '@/db/auth/reward-nomination-guards'
import { AUDIT_AUTHOR_GUARDS } from '@/db/auth/audit-author-guards'
import { CASE_PRIMARY_DOMAIN_GUARDS, CASE_DOMAIN_SUPPORT_CATALOG_QUERY, caseDomainSupportViolations } from '@/db/auth/case-primary-domain-guards'
import { QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY, queuedCaseMailFunctionViolations } from '@/db/auth/queued-case-mail'
import { physicalGuardQueries, physicalGuardViolations, type PhysicalTriggerDescriptor } from '@/db/auth/physical-guard-catalog'
import {
  inspectMessagingPhysicalCatalog,
  MESSAGING_PHYSICAL_QUERIES,
  messagingPhysicalGuardViolations,
} from '@/db/auth/messaging-physical-guards'
import {
  AUTH_EXECUTION_ROLES,
  AUTH_PRIVILEGE_EXPECTATIONS,
  AUTH_ROLE_MEMBERSHIP_EXPECTATIONS,
} from '@nzila/db/auth-storage-authority'
import { AUTH_FUNCTION_EXPECTATIONS } from '../../scripts/bootstrap-v2/auth-sql'
import { EXTERNAL_READ_CATALOG_QUERIES, inspectExternalRead, externalReadCatalogViolations } from '../external-resource-read/catalog'
import { CONTAINED_PARENT_POLICY_QUERY, containedParentPolicyInstallViolations } from '../../scripts/bootstrap-v2/contained-parent-policies'
import baseContract from './catalog-authority-contract.json'
import v2Decisions from './catalog-v2-decisions.json'
import { catalogContractDigest, type CatalogRow, type ContainedParentPolicy } from './catalog-admission-core.mjs'
import {
  CASE_ASSIGNEE_CATALOG_QUERY,
  caseAssigneePredicateViolations,
} from '@/db/auth/case-assignee-predicate'
import {
  CONVERSATION_ASSIGNEE_CATALOG_QUERY,
  conversationAssigneePredicateViolations,
} from '@/db/auth/conversation-assignee-predicate'
import {
  BUSINESS_SESSION_POLICY,
  BUSINESS_SESSION_CATALOG_PREDICATE,
  BUSINESS_SESSION_POLICY_QUERY,
  businessSessionPolicyViolations,
} from '@/db/auth/business-session-policy'
import {
  DEADLINE_SESSION_GUARD_QUERY,
  deadlineSessionGuardViolations,
} from '@/db/auth/business-session-event-guard'
import { membershipCatalogProjectionSql, type CanonicalPostgresMajor } from '../../../../packages/db/src/auth-storage-authority/membership-semantics'

type Execute = (statement: string) => Promise<CatalogRow[]>
const roles = [...Object.values(AUTH_EXECUTION_ROLES), 'union_eyes_runtime', 'union_eyes_system']
const literals = roles.map((role) => `'${role}'`).join(',')
export type CurrentOverlay = {
  entries: { table: string; classification: string; runtime: string[]; system: string[]; decision: string }[]
  currentSecurity?: {
    currentFunctions: { schema: string; name: string; executeAcl: { role: string; grantable: boolean }[] }[]
    approvedColumnGrants: { schema: string; table: string; role: string; privilege: string; columns: string[]; grantable: boolean }[]
    dedicatedRolePrivileges: { schema: string; table: string; role: string; privileges: string[] }[]
    nonPublic: { schema: string; table: string; runtime: string[]; system: string[] }[]
    runtimeSchemaUsage: string[]; systemSchemaUsage: string[]
    requiredSessionPolicy: { name: string; command: string; permissive: boolean; roles: string[]; predicate: string }
    requiredContainedParentPolicies: ContainedParentPolicy[]
    requiredPhysicalTriggers: PhysicalTriggerDescriptor[]
  }
}
const currentOverlay = v2Decisions as unknown as CurrentOverlay
const physicalContracts = [AUTHORITY_PHYSICAL_GUARDS, CASE_SCOPE_PHYSICAL_GUARDS, AUTHORITY_ISSUER_GUARDS, CASE_PRIMARY_DOMAIN_GUARDS, REWARD_NOMINATION_GUARDS, AUDIT_AUTHOR_GUARDS]

/** The canonical source projection replaces current permissions, never history.
 * A corrupt base or an ungenerated current overlay remains a denial. */
export function canonicalCatalogContract(base = baseContract) {
  return canonicalCatalogContractFromOverlay(base, currentOverlay)
}

/** Installer callers provide the freshly compiled source projection; application
 * reads use only the packaged projection above. An invalid historical digest
 * stays invalid in either path. */
export function canonicalCatalogContractFromOverlay(base: typeof baseContract, overlay: CurrentOverlay) {
  if (catalogContractDigest(base.payload) !== base.digest) return base
  const historical = structuredClone(base.payload), current = overlay.currentSecurity
  if (!current) {
    const payload = { ...historical, currentFunctions: undefined }
    return { payload, digest: catalogContractDigest(payload) }
  }
  const payload = {
    ...historical,
    entries: overlay.entries.map(({ decision: _decision, ...entry }) => entry),
    nonPublic: current.nonPublic,
    runtimeSchemaUsage: current.runtimeSchemaUsage,
    systemSchemaUsage: current.systemSchemaUsage,
    approvedColumnGrants: current.approvedColumnGrants,
    dedicatedRolePrivileges: current.dedicatedRolePrivileges,
    currentFunctions: current.currentFunctions,
    requiredSessionPolicy: current.requiredSessionPolicy,
    requiredContainedParentPolicies: current.requiredContainedParentPolicies,
    requiredPhysicalTriggers: current.requiredPhysicalTriggers,
  }
  return { payload, digest: catalogContractDigest(payload) }
}

// The same source-owned statements drive serial inspection and the default
// single-statement snapshot. Keep validation below independent of transport.
export function canonicalAuthMembershipQuery(postgresMajor: CanonicalPostgresMajor = 16) {
  const options = membershipCatalogProjectionSql(postgresMajor, { membershipAlias: 'm', memberAlias: 'member' })
  return `SELECT member.rolname AS member,granted.rolname AS granted,${options.adminOption} AS admin_option,
    ${options.inheritOption} AS inherit_option,${options.setOption} AS set_option
    FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
    WHERE member.rolname IN (${literals})`
}
export const CANONICAL_AUTH_QUERIES = {
  roles: `SELECT rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin,rolcreatedb,rolcreaterole,
    pg_catalog.has_schema_privilege(rolname,'user_management','USAGE') AS auth_usage,
    pg_catalog.has_schema_privilege(rolname,'user_management','CREATE') AS auth_create,
    pg_catalog.has_schema_privilege(rolname,'public','CREATE') AS public_create
    FROM pg_catalog.pg_roles WHERE rolname IN (${literals})`,
  memberships: canonicalAuthMembershipQuery(),
  columns: `SELECT r.rolname AS role,i.schema_name,i.table_name,v.privilege,
    i.all_columns,
    CASE WHEN pg_catalog.has_table_privilege(r.oid,i.relation_oid,v.privilege) THEN i.all_columns
      ELSE ARRAY(SELECT a.attname::text FROM pg_catalog.pg_attribute a
        WHERE a.attrelid=i.relation_oid AND a.attnum<>0 AND NOT a.attisdropped
          AND pg_catalog.has_column_privilege(r.oid,i.relation_oid,a.attnum,v.privilege)
        ORDER BY a.attname) END AS allowed_columns
    FROM pg_catalog.pg_roles r CROSS JOIN (
      SELECT c.oid AS relation_oid,n.nspname AS schema_name,c.relname AS table_name,
        array_agg(a.attname::text ORDER BY a.attname) AS all_columns
      FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE (n.nspname='user_management' OR
        (n.nspname='public' AND c.relname IN ('platform_identity_bindings','organization_members')))
        AND c.relkind IN ('r','p') AND a.attnum<>0 AND NOT a.attisdropped
      GROUP BY c.oid,n.nspname,c.relname
    ) AS i CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) v(privilege)
    WHERE r.rolname IN (${literals}) AND (i.schema_name='user_management' OR
      (i.schema_name='public' AND r.rolname LIKE 'nzila_auth_%'))`,
  tables: `SELECT r.rolname AS role,n.nspname AS schema_name,c.relname AS table_name,v.privilege,
    pg_catalog.has_table_privilege(r.oid,c.oid,v.privilege) AS allowed,c.relrowsecurity,c.relforcerowsecurity,owner.rolname AS owner
    FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_roles owner ON owner.oid=c.relowner
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES','DELETE','TRUNCATE','TRIGGER']) v(privilege)
    WHERE r.rolname IN (${literals}) AND (n.nspname='user_management' OR
      (n.nspname='public' AND c.relname IN ('platform_identity_bindings','organization_members') AND r.rolname LIKE 'nzila_auth_%'))
      AND c.relkind IN ('r','p')`,
  functions: `SELECT p.proname,p.prosecdef,p.proconfig,owner.rolname AS owner,r.rolname AS role,
    pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed,pg_catalog.has_function_privilege('public',p.oid,'EXECUTE') AS public_execute
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname='user_management' AND r.rolname IN (${literals})`,
} as const

export const canonicalAdmissionQueriesForMajor = (postgresMajor: CanonicalPostgresMajor = 16): readonly string[] => [
  ...Object.values({ ...CANONICAL_AUTH_QUERIES, memberships: canonicalAuthMembershipQuery(postgresMajor) }),
  CASE_ASSIGNEE_CATALOG_QUERY,
  CONVERSATION_ASSIGNEE_CATALOG_QUERY,
  BUSINESS_SESSION_POLICY_QUERY,
  DEADLINE_SESSION_GUARD_QUERY,
  CASE_DOMAIN_SUPPORT_CATALOG_QUERY,
  QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY,
  ...Object.values(MESSAGING_PHYSICAL_QUERIES),
  ...physicalContracts.flatMap(contract => Object.values(physicalGuardQueries(contract))),
  ...Object.values(EXTERNAL_READ_CATALOG_QUERIES),
  CONTAINED_PARENT_POLICY_QUERY,
]
export const canonicalAdmissionQueries = canonicalAdmissionQueriesForMajor()

/** Batched PostgreSQL 15 compatible catalog reads. No credentials, mutations,
 * SET ROLE, or admission-triggered privilege repair are permitted here.
 */
export async function inspectCanonicalAuthCatalog(execute: Execute, options: { postgresMajor?: CanonicalPostgresMajor; currentSecurity?: CurrentOverlay['currentSecurity'] } = {}): Promise<string[]> {
  const violations: string[] = []
  const roleRows =
    await execute(CANONICAL_AUTH_QUERIES.roles)
  for (const role of roles) {
    const actual = roleRows.find((row) => row.rolname === role)
    const canonical = Object.values(AUTH_EXECUTION_ROLES).some((value) => value === role)
    const gateway =
      role === AUTH_EXECUTION_ROLES.gateway || role === AUTH_EXECUTION_ROLES.systemGateway
    if (
      !actual ||
      actual.rolsuper !== false ||
      actual.rolbypassrls !== false ||
      actual.auth_create !== false ||
      actual.auth_usage !== ((canonical && !gateway) || role === 'union_eyes_runtime') ||
      (canonical &&
        (actual.rolinherit !== false ||
          actual.rolcanlogin !== false ||
          actual.rolcreatedb !== false ||
          actual.rolcreaterole !== false ||
          actual.public_create !== false))
    ) {
      violations.push(`${role}: unsafe or missing canonical role/schema authority`)
    }
  }
  const memberships =
    await execute(canonicalAuthMembershipQuery(options.postgresMajor))
  for (const row of memberships) {
    if (
      !AUTH_ROLE_MEMBERSHIP_EXPECTATIONS[String(row.member)]?.includes(String(row.granted)) ||
      row.admin_option !== false || row.inherit_option !== false || row.set_option !== true
    ) {
      violations.push(`${row.member}->${row.granted}: unsafe canonical membership`)
    }
  }
  for (const [member, grants] of Object.entries(AUTH_ROLE_MEMBERSHIP_EXPECTATIONS)) {
    for (const granted of grants)
      if (!memberships.some((row) => row.member === member && row.granted === granted))
        violations.push(`${member}->${granted}: missing canonical membership`)
  }
  const current = options.currentSecurity ?? currentOverlay.currentSecurity
  if (!current) return [...violations, 'Current canonical security source projection is missing']
  const sourceColumns = (schema: string, table: string, role: string, privilege: string, all: string[]) => {
    const whole = current.dedicatedRolePrivileges.some(grant => grant.schema === schema && grant.table === table
      && grant.role === role && grant.privileges.includes(privilege))
    return whole ? [...all].sort() : current.approvedColumnGrants.find(grant => grant.schema === schema
      && grant.table === table && grant.role === role && grant.privilege === privilege)?.columns ?? []
  }
  const columns =
    await execute(CANONICAL_AUTH_QUERIES.columns)
  for (const row of columns) {
    const expected = sourceColumns(String(row.schema_name),String(row.table_name),String(row.role),String(row.privilege),row.all_columns as string[])
    const actual = row.allowed_columns as string[]
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      violations.push(
        `${row.role}:${row.table_name}:${row.privilege}: canonical column privileges differ`,
      )
  }
  const expectedTables = new Set(
    Object.values(AUTH_PRIVILEGE_EXPECTATIONS).flatMap((tables) => Object.keys(tables)),
  )
  for (const table of expectedTables)
    if (!columns.some((row) => row.schema_name === 'user_management' && row.table_name === table))
      violations.push(`${table}: canonical auth relation is absent`)
  const tables = await execute(CANONICAL_AUTH_QUERIES.tables)
  for (const row of tables) {
    const expected = current.dedicatedRolePrivileges.some(grant => grant.schema === row.schema_name
      && grant.table === row.table_name && grant.role === row.role && grant.privileges.includes(String(row.privilege)))
    if (
      row.allowed !== expected ||
      !row.relrowsecurity ||
      !row.relforcerowsecurity ||
      roles.some((role) => role === row.owner)
    )
      violations.push(
        `${row.role}:${row.table_name}:${row.privilege}: canonical table grant, RLS or ownership differs`,
      )
  }
  const functions =
    await execute(CANONICAL_AUTH_QUERIES.functions)
  for (const expected of AUTH_FUNCTION_EXPECTATIONS) {
    const actual = functions.filter((row) => row.proname === expected.name)
    if (actual.length !== roles.length)
      violations.push(`${expected.name}: missing or overloaded canonical function`)
    for (const row of actual) {
      const allowed =
        row.role === expected.owner ||
        (expected.callers as readonly string[]).includes(String(row.role))
      if (
        row.owner !== expected.owner ||
        !row.prosecdef ||
        !(row.proconfig as string[] | null)?.includes('search_path=pg_catalog') ||
        row.allowed !== allowed ||
        row.public_execute
      ) {
        violations.push(`${row.role}:${expected.name}: canonical function authority differs`)
      }
    }
  }
  violations.push(...caseAssigneePredicateViolations(await execute(CASE_ASSIGNEE_CATALOG_QUERY)))
  violations.push(
    ...conversationAssigneePredicateViolations(await execute(CONVERSATION_ASSIGNEE_CATALOG_QUERY)),
  )
  violations.push(...businessSessionPolicyViolations(await execute(BUSINESS_SESSION_POLICY_QUERY)))
  violations.push(
    ...deadlineSessionGuardViolations(
      await execute(DEADLINE_SESSION_GUARD_QUERY),
      BUSINESS_SESSION_POLICY,
      BUSINESS_SESSION_CATALOG_PREDICATE,
    ),
  )
  violations.push(
    ...messagingPhysicalGuardViolations(await inspectMessagingPhysicalCatalog(execute)),
  )
  for (const contract of physicalContracts)
    violations.push(...await physicalGuardViolations(contract, execute))
  violations.push(...caseDomainSupportViolations(await execute(CASE_DOMAIN_SUPPORT_CATALOG_QUERY)))
  violations.push(...queuedCaseMailFunctionViolations(await execute(QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY)))
  violations.push(...externalReadCatalogViolations(await inspectExternalRead(execute)))
  violations.push(...containedParentPolicyInstallViolations(current.requiredContainedParentPolicies,
    await execute(CONTAINED_PARENT_POLICY_QUERY), { expectedOwner: 'ue_v2_owner', requireForcedRls: true }))
  return violations
}
