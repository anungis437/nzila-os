/**
 * Read-only catalog admission rules shared by the Next.js health route and
 * the governance CLI. This module has no database driver and does not read
 * the repository checkout.
 */

import { createHash } from 'node:crypto'

const PRIVILEGE_ORDER = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']

export const admissionQueries = [
  {
    name: 'roles',
    sql: `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
          FROM pg_catalog.pg_roles
          WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  },
  {
    name: 'membership',
    sql: `SELECT member.rolname AS member, granted.rolname AS granted
          FROM pg_catalog.pg_auth_members link
          JOIN pg_catalog.pg_roles member ON member.oid = link.member
          JOIN pg_catalog.pg_roles granted ON granted.oid = link.roleid
          WHERE member.rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  },
  {
    name: 'externalReadRole',
    sql: `SELECT r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolbypassrls,
      NOT EXISTS(SELECT FROM pg_catalog.pg_auth_members m WHERE m.roleid=r.oid OR m.member=r.oid) AS isolated,
      pg_catalog.has_schema_privilege(r.oid,'public','USAGE') AS public_usage,
      pg_catalog.has_schema_privilege(r.oid,'public','CREATE') AS public_create,
      pg_catalog.has_schema_privilege(r.oid,'public','USAGE WITH GRANT OPTION') AS public_grant_option,
      EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE n.nspname='user_management'
        AND pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE')) AS auth_usage,
      EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE n.nspname='user_management'
        AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE')) AS auth_create,
      EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE n.nspname='user_management'
        AND pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION')) AS auth_grant_option,
      EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
        AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE')) AS any_create
      FROM pg_catalog.pg_roles r WHERE r.rolname='ue_external_read_reader'`,
  },
  {
    name: 'schemaUsage',
    sql: `SELECT r.rolname, n.nspname
          FROM pg_catalog.pg_roles r
          JOIN pg_catalog.pg_namespace n ON pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE')
          WHERE r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            AND n.nspname NOT LIKE 'pg_temp%'
            AND n.nspname NOT LIKE 'pg_toast_temp%'`,
  },
  {
    name: 'schemaCreate',
    // Only schemas that EXIST are inspected: pg_catalog.has_schema_privilege raises on a missing schema, which made admission fail outright on a
    // topology that has no audit_security schema (a missing schema holds no privilege to leak).
    sql: `SELECT r.rolname, s.nspname
          FROM pg_catalog.pg_roles r
          CROSS JOIN (SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('public', 'user_management', 'audit_security')) AS s
          WHERE r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
            AND pg_catalog.has_schema_privilege(r.rolname, s.nspname::name, 'CREATE')`,
  },
  {
    name: 'relations',
    sql: `SELECT n.nspname AS schema_name,
                 c.relname AS table_name,
                 c.relkind,
                 c.relrowsecurity,
                 c.relforcerowsecurity,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE'), (5, 'REFERENCES'), (6, 'TRIGGER'), (7, 'TRUNCATE')) AS v(ord, priv)
                   WHERE pg_catalog.has_table_privilege('union_eyes_runtime', c.oid, priv)
                   ORDER BY ord
                 ) AS runtime,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE'), (5, 'REFERENCES'), (6, 'TRIGGER'), (7, 'TRUNCATE')) AS v(ord, priv)
                   WHERE pg_catalog.has_table_privilege('union_eyes_system', c.oid, priv)
                   ORDER BY ord
                 ) AS system
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname IN ('public', 'user_management', 'audit_security')
            AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_system')
          ORDER BY 1, 2`,
  },
  {
    name: 'policies',
    sql: `SELECT relation.relname AS table_name,
                 pol.polname,
                 pol.polcmd,
                 pol.polpermissive,
                 0 = ANY(pol.polroles) AS public_role,
                 pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) AS qual,
                 pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
                 COALESCE(policy_roles.roles, ARRAY[]::text[]) AS roles
          FROM pg_catalog.pg_policy pol
          JOIN pg_catalog.pg_class relation ON relation.oid = pol.polrelid
          JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
          LEFT JOIN (
            SELECT vectors.polroles,
              COALESCE(array_agg(role.rolname::text ORDER BY role.rolname) FILTER (WHERE role.rolname IS NOT NULL), ARRAY[]::text[]) AS roles
            FROM (SELECT DISTINCT polroles FROM pg_catalog.pg_policy) AS vectors
            LEFT JOIN pg_catalog.pg_roles role ON role.oid = ANY (vectors.polroles)
            GROUP BY vectors.polroles
          ) AS policy_roles ON policy_roles.polroles = pol.polroles
          WHERE namespace.nspname = 'public'`,
  },
  {
    name: 'publicGrants',
    sql: `SELECT n.nspname AS schema_name, c.relname AS table_name, acl.privilege_type
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) acl
          WHERE c.relacl IS NOT NULL
            AND n.nspname = 'public'
            AND c.relkind IN ('r', 'p', 'v', 'm')
            AND acl.grantee = 0
            AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE')`,
  },
  {
    name: 'sequences',
    sql: `SELECT c.relname
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'S'
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_system')
            AND (
              pg_catalog.has_sequence_privilege('union_eyes_runtime', c.oid, 'USAGE')
              OR pg_catalog.has_sequence_privilege('union_eyes_runtime', c.oid, 'SELECT')
              OR pg_catalog.has_sequence_privilege('union_eyes_system', c.oid, 'USAGE')
              OR pg_catalog.has_sequence_privilege('union_eyes_system', c.oid, 'SELECT')
            )`,
  },
  {
    name: 'definers',
    sql: `SELECT n.nspname, p.proname, owner.rolname AS owner, p.proconfig,
                 pg_catalog.has_function_privilege('union_eyes_runtime',p.oid,'EXECUTE') AS runtime_execute,
                 pg_catalog.has_function_privilege('union_eyes_system',p.oid,'EXECUTE') AS system_execute,
                 pg_catalog.has_function_privilege('public',p.oid,'EXECUTE') AS public_execute
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
          WHERE p.prosecdef
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_system')
            AND (
              pg_catalog.has_function_privilege('union_eyes_runtime', p.oid, 'EXECUTE')
              OR pg_catalog.has_function_privilege('union_eyes_system', p.oid, 'EXECUTE')
              OR pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
            )`,
  },
  {
    name: 'currentFunctions',
    sql: `SELECT n.nspname AS schema,p.proname AS name,
          n.nspname||'.'||p.proname||'('||array_to_string(ARRAY(SELECT pg_catalog.format_type(t,NULL) FROM unnest(p.proargtypes::oid[]) t),',')||')' AS signature,
          pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosrc AS body,l.lanname AS language,p.provolatile AS volatility,
          p.prosecdef AS definer,p.proisstrict AS strict,p.proleakproof AS leakproof,
          pg_catalog.format_type(p.prorettype,NULL) AS returns,p.proretset AS "returnsSet",
          p.proargnames AS "argumentNames",p.proargmodes::text[] AS "argumentModes",
          ARRAY(SELECT pg_catalog.format_type(t,NULL) FROM unnest(COALESCE(p.proallargtypes,p.proargtypes::oid[])) t) AS "allArgumentTypes",
          p.pronargdefaults AS "defaultCount",pg_catalog.pg_get_expr(p.proargdefaults,0) AS defaults,p.proconfig AS config,
          (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantable',a.is_grantable))
            FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
            WHERE a.privilege_type='EXECUTE') AS "executeAcl"
          FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang
          WHERE n.nspname IN ('public','user_management') ORDER BY n.nspname,p.proname,p.oid`,
  },
  {
    name: 'dedicatedRoles',
    sql: `SELECT n.nspname AS schema_name,c.relname AS table_name,
                 r.rolname AS role_name,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE'), (5, 'REFERENCES'), (6, 'TRIGGER'), (7, 'TRUNCATE')) AS v(ord, priv)
                   WHERE pg_catalog.has_table_privilege(r.oid, c.oid, priv)
                   ORDER BY ord
                 ) AS privileges
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_catalog.pg_roles r ON r.rolname LIKE 'ue_framework_%' OR r.rolname LIKE 'nzila_auth_%' OR r.rolname='ue_external_read_reader'
          WHERE n.nspname IN ('public','user_management')
            AND c.relkind IN ('r', 'p')`,
  },
  {
    name: 'columnGrants',
    sql: `SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
                 COALESCE(g.rolname, 'PUBLIC') AS role_name, x.privilege_type,x.is_grantable
          FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) x
          LEFT JOIN pg_catalog.pg_roles g ON g.oid = x.grantee
          WHERE a.attacl IS NOT NULL
            AND a.attnum <> 0
            AND NOT a.attisdropped
            AND n.nspname IN ('public', 'user_management', 'audit_security')
          ORDER BY 1, 2, 4, 5, 3`,
  },
  {
    name: 'defaults',
    sql: `SELECT n.nspname, pg_catalog.pg_get_userbyid(d.defaclrole) AS owner, d.defaclacl::text AS acl
          FROM pg_catalog.pg_default_acl d
          LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
          WHERE d.defaclacl::text LIKE '%union_eyes_runtime%'
             OR d.defaclacl::text LIKE '%union_eyes_system%'`,
  },
  {
    name: 'physicalTriggers',
    sql: `SELECT n.nspname::text AS table_schema,c.relname::text AS table_name,pg_catalog.pg_get_userbyid(c.relowner)::text AS owner_name,
      c.relrowsecurity,c.relforcerowsecurity,t.tgname::text AS name,p.proname::text AS function_name,
      pn.nspname::text AS function_schema,pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_args,
      pg_catalog.pg_get_userbyid(p.proowner)::text AS function_owner,p.prosecdef,
      t.tgtype,t.tgenabled::text,t.tgdeferrable,t.tginitdeferred,t.tgconstraint<>0 AS is_constraint,
      t.tgqual IS NOT NULL AS has_condition,t.tgattr::text AS columns,
      ARRAY(SELECT a.attname::text FROM unnest(t.tgattr::smallint[]) WITH ORDINALITY wanted(attnum,ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=wanted.attnum ORDER BY wanted.ord) AS column_names,
      pg_catalog.encode(t.tgargs,'hex') AS args_hex,t.tgoldtable::text AS old_table,t.tgnewtable::text AS new_table
      ,pg_catalog.pg_get_triggerdef(t.oid) AS definition
      FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
      WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND NOT t.tgisinternal ORDER BY n.nspname,c.relname,t.tgname`,
  },
]

export function catalogContractDigest(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function asArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (value == null) return []
  const text = String(value)
  if (text === '{}' || text === '') return []
  if (text.startsWith('{') && text.endsWith('}')) {
    return text.slice(1, -1).split(',').filter(Boolean)
  }
  return [text]
}

function samePrivileges(actual, expected) {
  const valid = value => Array.isArray(value)
    && value.every(privilege => PRIVILEGE_ORDER.includes(privilege))
    && new Set(value).size === value.length
  return valid(actual) && valid(expected) && actual.length === expected.length
    && actual.every(privilege => expected.includes(privilege))
}

function rows(snapshots, name) {
  const value = snapshots?.[name]
  return Array.isArray(value) ? value : []
}

/** Exact compiler-derived identities. Same-name overloads and extra ACLs deny. */
export function currentFunctionViolations(expected, actual) {
  if (!Array.isArray(expected)) return ['current function source contract is missing']
  const violations = []
  const scalar = ['schema','name','signature','owner','language','volatility','definer','strict','leakproof','returns','returnsSet','defaultCount','defaults']
  const arrays = ['argumentNames','argumentModes','allArgumentTypes','config']
  const acl = value => Array.isArray(value)
    ? [...value].sort((a,b) => String(a.role).localeCompare(String(b.role))) : value
  for (const spec of expected) {
    const matches = actual.filter(row => row.schema === spec.schema && row.name === spec.name)
    const admittedNames = expected.filter(row => row.schema === spec.schema && row.name === spec.name)
    const row = matches.find(item => item.signature === spec.signature)
    if (matches.length !== admittedNames.length || !row
      || !/^[a-f0-9]{64}$/.test(spec.bodyDigest ?? '')
      || typeof row.body !== 'string' || createHash('sha256').update(row.body).digest('hex') !== spec.bodyDigest
      || scalar.some(key => row[key] !== spec[key])
      || arrays.some(key => JSON.stringify(row[key]) !== JSON.stringify(spec[key]))
      || JSON.stringify(acl(row.executeAcl)) !== JSON.stringify(acl(spec.executeAcl))) {
      violations.push(`current function differs: ${spec.signature}`)
    }
  }
  return violations
}

/** The source-owned private function owner is isolated in every transport,
 * including MJS restore admission. Expected powers come from source functions. */
export function externalReadRoleViolations(expectedFunctions, snapshots) {
  if (!Array.isArray(expectedFunctions)) return [] // The source-contract failure is reported independently.
  const name = 'ue_external_read_reader'
  if (!expectedFunctions.some(fn => fn.owner === name)) return []
  const actual = rows(snapshots, 'externalReadRole'), role = actual[0], violations = []
  if (actual.length !== 1 || !role || role.rolname !== name || role.isolated !== true
    || ['rolsuper','rolinherit','rolcreaterole','rolcreatedb','rolcanlogin','rolbypassrls','public_create','public_grant_option','auth_create','auth_grant_option','any_create'].some(key => role[key] !== false)
    || role.public_usage !== true || role.auth_usage !== true)
    violations.push('External private execution role/namespace contract is missing or changed')
  const allowed = new Set(expectedFunctions.filter(fn => Array.isArray(fn.executeAcl)
    && fn.executeAcl.some(grant => grant.role === name && grant.grantable === false)).map(fn => fn.signature))
  for (const fn of rows(snapshots, 'currentFunctions')) {
    const callable = fn.owner === name || (Array.isArray(fn.executeAcl) && fn.executeAcl.some(grant => grant.role === name || grant.role === 'PUBLIC'))
    if (callable && !allowed.has(fn.signature)) violations.push(`External private role has undeclared function execution: ${fn.signature}`)
  }
  return violations
}

/** Parse only the current source's single textual equality condition. No
 * boolean rewrites, identifiers, operators or literals are discarded. */
function triggerCondition(definition) {
  if (typeof definition !== 'string') return undefined
  const tokens = [], expression = /\s+|'(?:''|[^'])*'|"(?:""|[^"])*"|::|[A-Za-z_][A-Za-z_0-9$]*|[(),.=;]/gy
  let position = 0
  while (position < definition.length) {
    expression.lastIndex = position
    const match = expression.exec(definition)
    if (!match) return undefined
    position = expression.lastIndex
    if (!/^\s+$/.test(match[0])) tokens.push(match[0])
  }
  const identifier = token => typeof token === 'string' && token.startsWith('"')
    ? token.slice(1,-1).replaceAll('""','"') : token?.toLowerCase()
  const whens = tokens.map((token,index) => token[0] !== "'" && token[0] !== '"' && identifier(token) === 'when' ? index : -1).filter(index => index >= 0)
  if (whens.length !== 1 || tokens[whens[0]+1] !== '(') return undefined
  const condition = []
  let depth = 0, end = -1
  for (let i=whens[0]+1;i<tokens.length;i++) {
    if (tokens[i] === '(') depth++
    if (tokens[i] === ')') depth--
    if (depth < 0) return undefined
    condition.push(tokens[i])
    if (depth === 0) { end=i; break }
  }
  if (end < 0 || identifier(tokens[end+1]) !== 'execute'
    || !['function','procedure'].includes(identifier(tokens[end+2]))) return undefined
  // Removing parentheses is safe inside this deliberately tiny grammar: a
  // function, OR/AND, second comparison or cast still leaves unaccepted tokens.
  const input = condition.filter(token => token !== '(' && token !== ')')
  let cursor = 0
  const row = identifier(input[cursor++])
  if (!['new','old'].includes(row) || input[cursor++] !== '.') return undefined
  const column = identifier(input[cursor++])
  if (!/^[a-z_][a-z0-9_]*$/.test(column ?? '')) return undefined
  const textCast = () => {
    if (input[cursor] !== '::') return true
    cursor++
    if (identifier(input[cursor]) === 'pg_catalog' && input[cursor+1] === '.') cursor+=2
    return identifier(input[cursor++]) === 'text'
  }
  if (!textCast() || input[cursor++] !== '=') return undefined
  const literal = input[cursor++]
  if (typeof literal !== 'string' || !/^'(?:''|[^'])*'$/.test(literal) || !textCast() || cursor !== input.length) return undefined
  return { kind:'text-equality', row, column, value:literal.slice(1,-1).replaceAll("''", "'") }
}

/** Metadata comes from the source contracts; catalog facts never select the
 * desired trigger, function, event or execution owner. */
export function physicalTriggerViolations(expected, actual, functions) {
  if (!Array.isArray(expected)) return ['physical trigger source contract is missing']
  if (!Array.isArray(actual) || !Array.isArray(functions)) return ['physical trigger catalog/function source is missing']
  const violations = [], identities = new Set(), names = new Set(), functionNames = new Set(), exclusive = new Set()
  const identifier = value => typeof value === 'string' && /^[a-z_][a-z0-9_]*$/.test(value)
  for (const spec of expected) {
    const identity = `${spec?.schema}.${spec?.table_name}|${spec?.name}`
    const validCondition = spec?.condition === null || (spec?.condition?.kind === 'text-equality'
      && ['new','old'].includes(spec.condition.row) && identifier(spec.condition.column)
      && typeof spec.condition.value === 'string' && Object.keys(spec.condition).sort().join(',') === 'column,kind,row,value')
    if (!spec || !['public','user_management'].includes(spec.schema) || !identifier(spec.table_name)
      || !identifier(spec.table_owner) || !identifier(spec.name) || !identifier(spec.function_name)
      || !['public','user_management'].includes(spec.function_schema)
      || !Number.isInteger(spec.tgtype) || spec.tgtype <= 0 || spec.tgtype > 127
      || typeof spec.tgdeferrable !== 'boolean' || typeof spec.tginitdeferred !== 'boolean'
      || (spec.tginitdeferred && !spec.tgdeferrable) || typeof spec.exclusive !== 'boolean'
      || typeof spec.is_constraint !== 'boolean' || !Array.isArray(spec.columns)
      || !spec.columns.every(identifier) || new Set(spec.columns).size !== spec.columns.length
      || ![spec.old_table,spec.new_table].every(value => value === null || identifier(value)) || !validCondition
      || typeof spec.args_hex !== 'string' || !/^(?:[0-9a-f]{2})*$/.test(spec.args_hex)
      || identities.has(identity)) {
      violations.push(`physical trigger source contract is invalid: ${identity}`)
      continue
    }
    identities.add(identity); names.add(spec.name); functionNames.add(spec.function_name)
    if (spec.exclusive) exclusive.add(`${spec.schema}.${spec.table_name}`)
    const source = functions.filter(fn => fn.schema === spec.function_schema && fn.name === spec.function_name)
    const producer = source[0]
    if (source.length !== 1 || producer.signature !== `${spec.function_schema}.${spec.function_name}()`
      || !identifier(producer.owner) || producer.returns !== 'trigger' || typeof producer.definer !== 'boolean')
      violations.push(`physical trigger function source differs: ${identity}`)
    const matches = actual.filter(row => row.table_schema === spec.schema && row.table_name === spec.table_name && row.name === spec.name), row = matches[0]
    if (matches.length !== 1 || !row || row.owner_name !== spec.table_owner
      || row.relrowsecurity !== true || row.relforcerowsecurity !== true
      || row.function_name !== spec.function_name || row.function_schema !== spec.function_schema || row.function_args !== ''
      || row.function_owner !== producer?.owner || row.prosecdef !== producer?.definer
      || row.tgtype !== spec.tgtype || row.tgenabled !== 'O' || row.tgdeferrable !== spec.tgdeferrable
      || row.tginitdeferred !== spec.tginitdeferred || row.is_constraint !== spec.is_constraint
      || row.has_condition !== (spec.condition !== null) || row.args_hex !== spec.args_hex
      || JSON.stringify(row.column_names) !== JSON.stringify(spec.columns)
      || (spec.columns.length === 0 && row.columns !== '')
      || row.old_table !== spec.old_table || row.new_table !== spec.new_table
      || (spec.condition !== null && JSON.stringify(triggerCondition(row.definition)) !== JSON.stringify(spec.condition)))
      violations.push(`physical trigger is missing or changed: ${identity}`)
  }
  for (const row of actual) {
    if ((exclusive.has(`${row.table_schema}.${row.table_name}`) || names.has(row.name) || functionNames.has(row.function_name))
      && !identities.has(`${row.table_schema}.${row.table_name}|${row.name}`))
      violations.push(`physical trigger has an undeclared attachment: ${row.table_schema}.${row.table_name}|${row.name}`)
  }
  return violations
}

const CONTAINED_PARENT_PREFIX = 'ue_v2_contained_parent_'
// This grammar deliberately admits only source-owned NULL/false conjunctions.
// PostgreSQL may change whitespace, quoting and parentheses when deparsing; it
// must not turn OR, casts, functions or an unrelated column into an equivalent guard.
function containedParentExpression(value) {
  if (typeof value !== 'string' || value.length > 100_000) return null
  const tokens = value.match(/\s+|"(?:[^"]|"")*"|[A-Za-z_][A-Za-z_0-9]*|[()]/g) ?? []
  if (tokens.join('') !== value) return null
  const input = tokens.filter(token => !/^\s+$/.test(token))
  let position = 0
  const keyword = word => input[position]?.toUpperCase() === word
  const atom = () => {
    if (input[position] === '(') {
      position++
      const terms = conjunction()
      if (!terms || input[position++] !== ')') return null
      return terms
    }
    if (keyword('FALSE') || keyword('TRUE')) return [input[position++].toLowerCase()]
    const token = input[position++]
    if (!token || !/^(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z_0-9]*)$/.test(token)) return null
    const column = token.startsWith('"') ? token.slice(1,-1).replaceAll('""','"') : token.toLowerCase()
    if (!column || !keyword('IS')) return null
    position++
    if (!keyword('NULL')) return null
    position++
    return [`null:${column}`]
  }
  const conjunction = () => {
    const terms = atom()
    if (!terms) return null
    while (keyword('AND')) {
      position++
      const next = atom()
      if (!next) return null
      terms.push(...next)
    }
    return terms
  }
  const terms = conjunction()
  return terms && position === input.length && terms.length
    && new Set(terms).size === terms.length ? terms.sort() : null
}

/** Mandatory current-source restrictions, independent of permissive row filters. */
export function containedParentPolicyViolations(expected, actual) {
  if (!Array.isArray(expected)) return ['contained-parent policy source contract is missing']
  if (!Array.isArray(actual)) return ['contained-parent policy catalog is missing']
  const violations = [], identities = new Set()
  const validRoles = roles => Array.isArray(roles) && roles.length > 0
    && roles.every(role => ['union_eyes_runtime','union_eyes_system'].includes(role))
    && new Set(roles).size === roles.length
  for (const spec of expected) {
    const identity = `${spec?.table}|${spec?.name}`
    const predicate = containedParentExpression(spec?.predicate)
    if (!spec || spec.schema !== 'public' || !/^[a-z_][a-z_0-9]*$/.test(spec.table ?? '')
      || !['INSERT','UPDATE'].includes(spec.command)
      || spec.name !== CONTAINED_PARENT_PREFIX + spec.command.toLowerCase()
      || spec.permissive !== false || spec.using !== (spec.command === 'UPDATE' ? 'true' : null)
      || !validRoles(spec.roles) || !predicate || predicate.includes('true') || identities.has(identity)) {
      violations.push(`contained-parent policy source contract is invalid: ${identity}`)
      continue
    }
    identities.add(identity)
    const matches = actual.filter(row => row.table_name === spec.table && row.polname === spec.name)
    const row = matches[0]
    if (matches.length !== 1 || !row || row.polcmd !== {INSERT:'a',UPDATE:'w'}[spec.command]
      || row.polpermissive !== false || row.public_role !== false || !validRoles(row.roles)
      || JSON.stringify([...row.roles].sort()) !== JSON.stringify([...spec.roles].sort())
      || (spec.using === null ? row.qual !== null : JSON.stringify(containedParentExpression(row.qual)) !== '["true"]')
      || JSON.stringify(containedParentExpression(row.with_check)) !== JSON.stringify(predicate))
      violations.push(`public.${spec.table} contained-parent policy is missing or changed: ${spec.name}`)
  }
  for (const row of actual) {
    if (typeof row.polname === 'string' && row.polname.startsWith(CONTAINED_PARENT_PREFIX)
      && !identities.has(`${row.table_name}|${row.polname}`))
      violations.push(`public.${row.table_name} has an undeclared contained-parent policy: ${row.polname}`)
  }
  return violations
}

function policyViolations(table, entry, policies) {
  const violations = []
  const appliesTo = (policy, role) => policy.roles.length === 0 || policy.roles.includes(role)
  const covers = (policy, privilege) => {
    const command = { SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd' }[privilege]
    return policy.polpermissive === true && (policy.polcmd === '*' || policy.polcmd === command)
  }
  const runtimePolicies = policies.filter((policy) => appliesTo(policy, 'union_eyes_runtime'))
  const systemPolicies = policies.filter((policy) => appliesTo(policy, 'union_eyes_system'))
  if (
    entry.classification === 'SYSTEM_ONLY' ||
    entry.classification === 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT' ||
    entry.classification === 'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT'
  ) {
    if (runtimePolicies.length > 0) violations.push(`public.${table} has a runtime RLS policy`)
    if (entry.classification !== 'SYSTEM_ONLY' && systemPolicies.length > 0) {
      violations.push(`public.${table} has a system RLS policy`)
    }
    if (entry.classification === 'SYSTEM_ONLY' && entry.system.length > 0 && systemPolicies.length === 0) {
      violations.push(`public.${table} has no system RLS policy`)
    }
    return violations
  }
  for (const policy of runtimePolicies) {
    if (policy.polpermissive !== false && (policy.qual === 'true' || policy.with_check === 'true')) {
      violations.push(`public.${table} runtime policy ${policy.polname} is permissive`)
    }
  }
  for (const privilege of entry.runtime) {
    if (!runtimePolicies.some((policy) => covers(policy, privilege))) {
      violations.push(`public.${table} has no runtime ${privilege} policy`)
    }
  }
  for (const privilege of entry.system) {
    if (!systemPolicies.some((policy) => covers(policy, privilege))) {
      violations.push(`public.${table} has no system ${privilege} policy`)
    }
  }
  return violations
}

export function assessCatalogAdmission(contract, snapshots, environment = 'unknown') {
  const violations = []
  const payload = contract?.payload
  if (!payload || catalogContractDigest(payload) !== contract?.digest || !Array.isArray(payload.entries) || payload.entries.length < 100) {
    violations.push('catalog contract digest is invalid')
    return {
      ok: false,
      applicationReady: false,
      environment,
      source: 'apps/union-eyes/lib/operations/catalog-authority-contract.json',
      violations,
    }
  }

  const manifest = new Map(payload.entries.map((entry) => [entry.table, entry]))
  const nonpublic = new Map(payload.nonPublic.map((entry) => [`${entry.schema}.${entry.table}`, entry]))
  const rlsRequired = new Set(payload.rlsRequired)
  const present = new Map(rows(snapshots, 'roles').map((row) => [row.rolname, row]))
  for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
    const attributes = present.get(role)
    if (!attributes) {
      violations.push(`${role} is absent`)
      continue
    }
    if (attributes.rolsuper !== false || attributes.rolbypassrls !== false || attributes.rolcreatedb !== false || attributes.rolcreaterole !== false) {
      violations.push(`${role} has a privileged attribute`)
    }
  }
  if (violations.length > 0) {
    return report(environment, violations)
  }

  for (const row of rows(snapshots, 'membership')) {
    violations.push(`${row.member} inherits ${row.granted}`)
  }
  violations.push(...containedParentPolicyViolations(payload.requiredContainedParentPolicies, rows(snapshots, 'policies')))
  if (payload.currentFunctions !== undefined)
    violations.push(...physicalTriggerViolations(payload.requiredPhysicalTriggers, rows(snapshots, 'physicalTriggers'), payload.currentFunctions))

  for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
    const expected = role === 'union_eyes_runtime' ? payload.runtimeSchemaUsage : payload.systemSchemaUsage
    const actual = rows(snapshots, 'schemaUsage')
      .filter((row) => row.rolname === role)
      .map((row) => row.nspname)
      .sort()
    const wanted = [...expected].sort()
    if (actual.join(',') !== wanted.join(',')) {
      violations.push(`${role} schema USAGE is ${actual.join(',') || '(none)'}`)
    }
  }
  for (const row of rows(snapshots, 'schemaCreate')) {
    violations.push(`${row.rolname} can CREATE in ${row.nspname}`)
  }

  const policiesByTable = new Map()
  for (const policy of rows(snapshots, 'policies')) {
    const normalized = { ...policy, roles: asArray(policy.roles) }
    const list = policiesByTable.get(policy.table_name) ?? []
    list.push(normalized)
    policiesByTable.set(policy.table_name, list)
  }
  if (Array.isArray(payload.requiredContainedParentPolicies)) {
    for (const table of new Set(payload.requiredContainedParentPolicies.map(spec => spec?.table))) {
      const matches = rows(snapshots, 'relations').filter(row => row.schema_name === 'public' && row.table_name === table)
      if (matches.length !== 1 || matches[0].relrowsecurity !== true || matches[0].relforcerowsecurity !== true)
        violations.push(`public.${table} contained-parent policy relation lacks FORCE RLS`)
    }
  }

  for (const relation of rows(snapshots, 'relations')) {
    const key = `${relation.schema_name}.${relation.table_name}`
    const runtime = asArray(relation.runtime)
    const system = asArray(relation.system)
    if (relation.relkind === 'v' || relation.relkind === 'm') {
      if (relation.schema_name === 'public' && !manifest.has(relation.table_name))
        violations.push(`public.${relation.table_name} is unclassified`)
      if (runtime.length || system.length) violations.push(`${key} is a view with runtime or system privileges`)
      continue
    }
    if (relation.schema_name !== 'public') {
      const approved = nonpublic.get(key)
      if (!approved) {
        if (runtime.length || system.length) violations.push(`${key} has privileges outside the scoped auth contract`)
        continue
      }
      if (!samePrivileges(runtime, approved.runtime) || !samePrivileges(system, approved.system)) {
        violations.push(`${key} privileges are runtime[${runtime}] system[${system}]`)
      }
      if ((approved.runtime.length || approved.system.length) && !relation.relforcerowsecurity) {
        violations.push(`${key} is granted without FORCE RLS`)
      }
      continue
    }

    const entry = manifest.get(relation.table_name)
    if (!entry) {
      violations.push(`public.${relation.table_name} is unclassified`)
      continue
    }
    if (entry.classification === 'NEEDS_REVIEW') violations.push(`public.${relation.table_name} is NEEDS_REVIEW`)
    if (entry.runtime === 'TBD' || entry.system === 'TBD') {
      violations.push(`public.${relation.table_name} privileges are TBD`)
      continue
    }
    if (!samePrivileges(runtime, entry.runtime) || !samePrivileges(system, entry.system)) {
      violations.push(`public.${relation.table_name} privileges are runtime[${runtime}] system[${system}]`)
    }
    const columnPowers = role => (payload.approvedColumnGrants ?? []).filter(grant => grant.schema === 'public'
      && grant.table === relation.table_name && grant.role === role && Array.isArray(grant.columns) && grant.columns.length > 0)
      .map(grant => grant.privilege)
    const effectiveEntry = { ...entry,
      runtime: [...new Set([...entry.runtime, ...columnPowers('union_eyes_runtime')])],
      system: [...new Set([...entry.system, ...columnPowers('union_eyes_system')])],
    }
    if (effectiveEntry.runtime.length && payload.requiredSessionPolicy) {
      const expected = payload.requiredSessionPolicy
      const matches = (policiesByTable.get(relation.table_name) ?? []).filter(policy => policy.polname === expected.name)
      const policy = matches[0]
      if (matches.length !== 1 || !policy || policy.polcmd !== expected.command || policy.polpermissive !== expected.permissive
        || JSON.stringify(policy.roles) !== JSON.stringify(expected.roles)
        || policy.qual !== expected.predicate || policy.with_check !== expected.predicate)
        violations.push(`public.${relation.table_name} verified session policy is missing or changed`)
    }
    if (rlsRequired.has(entry.classification)) {
      if (!relation.relrowsecurity || !relation.relforcerowsecurity) {
        violations.push(`public.${relation.table_name} lacks FORCE RLS`)
      } else {
        violations.push(...policyViolations(relation.table_name, effectiveEntry, policiesByTable.get(relation.table_name) ?? []))
      }
    }
  }

  const dedicatedActual = new Map()
  for (const row of rows(snapshots, 'dedicatedRoles')) {
    dedicatedActual.set(`${row.schema_name ?? 'public'}.${row.table_name}|${row.role_name}`, asArray(row.privileges))
  }
  for (const expected of payload.dedicatedRolePrivileges ?? []) {
    const schema = expected.schema ?? 'public'
    const present = rows(snapshots,'relations').some(row => row.schema_name === schema && row.table_name === expected.table)
    if (!present) continue
    const actual = dedicatedActual.get(`${schema}.${expected.table}|${expected.role}`) ?? []
    if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected.privileges].sort())) {
      violations.push(`${schema}.${expected.table} ${expected.role} privileges are [${actual}]`)
    }
  }
  for (const row of rows(snapshots,'dedicatedRoles')) {
    if (!asArray(row.privileges).length) continue
    if (!(payload.dedicatedRolePrivileges ?? []).some(expected => (expected.schema ?? 'public') === (row.schema_name ?? 'public')
      && expected.table === row.table_name && expected.role === row.role_name))
      violations.push(`${row.schema_name ?? 'public'}.${row.table_name} ${row.role_name} has undeclared table privileges`)
  }

  for (const row of rows(snapshots, 'publicGrants')) {
    violations.push(`PUBLIC holds ${row.privilege_type} on ${row.schema_name}.${row.table_name}`)
  }
  for (const row of rows(snapshots, 'sequences')) violations.push(`public sequence ${row.relname} is granted`)
  violations.push(...currentFunctionViolations(payload.currentFunctions, rows(snapshots,'currentFunctions')))
  violations.push(...externalReadRoleViolations(payload.currentFunctions, snapshots))
  for (const row of rows(snapshots, 'definers')) {
    const expected = (payload.currentFunctions ?? []).find(entry => entry.schema === row.nspname && entry.name === row.proname)
    const effective = role => Boolean(expected?.executeAcl?.some(grant => grant.role === role))
    if (!expected || row.owner !== expected.owner || JSON.stringify(row.proconfig) !== JSON.stringify(expected.config)
      || row.runtime_execute !== effective('union_eyes_runtime')
      || row.system_execute !== effective('union_eyes_system') || row.public_execute !== effective('PUBLIC')) {
      violations.push(`${row.nspname}.${row.proname} is a SECURITY DEFINER function executable by a runtime principal`)
    }
  }
  const approvedColumns = new Map(
    (payload.approvedColumnGrants ?? []).map((grant) => [
      `${grant.schema}.${grant.table}|${grant.role}|${grant.privilege}`,
      grant,
    ]),
  )
  const actualColumns = new Map()
  for (const row of rows(snapshots, 'columnGrants')) {
    const key = `${row.schema_name}.${row.table_name}|${row.role_name}|${row.privilege_type}`
    if (!approvedColumns.has(key)) {
      violations.push(
        `${row.schema_name}.${row.table_name}.${row.column_name} has an unapproved column ACL (${row.role_name} ${row.privilege_type})`,
      )
      continue
    }
    if (row.is_grantable !== (approvedColumns.get(key).grantable ?? false))
      violations.push(`${row.schema_name}.${row.table_name}.${row.column_name} column grant option differs`)
    if (!approvedColumns.get(key).columns.includes(row.column_name))
      violations.push(`${row.schema_name}.${row.table_name}.${row.column_name} is outside the source column ACL`)
    actualColumns.set(key, [...(actualColumns.get(key) ?? []), row.column_name])
  }
  const presentRelations = new Set(
    rows(snapshots, 'relations').map((relation) => `${relation.schema_name}.${relation.table_name}`),
  )
  for (const [key, grant] of approvedColumns) {
    if (!presentRelations.has(`${grant.schema}.${grant.table}`)) continue
    const actual = [...(actualColumns.get(key) ?? [])].sort()
    const expected = [...grant.columns].sort()
    if (actual.length !== expected.length || actual.some((column, index) => column !== expected[index])) {
      violations.push(
        `${grant.schema}.${grant.table} ${grant.role} ${grant.privilege} columns are [${actual}], expected [${expected}]`,
      )
    }
  }
  for (const row of rows(snapshots, 'defaults')) {
    violations.push(`default privileges for ${row.owner} on ${row.nspname || 'database'} include a runtime role`)
  }

  return report(environment, violations)
}

function report(environment, violations) {
  return {
    ok: violations.length === 0,
    applicationReady: false,
    environment,
    source: 'apps/union-eyes/lib/operations/catalog-authority-contract.json',
    violations,
  }
}

export function privilegesInOrder(value) {
  if (value === 'TBD') return 'TBD'
  const privileges = [...(value ?? [])]
  return PRIVILEGE_ORDER.filter((privilege) => privileges.includes(privilege))
}
