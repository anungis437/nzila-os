import { describe, expect, it } from 'vitest'
import {
  FUNCTION_OWNER_ROLES,
  ISOLATED_EXTERNAL_READ_OWNER,
  transformReceiptDump,
  transformSchemaDump,
} from './prepare-bootstrap-restore'

const dump = [
  '--',
  '-- PostgreSQL database dump',
  '--',
  '',
  '\\restrict abc123',
  '',
  'SET statement_timeout = 0;',
  'CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;',
  'CREATE SCHEMA user_management;',
  'ALTER SCHEMA user_management OWNER TO ue_v2_owner;',
  'CREATE TABLE public.t (id int);',
  '',
  '\\unrestrict abc123',
  '',
].join('\n')

describe('bootstrap restore transform', () => {
  it('removes the extension, restores as the owner, and grants then revokes CREATE', () => {
    const out = transformSchemaDump(dump)
    const lines = out.split('\n')
    expect(out).not.toContain('CREATE EXTENSION')
    const restrict = lines.indexOf('\\restrict abc123')
    // The isolated external-read owner is granted to ue_v2_owner (SET only) by the operator login,
    // then the restore runs as ue_v2_owner.
    expect(lines[restrict + 1]).toContain(`GRANT ${ISOLATED_EXTERNAL_READ_OWNER} TO ue_v2_owner WITH ADMIN FALSE,INHERIT FALSE,SET TRUE`)
    expect(lines[restrict + 2]).toBe('SET ROLE ue_v2_owner;')
    for (const role of FUNCTION_OWNER_ROLES) {
      expect(out).toContain(role)
    }
    const grantPublic = lines.findIndex((l) => l.startsWith('GRANT CREATE ON SCHEMA public'))
    const grantUm = lines.findIndex((l) => l.startsWith('GRANT CREATE ON SCHEMA user_management'))
    const revokePublic = lines.findIndex((l) => l.startsWith('REVOKE CREATE ON SCHEMA public'))
    const revokeUm = lines.findIndex((l) => l.startsWith('REVOKE CREATE ON SCHEMA user_management'))
    const unrestrict = lines.findIndex((l) => l.startsWith('\\unrestrict'))
    expect(grantPublic).toBeGreaterThan(-1)
    expect(grantUm).toBeGreaterThan(
      lines.indexOf('ALTER SCHEMA user_management OWNER TO ue_v2_owner;') - 1,
    )
    // every grant is revoked before the dump ends
    expect(revokePublic).toBeGreaterThan(grantPublic)
    expect(revokeUm).toBeGreaterThan(grantUm)
    expect(unrestrict).toBeGreaterThan(revokeUm)
    // The external-read owner's CREATE and membership are restore-only too.
    expect(lines[grantPublic]).toContain(ISOLATED_EXTERNAL_READ_OWNER)
    expect(lines[revokePublic]).toContain(ISOLATED_EXTERNAL_READ_OWNER)
    const reset = lines.indexOf('RESET ROLE;')
    const revokeMembership = lines.indexOf(`REVOKE ${ISOLATED_EXTERNAL_READ_OWNER} FROM ue_v2_owner;`)
    expect(reset).toBeGreaterThan(revokeUm)
    expect(revokeMembership).toBe(reset + 1)
    expect(unrestrict).toBe(revokeMembership + 1)
  })

  it('applies ACLs of objects owned by the isolated external-read role as that role', () => {
    const fn = 'public.ue_external_payload_valid(payload jsonb)'
    const withExternal = dump.replace(
      'CREATE TABLE public.t (id int);',
      [
        'CREATE TABLE public.t (id int);',
        `ALTER FUNCTION ${fn} OWNER TO ${ISOLATED_EXTERNAL_READ_OWNER};`,
        '--',
        `-- Name: FUNCTION ue_external_payload_valid(payload jsonb); Type: ACL; Schema: public; Owner: ${ISOLATED_EXTERNAL_READ_OWNER}`,
        '--',
        '',
        `REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC;`,
        `GRANT ALL ON FUNCTION ${fn} TO ${ISOLATED_EXTERNAL_READ_OWNER};`,
        '',
        '--',
        '-- Name: TABLE t; Type: ACL; Schema: public; Owner: ue_v2_owner',
        '--',
        '',
        'GRANT SELECT ON TABLE public.t TO union_eyes_runtime;',
      ].join('\n'),
    )
    const lines = transformSchemaDump(withExternal).split('\n')
    const enter = lines.indexOf(`SET ROLE ${ISOLATED_EXTERNAL_READ_OWNER};`)
    const revoke = lines.indexOf(`REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC;`)
    const grant = lines.indexOf(`GRANT ALL ON FUNCTION ${fn} TO ${ISOLATED_EXTERNAL_READ_OWNER};`)
    const tableHeader = lines.findIndex((l) => l.startsWith('-- Name: TABLE t; Type: ACL'))
    expect(enter).toBeGreaterThan(-1)
    expect(revoke).toBeGreaterThan(enter)
    expect(grant).toBeGreaterThan(revoke)
    // The next TOC entry, owned by ue_v2_owner, is applied as ue_v2_owner again.
    expect(lines[tableHeader - 1]).toBe('SET ROLE ue_v2_owner;')
    expect(lines.slice(grant, tableHeader).filter((l) => l.startsWith('SET ROLE')).length).toBe(1)
    // An external-owned ACL entry that is the dump's last entry is closed before the CREATE revokes.
    const last = dump.replace(
      'CREATE TABLE public.t (id int);',
      [
        `ALTER FUNCTION ${fn} OWNER TO ${ISOLATED_EXTERNAL_READ_OWNER};`,
        `-- Name: FUNCTION ue_external_payload_valid(payload jsonb); Type: ACL; Schema: public; Owner: ${ISOLATED_EXTERNAL_READ_OWNER}`,
        `REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC;`,
      ].join('\n'),
    )
    const lastLines = transformSchemaDump(last).split('\n')
    const revokeCreate = lastLines.findIndex((l) => l.startsWith('REVOKE CREATE ON SCHEMA public'))
    expect(lastLines[revokeCreate - 1]).toBe('SET ROLE ue_v2_owner;')
    // Externally owned objects with no owner-applied ACL entry are refused, not restored with defaults.
    expect(() =>
      transformSchemaDump(
        dump.replace('CREATE TABLE public.t (id int);', `ALTER FUNCTION ${fn} OWNER TO ${ISOLATED_EXTERNAL_READ_OWNER};`),
      ),
    ).toThrow(/WITHOUT_OWNER_ACLS/)
  })

  it('refuses a dump with CRLF endings, which corrupts function bodies', () => {
    expect(() => transformSchemaDump(dump.replace(/\n/g, '\r\n'))).toThrow(/CRLF/)
    expect(() => transformReceiptDump('\\restrict x\r\n')).toThrow(/CRLF/)
  })

  it('fails loudly when the dump does not have the expected shape', () => {
    expect(() =>
      transformSchemaDump(
        dump.replace('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;', ''),
      ),
    ).toThrow(/EXTENSION/)
    expect(() =>
      transformSchemaDump(dump.replace('ALTER SCHEMA user_management OWNER TO ue_v2_owner;', '')),
    ).toThrow(/USER_MANAGEMENT/)
    expect(() => transformSchemaDump(dump.replace('\\unrestrict abc123', ''))).toThrow(/RESTRICT/)
  })

  it('prepares the receipt restore to run as the owner', () => {
    expect(transformReceiptDump('\\restrict r\nINSERT 1;\n\\unrestrict r\n')).toContain(
      'SET ROLE ue_v2_owner;',
    )
  })
  it('accepts a no-vector plan only when it explicitly expects no extension and rejects unexpected provisioning', () => {
    const withoutVector = dump.replace('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;', '')
    expect(transformSchemaDump(withoutVector, { vectorExtensionExpected: false })).toContain('SET ROLE ue_v2_owner;')
    expect(() => transformSchemaDump(dump, { vectorExtensionExpected: false })).toThrow(/EXTENSION_COUNT/)
    expect(() => transformSchemaDump(withoutVector)).toThrow(/EXTENSION_COUNT/)
  })
})
