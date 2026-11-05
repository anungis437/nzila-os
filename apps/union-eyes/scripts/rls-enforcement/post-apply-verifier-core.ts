/**
 * scripts/rls-enforcement/post-apply-verifier-core.ts
 *
 * Decision logic and catalog observation for the read-only post-apply verifier
 * (post-apply-verifier.ts is the command-line entry point). No writes, ever.
 *
 * The expectation for every table is derived from its manifest entry, which is the single source of truth:
 *   - privileges: the effective privileges of union_eyes_runtime and union_eyes_system equal
 *     requiredRuntimePrivileges / requiredSystemPrivileges exactly, in both directions;
 *   - row-level security: for classes that own an RLS contract, RLS is enabled and forced, and every command a role is
 *     privileged to run is covered by a permissive policy that applies to that role.
 *
 * Policy coverage follows the privileges rather than a fixed four-command shape, because append-only and read-only
 * tables are granted fewer commands on purpose: a command with neither a privilege nor a policy is denied twice over.
 * Classes owned by a dedicated execution context (the Django framework role, platform metadata) have no runtime or
 * system RLS contract, so only their privileges are compared.
 */
import type { RuntimeOperation, StorageAuthorityClassification } from '../../db/rls-storage-authority/index'

export const OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const satisfies readonly RuntimeOperation[]
export const RUNTIME_ROLE = 'union_eyes_runtime'
export const SYSTEM_ROLE = 'union_eyes_system'

type Treatment = 'RLS_CONTRACT' | 'DEDICATED_CONTEXT' | 'NO_CONTRACT'

/**
 * Exhaustive over the manifest's classification vocabulary: a classification added to the manifest without deciding
 * its treatment here fails typecheck, which is how the verifier previously drifted out of date unnoticed.
 */
export const CLASSIFICATION_TREATMENT: Record<StorageAuthorityClassification, Treatment> = {
  TENANT_RLS_REQUIRED: 'RLS_CONTRACT',
  USER_RLS_REQUIRED: 'RLS_CONTRACT',
  PARENT_OWNED_RLS_REQUIRED: 'RLS_CONTRACT',
  MIXED_GLOBAL_TENANT_RLS_REQUIRED: 'RLS_CONTRACT',
  MULTI_PARTY_RLS_REQUIRED: 'RLS_CONTRACT',
  SYSTEM_ONLY: 'RLS_CONTRACT',
  // A failing classification everywhere else; it is never silently exempt here.
  NEEDS_REVIEW: 'RLS_CONTRACT',
  FRAMEWORK_DEDICATED_EXECUTION_CONTEXT: 'DEDICATED_CONTEXT',
  PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT: 'DEDICATED_CONTEXT',
  GLOBAL_REFERENCE_DATA: 'NO_CONTRACT',
  APP_SCOPED_NON_SENSITIVE: 'NO_CONTRACT',
  SEPARATE_DATABASE_BOUNDARY: 'NO_CONTRACT',
  LATENT_UNREACHABLE: 'NO_CONTRACT',
  CONTAINED_NO_AUTHORITY: 'NO_CONTRACT',
}

export interface ManifestEntryLike {
  table: string
  classification: StorageAuthorityClassification
  requiredRuntimePrivileges?: readonly RuntimeOperation[] | 'TBD'
  requiredSystemPrivileges?: readonly RuntimeOperation[] | 'TBD'
}

export interface ObservedPolicy {
  roles: readonly string[]
  command: RuntimeOperation | 'ALL'
  permissive: boolean
}

export interface ObservedTable {
  rlsEnabled: boolean
  rlsForced: boolean
  policies: readonly ObservedPolicy[]
  runtimePrivileges: ReadonlySet<RuntimeOperation>
  systemPrivileges: ReadonlySet<RuntimeOperation>
}

export interface Diff {
  kind: 'MISSING' | 'EXTRA'
  text: string
}

// An unrecognised classification is treated as owning an RLS contract, never as exempt.
const treatmentOf = (classification: string): Treatment =>
  (CLASSIFICATION_TREATMENT as Record<string, Treatment>)[classification] ?? 'RLS_CONTRACT'

export function isInScope(entry: Pick<ManifestEntryLike, 'classification'>): boolean {
  return treatmentOf(entry.classification) !== 'NO_CONTRACT'
}

export function requiresRowLevelSecurity(classification: string): boolean {
  return treatmentOf(classification) === 'RLS_CONTRACT'
}

export function privilegeSet(value: readonly RuntimeOperation[] | 'TBD' | undefined): ReadonlySet<RuntimeOperation> {
  return new Set(value === 'TBD' || value === undefined ? [] : value)
}

/** A permissive policy applies to a role when it names the role or is granted to PUBLIC (no role list, shown as "-"). */
export function policyCoverage(policies: readonly ObservedPolicy[], role: string): ReadonlySet<RuntimeOperation> {
  const covered = new Set<RuntimeOperation>()
  for (const policy of policies) {
    if (!policy.permissive) continue
    if (!policy.roles.some((r) => r === role || r === '-' || r === 'public')) continue
    if (policy.command === 'ALL') OPERATIONS.forEach((op) => covered.add(op))
    else covered.add(policy.command)
  }
  return covered
}

export function evaluateTable(entry: ManifestEntryLike, observed: ObservedTable): Diff[] {
  const diffs: Diff[] = []
  const missing = (text: string) => diffs.push({ kind: 'MISSING', text })
  const extra = (text: string) => diffs.push({ kind: 'EXTRA', text })
  const runtimeWanted = privilegeSet(entry.requiredRuntimePrivileges)
  const systemWanted = privilegeSet(entry.requiredSystemPrivileges)

  if (requiresRowLevelSecurity(entry.classification)) {
    if (!observed.rlsEnabled) missing(`${entry.table} RLS not enabled`)
    if (!observed.rlsForced) missing(`${entry.table} FORCE RLS not enabled`)
    for (const [role, wanted] of [[RUNTIME_ROLE, runtimeWanted], [SYSTEM_ROLE, systemWanted]] as const) {
      const covered = policyCoverage(observed.policies, role)
      for (const op of OPERATIONS) {
        if (wanted.has(op) && !covered.has(op)) missing(`${entry.table} ${role} is privileged to ${op} but no permissive ${op} policy applies to it`)
      }
    }
  }

  for (const [role, wanted, held] of [
    [RUNTIME_ROLE, runtimeWanted, observed.runtimePrivileges],
    [SYSTEM_ROLE, systemWanted, observed.systemPrivileges],
  ] as const) {
    for (const op of OPERATIONS) {
      if (wanted.has(op) && !held.has(op)) missing(`${role} ${op} on ${entry.table}`)
      if (!wanted.has(op) && held.has(op)) extra(`${role} ${op} on ${entry.table}`)
    }
  }
  return diffs
}

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

const COMMAND_BY_CODE: Record<string, ObservedPolicy['command']> = { r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE', '*': 'ALL' }

const OBSERVE_SQL = `
  SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('roles', p.polroles::regrole[]::text[], 'cmd', p.polcmd::text, 'permissive', p.polpermissive))
              FROM pg_policy p WHERE p.polrelid = c.oid), '[]'::jsonb) AS policies,
    (SELECT jsonb_object_agg(r.role || ':' || o.op, has_table_privilege(r.role, c.oid, o.op))
       FROM (VALUES ('${RUNTIME_ROLE}'), ('${SYSTEM_ROLE}')) AS r(role)
       CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS o(op)) AS privileges
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r', 'p')`

export async function observeTable(db: Queryable, table: string): Promise<ObservedTable | null> {
  const { rows } = await db.query(OBSERVE_SQL, [table])
  if (rows.length === 0) return null
  const row = rows[0] as {
    rls: boolean
    forced: boolean
    policies: Array<{ roles: string[]; cmd: string; permissive: boolean }>
    privileges: Record<string, boolean>
  }
  const held = (role: string) => new Set(OPERATIONS.filter((op) => row.privileges[`${role}:${op}`]))
  return {
    rlsEnabled: row.rls,
    rlsForced: row.forced,
    policies: row.policies.map((p) => ({ roles: p.roles, command: COMMAND_BY_CODE[p.cmd] ?? 'ALL', permissive: p.permissive })),
    runtimePrivileges: held(RUNTIME_ROLE),
    systemPrivileges: held(SYSTEM_ROLE),
  }
}

export interface VerificationReport {
  checked: string[]
  skipped: string[]
  missing: number
  extra: number
  diffs: Diff[]
}

export async function verifyEntries(db: Queryable, entries: readonly ManifestEntryLike[]): Promise<VerificationReport> {
  const report: VerificationReport = { checked: [], skipped: [], missing: 0, extra: 0, diffs: [] }
  for (const entry of entries) {
    if (!isInScope(entry)) continue
    const observed = await observeTable(db, entry.table)
    if (!observed) {
      report.skipped.push(entry.table)
      continue
    }
    report.checked.push(entry.table)
    for (const diff of evaluateTable(entry, observed)) {
      report.diffs.push(diff)
      if (diff.kind === 'MISSING') report.missing++
      else report.extra++
    }
  }
  return report
}
