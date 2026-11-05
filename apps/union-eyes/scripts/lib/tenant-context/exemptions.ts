/**
 * Statements that run on the ambient database handle outside a tenant or system transaction, and are correct there (UE-CONV-H-019).
 *
 * The census (scripts/runtime/tenant-context-census.ts) fails on every statement that can reach the ambient handle with no context, because outside a
 * transaction the runtime role has no organization and shows a tenant table as empty. A statement belongs here only when running on that handle IS what it is
 * for: it must say what it reads and why that is the right handle, and the census fails on an entry that matches no finding (a stale exemption hides nothing but
 * also proves nothing). Not an exemption: a route that "only reads a little", a helper that is "always called inside a context" (say so to the census by calling
 * it inside one), or a table that "is not very sensitive".
 */
export interface AmbientExemption {
  /** The top-level declaration the statement is written in: `relative/file.ts#name`. */
  declaration: string
  /** The method called on the handle (`select`, `execute`, ...). */
  method: string
  /** Why the ambient handle is the right one for this statement. */
  reason: string
}

export const AMBIENT_EXEMPTIONS: readonly AmbientExemption[] = [
  {
    declaration: 'app/api/admin/database/health/route.ts#readPrincipal',
    method: 'execute',
    reason:
      'The route reports which database role the ambient (tenant) connection really uses: current_user and that role\'s attributes in pg_roles. The ambient handle is the thing being measured; running it inside a tenant or system transaction would measure a different connection.',
  },
  {
    declaration: 'lib/ai/vector-readiness.ts#vectorColumnReady',
    method: 'passed',
    reason:
      'The probe asks the database whether the pgvector extension and an embedding column exist: it reads only the system catalogs (pg_extension, pg_attribute, pg_class, pg_namespace, pg_type), which every role may read and row-level security never applies to, and it touches no application table. It runs before the query text is sent to the embedding service and, by design, outside any transaction (none is held across that network call), so the pooled handle with no organization is the right one; a tenant or system transaction would add a connection and a role for a read that needs neither. The census sees the `db` default of the executor parameter and cannot see that the statement is catalog-only.',
  },
  {
    declaration: 'lib/ai/vector-readiness.ts#requireVectorColumn',
    method: 'passed',
    reason:
      'requireVectorColumn only forwards its executor to vectorColumnReady (see that entry): the same catalog-only probe on the pooled handle, with no organization and no transaction by design.',
  },
]

/** Splits findings into those an exemption accounts for and those it does not, and names the exemptions that account for none. */
export function applyExemptions<T extends { declaration: string; method: string }>(
  findings: readonly T[],
  exemptions: readonly AmbientExemption[] = AMBIENT_EXEMPTIONS,
): { open: T[]; exempt: T[]; stale: AmbientExemption[] } {
  const used = new Set<AmbientExemption>()
  const open: T[] = []
  const exempt: T[] = []
  for (const finding of findings) {
    const match = exemptions.find((entry) => entry.declaration === finding.declaration && entry.method === finding.method)
    if (match) {
      used.add(match)
      exempt.push(finding)
    } else open.push(finding)
  }
  return { open, exempt, stale: exemptions.filter((entry) => !used.has(entry)) }
}

/**
 * A statement that runs as a role the manifest has not granted what it does, and is correct anyway.
 *
 * The census judges every statement some entry point runs against `requiredRuntimePrivileges` / `requiredSystemPrivileges` of the storage-authority manifest (the
 * input to the GRANTs), so a finding is a statement the database would answer "permission denied". The fix is almost never an exemption: either the code is wrong
 * (it runs as the wrong role, or does something to the table that no role may), or the manifest is (the privilege is needed and was never declared: declare it with
 * its evidence in db/rls-storage-authority and the GRANT follows). An entry here is for the statement the census cannot see is safe: say why.
 */
export interface PrivilegeExemption {
  declaration: string
  table: string
  operation: string
  principal: 'RUNTIME' | 'SYSTEM'
  reason: string
}

export const PRIVILEGE_EXEMPTIONS: readonly PrivilegeExemption[] = []

export function applyPrivilegeExemptions<T extends { declaration: string; table: string; operation: string; principal: string }>(
  findings: readonly T[],
  exemptions: readonly PrivilegeExemption[] = PRIVILEGE_EXEMPTIONS,
): { open: T[]; exempt: T[]; stale: PrivilegeExemption[] } {
  const used = new Set<PrivilegeExemption>()
  const open: T[] = []
  const exempt: T[] = []
  for (const finding of findings) {
    const match = exemptions.find((entry) => entry.declaration === finding.declaration && entry.table === finding.table && entry.operation === finding.operation && entry.principal === finding.principal)
    if (match) {
      used.add(match)
      exempt.push(finding)
    } else open.push(finding)
  }
  return { open, exempt, stale: exemptions.filter((entry) => !used.has(entry)) }
}
