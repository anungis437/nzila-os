/** Source-owned additive physical protections. No released migration or supplied SQL is executed. */
import { createHash } from 'node:crypto'
export type Row = Record<string, unknown>
export type Execute = (sql: string) => Promise<Row[]>
export interface PhysicalGuardContract {
  source: string
  references: readonly { path: string; sha256: string }[]
  tables: readonly string[]
  functions: readonly {
    name: string
    body: string
    returns: string
    args: string
    volatility: string
    language: string
    path: string
    callable: boolean
  }[]
  constraints: readonly { table_name: string; name: string; type: string; definition: string }[]
  triggers: readonly {
    table_name: string
    name: string
    function_name: string
    tgtype: number
    tgdeferrable: boolean
    tginitdeferred: boolean
    definition: string
    args_hex: string
  }[]
}
const literal = (s: string) => `'${s.replaceAll("'", "''")}'`
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`
const normalized = (s: unknown) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/REFERENCES public\./g, 'REFERENCES ')
    .trim()
export function compileGuardFunction(fn: PhysicalGuardContract['functions'][number]): string[] {
  const volatility =
    fn.volatility === 'i' ? 'IMMUTABLE' : fn.volatility === 's' ? 'STABLE' : 'VOLATILE'
  return [
    `CREATE FUNCTION public.${quote(fn.name)}(${fn.args}) RETURNS ${fn.returns} LANGUAGE ${fn.language} ${volatility} SECURITY INVOKER SET search_path=${fn.path} AS $ue_guard$${fn.body}$ue_guard$;`,
    `REVOKE ALL ON FUNCTION public.${quote(fn.name)}(${fn.args}) FROM PUBLIC,union_eyes_runtime,union_eyes_system;`,
    ...(fn.callable
      ? [
          `GRANT EXECUTE ON FUNCTION public.${quote(fn.name)}(${fn.args}) TO union_eyes_runtime,union_eyes_system;`,
        ]
      : []),
  ]
}
export function physicalGuardQueries(contract: PhysicalGuardContract) {
  const names = contract.tables.map(literal).join(','),
    functions = contract.functions.map((f) => literal(f.name)).join(',')
  return {
    tables: `SELECT wanted.name AS table_name,c.oid::text,pg_get_userbyid(c.relowner) AS owner_name,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity FROM unnest(ARRAY[${names}]) wanted(name) LEFT JOIN pg_namespace n ON n.nspname='public' LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=wanted.name AND c.relkind='r' ORDER BY wanted.name`,
    functions: `SELECT p.proname AS name,p.prosrc AS body,p.prosecdef,p.provolatile AS volatility,pg_get_function_identity_arguments(p.oid) AS args,p.prorettype::regtype::text AS returns,pg_get_userbyid(p.proowner) AS owner_name,p.proconfig,l.lanname AS language,has_function_privilege('public',p.oid,'EXECUTE') AS public_execute,has_function_privilege('union_eyes_runtime',p.oid,'EXECUTE') AS runtime_execute,has_function_privilege('union_eyes_system',p.oid,'EXECUTE') AS system_execute,NOT EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN (p.proowner,(SELECT oid FROM pg_roles WHERE rolname='union_eyes_runtime'),(SELECT oid FROM pg_roles WHERE rolname='union_eyes_system')) OR (a.is_grantable AND a.grantee<>p.proowner)) AS exact_acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.proname IN (${functions}) ORDER BY p.proname,p.oid`,
    constraints: `SELECT c.relname AS table_name,k.conname AS name,k.contype AS type,pg_get_constraintdef(k.oid) AS definition,k.convalidated,k.condeferrable,k.condeferred FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${names}) AND k.contype IN ('c','u','f') ORDER BY c.relname,k.conname`,
    triggers: `SELECT c.relname AS table_name,t.tgname AS name,p.proname AS function_name,pn.nspname AS function_schema,t.tgtype,t.tgenabled,t.tgdeferrable,t.tginitdeferred,t.tgconstraint<>0 AS is_constraint,t.tgqual IS NOT NULL AS has_condition,t.tgattr::text AS columns,encode(t.tgargs,'hex') AS args_hex FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='public' AND c.relname IN (${names}) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
  }
}
export async function inspectPhysicalGuards(contract: PhysicalGuardContract, execute: Execute) {
  const q = physicalGuardQueries(contract)
  return {
    tables: await execute(q.tables),
    functions: await execute(q.functions),
    constraints: await execute(q.constraints),
    triggers: await execute(q.triggers),
  }
}
export type PhysicalSnapshot = Awaited<ReturnType<typeof inspectPhysicalGuards>>
export function planPhysicalGuards(contract: PhysicalGuardContract, snapshot: PhysicalSnapshot) {
  const missing = contract.tables.filter(
    (name) => !snapshot.tables.some((row) => row.table_name === name && row.oid),
  )
  if (missing.length)
    throw new Error(`Required current protection relations missing: ${missing.join(',')}`)
  for (const row of snapshot.tables)
    if (
      row.owner_name !== 'ue_v2_owner' ||
      row.relrowsecurity !== true ||
      row.relforcerowsecurity !== true
    )
      throw new Error(`Bounded owner and forced RLS required: ${String(row.table_name)}`)
  const statements: string[] = []
  for (const fn of contract.functions) {
    const rows = snapshot.functions.filter((row) => row.name === fn.name),
      r = rows[0]
    if (!rows.length) {
      statements.push(...compileGuardFunction(fn))
      continue
    }
    if (
      rows.length !== 1 ||
      r.body !== fn.body ||
      r.owner_name !== 'ue_v2_owner' ||
      r.prosecdef !== false ||
      r.volatility !== fn.volatility ||
      r.args !== fn.args ||
      r.returns !== fn.returns ||
      r.language !== fn.language ||
      JSON.stringify(r.proconfig) !==
        JSON.stringify(['search_path=' + fn.path.replaceAll(',', ', ')]) ||
      r.public_execute !== false ||
      r.runtime_execute !== fn.callable ||
      r.system_execute !== fn.callable ||
      r.exact_acl !== true
    )
      throw new Error(`Current guard function differs; replacement refused: ${fn.name}`)
  }
  for (const spec of contract.constraints) {
    const sameName = snapshot.constraints.filter(
      (row) => row.table_name === spec.table_name && row.name === spec.name,
    )
    const rows = sameName.length
      ? sameName
      : snapshot.constraints.filter(
          (row) =>
            row.table_name === spec.table_name &&
            row.type === spec.type &&
            normalized(row.definition) === normalized(spec.definition),
        )
    if (!rows.length) {
      statements.push(
        `ALTER TABLE public.${quote(spec.table_name)} ADD CONSTRAINT ${quote(spec.name)} ${spec.definition.replace(/REFERENCES (ue_authority_[a-z_]+)/g, 'REFERENCES public.$1')};`,
      )
      continue
    }
    if (
      rows.length !== 1 ||
      rows[0].type !== spec.type ||
      normalized(rows[0].definition) !== normalized(spec.definition) ||
      rows[0].convalidated !== true ||
      rows[0].condeferrable !== false ||
      rows[0].condeferred !== false
    )
      throw new Error(
        `Current guard constraint differs; replacement refused: ${spec.table_name}.${spec.name}`,
      )
  }
  for (const spec of contract.triggers) {
    const rows = snapshot.triggers.filter(
        (row) => row.table_name === spec.table_name && row.name === spec.name,
      ),
      r = rows[0]
    if (!rows.length) {
      statements.push(
        spec.definition.replace(
          /EXECUTE FUNCTION (ue_authority_[a-z_]+)/g,
          'EXECUTE FUNCTION public.$1',
        ) + ';',
      )
      continue
    }
    if (
      rows.length !== 1 ||
      r.function_name !== spec.function_name ||
      r.function_schema !== 'public' ||
      r.tgtype !== spec.tgtype ||
      r.tgenabled !== 'O' ||
      r.tgdeferrable !== spec.tgdeferrable ||
      r.tginitdeferred !== spec.tginitdeferred ||
      r.is_constraint !== spec.tgdeferrable ||
      r.has_condition !== false ||
      r.columns !== '' ||
      r.args_hex !== spec.args_hex
    )
      throw new Error(
        `Current guard trigger differs; replacement refused: ${spec.table_name}.${spec.name}`,
      )
  }
  return {
    statements,
    fingerprint: createHash('sha256').update(JSON.stringify({ contract, snapshot })).digest('hex'),
  }
}
export async function applyPhysicalGuards(
  contract: PhysicalGuardContract,
  execute: Execute,
  reviewedFingerprint: string,
) {
  const fresh = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute))
  if (fresh.fingerprint !== reviewedFingerprint)
    throw new Error('Physical guard source/catalog metadata drift; nothing applied')
  for (const sql of fresh.statements) await execute(sql)
  const after = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute))
  if (after.statements.length) throw new Error('Physical guard postcondition failed')
  return {
    executedStatements: fresh.statements.length,
    verifiedFunctions: contract.functions.length,
    verifiedConstraints: contract.constraints.length,
    verifiedTriggers: contract.triggers.length,
    businessDmlIssued: false,
  }
}
export async function physicalGuardViolations(
  contract: PhysicalGuardContract,
  execute: Execute,
): Promise<string[]> {
  try {
    return planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute)).statements
      .length
      ? ['Current authority physical protections are missing']
      : []
  } catch (e) {
    return [e instanceof Error ? e.message : 'Current physical protections cannot be qualified']
  }
}
