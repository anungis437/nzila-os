/** A permissive tenant policy must never bypass the canonical session binding. */
import { createHash } from 'node:crypto'
import {
  DEADLINE_SESSION_GUARD_QUERY,
  deadlineSessionGuardPlan,
  deadlineSessionGuardViolations,
} from './business-session-event-guard'

export const BUSINESS_SESSION_POLICY = 'ue_v2_verified_business_session'
export const BUSINESS_SESSION_PREDICATE =
  "user_management.auth_business_org_authorized(NULLIF(current_setting('app.current_org_id',true),'')::uuid,NULL::text[])"
const quoted = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`

/** Additive only: no row, existing policy, privilege, or authentication instrument is changed. */
export function compileBusinessSessionPolicy(table: string): string {
  if (!table || table.includes('\0'))
    throw new Error('Business session policy requires a table identifier')
  return `CREATE POLICY ${quoted(BUSINESS_SESSION_POLICY)} ON public.${quoted(table)} AS RESTRICTIVE FOR ALL TO union_eyes_runtime USING (${BUSINESS_SESSION_PREDICATE}) WITH CHECK (${BUSINESS_SESSION_PREDICATE});`
}

export const BUSINESS_SESSION_POLICY_QUERY = `SELECT c.relname AS table_name,c.oid::text AS table_oid,
  pg_get_userbyid(c.relowner) AS owner_name,c.relacl::text AS table_acl,c.relrowsecurity,c.relforcerowsecurity,
  p.polname,p.polcmd,p.polpermissive,0=ANY(p.polroles) AS public_role,
  ARRAY(SELECT r.rolname::text FROM pg_roles r WHERE r.oid=ANY(p.polroles) ORDER BY r.rolname) AS roles,
  pg_get_expr(p.polqual,p.polrelid) AS qual,pg_get_expr(p.polwithcheck,p.polrelid) AS with_check
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid=c.oid AND p.polname='${BUSINESS_SESSION_POLICY}'
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND (has_table_privilege('union_eyes_runtime',c.oid,'SELECT,INSERT,UPDATE,DELETE')
      OR has_any_column_privilege('union_eyes_runtime',c.oid,'SELECT,INSERT,UPDATE'))
  ORDER BY c.relname`

// PostgreSQL's deparsed expression, independently pinned by the native policy regression.
export const BUSINESS_SESSION_CATALOG_PREDICATE =
  "user_management.auth_business_org_authorized((NULLIF(current_setting('app.current_org_id'::text, true), ''::text))::uuid, NULL::text[])"
const normalized = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
export function businessSessionPolicyViolations(
  rows: readonly Record<string, unknown>[],
): string[] {
  if (!rows.length) return ['business session policy: no runtime relations inspected']
  return rows.flatMap((row) =>
    row.relrowsecurity === true &&
    row.relforcerowsecurity === true &&
    row.owner_name === 'ue_v2_owner' &&
    row.public_role === false &&
    row.polname === BUSINESS_SESSION_POLICY &&
    row.polcmd === '*' &&
    row.polpermissive === false &&
    JSON.stringify(row.roles) === JSON.stringify(['union_eyes_runtime']) &&
    normalized(row.qual) === BUSINESS_SESSION_CATALOG_PREDICATE &&
    normalized(row.with_check) === BUSINESS_SESSION_CATALOG_PREDICATE
      ? []
      : [
          `public.${String(row.table_name)}: mandatory verified business session policy missing or changed`,
        ],
  )
}

type Execute = (statement: string) => Promise<Record<string, unknown>[]>
export async function planBusinessSessionRepair(execute: Execute) {
  const rows = await execute(BUSINESS_SESSION_POLICY_QUERY)
  if (!rows.length) throw new Error('No runtime relations inspected; repair refused')
  for (const row of rows) {
    if (
      row.owner_name !== 'ue_v2_owner' ||
      row.relrowsecurity !== true ||
      row.relforcerowsecurity !== true
    )
      throw new Error(`Existing bounded owner and forced RLS required: ${String(row.table_name)}`)
    if (row.polname && businessSessionPolicyViolations([row]).length)
      throw new Error(
        `Existing mandatory session policy differs; automatic replacement refused: ${String(row.table_name)}`,
      )
  }
  const guard = deadlineSessionGuardPlan(
    await execute(DEADLINE_SESSION_GUARD_QUERY),
    BUSINESS_SESSION_POLICY,
    BUSINESS_SESSION_CATALOG_PREDICATE,
  )
  const statements = rows
    .filter((row) => !row.polname)
    .map((row) => compileBusinessSessionPolicy(String(row.table_name)))
  return {
    policy: BUSINESS_SESSION_POLICY,
    inspectedRelations: rows.length,
    targets: rows.filter((row) => !row.polname).map((row) => String(row.table_name)),
    statements,
    protectedGuardUpgradeSql: guard.upgradeSql,
    protectedGuardState: guard.state,
    fingerprint: createHash('sha256')
      .update(JSON.stringify({ rows, protectedGuard: guard.metadata }))
      .digest('hex'),
  }
}

/** Caller owns BEGIN/COMMIT/ROLLBACK. Recompute SQL from source; never execute supplied plan SQL. */
export async function applyBusinessSessionRepair(
  execute: Execute,
  reviewedFingerprint: string,
  executeAsExistingGuardOwner?: Execute,
) {
  if (!/^[a-f0-9]{64}$/.test(reviewedFingerprint))
    throw new Error('Reviewed repair fingerprint required')
  const fresh = await planBusinessSessionRepair(execute)
  if (fresh.fingerprint !== reviewedFingerprint)
    throw new Error('Business session repair metadata drift; no changes applied')
  if (fresh.protectedGuardUpgradeSql) {
    if (!executeAsExistingGuardOwner)
      throw new Error('Existing bounded deadline-guard owner executor required')
    await executeAsExistingGuardOwner(fresh.protectedGuardUpgradeSql)
  }
  for (const statement of fresh.statements) await execute(statement)
  const failures = businessSessionPolicyViolations(await execute(BUSINESS_SESSION_POLICY_QUERY))
  failures.push(
    ...deadlineSessionGuardViolations(
      await execute(DEADLINE_SESSION_GUARD_QUERY),
      BUSINESS_SESSION_POLICY,
      BUSINESS_SESSION_CATALOG_PREDICATE,
    ),
  )
  if (failures.length)
    throw new Error(`Business session repair verification failed: ${failures.join('; ')}`)
  return {
    policy: BUSINESS_SESSION_POLICY,
    inspectedRelations: fresh.inspectedRelations,
    addedPolicies: fresh.statements.length,
    upgradedProtectedGuards: fresh.protectedGuardUpgradeSql ? 1 : 0,
  }
}
