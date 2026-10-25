import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NON_CONFERRING_KERNEL_TABLES, SUBORDINATE_AUTHORITY_REGISTER } from '../subordinate-authority-register'

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..')
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')

describe('subordinate authority register is held to the code', () => {
  it('ids are unique and every proof and consumer file exists', () => {
    const ids = SUBORDINATE_AUTHORITY_REGISTER.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of SUBORDINATE_AUTHORITY_REGISTER) {
      for (const file of [...entry.proof, ...entry.consumers]) expect(existsSync(join(ROOT, file)), `${entry.id}: ${file}`).toBe(true)
    }
  })

  it('ENFORCED and FIXED entries name a proof; OPEN entries name their residual; NO_LIVE_CONSUMER entries have no consumer of the record', () => {
    for (const entry of SUBORDINATE_AUTHORITY_REGISTER) {
      if (entry.status === 'ENFORCED' || entry.status === 'FIXED') expect(entry.proof.length, entry.id).toBeGreaterThan(0)
      if (entry.status === 'OPEN' || entry.status === 'LAYERED' || entry.status === 'OTHER_LANE') expect(entry.residual?.length ?? 0, entry.id).toBeGreaterThan(20)
      if (entry.status === 'NO_LIVE_CONSUMER') expect(entry.proof, entry.id).toEqual([])
    }
  })

  it('a proof file really exercises the gate it is cited for (it names the entry’s central behaviour)', () => {
    const needle: Record<string, RegExp> = {
      'issuance-approvals': /APPROVAL_NOT_SATISFIED/,
      'rule-adoption-approvals': /adoption capacity/,
      'counsel-engagements': /COUNSEL_MEMBERSHIP_NOT_ACTIVE/,
      'mfa-challenges': /account_not_active/,
      'first-factor-tokens': /User account is not active/,
      sessions: /SESSION_AUTHORITY_REQUIRED/,
      mandates: /NOT_AN_ACTIVE_MEMBER/,
      delegations: /DELEGATION_INVALID/,
      'resource-relationships': /NOT_AN_ACTIVE_MEMBER/,
    }
    for (const entry of SUBORDINATE_AUTHORITY_REGISTER) {
      const pattern = needle[entry.id]
      if (!pattern) continue
      expect(entry.proof.some((file) => pattern.test(read(file))), entry.id).toBe(true)
    }
  })

  it('every kernel authority table in platform migration 0013 is registered, or declared non-conferring with a reason', () => {
    const migration = read('apps/union-eyes/db/migrations-platform/0013_authority_kernel_storage.sql')
    const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS (ue_authority_\w+)/g)].map((m) => m[1])
    expect(tables.length).toBeGreaterThan(10)
    const registered = new Set(SUBORDINATE_AUTHORITY_REGISTER.flatMap((e) => e.storage))
    const unaccounted = tables.filter((t) => !registered.has(t) && !(t in NON_CONFERRING_KERNEL_TABLES))
    expect(unaccounted).toEqual([])
    for (const reason of Object.values(NON_CONFERRING_KERNEL_TABLES)) expect(reason.length).toBeGreaterThan(10)
  })

  it('later kernel-family migrations are accounted for too (a new authority table must be registered or declared)', () => {
    const files = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard', 'apps/union-eyes/db/migrations-platform'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.sql'))
    const registered = new Set(SUBORDINATE_AUTHORITY_REGISTER.flatMap((e) => e.storage))
    const declared = new Set(Object.keys(NON_CONFERRING_KERNEL_TABLES))
    const later = files
      .filter((f) => !f.includes('0013_authority_kernel_storage'))
      .flatMap((f) => [...read(f).matchAll(/CREATE TABLE IF NOT EXISTS (ue_authority_\w+)/g)].map((m) => m[1]))
    expect(later.filter((t) => !registered.has(t) && !declared.has(t))).toEqual([])
  })
})
