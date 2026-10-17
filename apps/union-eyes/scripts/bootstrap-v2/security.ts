import { ENFORCEMENT_GEOMETRY_OVERRIDES } from '../rls-enforcement/enforcement-geometry-overrides'
import { hash, quote, type SourceTable, type V2Plan } from './source'
import {
  AUTH_BUSINESS_MEMBER_PARENT_PREDICATE,
  AUTH_BUSINESS_ORG_PREDICATE,
  AUTH_BUSINESS_USER_PARENT_PREDICATE,
} from './auth-sql'
import {
  FRAMEWORK_MODEL_OWNERS,
  FRAMEWORK_ROLES,
  PLATFORM_METADATA_MODEL_OWNERS,
} from './framework-contract'
import { SYSTEM_COLUMN_READ_CONTRACTS } from './service-column-contracts'

const ref = (table: string) => `public.${quote(table)}`
const org = "nullif(current_setting('app.current_org_id', true), '')"
const user = "nullif(current_setting('app.current_user_id', true), '')"
export const OWNERSHIP_PROTECTED_CLASSES = [
  'TENANT_RLS_REQUIRED',
  'PARENT_OWNED_RLS_REQUIRED',
  'USER_RLS_REQUIRED',
  'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
  'MULTI_PARTY_RLS_REQUIRED',
] as const
export interface SecurityRule {
  table: string
  classification: string
  predicate: string | null
  writePredicate: string | null
  checkPredicate: string | null
  runtimePrivileges: string[]
  systemPrivileges: string[]
  systemSelectColumns?: string[]
  source: string
  status: 'COMPLETE' | 'DENY_UNRESOLVED'
}

export function compileSecurity(plan: V2Plan) {
  const blockers = [...plan.securityBlockers]
  const statements: string[] = [
    'REVOKE ALL ON SCHEMA public FROM PUBLIC;',
    'GRANT USAGE ON SCHEMA public TO union_eyes_runtime, union_eyes_system;',
    'ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;',
  ]
  const rules: SecurityRule[] = []
  const selfReferenceHelpers = new Set<string>()
  const geometry = (table: SourceTable, visited: string[]): string | null => {
    if (visited.includes(table.name)) return null
    const override = ENFORCEMENT_GEOMETRY_OVERRIDES.find((entry) => entry.table === table.name)
    if (table.authority?.classification === 'USER_RLS_REQUIRED') {
      const column =
        override?.kind === 'USER_DIRECT_COLUMN_OVERRIDE' ? override.userColumn : 'user_id'
      if (table.columns.some((entry) => entry.name === column))
        return `${quote(column)}::text = ${user}`
      return null
    }
    if (
      override?.kind === 'EXPLICIT_DIRECT_COLUMN_OVERRIDE' &&
      table.columns.some((column) => column.name === override.orgColumn)
    )
      return `${quote(override.orgColumn)}::text = ${org}`
    if (table.name === 'organizations') return `${quote('id')}::text = ${org}`
    if (table.columns.some((column) => column.name === 'organization_id'))
      return `${quote('organization_id')}::text = ${org}`
    if (table.columns.some((column) => column.name === 'org_id'))
      return `${quote('org_id')}::text = ${org}`
    let parents = table.foreignKeys
    if (
      table.name === 'document_signers' &&
      table.authority?.classification === 'PARENT_OWNED_RLS_REQUIRED'
    ) {
      parents = parents.filter(
        (foreignKey) =>
          foreignKey.column === 'document_id' && foreignKey.table === 'signature_documents',
      )
    }
    if (
      override &&
      ['PARENT', 'TENANT_VIA_PARENT', 'PARENT_VIA_USER'].includes(override.kind) &&
      'fkColumn' in override
    )
      parents = parents.filter((column) => column.column === override.fkColumn)
    const candidates = parents.flatMap((fk) => {
      const parent = plan.tables.find((entry) => entry.name === fk.table)
      if (!parent || !geometry(parent, [...visited, table.name])) return []
      return [
        `EXISTS (SELECT 1 FROM ${ref(parent.name)} AS v2_parent WHERE v2_parent.${quote(fk.referencedColumn)} = ${quote(table.name)}.${quote(fk.column)})`,
      ]
    })
    return candidates.length === 1 ? candidates[0] : null
  }
  for (const table of [...plan.tables].sort((a, b) => a.name.localeCompare(b.name))) {
    if (plan.frameworkExecution && PLATFORM_METADATA_MODEL_OWNERS[table.name]) {
      if (table.source !== PLATFORM_METADATA_MODEL_OWNERS[table.name])
        throw new Error(`UE_V2_PLATFORM_METADATA_SOURCE_REQUIRED:${table.name}`)
      const administrator = 'user_management.ue_framework_admin_authorized()'
      statements.push(
        `ALTER TABLE ${ref(table.name)} ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE ${ref(table.name)} FORCE ROW LEVEL SECURITY;`,
        `REVOKE ALL ON TABLE ${ref(table.name)} FROM PUBLIC,union_eyes_runtime,union_eyes_system,${Object.values(FRAMEWORK_ROLES).map(quote).join(',')};`,
        `GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE ${ref(table.name)} TO ${quote(FRAMEWORK_ROLES.admin)};`,
        `CREATE POLICY ue_platform_metadata_admin ON ${ref(table.name)} FOR ALL TO ${quote(FRAMEWORK_ROLES.admin)}
          USING (${administrator}) WITH CHECK (${administrator});`,
      )
      rules.push({
        table: table.name,
        classification: 'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT',
        predicate: administrator,
        writePredicate: administrator,
        checkPredicate: administrator,
        runtimePrivileges: [],
        systemPrivileges: [],
        source: table.source,
        status: 'COMPLETE',
      })
      continue
    }
    if (plan.frameworkExecution && FRAMEWORK_MODEL_OWNERS[table.name]) {
      if (table.source !== FRAMEWORK_MODEL_OWNERS[table.name])
        throw new Error(`UE_V2_FRAMEWORK_CURRENT_MODEL_REQUIRED:${table.name}`)
      statements.push(
        `ALTER TABLE ${ref(table.name)} ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE ${ref(table.name)} FORCE ROW LEVEL SECURITY;`,
        `REVOKE ALL ON TABLE ${ref(table.name)} FROM PUBLIC,union_eyes_runtime,union_eyes_system;`,
      )
      rules.push({
        table: table.name,
        classification: 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT',
        predicate: null,
        writePredicate: null,
        checkPredicate: null,
        runtimePrivileges: [],
        systemPrivileges: [],
        source: table.source,
        status: 'COMPLETE',
      })
      continue
    }
    if (table.name.startsWith('user_management.')) {
      const name = `${quote('user_management')}.${quote(table.name.slice('user_management.'.length))}`
      statements.push(
        `ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;`,
        `ALTER TABLE ${name} FORCE ROW LEVEL SECURITY;`,
        `REVOKE ALL ON TABLE ${name} FROM PUBLIC, union_eyes_runtime, union_eyes_system;`,
      )
      if (!plan.authExecution)
        blockers.push({
          table: table.name,
          reason:
            'Canonical platform-auth schema is materialized and denied by default. Token-bearer/login/self-service execution context is not yet runtime-qualified; no auth grant inferred from the public-schema registry.',
        })
      rules.push({
        table: table.name,
        classification: plan.authExecution
          ? 'AUTH_DEDICATED_EXECUTION_CONTEXT'
          : 'AUTH_EXECUTION_CONTEXT_UNQUALIFIED',
        predicate: null,
        writePredicate: null,
        checkPredicate: null,
        runtimePrivileges: [],
        systemPrivileges: [],
        source: table.source,
        status: plan.authExecution ? 'COMPLETE' : 'DENY_UNRESOLVED',
      })
      continue
    }
    const authority = table.authority
    const classification = authority?.classification ?? 'UNOWNED_CURRENT_SOURCE'
    let predicate: string | null = null
    let writePredicate: string | null = null
    let complete =
      Boolean(authority) &&
      authority?.requiredRuntimePrivileges !== 'TBD' &&
      authority?.requiredSystemPrivileges !== 'TBD'
    const runtimePrivileges =
      authority?.requiredRuntimePrivileges === 'TBD'
        ? []
        : [...(authority?.requiredRuntimePrivileges ?? [])]
    const systemPrivileges =
      authority?.requiredSystemPrivileges === 'TBD'
        ? []
        : [...(authority?.requiredSystemPrivileges ?? [])]
    const columnReadContract = SYSTEM_COLUMN_READ_CONTRACTS.find(
      (entry) => entry.table === table.name,
    )
    const systemSelectColumns =
      columnReadContract &&
      systemPrivileges.some((privilege) => privilege === 'INSERT' || privilege === 'UPDATE') &&
      !systemPrivileges.includes('SELECT')
        ? [...columnReadContract.columns]
        : []
    if (systemSelectColumns.some((name) => !table.columns.some((column) => column.name === name)))
      throw new Error(`UE_V2_SYSTEM_PREDICATE_COLUMN_REQUIRED:${table.name}`)
    if (
      ['TENANT_RLS_REQUIRED', 'PARENT_OWNED_RLS_REQUIRED', 'USER_RLS_REQUIRED'].includes(
        classification,
      )
    ) {
      predicate = geometry(table, [])
      writePredicate = predicate
      if (!predicate) complete = false
    } else if (classification === 'MIXED_GLOBAL_TENANT_RLS_REQUIRED') {
      if (table.columns.some((column) => column.name === 'organization_id')) {
        writePredicate = `${quote('organization_id')}::text = ${org}`
        predicate = `(${quote('organization_id')} IS NULL OR ${writePredicate})`
      } else complete = false
    } else if (classification === 'MULTI_PARTY_RLS_REQUIRED') {
      const override = ENFORCEMENT_GEOMETRY_OVERRIDES.find((entry) => entry.table === table.name)
      const organizationParents = table.foreignKeys.filter(
        (foreignKey) =>
          foreignKey.table === 'organizations' &&
          foreignKey.referencedColumn === 'id' &&
          table.columns.some(
            (column) => column.name === foreignKey.column && column.type === 'uuid',
          ),
      )
      if (
        override?.kind === 'MULTI_PARTY' &&
        [override.orgColumnA, override.orgColumnB].every((name) =>
          table.columns.some((column) => column.name === name),
        )
      ) {
        predicate = `(${quote(override.orgColumnA)}::text = ${org} OR ${quote(override.orgColumnB)}::text = ${org})`
        if (runtimePrivileges.some((privilege) => privilege !== 'SELECT')) complete = false
      } else if (
        override?.kind === 'SHARED_LIBRARY_ROOT' &&
        [override.orgColumn, override.sharingLevelColumn, override.sharedWithColumn].every((name) =>
          table.columns.some((column) => column.name === name),
        )
      ) {
        writePredicate = `${quote(override.orgColumn)}::text = ${org}`
        predicate = `(${writePredicate} OR ${org} = ANY(${quote(override.sharedWithColumn)}::text[]) OR ${quote(override.sharingLevelColumn)} = 'public')`
      } else if (
        override?.kind === 'SHARED_LIBRARY_CHILD' &&
        table.columns.some((column) => column.name === override.fkColumn) &&
        plan.tables.some((parent) => parent.name === 'shared_clause_library')
      ) {
        const match = `v2_parent.id = ${quote(table.name)}.${quote(override.fkColumn)}`
        predicate = `EXISTS (SELECT 1 FROM public.shared_clause_library v2_parent WHERE ${match})`
        writePredicate = `EXISTS (SELECT 1 FROM public.shared_clause_library v2_parent WHERE ${match} AND v2_parent.source_organization_id::text = ${org})`
      } else if (
        organizationParents.length === 2 &&
        new Set(organizationParents.map((foreignKey) => foreignKey.column)).size === 2 &&
        runtimePrivileges.every((privilege) => privilege === 'SELECT')
      ) {
        predicate = `(${organizationParents.map((foreignKey) => `${quote(foreignKey.column)}::text = ${org}`).join(' OR ')})`
      } else complete = false
    } else if (
      classification === 'GLOBAL_REFERENCE_DATA' ||
      classification === 'APP_SCOPED_NON_SENSITIVE'
    ) {
      predicate = 'true'
      writePredicate = 'true'
    } else if (
      !['SYSTEM_ONLY', 'LATENT_UNREACHABLE', 'CONTAINED_NO_AUTHORITY'].includes(classification)
    )
      complete = false
    if (
      runtimePrivileges.some((privilege) => (privilege === 'SELECT' ? !predicate : !writePredicate))
    )
      complete = false
    let checkPredicate = writePredicate
    if (complete && checkPredicate) {
      const parentChecks = table.foreignKeys.flatMap((foreignKey) => {
        if (
          plan.authExecution &&
          foreignKey.table === 'user_management.users' &&
          foreignKey.referencedColumn === 'user_id'
        ) {
          const ownUser = table.name === 'ai_usage_metrics' && foreignKey.column === 'user_id'
          const memberAttribution =
            (table.name === 'insight_recommendations' &&
              ['acknowledged_by', 'dismissed_by'].includes(foreignKey.column)) ||
            (table.name === 'kpi_configurations' && foreignKey.column === 'created_by')
          if (!ownUser && !memberAttribution)
            throw new Error(
              `UE_V2_AUTH_PARENT_SEMANTICS_REQUIRED:${table.name}:${foreignKey.column}`,
            )
          const helper = ownUser
            ? AUTH_BUSINESS_USER_PARENT_PREDICATE
            : AUTH_BUSINESS_MEMBER_PARENT_PREDICATE
          return [
            `(${quote(foreignKey.column)} IS NULL OR ${helper}(${quote(foreignKey.column)}::text, (${org})::uuid))`,
          ]
        }
        const parent = plan.tables.find((entry) => entry.name === foreignKey.table)
        if (
          !parent ||
          !OWNERSHIP_PROTECTED_CLASSES.some(
            (classification) => classification === parent.authority?.classification,
          )
        )
          return []
        if (parent.name === table.name) {
          const helper = `ue_v2_visible_parent_${hash(`${parent.name}:${foreignKey.referencedColumn}`).slice(0, 16)}`
          const key = parent.columns.find((column) => column.name === foreignKey.referencedColumn)
          if (!key) throw new Error(`UE_V2_SELF_REFERENCE_KEY_REQUIRED:${table.name}`)
          if (!selfReferenceHelpers.has(helper)) {
            // A separate invoker query avoids recursive UPDATE policy expansion without bypassing SELECT RLS.
            statements.push(
              `CREATE FUNCTION public.${quote(helper)}(parent_key ${key.type}) RETURNS boolean LANGUAGE plpgsql STABLE STRICT SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $ue_v2$ BEGIN RETURN EXISTS (SELECT 1 FROM ${ref(parent.name)} v2_parent WHERE v2_parent.${quote(foreignKey.referencedColumn)} = parent_key); END $ue_v2$;`,
              `REVOKE ALL ON FUNCTION public.${quote(helper)}(${key.type}) FROM PUBLIC, union_eyes_system;`,
              `GRANT EXECUTE ON FUNCTION public.${quote(helper)}(${key.type}) TO union_eyes_runtime;`,
            )
            selfReferenceHelpers.add(helper)
          }
          return [
            `(${quote(foreignKey.column)} IS NULL OR public.${quote(helper)}(${quote(foreignKey.column)}))`,
          ]
        }
        return [
          `(${quote(foreignKey.column)} IS NULL OR EXISTS (SELECT 1 FROM ${ref(parent.name)} v2_fk WHERE v2_fk.${quote(foreignKey.referencedColumn)} = ${quote(table.name)}.${quote(foreignKey.column)}))`,
        ]
      })
      if (parentChecks.length)
        checkPredicate = `(${checkPredicate}) AND ${parentChecks.join(' AND ')}`
    }
    statements.push(
      `ALTER TABLE ${ref(table.name)} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${ref(table.name)} FORCE ROW LEVEL SECURITY;`,
      `REVOKE ALL ON TABLE ${ref(table.name)} FROM PUBLIC, union_eyes_runtime, union_eyes_system;`,
    )
    if (!complete) {
      blockers.push({
        table: table.name,
        reason: `Current-source security authority/geometry incomplete:${classification}; no runtime/system grants issued.`,
      })
    } else {
      for (const privilege of runtimePrivileges) {
        if (!predicate) {
          blockers.push({
            table: table.name,
            reason: `Runtime ${privilege} has no approved predicate:${classification}`,
          })
          complete = false
          break
        }
        const using = privilege === 'SELECT' ? predicate : writePredicate
        if (!using) throw new Error(`UE_V2_WRITE_PREDICATE_REQUIRED:${table.name}`)
        const authenticated = plan.authExecution
          ? `${AUTH_BUSINESS_ORG_PREDICATE}((${org})::uuid)`
          : `${user} IS NOT NULL`
        const guard = `(${authenticated} AND (${using}))`
        const checkGuard = `(${authenticated} AND (${checkPredicate}))`
        statements.push(
          `GRANT ${privilege} ON TABLE ${ref(table.name)} TO union_eyes_runtime;`,
          `CREATE POLICY ${quote(`ue_v2_${privilege.toLowerCase()}`)} ON ${ref(table.name)} FOR ${privilege} TO union_eyes_runtime ${privilege === 'INSERT' ? `WITH CHECK (${checkGuard})` : privilege === 'UPDATE' ? `USING (${guard}) WITH CHECK (${checkGuard})` : `USING (${guard})`};`,
        )
      }
      if (systemPrivileges.length) {
        statements.push(
          `GRANT ${systemPrivileges.join(', ')} ON TABLE ${ref(table.name)} TO union_eyes_system;`,
        )
        for (const privilege of systemPrivileges)
          statements.push(
            `CREATE POLICY ${quote(`ue_v2_system_${privilege.toLowerCase()}`)} ON ${ref(table.name)} FOR ${privilege} TO union_eyes_system ${privilege === 'INSERT' ? 'WITH CHECK (true)' : privilege === 'UPDATE' ? 'USING (true) WITH CHECK (true)' : 'USING (true)'};`,
          )
        if (systemSelectColumns.length)
          statements.push(
            `GRANT SELECT (${systemSelectColumns.map(quote).join(', ')}) ON TABLE ${ref(table.name)} TO union_eyes_system;`,
            `CREATE POLICY ue_v2_system_predicate_select ON ${ref(table.name)} FOR SELECT TO union_eyes_system USING (true);`,
          )
      }
    }
    rules.push({
      table: table.name,
      classification,
      predicate,
      writePredicate,
      checkPredicate,
      runtimePrivileges: complete ? runtimePrivileges : [],
      systemPrivileges: complete ? systemPrivileges : [],
      ...(systemSelectColumns.length
        ? { systemSelectColumns: complete ? systemSelectColumns : [] }
        : {}),
      source: authority?.reason ?? 'No security authority; denied rather than inferred.',
      status: complete ? 'COMPLETE' : 'DENY_UNRESOLVED',
    })
  }
  return { rules, statements, blockers }
}
