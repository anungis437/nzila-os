import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../..')
const authority = readFileSync(resolve(root, 'tooling/scripts/lib/union-eyes-catalog-authority.mjs'), 'utf8')
const contract = JSON.parse(readFileSync(resolve(root, 'apps/union-eyes/lib/operations/catalog-authority-contract.json'), 'utf8'))
const migration = readFileSync(resolve(root, 'apps/union-eyes/db/migrations-cache/0045_audit_security_runtime_read.sql'), 'utf8')
const rollback = readFileSync(resolve(root, 'apps/union-eyes/db/migrations-cache/0045_audit_security_runtime_read.rollback.sql'), 'utf8')

describe('legacy audit reader authority contract after scoped migration 0045', () => {
  it('reconciles the physical scoped SELECT grant with the exact bootstrap privilege manifest', () => {
    expect(authority).toContain("{ schema: 'audit_security', table: 'audit_logs', runtime: ['SELECT', 'INSERT'], system: [] }")
    const row = contract.payload.nonPublic.find((entry: { schema: string; table: string }) =>
      entry.schema === 'audit_security' && entry.table === 'audit_logs')
    expect(row).toEqual({ schema: 'audit_security', table: 'audit_logs', runtime: ['SELECT', 'INSERT'], system: [] })
    expect(contract.digest).toBe(createHash('sha256').update(JSON.stringify(contract.payload)).digest('hex'))
  })

  it('grants tenant-limited read but not modification or cross-tenant visibility', () => {
    expect(migration).toMatch(/CREATE POLICY ue_runtime_audit_select ON audit_security\.audit_logs\s+FOR SELECT TO union_eyes_runtime/)
    expect(migration).toContain("organization_id::text = current_setting('app.current_org_id', true)")
    expect(migration).toContain('organization_id IS NOT NULL')
    expect(migration).toContain('GRANT SELECT ON TABLE audit_security.audit_logs TO union_eyes_runtime')
    expect(migration).not.toMatch(/GRANT (UPDATE|DELETE|TRUNCATE) ON TABLE audit_security\.audit_logs TO union_eyes_runtime/)
    expect(rollback).toContain('REVOKE SELECT ON TABLE audit_security.audit_logs FROM union_eyes_runtime')
  })
})
