/**
 * Prepares the qualified Canonical Bootstrap V2 export for restore into a managed PostgreSQL server.
 *
 *   tsx scripts/production/prepare-bootstrap-restore.ts <export-dir>
 *
 * Reads <export-dir>/schema.sql and receipt.sql (written by scripts/staging/export-v2-schema.ts) and
 * writes schema-restore.sql and receipt-restore.sql next to them. The transform is exactly what was
 * proven on the Azure staging restore (LF line endings are required; never rewrite these files with a
 * tool that converts to CRLF):
 *   - drops "CREATE EXTENSION vector" (the operator creates it; the platform owns that extension),
 *   - restores as the schema owner (SET ROLE ue_v2_owner),
 *   - grants CREATE on public and user_management to the four function-owner roles for the restore only
 *     and revokes it again before the dump ends.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const FUNCTION_OWNER_ROLES = [
  'nzila_auth_org_authority_reader',
  'nzila_auth_provider_reader',
  'nzila_auth_risk_aggregate',
  'ue_framework_authority_reader',
] as const
const roles = FUNCTION_OWNER_ROLES.join(',')
const EXTENSION_LINE = 'CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;'

export function transformSchemaDump(dump: string): string {
  if (dump.includes('\r'))
    throw new Error('UE_RESTORE_DUMP_HAS_CRLF: the dump must keep LF line endings')
  const out: string[] = []
  let extensionLines = 0
  let restrictSeen = 0
  let userManagementSeen = 0
  let unrestrictSeen = 0
  for (const line of dump.split('\n')) {
    if (line === EXTENSION_LINE) {
      extensionLines++
      continue
    }
    if (line.startsWith('\\unrestrict')) {
      unrestrictSeen++
      out.push(`REVOKE CREATE ON SCHEMA public FROM ${roles};`)
      out.push(`REVOKE CREATE ON SCHEMA user_management FROM ${roles};`)
    }
    out.push(line)
    if (line.startsWith('\\restrict')) {
      restrictSeen++
      out.push('SET ROLE ue_v2_owner;')
      out.push(`GRANT CREATE ON SCHEMA public TO ${roles};`)
    }
    if (line === 'ALTER SCHEMA user_management OWNER TO ue_v2_owner;') {
      userManagementSeen++
      out.push(`GRANT CREATE ON SCHEMA user_management TO ${roles};`)
    }
  }
  if (extensionLines !== 1)
    throw new Error(`UE_RESTORE_EXPECTED_ONE_VECTOR_EXTENSION_LINE (found ${extensionLines})`)
  if (restrictSeen !== 1 || unrestrictSeen !== 1)
    throw new Error('UE_RESTORE_EXPECTED_ONE_RESTRICT_MARKER_PAIR')
  if (userManagementSeen !== 1)
    throw new Error('UE_RESTORE_EXPECTED_ONE_USER_MANAGEMENT_OWNER_LINE')
  return out.join('\n')
}

export function transformReceiptDump(dump: string): string {
  if (dump.includes('\r'))
    throw new Error('UE_RESTORE_DUMP_HAS_CRLF: the dump must keep LF line endings')
  const out: string[] = []
  let restrictSeen = 0
  for (const line of dump.split('\n')) {
    out.push(line)
    if (line.startsWith('\\restrict')) {
      restrictSeen++
      out.push('SET ROLE ue_v2_owner;')
    }
  }
  if (restrictSeen !== 1) throw new Error('UE_RESTORE_EXPECTED_ONE_RESTRICT_MARKER')
  return out.join('\n')
}

function main() {
  const dir = process.argv[2]
  if (!dir) throw new Error('export directory required')
  const schema = transformSchemaDump(readFileSync(path.join(dir, 'schema.sql'), 'utf8'))
  const receipt = transformReceiptDump(readFileSync(path.join(dir, 'receipt.sql'), 'utf8'))
  writeFileSync(path.join(dir, 'schema-restore.sql'), schema)
  writeFileSync(path.join(dir, 'receipt-restore.sql'), receipt)
  process.stdout.write(
    `${JSON.stringify({ schemaRestoreBytes: schema.length, receiptRestoreBytes: receipt.length })}\n`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
