/**
 * Prints the reviewed storage-authority manifest as JSON on stdout.
 * The bootstrap privilege preflight imports this projection at runtime.
 * It does not write a second registry and it does not emit migration SQL.
 */
import { storageAuthorityManifest } from '../../apps/union-eyes/db/rls-storage-authority/index'

const rows = storageAuthorityManifest.map((entry) => ({
  table: entry.table,
  classification: entry.classification,
  runtime: entry.requiredRuntimePrivileges,
  system: entry.requiredSystemPrivileges,
  scopeDisposition: entry.scopeDisposition ?? null,
  frameworkRolePrivileges: entry.frameworkRolePrivileges ?? [],
}))

process.stdout.write(`${JSON.stringify(rows)}\n`)
