import { describe, expect, it } from 'vitest'
import {
  FUNCTION_OWNER_ROLES,
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
    expect(lines[lines.indexOf('\\restrict abc123') + 1]).toBe('SET ROLE ue_v2_owner;')
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
})
