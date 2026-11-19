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
 *     and revokes it again before the dump ends,
 *   - gives ue_v2_owner a SET-only membership in the isolated external-read owner and that role CREATE on
 *     public for the restore only (PostgreSQL 16 requires both to hand it function ownership), then
 *     revokes both before the dump ends, exactly as the installer's external-read finalization does,
 *   - applies every ACL entry pg_dump lists as owned by that isolated role while SET to that role, as the
 *     installer does: the SET-only membership confers none of the owner's privileges, so the dump's
 *     REVOKE/GRANT run as ue_v2_owner would only warn and leave PUBLIC EXECUTE on SECURITY DEFINER code.
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
export const ISOLATED_EXTERNAL_READ_OWNER = 'ue_external_read_reader'
const EXTERNAL_OWNER_SET_GRANT = `DO $ue_restore_external$ BEGIN IF current_setting('server_version_num')::integer>=160000 THEN EXECUTE 'GRANT ${ISOLATED_EXTERNAL_READ_OWNER} TO ue_v2_owner WITH ADMIN FALSE,INHERIT FALSE,SET TRUE'; ELSE GRANT ${ISOLATED_EXTERNAL_READ_OWNER} TO ue_v2_owner; END IF; END $ue_restore_external$;`
const EXTENSION_LINE = 'CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;'
const TOC_HEADER = /^-- Name: .*; Type: [A-Z ]+; Schema: [^;]*; Owner: [^;]*$/
const EXTERNAL_OWNED_ACL_HEADER = new RegExp(`^-- Name: .*; Type: ACL; Schema: [^;]*; Owner: ${ISOLATED_EXTERNAL_READ_OWNER}$`)

export function transformSchemaDump(
  dump: string,
  options: { vectorExtensionExpected?: boolean } = {},
): string {
  if (dump.includes('\r'))
    throw new Error('UE_RESTORE_DUMP_HAS_CRLF: the dump must keep LF line endings')
  const out: string[] = []
  let extensionLines = 0
  let restrictSeen = 0
  let userManagementSeen = 0
  let unrestrictSeen = 0
  let externalAclOpen = false
  let externalAclEntries = 0
  for (const line of dump.split('\n')) {
    if (externalAclOpen && (TOC_HEADER.test(line) || line.startsWith('\\unrestrict'))) {
      out.push('SET ROLE ue_v2_owner;')
      externalAclOpen = false
    }
    if (line === EXTENSION_LINE) {
      extensionLines++
      continue
    }
    if (line.startsWith('\\unrestrict')) {
      unrestrictSeen++
      out.push(`REVOKE CREATE ON SCHEMA public FROM ${roles},${ISOLATED_EXTERNAL_READ_OWNER};`)
      out.push(`REVOKE CREATE ON SCHEMA user_management FROM ${roles};`)
      out.push('RESET ROLE;')
      out.push(`REVOKE ${ISOLATED_EXTERNAL_READ_OWNER} FROM ue_v2_owner;`)
    }
    out.push(line)
    if (line.startsWith('\\restrict')) {
      restrictSeen++
      out.push(EXTERNAL_OWNER_SET_GRANT)
      out.push('SET ROLE ue_v2_owner;')
      out.push(`GRANT CREATE ON SCHEMA public TO ${roles},${ISOLATED_EXTERNAL_READ_OWNER};`)
    }
    if (EXTERNAL_OWNED_ACL_HEADER.test(line)) {
      externalAclEntries++
      externalAclOpen = true
      out.push(`SET ROLE ${ISOLATED_EXTERNAL_READ_OWNER};`)
    }
    if (line === 'ALTER SCHEMA user_management OWNER TO ue_v2_owner;') {
      userManagementSeen++
      out.push(`GRANT CREATE ON SCHEMA user_management TO ${roles};`)
    }
  }
  const expectedExtensionLines = options.vectorExtensionExpected === false ? 0 : 1
  if (extensionLines !== expectedExtensionLines)
    throw new Error(`UE_RESTORE_VECTOR_EXTENSION_COUNT (expected ${expectedExtensionLines}, found ${extensionLines})`)
  if (restrictSeen !== 1 || unrestrictSeen !== 1)
    throw new Error('UE_RESTORE_EXPECTED_ONE_RESTRICT_MARKER_PAIR')
  if (userManagementSeen !== 1)
    throw new Error('UE_RESTORE_EXPECTED_ONE_USER_MANAGEMENT_OWNER_LINE')
  if (externalAclOpen) throw new Error('UE_RESTORE_EXTERNAL_ACL_SECTION_UNTERMINATED')
  const externalOwnedObjects = dump
    .split('\n')
    .filter((line) => new RegExp(` OWNER TO ${ISOLATED_EXTERNAL_READ_OWNER};$`).test(line)).length
  if (externalOwnedObjects > 0 && externalAclEntries === 0)
    throw new Error('UE_RESTORE_EXTERNAL_OWNED_OBJECTS_WITHOUT_OWNER_ACLS')
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
