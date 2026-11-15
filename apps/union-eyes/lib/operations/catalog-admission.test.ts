import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import contract from './catalog-authority-contract.json'
import { admissionQueries } from './catalog-admission-core.mjs'

const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@nzila/db', () => ({ db: { execute: mocks.execute } }))

type Row = Record<string, unknown>
const dialect = new PgDialect()

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

function safeSnapshot(): Record<string, Row[]> {
  return {
    roles: ['union_eyes_runtime', 'union_eyes_system'].map(rolname => ({
      rolname, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false,
    })),
    schemaUsage: [
      ...contract.payload.runtimeSchemaUsage.map(nspname => ({ rolname: 'union_eyes_runtime', nspname })),
      ...contract.payload.systemSchemaUsage.map(nspname => ({ rolname: 'union_eyes_system', nspname })),
    ],
  }
}

describe('catalog admission while inspections overlap', () => {
  let snapshot: Record<string, Row[]>
  let statements: string[]

  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@nzila/db', () => ({ db: { execute: mocks.execute } }))
    vi.doUnmock('./catalog-authority-contract.json')
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    vi.stubEnv('UE_ENVIRONMENT', 'catalog-admission-unit')
    vi.stubEnv('DATABASE_URL', 'postgresql://catalog-unit.invalid/first')
    vi.stubEnv('GITHUB_SHA', 'catalog-admission-unit')
    mocks.execute.mockReset()
    snapshot = safeSnapshot()
    statements = []
    mocks.execute.mockImplementation(async (statement: SQL) => read(dialect.sqlToQuery(statement).sql))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('./catalog-authority-contract.json')
  })

  function read(statement: string): Row[] {
    statements.push(statement)
    const query = admissionQueries.find(item => item.sql === statement)
    return structuredClone(query ? snapshot[query.name] ?? [] : [])
  }

  async function holdDefaultInspection(expectedStarts = 1) {
    const gate = deferred(), entered = deferred(), firstEntered = deferred()
    let starts = 0
    mocks.execute.mockImplementation(async (query: SQL) => {
      const statement = dialect.sqlToQuery(query).sql
      if (statement === admissionQueries[0].sql) {
        starts++
        if (starts === 1) firstEntered.resolve()
        if (starts === expectedStarts) entered.resolve()
        await gate.promise
      }
      return read(statement)
    })
    return { gate, entered, firstEntered, starts: () => starts }
  }

  it('inspects every original query once for five concurrent default requests', async () => {
    const { evaluateCatalogAdmission } = await import('./catalog-admission')
    const held = await holdDefaultInspection()
    const requests = Array.from({ length: 5 }, () => evaluateCatalogAdmission())
    await held.entered.promise
    expect(held.starts()).toBe(1)
    held.gate.resolve()
    const reports = await Promise.all(requests)
    expect(reports.every(report => report.ok)).toBe(true)
    expect(statements).toEqual(admissionQueries.map(query => query.sql))
    reports[0].violations.push('caller-local diagnostic')
    expect(reports[1].violations).toEqual([])
  })

  it('shares a running inspection across separately loaded route module copies', async () => {
    const first = await import('./catalog-admission')
    const held = await holdDefaultInspection()
    const health = first.evaluateCatalogAdmission()
    await held.entered.promise
    vi.resetModules()
    const second = await import('./catalog-admission')
    expect(first.evaluateCatalogAdmission).not.toBe(second.evaluateCatalogAdmission)
    const readiness = second.evaluateCatalogAdmission()
    held.gate.resolve()
    expect((await Promise.all([health, readiness])).every(report => report.ok)).toBe(true)
    expect(statements).toEqual(admissionQueries.map(query => query.sql))
  })

  it('performs a fresh scan after success and rejects newly unsafe actual rows', async () => {
    const { evaluateCatalogAdmission } = await import('./catalog-admission')
    expect((await evaluateCatalogAdmission()).ok).toBe(true)
    snapshot.roles[0].rolsuper = true
    const changed = await evaluateCatalogAdmission()
    expect(changed.ok).toBe(false)
    expect(changed.violations).toContain('union_eyes_runtime has a privileged attribute')
    expect(statements).toHaveLength(admissionQueries.length * 2)
  })

  it('does not cache an unsuccessful admission after the actual rows are repaired', async () => {
    const { evaluateCatalogAdmission } = await import('./catalog-admission')
    snapshot.roles[0].rolbypassrls = true
    expect((await evaluateCatalogAdmission()).ok).toBe(false)
    snapshot.roles[0].rolbypassrls = false
    expect((await evaluateCatalogAdmission()).ok).toBe(true)
    expect(statements).toHaveLength(admissionQueries.length * 2)
  })

  it('fails all overlapping callers on a read rejection and retries the next request afresh', async () => {
    const { evaluateCatalogAdmission } = await import('./catalog-admission')
    const held = await holdDefaultInspection()
    const unavailable = new Error('catalog reader unavailable')
    const firstRead = deferred()
    mocks.execute.mockImplementationOnce(async () => { firstRead.resolve(); await held.gate.promise; throw unavailable })
    const requests = Array.from({ length: 5 }, () => evaluateCatalogAdmission())
    // All requests are started before the single failed read settles.
    await firstRead.promise
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    held.gate.resolve()
    const results = await Promise.allSettled(requests)
    expect(results.every(result => result.status === 'rejected' && result.reason === unavailable)).toBe(true)
    expect((await evaluateCatalogAdmission()).ok).toBe(true)
    expect(statements).toEqual(admissionQueries.map(query => query.sql))
  })

  it('keeps explicit connection executors independent of the default flight and each other', async () => {
    const { evaluateCatalogAdmission } = await import('./catalog-admission')
    const held = await holdDefaultInspection()
    const defaults = evaluateCatalogAdmission()
    await held.entered.promise
    const safe = vi.fn(async (statement: string) => read(statement))
    const unsafe = vi.fn(async (statement: string) => {
      const rows = read(statement)
      if (statement === admissionQueries[0].sql) rows[0].rolcreaterole = true
      return rows
    })
    const [one, two, denied] = await Promise.all([
      evaluateCatalogAdmission(safe), evaluateCatalogAdmission(safe), evaluateCatalogAdmission(unsafe),
    ])
    expect(one.ok).toBe(true)
    expect(two.ok).toBe(true)
    expect(denied.ok).toBe(false)
    expect(safe).toHaveBeenCalledTimes(admissionQueries.length * 2)
    expect(unsafe).toHaveBeenCalledTimes(admissionQueries.length)
    held.gate.resolve()
    expect((await defaults).ok).toBe(true)
  })

  for (const changed of ['environment', 'database', 'source', 'canonical mode'] as const) {
    it(`does not mix overlapping ${changed} contexts`, async () => {
      const { evaluateCatalogAdmission } = await import('./catalog-admission')
      const held = await holdDefaultInspection(2)
      const first = evaluateCatalogAdmission()
      await held.firstEntered.promise
      if (changed === 'environment') vi.stubEnv('UE_ENVIRONMENT', 'second-catalog-environment')
      if (changed === 'database') vi.stubEnv('DATABASE_URL', 'postgresql://catalog-unit.invalid/second')
      if (changed === 'source') vi.stubEnv('GITHUB_SHA', 'second-catalog-source')
      if (changed === 'canonical mode') vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
      const second = evaluateCatalogAdmission()
      await held.entered.promise
      held.gate.resolve()
      const [oldContext, newContext] = await Promise.all([first, second])
      expect(oldContext.ok).toBe(true)
      expect(oldContext.environment).toBe('catalog-admission-unit')
      if (changed === 'environment') expect(newContext.environment).toBe('second-catalog-environment')
      if (changed === 'canonical mode') {
        expect(newContext.ok).toBe(false)
        expect(newContext.violations).toContain('nzila_auth_gateway: unsafe or missing canonical role/schema authority')
      } else expect(newContext.ok).toBe(true)
      expect(held.starts()).toBe(2)
    })
  }

  it('does not share a valid module flight with a separately packaged corrupt contract', async () => {
    const valid = await import('./catalog-admission')
    const held = await holdDefaultInspection(2)
    const safe = valid.evaluateCatalogAdmission()
    await held.firstEntered.promise
    vi.resetModules()
    vi.doMock('./catalog-authority-contract.json', () => ({ default: { ...contract, digest: '0'.repeat(64) } }))
    const corrupt = await import('./catalog-admission')
    const denied = corrupt.evaluateCatalogAdmission()
    await held.entered.promise
    held.gate.resolve()
    expect((await safe).ok).toBe(true)
    const rejected = await denied
    expect(rejected.ok).toBe(false)
    expect(rejected.violations).toContain('catalog contract digest is invalid')
  })
})
