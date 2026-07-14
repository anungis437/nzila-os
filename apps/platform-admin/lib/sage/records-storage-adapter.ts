/**
 * Platform Admin — SAGE export-package storage deletion adapter (server-only)
 *
 * Phase 8B destruction requires a real, verifiable object deletion. SAGE package
 * bytes are stored as immutable, content-addressed rows in
 * `sage_export_package_object` (the private object store owned by the repository).
 * This adapter DELETES those bytes and then INDEPENDENTLY verifies their absence.
 *
 * Critical safety properties:
 *   - `deleteObject()` removes the actual object bytes, not the package metadata
 *     row (the package remains as an immutable tombstone).
 *   - `deleteObject()` success is NEVER treated as proof of destruction — the
 *     service always calls `verifyObjectAbsent()` afterwards.
 *   - the raw storage reference never leaves this server-only module in any
 *     audit/evidence payload (the service persists only a hash).
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import type { SageExportPackageStorage } from '@nzila/sage-core'
import { createSagePlatformSqlClient } from './sql-adapter'

export function createSageExportPackageStorage(): SageExportPackageStorage {
  const sql = createSagePlatformSqlClient()
  return {
    async deleteObject(input) {
      try {
        // Content-addressed delete: only the exact approved object (matching
        // storage reference AND content hash) is removed. The idempotencyKey is a
        // stable per-attempt token; a repeated call for the same attempt is safe
        // because the row is already gone (returns not_found on the second call).
        void input.idempotencyKey
        const { rows } = await sql.query<{ storage_reference: string }>(
          `delete from sage_export_package_object
           where storage_reference = $1 and content_hash = $2
           returning storage_reference`,
          [input.storageReference, input.expectedContentHash],
        )
        return { result: rows.length > 0 ? 'deleted' : 'not_found', providerRequestId: input.idempotencyKey }
      } catch {
        // Never leak the provider error body; reduce to a safe code.
        return { result: 'failed', safeErrorCode: 'STORAGE_DELETE_ERROR' }
      }
    },
    async verifyObjectPresent(input) {
      const { rows } = await sql.query<{ present: boolean }>(
        `select exists (
           select 1 from sage_export_package_object where storage_reference = $1
         ) as present`,
        [input.storageReference],
      )
      return rows.length > 0 ? Boolean(rows[0].present) : false
    },
    async verifyObjectAbsent(input) {
      const { rows } = await sql.query<{ present: boolean }>(
        `select exists (
           select 1 from sage_export_package_object where storage_reference = $1
         ) as present`,
        [input.storageReference],
      )
      return rows.length === 0 ? true : !rows[0].present
    },
  }
}
