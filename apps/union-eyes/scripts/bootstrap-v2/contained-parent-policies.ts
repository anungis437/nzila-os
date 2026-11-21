import {
  containedParentPolicyViolations,
  type CatalogRow,
  type ContainedParentPolicy,
} from '../../lib/operations/catalog-admission-core.mjs'

export type { ContainedParentPolicy }
const quoted = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`
const policyRow = (spec: ContainedParentPolicy): CatalogRow => ({
  table_name: spec.table, polname: spec.name,
  polcmd: spec.command === 'INSERT' ? 'a' : 'w', polpermissive: false,
  public_role: false, roles: spec.roles, qual: spec.using, with_check: spec.predicate,
})

/** Source-only restrictive layer: it never replaces a permissive resource filter. */
export function compileContainedParentPolicy(spec: ContainedParentPolicy): string {
  if (containedParentPolicyViolations([spec], [policyRow(spec)]).length)
    throw new Error('Invalid contained-parent source policy')
  return `CREATE POLICY ${quoted(spec.name)} ON public.${quoted(spec.table)} AS RESTRICTIVE FOR ${spec.command} TO ${spec.roles.join(', ')} ${spec.using === null ? '' : 'USING (true) '}WITH CHECK (${spec.predicate});`
}

// Inspect every base table, including a missing-policy row and collisions with
// reserved names on unrelated tables. PUBLIC must be observed independently of
// named roles because role OID zero has no pg_roles entry.
export const CONTAINED_PARENT_POLICY_QUERY = `SELECT c.relname AS table_name,
  pg_catalog.pg_get_userbyid(c.relowner) AS owner_name,c.relrowsecurity,c.relforcerowsecurity,
  p.polname,p.polcmd,p.polpermissive,0=ANY(p.polroles) AS public_role,
  ARRAY(SELECT r.rolname::text FROM pg_catalog.pg_roles r WHERE r.oid=ANY(p.polroles) ORDER BY r.rolname) AS roles,
  pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS qual,
  pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS with_check
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_catalog.pg_policy p ON p.polrelid=c.oid
    AND left(p.polname,length('ue_v2_contained_parent_'))='ue_v2_contained_parent_'
  WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname,p.polname`

export type ContainedParentInstallOptions = {
  /** Supplied by the source-admitted ownership plan, never copied from a row. */
  expectedOwner: string
  /** Historical preflight may precede source-owned ENABLE/FORCE installation. */
  requireForcedRls: boolean
}

function relationViolations(expected: readonly ContainedParentPolicy[], rows: readonly CatalogRow[], options: ContainedParentInstallOptions) {
  if (!options || !['uev2admin', 'ue_v2_owner'].includes(options.expectedOwner)
    || typeof options.requireForcedRls !== 'boolean')
    throw new Error('Source-admitted contained-parent ownership/RLS options required')
  return [...new Set(expected.map(spec => spec.table))].flatMap(table => {
    const matches = rows.filter(row => row.table_name === table)
    return matches.length && matches.every(row => row.owner_name === options.expectedOwner
      && typeof row.relrowsecurity === 'boolean' && typeof row.relforcerowsecurity === 'boolean'
      && (!options.requireForcedRls || (row.relrowsecurity === true && row.relforcerowsecurity === true)))
      ? [] : [`public.${table}: contained-parent relation owner/forced RLS is missing or changed`]
  })
}

/** Complete read-only inspector for final installation and idempotent reruns. */
export function containedParentPolicyInstallViolations(expected: ContainedParentPolicy[], rows: CatalogRow[], options: ContainedParentInstallOptions): string[] {
  const failures = containedParentPolicyViolations(expected, rows)
  if (!Array.isArray(expected)) return failures
  return [...failures, ...relationViolations(expected, rows, options)]
}

/** Caller owns transaction/locks. Missing source policies may be added; a
 * same-name difference or an undeclared reserved policy is never replaced. */
export function planContainedParentPolicyInstall(expected: ContainedParentPolicy[], rows: CatalogRow[], options: ContainedParentInstallOptions) {
  const sourceFailures = containedParentPolicyViolations(expected, Array.isArray(expected) ? expected.map(policyRow) : [])
  if (sourceFailures.length) throw new Error(sourceFailures.join('; '))
  const missing = expected.filter(spec => !rows.some(row => row.table_name === spec.table && row.polname === spec.name))
  const failures = [
    ...containedParentPolicyViolations(expected, [...rows, ...missing.map(policyRow)]),
    ...relationViolations(expected, rows, options),
  ]
  if (failures.length) throw new Error(`Contained-parent policy preimage refused: ${failures.join('; ')}`)
  return { statements: missing.map(compileContainedParentPolicy), targets: missing.map(spec => `public.${spec.table}.${spec.name}`) }
}
