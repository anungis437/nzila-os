/** Component of the existing canonical security catalog, not a release gate.
 * Every expectation comes from the current producer and declared columns. */
import { EXTERNAL_READ_COLUMN_GRANTS, EXTERNAL_READ_FUNCTIONS, EXTERNAL_READ_OWNER, EXTERNAL_READ_STORAGE_TABLES, EXTERNAL_READ_TRIGGER_TABLES, EXTERNAL_READ_PREREQUISITE_CONTRACTS } from './source'
import { EXTERNAL_AUTHORIZER_LIVE_FUNCTION } from './auth-bridge'
import { PRIVATE_ROLE_ISOLATED_SQL } from '../operations/catalog-admission-core.mjs'
type Row = Record<string, unknown>
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
const allFunctions = [...EXTERNAL_READ_FUNCTIONS.map(fn => ({ ...fn, owner: EXTERNAL_READ_OWNER })), EXTERNAL_AUTHORIZER_LIVE_FUNCTION]
const names = allFunctions.map(fn => literal(fn.name)).join(',')
const tables = EXTERNAL_READ_COLUMN_GRANTS.map(table => literal(table.table)).join(',')
export const EXTERNAL_READ_CATALOG_QUERIES = {
  role: `SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls,
    ${PRIVATE_ROLE_ISOLATED_SQL} AS isolated,
    has_schema_privilege(r.oid,'public','USAGE') AS public_usage,has_schema_privilege(r.oid,'public','CREATE') AS public_create,
    has_schema_privilege(r.oid,'public','USAGE WITH GRANT OPTION') AS public_grant_option,
    has_schema_privilege(r.oid,'user_management','USAGE') AS auth_usage,has_schema_privilege(r.oid,'user_management','CREATE') AS auth_create,
    has_schema_privilege(r.oid,'user_management','USAGE WITH GRANT OPTION') AS auth_grant_option
    FROM pg_roles r WHERE rolname=${literal(EXTERNAL_READ_OWNER)}`,
  prerequisites: `SELECT n.nspname AS schema,p.proname AS name,p.proargtypes::text AS argument_types,e.is_grantable,
    has_function_privilege('${EXTERNAL_READ_OWNER}',p.oid,'EXECUTE') AS executable
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) e
    WHERE e.grantee=(SELECT oid FROM pg_roles WHERE rolname='${EXTERNAL_READ_OWNER}') AND e.privilege_type='EXECUTE'
      AND p.proowner<>e.grantee ORDER BY n.nspname,p.proname,p.oid`,
  functions: `SELECT p.proname AS name,p.prosrc AS body,p.prosecdef,p.provolatile,p.proleakproof,p.proisstrict,p.proretset,p.prokind,
    l.lanname AS language,pg_get_function_identity_arguments(p.oid) AS args,p.prorettype::regtype::text AS returns,
    pg_get_userbyid(p.proowner) AS owner,p.proconfig,
    ARRAY(SELECT (CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END)::text FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.privilege_type='EXECUTE' ORDER BY a.grantee) AS callers,
    EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.is_grantable AND a.grantee<>p.proowner) AS delegated
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname IN(${names}) ORDER BY p.proname,p.oid`,
  tables: `SELECT c.relname AS name,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,
    has_table_privilege('${EXTERNAL_READ_OWNER}',c.oid,'SELECT') AS table_select,
    has_table_privilege('${EXTERNAL_READ_OWNER}',c.oid,'INSERT') AS table_insert,
    has_table_privilege('${EXTERNAL_READ_OWNER}',c.oid,'UPDATE') AS table_update,
    has_table_privilege('${EXTERNAL_READ_OWNER}',c.oid,'DELETE') AS table_delete,
    has_table_privilege('${EXTERNAL_READ_OWNER}',c.oid,'TRUNCATE') AS table_truncate,
    has_table_privilege('${EXTERNAL_READ_OWNER}',c.oid,'REFERENCES') AS table_references,
    has_table_privilege('${EXTERNAL_READ_OWNER}',c.oid,'TRIGGER') AS table_trigger
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN(${tables}) AND c.relkind='r' ORDER BY c.relname`,
  columns: `SELECT c.relname AS table_name,a.attname AS column_name,e.privilege_type,e.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    CROSS JOIN LATERAL aclexplode(a.attacl) e WHERE n.nspname='public' AND c.relname IN(${tables}) AND NOT a.attisdropped
    AND e.grantee=(SELECT oid FROM pg_roles WHERE rolname='${EXTERNAL_READ_OWNER}') ORDER BY c.relname,a.attnum,e.privilege_type`,
  policies: `SELECT c.relname AS table_name,p.polname,p.polcmd,p.polpermissive,
    ARRAY(SELECT pg_get_userbyid(r)::text FROM unnest(p.polroles) r ORDER BY r) AS roles,
    pg_get_expr(p.polqual,p.polrelid) AS qual,pg_get_expr(p.polwithcheck,p.polrelid) AS check
    FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN(${tables}) AND (p.polname IN('ue_external_reader','ue_external_writer','ue_external_revoker')
      OR (SELECT oid FROM pg_roles WHERE rolname='${EXTERNAL_READ_OWNER}')=ANY(p.polroles)) ORDER BY c.relname,p.polname`,
  triggers: `SELECT c.relname AS table_name,t.tgname,p.proname AS function_name,pn.nspname AS function_schema,t.tgenabled,t.tgtype,t.tgdeferrable,t.tginitdeferred,
    t.tgconstraint<>0 AS constraint_trigger,t.tgqual IS NOT NULL AS conditional,t.tgattr::text AS columns,encode(t.tgargs,'hex') AS args
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    AND t.tgname IN(${[...new Set(EXTERNAL_READ_TRIGGER_TABLES.map(t => t.name))].map(literal).join(',')}) ORDER BY c.relname,t.tgname`,
} as const

export async function inspectExternalRead(execute: (text: string) => Promise<Row[]>) {
  const results = {} as { -readonly [K in keyof typeof EXTERNAL_READ_CATALOG_QUERIES]: Row[] }
  for (const key of Object.keys(EXTERNAL_READ_CATALOG_QUERIES) as (keyof typeof EXTERNAL_READ_CATALOG_QUERIES)[])
    results[key] = await execute(EXTERNAL_READ_CATALOG_QUERIES[key])
  return results
}
const equalSet = (actual: unknown, expected: readonly string[]) => Array.isArray(actual)
  && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
const scopeExpression = (value: unknown) => String(value ?? '').replaceAll('::text', '').replace(/[\s()]/g, '')
const scope = scopeExpression("organization_id::text=NULLIF(current_setting('ue.external_read_org',true),'')")
export function externalReadCatalogViolations(snapshot: Awaited<ReturnType<typeof inspectExternalRead>>): string[] {
  const failures: string[] = [], role = snapshot.role[0]
  if (snapshot.role.length !== 1 || !role || role.rolname !== EXTERNAL_READ_OWNER || role.isolated !== true
    || role.rolsuper !== false || role.rolinherit !== false || role.rolcreaterole !== false || role.rolcreatedb !== false || role.rolcanlogin !== false || role.rolbypassrls !== false
    || role.public_usage !== true || role.public_create !== false || role.public_grant_option !== false || role.auth_usage !== true || role.auth_create !== false || role.auth_grant_option !== false)
    failures.push('External private reader role/namespace authority differs')
  const requiredExecutions = [...EXTERNAL_READ_PREREQUISITE_CONTRACTS, { schema: EXTERNAL_AUTHORIZER_LIVE_FUNCTION.schema,
    name: EXTERNAL_AUTHORIZER_LIVE_FUNCTION.name, argumentTypes: '2950 2950 25' }]
  if (snapshot.prerequisites.length !== requiredExecutions.length || requiredExecutions.some(expected => {
    const rows = snapshot.prerequisites.filter(row => row.schema === expected.schema && row.name === expected.name && row.argument_types === expected.argumentTypes), row = rows[0]
    return rows.length !== 1 || !row || row.executable !== true || row.is_grantable !== false
  })) failures.push('External private reader prerequisite EXECUTE contract differs')
  for (const fn of allFunctions) {
    const rows = snapshot.functions.filter(row => row.name === fn.name), row = rows[0]
    const returned = fn.returns === 'TABLE(payload jsonb)' ? 'jsonb' : fn.returns
    if (rows.length !== 1 || !row || row.body !== fn.body || row.args !== fn.args || row.returns !== returned || row.owner !== fn.owner
      || row.language !== 'plpgsql' || row.prosecdef !== true || row.provolatile !== (fn.immutable ? 'i' : 'v') || row.proleakproof !== false
      || row.proisstrict !== false || row.proretset !== (fn.returns === 'TABLE(payload jsonb)') || row.prokind !== 'f'
      || row.delegated !== false || !equalSet(row.callers, [fn.owner, ...fn.callers])
      || JSON.stringify(row.proconfig) !== JSON.stringify(['search_path=pg_catalog'])) failures.push(`${fn.name}: protected external function differs`)
  }
  for (const grant of EXTERNAL_READ_COLUMN_GRANTS) {
    const rows = snapshot.tables.filter(row => row.name === grant.table), row = rows[0]
    if (rows.length !== 1 || !row || row.relrowsecurity !== true || row.relforcerowsecurity !== true
      || (EXTERNAL_READ_STORAGE_TABLES.some(table => table === grant.table) && row.owner !== 'ue_v2_owner')
      || ['table_select', 'table_insert', 'table_update', 'table_delete', 'table_truncate', 'table_references', 'table_trigger'].some(key => row[key] !== false))
      failures.push(`${grant.table}: external storage/column-only authority differs`)
    const expected = [
      ...grant.select.map(column => [column, 'SELECT']),
      ...('insert' in grant ? grant.insert.map(column => [column, 'INSERT']) : []),
      ...('update' in grant ? grant.update.map(column => [column, 'UPDATE']) : []),
    ].map(([column, privilege]) => `${column}:${privilege}`)
    const columns = snapshot.columns.filter(row => row.table_name === grant.table)
    if (columns.some(row => row.is_grantable !== false) || !equalSet(columns.map(row => `${String(row.column_name)}:${String(row.privilege_type)}`), expected))
      failures.push(`${grant.table}: private external column contract differs`)
    const expectedPolicies = [{ name: 'ue_external_reader', command: 'r', using: true, check: false },
      ...('insert' in grant ? [{ name: 'ue_external_writer', command: 'a', using: false, check: true }] : []),
      ...('update' in grant ? [{ name: 'ue_external_revoker', command: 'w', using: true, check: true }] : [])]
    const policies = snapshot.policies.filter(row => row.table_name === grant.table)
    if (policies.length !== expectedPolicies.length || expectedPolicies.some(expectedPolicy => {
      const matches = policies.filter(row => row.polname === expectedPolicy.name), row = matches[0]
      return matches.length !== 1 || !row || row.polcmd !== expectedPolicy.command || row.polpermissive !== true || !equalSet(row.roles, [EXTERNAL_READ_OWNER])
        || (expectedPolicy.using ? scopeExpression(row.qual) !== scope : row.qual !== null)
        || (expectedPolicy.check ? scopeExpression(row.check) !== scope : row.check !== null)
    })) failures.push(`${grant.table}: private external row policy differs`)
  }
  if (snapshot.triggers.length !== EXTERNAL_READ_TRIGGER_TABLES.length) failures.push('External protection trigger census differs')
  for (const trigger of EXTERNAL_READ_TRIGGER_TABLES) {
    const rows = snapshot.triggers.filter(row => row.table_name === trigger.table && row.tgname === trigger.name), row = rows[0]
    if (rows.length !== 1 || !row || row.function_name !== trigger.fn || row.function_schema !== 'public' || row.tgenabled !== 'O'
      || row.tgtype !== (trigger.events === 'INSERT OR UPDATE OR DELETE' ? 31 : trigger.events === 'INSERT' ? 7 : 27) || row.tgdeferrable !== false || row.tginitdeferred !== false
      || row.constraint_trigger !== false || row.conditional !== false || row.columns !== '' || row.args !== '') failures.push(`${trigger.table}: protected external trigger differs`)
  }
  return failures
}
