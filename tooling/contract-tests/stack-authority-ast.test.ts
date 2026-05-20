/**
 * Self-tests for the AST-level stack-authority detector.
 *
 * Drives {@link findAliasedMutations} directly with synthetic fixtures so
 * the detector's coverage (especially the regex-bypass cases) is
 * verifiable without scanning the real `apps/` tree.
 *
 * @invariant STACK_AUTHORITY_001
 */
import { describe, it, expect } from 'vitest'
import { findAliasedMutations } from './stack-authority-ast'

const FAKE_PATH = 'apps/abr/actions/synthetic.ts'

describe('findAliasedMutations — AST detector', () => {
  it('flags a bare db.insert call when db comes from @nzila/db', () => {
    const src = `
      import { db } from '@nzila/db'
      export async function run() {
        await db.insert(users).values({ id: 1 })
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ alias: 'db', root: 'db', method: 'insert' })
  })

  it('closes the regex KNOWN GAP: pure alias `const writer = db; writer.insert(...)`', () => {
    const src = `
      import { db } from '@nzila/db'
      const writer = db
      export async function run() {
        await writer.insert(users).values({ id: 1 })
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ alias: 'writer', root: 'db', method: 'insert' })
  })

  it('flags a parameter alias when the param name matches the DB-handle heuristic', () => {
    const src = `
      export function run(scopedDb) {
        return scopedDb.update(users).set({ name: 'x' })
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ alias: 'scopedDb', method: 'update' })
  })

  it('does NOT flag mutation-shaped text inside comments or string literals', () => {
    const src = `
      import { db } from '@nzila/db'
      // db.insert(users) — this is a comment, must not be flagged
      const note = "db.delete(users) is dangerous"
      export async function safe() {
        return note
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(0)
  })

  it('does NOT flag a mutation inside withRLSContext callback', () => {
    const src = `
      import { db } from '@nzila/db'
      import { withRLSContext } from '@/lib/rls'
      export async function run() {
        return withRLSContext('org-1', async (scoped) => {
          await scoped.insert(users).values({ id: 1 })
        })
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(0)
  })

  it('does NOT flag a mutation inside withSystemContext callback', () => {
    const src = `
      import { db } from '@nzila/db'
      import { withSystemContext } from '@/lib/system'
      export async function run() {
        return withSystemContext(async (sysDb) => {
          await sysDb.upsert(users, { id: 1 })
        })
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(0)
  })

  it('flags a destructured-and-renamed alias: `const { db: writer } = ctx`', () => {
    const src = `
      import { ctx } from '@nzila/db'
      const { db: writer } = ctx
      export async function run() {
        await writer.delete(users)
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ alias: 'writer', method: 'delete' })
  })

  it('flags all configured mutation methods (insertMany, bulkInsert, deleteMany, upsert, merge)', () => {
    const src = `
      import { db } from '@nzila/db'
      export async function run() {
        await db.insertMany(users, rows)
        await db.bulkInsert(users, rows)
        await db.deleteMany(users)
        await db.upsert(users, { id: 1 })
        await db.merge(users).using(rows)
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings.map((f) => f.method).sort()).toEqual(
      ['bulkInsert', 'deleteMany', 'insertMany', 'merge', 'upsert'],
    )
  })

  it('does NOT flag read-only methods (select, query)', () => {
    const src = `
      import { db } from '@nzila/db'
      export async function read() {
        return db.select().from(users).where(eq(users.id, 1))
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(0)
  })

  it('returns empty when no DB roots exist in the file (no false-positive seeds)', () => {
    const src = `
      export function add(a: number, b: number) {
        return a + b
      }
    `
    const findings = findAliasedMutations(FAKE_PATH, src)
    expect(findings).toHaveLength(0)
  })
})
