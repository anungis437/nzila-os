import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AMBIENT_EXEMPTIONS, PRIVILEGE_EXEMPTIONS, applyExemptions, applyPrivilegeExemptions, type AmbientExemption, type PrivilegeExemption } from '../lib/tenant-context/exemptions'

const finding = (declaration: string, method: string) => ({ declaration, method, file: declaration.split('#')[0] })

describe('the exemptions to the tenant-context census', () => {
  const register: AmbientExemption[] = [
    { declaration: 'lib/a.ts#measure', method: 'execute', reason: 'measures the ambient connection itself' },
    { declaration: 'lib/b.ts#gone', method: 'select', reason: 'a statement that no longer exists' },
  ]

  it('accounts for a finding by its declaration and its method, and for nothing else', () => {
    const { open, exempt } = applyExemptions([finding('lib/a.ts#measure', 'execute'), finding('lib/a.ts#measure', 'select'), finding('lib/c.ts#measure', 'execute')], register)
    expect(exempt.map((entry) => `${entry.declaration} ${entry.method}`)).toEqual(['lib/a.ts#measure execute'])
    expect(open.map((entry) => `${entry.declaration} ${entry.method}`)).toEqual(['lib/a.ts#measure select', 'lib/c.ts#measure execute'])
  })

  it('names an exemption that accounts for no finding: it hides nothing, and it proves nothing', () => {
    const { stale } = applyExemptions([finding('lib/a.ts#measure', 'execute')], register)
    expect(stale.map((entry) => entry.declaration)).toEqual(['lib/b.ts#gone'])
  })

  it('holds only entries that say what the statement is for, in a file that exists', () => {
    expect(AMBIENT_EXEMPTIONS.length).toBeGreaterThan(0)
    for (const entry of AMBIENT_EXEMPTIONS) {
      expect(entry.reason.length, entry.declaration).toBeGreaterThan(60)
      expect(existsSync(path.resolve(__dirname, '..', '..', entry.declaration.split('#')[0])), entry.declaration).toBe(true)
    }
    expect(new Set(AMBIENT_EXEMPTIONS.map((entry) => `${entry.declaration} ${entry.method}`)).size).toBe(AMBIENT_EXEMPTIONS.length)
  })
})

describe('the privilege exemptions', () => {
  const entry = (declaration: string, table: string, operation: string, principal: 'RUNTIME' | 'SYSTEM'): PrivilegeExemption => ({ declaration, table, operation, principal, reason: 'a statement the census cannot see is safe' })
  const denied = (declaration: string, table: string, operation: string, principal: string) => ({ declaration, table, operation, principal })

  it('accounts for a finding by its declaration, table, operation and role, and for nothing else', () => {
    const register = [entry('lib/a.ts#run', 'things', 'DELETE', 'RUNTIME')]
    const { open, exempt } = applyPrivilegeExemptions(
      [denied('lib/a.ts#run', 'things', 'DELETE', 'RUNTIME'), denied('lib/a.ts#run', 'things', 'DELETE', 'SYSTEM'), denied('lib/a.ts#run', 'things', 'UPDATE', 'RUNTIME'), denied('lib/a.ts#run', 'parts', 'DELETE', 'RUNTIME'), denied('lib/b.ts#run', 'things', 'DELETE', 'RUNTIME')],
      register,
    )
    expect(exempt).toHaveLength(1)
    expect(open).toHaveLength(4)
  })

  it('names an exemption that accounts for no finding', () => {
    const register = [entry('lib/a.ts#run', 'things', 'DELETE', 'RUNTIME'), entry('lib/gone.ts#run', 'things', 'DELETE', 'RUNTIME')]
    expect(applyPrivilegeExemptions([denied('lib/a.ts#run', 'things', 'DELETE', 'RUNTIME')], register).stale.map((stale) => stale.declaration)).toEqual(['lib/gone.ts#run'])
  })

  it('holds only entries that say why the statement is right, in a file that exists', () => {
    for (const exemption of PRIVILEGE_EXEMPTIONS) {
      expect(exemption.reason.length, exemption.declaration).toBeGreaterThan(60)
      expect(existsSync(path.resolve(__dirname, '..', '..', exemption.declaration.split('#')[0])), exemption.declaration).toBe(true)
    }
    expect(new Set(PRIVILEGE_EXEMPTIONS.map((exemption) => `${exemption.declaration} ${exemption.principal} ${exemption.operation} ${exemption.table}`)).size).toBe(PRIVILEGE_EXEMPTIONS.length)
  })
})
