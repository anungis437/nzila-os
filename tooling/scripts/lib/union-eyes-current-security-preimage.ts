import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseSql, type ParseNode } from '../../../apps/union-eyes/scripts/lib/sql-census/parse'
import { currentFunctionViolations, type CatalogRow } from '../../../apps/union-eyes/lib/operations/catalog-admission-core.mjs'
import { projectCurrentCompilerSecurity } from './union-eyes-current-security-contract'
import { compileGuardFunction, type PhysicalGuardContract } from '../../../apps/union-eyes/db/auth/physical-guard-catalog'

const references = {
  'apps/union-eyes/db/migrations-cache/0006_external_specialist_runtime_privilege_closure.sql': 'aa9a3314fc70de80e3064e8dedbc31b12a09caa3d99632ac75ae0c0a19731003',
  'apps/union-eyes/db/migrations-cache/0007_auth_bootstrap_runtime_remediation.sql': '4b742c7a3a1a70532c9f3dc1133f3020b58246ff3663c036e92da09143751a45',
  'apps/union-eyes/db/migrations-platform/0049_claim_status_transitions.sql': 'ba7d67d0fd7cebe99a7d9f249bbe8f95432c7587bbc0858f4aa89d73c5c61550',
  'apps/union-eyes/db/migrations-cache/0017_snapshot_authority_reconciliation.sql': '1b383028f528daa86b079662688d072e9c60ac9e96ce607810449b9148c27f48',
}
export function readLegacySecurityReferences(root: string) {
  return Object.fromEntries(Object.entries(references).map(([source, expected]) => {
    const sql = readFileSync(path.join(root, source), 'utf8')
    if (createHash('sha256').update(sql).digest('hex') !== expected)
      throw new Error(`Released security reference differs: ${source}`)
    return [source, sql]
  }))
}

export interface LegacyAuthPolicy {
  table_name: string
  name: string
  cmd: string
  roles: string[]
  permissive: boolean
  qual: string | null
  with_check: string | null
}
const self = "((user_id)::text = current_setting('app.current_user_id'::text, true))"
const policies = [
  { table_name: 'users', name: 'ue_auth_users_self_select', cmd: 'r', role: 'union_eyes_runtime', qual: self, check: null },
  { table_name: 'organization_users', name: 'ue_auth_organization_users_self_select', cmd: 'r', role: 'union_eyes_runtime', qual: self, check: null },
  { table_name: 'users', name: 'ue_auth_bootstrap_users_select_system', cmd: 'r', role: 'union_eyes_system', qual: 'true', check: null },
  { table_name: 'users', name: 'ue_auth_bootstrap_users_update_system', cmd: 'w', role: 'union_eyes_system', qual: 'true', check: 'true' },
  { table_name: 'organization_users', name: 'ue_auth_bootstrap_organization_users_system', cmd: 'r', role: 'union_eyes_system', qual: 'true', check: null },
  { table_name: 'auth_audit_log', name: 'ue_auth_bootstrap_audit_system', cmd: '*', role: 'union_eyes_system', qual: 'true', check: 'true' },
  { table_name: 'mfa_totp', name: 'ue_auth_bootstrap_mfa_system', cmd: 'r', role: 'union_eyes_system', qual: 'true', check: null },
  { table_name: 'org_auth_policies', name: 'ue_auth_bootstrap_org_policies_system', cmd: 'r', role: 'union_eyes_system', qual: 'true', check: null },
  { table_name: 'user_sessions', name: 'ue_auth_bootstrap_sessions_system', cmd: '*', role: 'union_eyes_system', qual: 'true', check: 'true' },
  { table_name: 'users', name: 'ue_framework_authority_reader_select', cmd: 'r', role: 'ue_framework_authority_reader', qual: 'true', check: null },
  { table_name: 'user_sessions', name: 'ue_framework_authority_reader_select', cmd: 'r', role: 'ue_framework_authority_reader', qual: 'true', check: null },
]
const normalize = (value: string | null) => value?.replace(/\s+/g, ' ').trim() ?? null
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'

/** Retire only the exact, immutable legacy predicate set. Unknown facts refuse. */
export function planLegacyAuthPolicyReplacement(actual: LegacyAuthPolicy[]): string[] {
  if (actual.length !== policies.length) throw new Error('Legacy auth policy preimage is missing, partial or extended')
  for (const expected of policies) {
    const rows = actual.filter(row => row.table_name === expected.table_name && row.name === expected.name)
    const row = rows[0]
    if (rows.length !== 1 || !row || row.cmd !== expected.cmd || !row.permissive
      || JSON.stringify(row.roles) !== JSON.stringify([expected.role])
      || normalize(row.qual) !== expected.qual || normalize(row.with_check) !== expected.check)
      throw new Error(`Legacy auth policy preimage differs: ${expected.table_name}.${expected.name}`)
  }
  return policies.map(policy => `DROP POLICY ${quote(policy.name)} ON user_management.${quote(policy.table_name)}`)
}

const frameworkNames = ['ue_framework_actor_authorized', 'ue_framework_admin_authorized']

/** Upgrade the exact released helpers without dropping their dependent
 * policies. Replacement text comes only from the parsed current producer. */
export async function planLegacyFrameworkFunctionReplacement(root: string, currentFrameworkSql: string, actual: CatalogRow[]) {
  const reference = readLegacySecurityReferences(root)['apps/union-eyes/db/migrations-cache/0017_snapshot_authority_reconciliation.sql']
  const declarations = [...reference.matchAll(/EXECUTE \$fn\$([\s\S]*?)\$fn\$;/g)].map(match => match[1])
  const metadata = [...reference.matchAll(/EXECUTE '((?:[^']|'')*)';/g)]
    .map(match => match[1].replaceAll("''", "'"))
    .filter(statement => /^(ALTER FUNCTION|REVOKE ALL ON FUNCTION|GRANT EXECUTE ON FUNCTION) user_management\.ue_framework_(actor|admin)_authorized\(\)/.test(statement))
  const expected = (await projectCurrentCompilerSecurity([...declarations, ...metadata], 'uev2admin', { immutableReferenceOnly: true })).functions
  if (expected.length !== 2 || expected.some(fn => !frameworkNames.includes(fn.name)))
    throw new Error('Exact released framework function source required')
  const candidates = actual.filter(row => row.schema === 'user_management' && frameworkNames.includes(String(row.name)))
  const violations = currentFunctionViolations(expected, candidates)
  if (violations.length) throw new Error('Legacy framework function preimage differs: ' + violations.join('; '))
  const parsed = await parseSql(currentFrameworkSql)
  if (!parsed.ok) throw new Error('Current framework source must parse')
  const replacements = []
  for (let i=0;i<parsed.statements.length;i++) {
    const fn = parsed.statements[i].CreateFunctionStmt
    if (!fn) continue
    const names = fn.funcname.map((part: ParseNode) => part.String.sval)
    if (names.length !== 2 || names[0] !== 'user_management' || !frameworkNames.includes(names[1]) || fn.replace || fn.parameters?.length)
      throw new Error('Unexpected current framework function replacement identity')
    const old = expected.find(spec => spec.name === names[1])!
    const produced = (await projectCurrentCompilerSecurity([parsed.texts[i]])).functions[0]
    if (!produced || produced.signature !== old.signature || produced.returns !== old.returns || produced.returnsSet !== old.returnsSet)
      throw new Error('Framework replacement must preserve exact identity and return contract')
    const originalSql = parsed.texts[i]
    const replacementSql = originalSql.replace(/^CREATE\s+FUNCTION\b/i, 'CREATE OR REPLACE FUNCTION')
    if (replacementSql === originalSql) throw new Error('Exact additive current framework producer required')
    replacements.push({ originalSql, originalDigest: createHash('sha256').update(originalSql).digest('hex'), replacementSql })
  }
  if (replacements.length !== 2) throw new Error('Both exact current framework replacements required')
  return replacements
}

export interface ExistingFrameworkPolicy {
  schema: string; table: string; name: string; command: string; permissive: boolean;
  roles: string[]; using: string | null; check: string | null;
}

export async function frameworkPolicyPreimageQuery(currentPolicySource: string) {
  const parsed = await parseSql(currentPolicySource)
  if (!parsed.ok) throw new Error('Current framework policy source must parse')
  const tables = [...new Set(parsed.statements.flatMap(statement => statement.CreatePolicyStmt?.table.schemaname === 'public'
    ? [statement.CreatePolicyStmt.table.relname as string] : []))].sort()
  if (!tables.length) throw new Error('Current public framework policy targets required')
  const list = tables.map(table => `'${table.replaceAll("'", "''")}'`).join(',')
  return `SELECT n.nspname AS schema,c.relname AS table,p.polname AS name,p.polcmd AS command,p.polpermissive AS permissive,
    ARRAY(SELECT COALESCE(r.rolname::text,'PUBLIC') FROM unnest(p.polroles) v(oid)
      LEFT JOIN pg_catalog.pg_roles r ON r.oid=v.oid ORDER BY 1) AS roles,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS using,pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS check
    FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname='public' AND c.relname IN(${list},'django_migrations'))
      OR EXISTS(SELECT FROM unnest(p.polroles) v(oid) JOIN pg_catalog.pg_roles r ON r.oid=v.oid WHERE r.rolname LIKE 'ue_framework_%')
    ORDER BY n.nspname,c.relname,p.polname`
}

// PostgreSQL deparses implicit casts to text/name and flattens AND/OR trees.
// Only those presentation changes are normalized; operators, literals,
// identifiers, calls, subqueries and every other cast remain exact.
function policyExpressionTree(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(policyExpressionTree)
  if (!value || typeof value !== 'object') return value
  const node = value as ParseNode
  if (node.TypeCast) {
    const names = node.TypeCast.typeName.names.map((item: ParseNode) => item.String.sval)
    if ((names.length === 1 || (names.length === 2 && names[0] === 'pg_catalog'))
      && !node.TypeCast.typeName.typmods?.length && !node.TypeCast.typeName.arrayBounds?.length
      && ((names.at(-1) === 'text' && (typeof node.TypeCast.arg.A_Const?.sval?.sval === 'string'
        || node.TypeCast.arg.ColumnRef?.fields?.at(-1)?.String?.sval === 'username'))
        || (names.at(-1) === 'name' && node.TypeCast.arg.A_Const?.sval?.sval === 'UTF8')))
      return policyExpressionTree(node.TypeCast.arg)
  }
  const entries = Object.entries(node).filter(([key]) => key !== 'location').map(([key,item]) => [key,policyExpressionTree(item)] as const)
  const result: ParseNode = Object.fromEntries(entries.sort(([a],[b]) => a.localeCompare(b)))
  if (result.BoolExpr && ['AND_EXPR','OR_EXPR'].includes(result.BoolExpr.boolop)) {
    result.BoolExpr.args = result.BoolExpr.args.flatMap((item: ParseNode) => item.BoolExpr?.boolop === result.BoolExpr.boolop ? item.BoolExpr.args : [item])
  }
  if (result.RangeVar?.schemaname === 'public') delete result.RangeVar.schemaname
  return result
}
async function parsedPolicyExpression(expression: string | null) {
  if (expression === null) return null
  const parsed = await parseSql(`SELECT ${expression}`)
  if (!parsed.ok || parsed.statements.length !== 1) throw new Error('Exact framework policy expression required')
  const select = parsed.statements[0].SelectStmt
  if (!select || select.targetList?.length !== 1 || Object.keys(select).some(key => !['targetList','limitOption','op'].includes(key)))
    throw new Error('Single framework policy expression required')
  return policyExpressionTree(select.targetList[0].ResTarget.val)
}

/** Preserve a current-source policy only after exact structural comparison.
 * The returned source hashes let the installer omit only those CREATE POLICY
 * statements; altered or unexpected policies are never silently adopted. */
export async function planExistingFrameworkPolicies(currentFrameworkSql: string, actual: ExistingFrameworkPolicy[]) {
  const parsed = await parseSql(currentFrameworkSql)
  if (!parsed.ok) throw new Error('Current framework source must parse')
  const expected = parsed.statements.map((statement,i) => ({ spec: statement.CreatePolicyStmt, sql: parsed.texts[i] }))
    .filter(({spec}) => spec?.table.schemaname === 'public')
  const candidates = actual
  if (candidates.some(policy => policy.schema !== 'public'))
    throw new Error('Unexpected non-public framework policy in public adoption plan')
  const adopted = []
  for (const {spec,sql} of expected) {
    const rows = candidates.filter(policy => policy.table === spec.table.relname && policy.name === spec.policy_name)
    if (!rows.length) continue
    const row = rows[0]
    const roles = spec.roles.map((part: ParseNode) => part.RoleSpec.rolename).sort()
    const command = ({select:'r',insert:'a',update:'w',delete:'d',all:'*'} as Record<string,string>)[spec.cmd_name]
    if (rows.length !== 1 || row.command !== command || row.permissive !== spec.permissive
      || JSON.stringify([...row.roles].sort()) !== JSON.stringify(roles)
      || JSON.stringify(await parsedPolicyExpression(row.using)) !== JSON.stringify(policyExpressionTree(spec.qual ?? null))
      || JSON.stringify(await parsedPolicyExpression(row.check)) !== JSON.stringify(policyExpressionTree(spec.with_check ?? null)))
      throw new Error(`Existing framework policy preimage differs: ${row.table}.${row.name}`)
    adopted.push({ originalSql: sql, originalDigest: createHash('sha256').update(sql).digest('hex') })
  }
  for (const row of candidates)
    if (!expected.some(({spec}) => spec.table.relname === row.table && spec.policy_name === row.name))
      throw new Error(`Unexpected existing framework policy: ${row.table}.${row.name}`)
  return adopted
}

/** The legacy migration recorder is retained as storage history, with no
 * application or dedicated framework grant in the current source plan. */
export function planLegacyFrameworkLedgerPolicy(root: string, actual: ExistingFrameworkPolicy[]) {
  readLegacySecurityReferences(root)
  const row = actual[0]
  const predicate = 'user_management.ue_framework_admin_authorized()'
  if (actual.length !== 1 || !row || row.schema !== 'public' || row.table !== 'django_migrations'
    || row.name !== 'ue_framework_admin' || row.command !== '*' || row.permissive !== true
    || JSON.stringify(row.roles) !== JSON.stringify(['ue_framework_admin'])
    || normalize(row.using) !== predicate || normalize(row.check) !== predicate)
    throw new Error('Legacy framework ledger policy preimage differs')
  return ['DROP POLICY "ue_framework_admin" ON public."django_migrations"']
}

/** Adopt only unchanged functions from the contract's measured immutable
 * references. Bodies and signatures are never replaced; ownership, path and
 * EXECUTE ACL alone converge to the current source descriptor. */
export async function planLegacyPhysicalFunctionAdoption(
  root: string, contract: PhysicalGuardContract, actual: CatalogRow[], trustedOwner: string,
) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(trustedOwner) || ['union_eyes_runtime','union_eyes_system'].includes(trustedOwner))
    throw new Error('Trusted original physical guard owner required')
  const references = contract.references.map(reference => {
    const sql = readFileSync(path.join(root,reference.path),'utf8')
    if (createHash('sha256').update(sql).digest('hex') !== reference.sha256)
      throw new Error(`Immutable physical guard reference differs: ${reference.path}`)
    return sql
  })
  const released = (await projectCurrentCompilerSecurity(references,trustedOwner,{immutableReferenceOnly:true})).functions
  const statements: string[] = [], adoptedNames: string[] = []
  for (const fn of contract.functions) {
    const old = released.filter(spec=>spec.schema==='public' && spec.name===fn.name)
    const rows = actual.filter(row=>row.schema==='public' && row.name===fn.name)
    if (!old.length) {
      if (rows.length) throw new Error(`Partial current physical guard installation refused: ${fn.name}`)
      continue
    }
    if (old.length !== 1 || currentFunctionViolations(old,rows).length)
      throw new Error(`Released physical guard preimage differs: ${fn.name}`)
    const current = (await projectCurrentCompilerSecurity(compileGuardFunction(fn))).functions[0]
    const comparable = {...old[0],owner:current.owner,config:current.config,executeAcl:current.executeAcl}
    if (JSON.stringify(comparable) !== JSON.stringify(current))
      throw new Error(`Physical guard adoption would change its released body or identity: ${fn.name}`)
    const signature = `${quote('public')}.${quote(fn.name)}(${fn.args})`
    statements.push(
      `ALTER FUNCTION ${signature} SET search_path=${fn.path}`,
      `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC,union_eyes_runtime,union_eyes_system`,
      `ALTER FUNCTION ${signature} OWNER TO ue_v2_owner`,
      ...(fn.callable ? [`GRANT EXECUTE ON FUNCTION ${signature} TO union_eyes_runtime,union_eyes_system`] : []),
    )
    adoptedNames.push(`public.${fn.name}`)
  }
  return {statements,adoptedNames}
}

export interface LegacyJournalFunction {
  name: string; owner: string; body: string; language: string; returns: string;
  args: string; definer: boolean; volatility: string; config: string[] | null;
  strict: boolean; leakproof: boolean; returns_set: boolean;
  execute_acl: { role: string; grantable: boolean }[];
}
export interface LegacyJournalTrigger {
  table_schema: string; table_name: string; name: string; function_name: string; function_schema: string;
  tgtype: number; tgenabled: string; tgdeferrable: boolean; tginitdeferred: boolean;
  columns: string[]; has_condition: boolean; args_hex: string;
}

/** All candidate facts are read; unexpected policies, overloads or claim
 * triggers are not filtered away before the exact preimage comparison. */
export const LEGACY_SECURITY_PREIMAGE_QUERIES = {
  owner: `SELECT pg_catalog.pg_get_userbyid(c.relowner) AS owner,current_user::text AS current_user,session_user::text AS session_user
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='claims' AND c.relkind='r'`,
  authPolicies: `SELECT c.relname AS table_name,p.polname AS name,p.polcmd AS cmd,p.polpermissive AS permissive,
    ARRAY(SELECT COALESCE(r.rolname::text,'PUBLIC') FROM unnest(p.polroles) v(oid)
      LEFT JOIN pg_catalog.pg_roles r ON r.oid=v.oid ORDER BY 1) AS roles,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS qual,pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS with_check
    FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='user_management'
    ORDER BY c.relname,p.polname`,
  journalFunctions: `SELECT p.proname AS name,pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosrc AS body,
    l.lanname AS language,pg_catalog.format_type(p.prorettype,NULL) AS returns,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef AS definer,p.provolatile AS volatility,
    p.proconfig AS config,p.proisstrict AS strict,p.proleakproof AS leakproof,p.proretset AS returns_set,
    (SELECT jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantable',a.is_grantable))
      FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='EXECUTE') AS execute_acl
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname IN('ue_claims_stamp_status_changed','ue_claims_record_status_transition')
    ORDER BY p.proname,p.oid`,
  journalTriggers: `SELECT n.nspname AS table_schema,c.relname AS table_name,t.tgname AS name,p.proname AS function_name,
    pn.nspname AS function_schema,t.tgtype,t.tgenabled,t.tgdeferrable,t.tginitdeferred,
    ARRAY(SELECT a.attname::text FROM unnest(t.tgattr::smallint[]) v(num)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=v.num ORDER BY a.attnum) AS columns,
    t.tgqual IS NOT NULL AS has_condition,pg_catalog.encode(t.tgargs,'hex') AS args_hex
    FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
    JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
    WHERE NOT t.tgisinternal AND ((n.nspname='public' AND c.relname='claims')
      OR (pn.nspname='public' AND p.proname IN('ue_claims_stamp_status_changed','ue_claims_record_status_transition'))
      OR t.tgname IN('ue_claims_stamp_status_changed','ue_claims_record_status_transition')) ORDER BY n.nspname,c.relname,t.tgname`,
} as const
export function planLegacyJournalReplacement(
  referenceSql: string,
  owner: string,
  actualFunctions: LegacyJournalFunction[],
  actualTriggers: LegacyJournalTrigger[],
) {
  if (!owner || ['union_eyes_runtime', 'union_eyes_system'].includes(owner)) throw new Error('Bounded legacy journal installation owner required')
  const names = ['ue_claims_stamp_status_changed', 'ue_claims_record_status_transition']
  if (actualFunctions.length !== 2 || actualTriggers.length !== 2) throw new Error('Legacy journal preimage is missing, overloaded or extended')
  for (const name of names) {
    const match = referenceSql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(\\) RETURNS trigger[\\s\\S]*?AS \\$fn\\$([\\s\\S]*?)\\$fn\\$;`))
    if (!match) throw new Error('Exact released journal reference body required')
    const fn = actualFunctions.find(row => row.name === name)
    const journal = name === 'ue_claims_record_status_transition'
    const expectedAcl = [{ role: owner, grantable: false }, ...(journal ? [] : [{ role: 'PUBLIC', grantable: false }])]
      .sort((a, b) => a.role.localeCompare(b.role))
    if (!fn || fn.owner !== owner || fn.body !== match[1] || fn.language !== 'plpgsql'
      || fn.returns !== 'trigger' || fn.args !== '' || fn.definer !== journal
      || fn.volatility !== 'v' || fn.strict || fn.leakproof || fn.returns_set
      || JSON.stringify(fn.config) !== JSON.stringify(journal ? ['search_path=public, pg_temp'] : null)
      || JSON.stringify([...fn.execute_acl].sort((a, b) => a.role.localeCompare(b.role))) !== JSON.stringify(expectedAcl))
      throw new Error(`Legacy journal function preimage differs: ${name}`)
    const trigger = actualTriggers.find(row => row.name === name)
    if (!trigger || trigger.table_schema !== 'public' || trigger.table_name !== 'claims' || trigger.function_name !== name || trigger.function_schema !== 'public'
      || trigger.tgtype !== (journal ? 21 : 23) || trigger.tgenabled !== 'O' || trigger.tgdeferrable || trigger.tginitdeferred
      || trigger.has_condition || trigger.args_hex !== '' || JSON.stringify(trigger.columns) !== JSON.stringify(journal ? ['status'] : []))
      throw new Error(`Legacy journal trigger preimage differs: ${name}`)
  }
  return [
    ...names.map(name => `DROP TRIGGER ${quote(name)} ON public.claims`),
    ...names.map(name => `DROP FUNCTION public.${quote(name)}()`),
  ]
}
