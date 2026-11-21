/** Real SQL-engine role census plus unconnected transaction protocol controls.
 * Neither substitutes for native LOGIN/production-issued session qualification. */
import { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import {
  assertRestrictedRuntimeTransaction,
  assertRuntimeQualificationActive,
  createPreparedRuntimeQualification,
  createRuntimeReportPump,
  runtimeFieldHistory,
  runtimeFieldHistoryResult,
  completeRuntimeColumnReport,
  withRuntimeColumnScope,
  type RuntimeBindingRunner,
} from './runtime-session-proof'
import { requireColumnPermissionDenial } from './runtime-column-security'
import { orderRuntimeReports } from './runtime-report-order'
import { RUNTIME_COLUMN_PRIVILEGE_CONTRACTS } from './service-column-contracts'
let db: PGlite
const sqlClient = new pg.Client()
beforeAll(async () => {
  db = new PGlite()
  Object.defineProperty(sqlClient, 'query', {
    value: (text: string, params: unknown[] = []) => db.query(text, params),
  })
  await db.exec(`CREATE ROLE ue_column_test_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE ROLE ue_column_test_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    GRANT ue_column_test_runtime TO ue_column_test_login;`)
}, 30000)
afterAll(async () => {
  await db?.close()
})
async function asRestricted(operation: () => Promise<void>) {
  await db.exec(
    'SET SESSION AUTHORIZATION ue_column_test_login; BEGIN; SET LOCAL ROLE ue_column_test_runtime',
  )
  try {
    await operation()
  } finally {
    await db.exec('ROLLBACK; RESET ROLE; SET SESSION AUTHORIZATION postgres; RESET ROLE')
  }
}
describe('actual SQL-engine restricted role census', () => {
  it('accepts genuine safe effective role and NOINHERIT LOGIN facts', async () => {
    const database = String(
      (await db.query<{ name: string }>('SELECT current_database() AS name')).rows[0].name,
    )
    await asRestricted(() =>
      assertRestrictedRuntimeTransaction(sqlClient, 'ue_column_test_runtime', database),
    )
  })
  it.each(['CREATEDB', 'CREATEROLE'])(
    'rejects effective %s even when a temporary pg_roles shadow falsifies that flag',
    async (flag) => {
      await db.exec(`ALTER ROLE ue_column_test_runtime ${flag}; CREATE TEMP TABLE pg_roles AS SELECT * FROM pg_catalog.pg_roles;
      UPDATE pg_temp.pg_roles SET rolcreatedb=false,rolcreaterole=false;
      GRANT SELECT ON pg_temp.pg_roles TO ue_column_test_runtime;`)
      const database = String(
        (await db.query<{ name: string }>('SELECT current_database() AS name')).rows[0].name,
      )
      try {
        await asRestricted(async () => {
          // This is the adversarial preimage: unqualified census reads temp data.
          expect(
            (
              await db.query<{ role: string; unsafe: boolean }>(
                `SELECT rolname AS role,(rolcreatedb OR rolcreaterole) AS unsafe FROM pg_roles WHERE rolname=current_user`,
              )
            ).rows,
          ).toEqual([{ role: 'ue_column_test_runtime', unsafe: false }])
          await expect(
            assertRestrictedRuntimeTransaction(sqlClient, 'ue_column_test_runtime', database),
          ).rejects.toThrow('RESTRICTED_LOGIN_ATTRIBUTES_REQUIRED')
        })
      } finally {
        await db.exec(`DROP TABLE pg_temp.pg_roles; ALTER ROLE ue_column_test_runtime NO${flag}`)
      }
    },
  )
})
describe('unconnected scope/rollback protocol only', () => {
  const port = () => {
    const statements: string[] = []
    const client = new pg.Client()
    const query = vi.fn(async (text: string) => {
      statements.push(text)
      if (text.includes('FROM pg_catalog.pg_roles'))
        return {
          rows: [
            {
              role: 'union_eyes_system',
              login: 'ue_test_system',
              database: 'ue_v2_protocol',
              rolsuper: false,
              rolbypassrls: false,
              effective_createdb: false,
              effective_createrole: false,
              rolcanlogin: true,
              rolinherit: false,
              login_superuser: false,
              login_bypass: false,
              rolcreatedb: false,
              rolcreaterole: false,
            },
          ],
        }
      if (text === 'SYNTHETIC_FORBIDDEN') {
        const error = new pg.DatabaseError('protocol-only denial', 0, 'error')
        error.code = '42501'
        throw error
      }
      return { rows: [], rowCount: 0 }
    })
    Object.defineProperty(client, 'query', { value: query })
    let issued = 0
    const withBinding: RuntimeBindingRunner = async (callback) =>
      callback({
        authority: 'pg-session',
        userId: 'synthetic-actor',
        organizationId: '11111111-1111-4111-8111-111111111111',
        role: 'member',
        sessionToken: `synthetic-protocol-token-never-real-${++issued}`,
        expiresAt: new Date(Date.now() + 30000),
      })
    return { client, statements, withBinding, issued: () => issued }
  }
  it('gets a new runner callback per probe and pins search path before role introspection', async () => {
    const input = port()
    for (let attempt = 0; attempt < 2; attempt++)
      await withRuntimeColumnScope({
        ...input,
        database: 'ue_v2_protocol',
        role: 'union_eyes_system',
        operation: async () => undefined,
      })
    expect(input.issued()).toBe(2)
    expect(input.statements[1]).toBe('SET LOCAL search_path = pg_catalog, public, pg_temp')
    expect(input.statements.filter((statement) => statement === 'ROLLBACK')).toHaveLength(2)
  })
  it('rolls expected SQL errors back directly without running SET CONSTRAINTS in an aborted transaction', async () => {
    const input = port()
    await withRuntimeColumnScope({
      ...input,
      database: 'ue_v2_protocol',
      role: 'union_eyes_system',
      operation: () => requireColumnPermissionDenial(input.client, 'SYNTHETIC_FORBIDDEN'),
    })
    expect(input.statements).not.toContain('SET CONSTRAINTS ALL IMMEDIATE')
    expect(input.statements.at(-1)).toBe('ROLLBACK')
  })
  it('checks constraints and commits only when explicitly requested for a positive operation', async () => {
    const input = port()
    await withRuntimeColumnScope({
      ...input,
      database: 'ue_v2_protocol',
      role: 'union_eyes_system',
      constraints: true,
      commit: true,
      operation: async () => undefined,
    })
    expect(input.statements.slice(-2)).toEqual(['SET CONSTRAINTS ALL IMMEDIATE', 'COMMIT'])
  })
  it('rolls a callback failure back and propagates it', async () => {
    const input = port(),
      failure = new Error('synthetic callback failure')
    await expect(
      withRuntimeColumnScope({
        ...input,
        database: 'ue_v2_protocol',
        role: 'union_eyes_system',
        operation: async () => {
          throw failure
        },
      }),
    ).rejects.toBe(failure)
    expect(input.statements.at(-1)).toBe('ROLLBACK')
    expect(input.statements).not.toContain('COMMIT')
  })
})

describe('column receipt completeness counterexamples (pure only)', () => {
  const marker = [
    'COLUMN_SOURCE_AUTHORIZED_SELECT',
    'COMMITTED_FOREIGN_ROW_HIDDEN',
    'BROAD_TABLE_ACLS_ABSENT',
    'SYSTEM_COLUMN_ACCESS_DENIED',
    ...['USER', 'ORG', 'BEARER', 'FOREIGN_ORG', 'FOREIGN_USER'].map(
      (name) => `COLUMN_INVALID_${name}_DENIED`,
    ),
    ...['SELECT', 'INSERT', 'UPDATE', 'DELETE'].flatMap((name) => [
      `SOURCE_UNAUTHORIZED_${name}_DENIED`,
      `SYSTEM_SOURCE_UNAUTHORIZED_${name}_DENIED`,
    ]),
    ...['UE_V2_OWNER', 'UNION_EYES_SYSTEM', 'NZILA_AUTH_GATEWAY', 'NZILA_AUTH_SYSTEM_GATEWAY'].map(
      (name) => `ROLE_ESCALATION_${name}_DENIED`,
    ),
    'COLUMN_HISTORY_UNCHANGED',
    'COLUMN_SOURCE_AUTHORIZED_INSERT_AND_AUDIT_ROLLED_BACK',
  ]
  const cases = ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'].flatMap((actor) =>
    marker.map((proof) => `${actor}:${proof}`),
  )
  it('accepts the complete protocol shape without claiming it was executed', () => {
    expect(completeRuntimeColumnReport({ status: 'PASS', cases }, true, false)).toBe(true)
  })
  it.each(marker)('refuses missing ORG_ADMIN:%s witness', (missing) => {
    expect(
      completeRuntimeColumnReport(
        { status: 'PASS', cases: cases.filter((proof) => proof !== `ORG_ADMIN:${missing}`) },
        true,
        false,
      ),
    ).toBe(false)
  })
  it.each(['FAIL', 'NOT_PROVEN', 'SKIP', 'UNKNOWN'])(
    'refuses %s state despite marker text',
    (status) => {
      expect(completeRuntimeColumnReport({ status, cases }, true, false)).toBe(false)
    },
  )
  it('refuses successful status with an adverse recorded failure', () => {
    expect(
      completeRuntimeColumnReport({ status: 'PASS', cases, failure: 'failed' }, true, false),
    ).toBe(false)
  })
  it('requires a read-only history witness rather than inventing a mutation rollback', () => {
    expect(completeRuntimeColumnReport({ status: 'PASS', cases }, false, true)).toBe(false)
  })
})

describe('single-statement complete field history (actual SQL engine)', () => {
  it('equals the prior serial field digests, including empty tables and unsafe numeric bytes', async () => {
    await db.exec(`CREATE TABLE history_fields(id uuid PRIMARY KEY, amount numeric(30,10), counter bigint, extra jsonb);
      CREATE TABLE history_empty(id uuid PRIMARY KEY);
      INSERT INTO history_fields VALUES('11111111-1111-4111-8111-111111111111',12345678901234567890.1234567890,9223372036854775807,'{"nested":"unchanged"}');`)
    const tables = ['history_fields', 'history_empty']
    const prior = []
    for (const table of [...tables].sort()) {
      const rows = (
        await db.query(
          `SELECT pg_catalog.to_jsonb(t)::text AS row FROM public.${table} t ORDER BY pg_catalog.to_jsonb(t)::text`,
        )
      ).rows
      prior.push({
        table,
        rows: rows.length,
        sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      })
    }
    const batchedClient = new pg.Client()
    let roundTrips = 0
    Object.defineProperty(batchedClient, 'query', {
      value: async (text: string, params: unknown[]) => {
        roundTrips++
        return db.query(text, params)
      },
    })
    const before = await runtimeFieldHistory(batchedClient, tables)
    expect(roundTrips).toBe(1)
    expect(before).toEqual(prior)
    expect(before.find((row) => row.table === 'history_empty')?.rows).toBe(0)
    await db.exec(`UPDATE history_fields SET counter=9223372036854775806`)
    const after = await runtimeFieldHistory(batchedClient, tables)
    expect(after.find((row) => row.table === 'history_fields')?.rows).toBe(1)
    expect(after.find((row) => row.table === 'history_fields')?.sha256).not.toBe(
      before.find((row) => row.table === 'history_fields')?.sha256,
    )
    expect(after.find((row) => row.table === 'history_empty')).toEqual(
      before.find((row) => row.table === 'history_empty'),
    )
  })
  it.each([
    { name: 'missing', rows: [{ table: 'a', rows: [] }] },
    {
      name: 'duplicate',
      rows: [
        { table: 'a', rows: [] },
        { table: 'a', rows: [] },
      ],
    },
    {
      name: 'foreign',
      rows: [
        { table: 'a', rows: [] },
        { table: 'x', rows: [] },
      ],
    },
    {
      name: 'numeric coercion',
      rows: [
        { table: 'a', rows: [9223372036854775807] },
        { table: 'b', rows: [] },
      ],
    },
    {
      name: 'malformed',
      rows: [
        { table: 'a', rows: null },
        { table: 'b', rows: [] },
      ],
    },
  ])('refuses $name history transport data', ({ rows }) => {
    expect(() => runtimeFieldHistoryResult(['a', 'b'], rows)).toThrow(/HISTORY/)
  })
})

describe('prepared source-complete scheduling and cancellation protocol', () => {
  const tables = Object.keys(RUNTIME_COLUMN_PRIVILEGE_CONTRACTS)
  it('prepares once and requests exactly one contract; remaining cells cannot pass early', async () => {
    expect(tables).toHaveLength(7)
    const reports = tables.map((table) => ({ table, status: 'FAIL' }))
    const requests: string[] = []
    const prepare = vi.fn(async () => undefined)
    const runner = createPreparedRuntimeQualification({
      tables,
      prepare,
      qualify: async (table) => {
        requests.push(table)
        reports.find((row) => row.table === table)!.status = 'PASS'
      },
      report: (table) => reports.find((row) => row.table === table)!,
      fail: () => {
        throw new Error('Unexpected protocol failure')
      },
    })
    for (const [index, table] of tables.entries()) {
      expect((await runner.qualifyTable(table)).status).toBe('PASS')
      expect(requests).toEqual(tables.slice(0, index + 1))
      expect(reports.filter((row) => row.status === 'PASS')).toHaveLength(index + 1)
    }
    expect(prepare).toHaveBeenCalledOnce()
    await runner.qualifyTable(tables[0])
    expect(requests).toEqual(tables)
    await expect(runner.qualifyTable('unreviewed_contract')).rejects.toThrow(
      'EXACT_SOURCE_COLUMN_TABLE_REQUIRED',
    )
  })
  it('aborts after actual transaction rollback and simulated bearer cleanup, then refuses subsequent work', async () => {
    const controller = new AbortController(),
      events: string[] = [],
      reports = tables.map((table) => ({ table, status: 'FAIL' }))
    const client = new pg.Client()
    Object.defineProperty(client, 'query', {
      value: async (text: string) => {
        events.push(text)
        if (text.includes('FROM pg_catalog.pg_roles'))
          return {
            rows: [
              {
                role: 'union_eyes_system',
                login: 'owned_login',
                database: 'ue_abort_protocol',
                rolsuper: false,
                rolbypassrls: false,
                effective_createdb: false,
                effective_createrole: false,
                rolcanlogin: true,
                rolinherit: false,
                login_superuser: false,
                login_bypass: false,
                rolcreatedb: false,
                rolcreaterole: false,
              },
            ],
          }
        return { rows: [], rowCount: 0 }
      },
    })
    const withBinding: RuntimeBindingRunner = async (callback) => {
      try {
        return await callback({
          authority: 'pg-session',
          userId: 'synthetic',
          organizationId: '11111111-1111-4111-8111-111111111111',
          role: 'member',
          sessionToken: 'synthetic-protocol-bearer-never-real',
          expiresAt: new Date(Date.now() + 30000),
        })
      } finally {
        events.push('SIMULATED_BEARER_REVOKED')
      }
    }
    let attempts = 0
    const failure = new Error('Deliberate component cancellation')
    const runner = createPreparedRuntimeQualification({
      tables,
      prepare: async () => undefined,
      qualify: async (_table, signal) => {
        attempts++
        await withRuntimeColumnScope({
          client,
          database: 'ue_abort_protocol',
          withBinding,
          role: 'union_eyes_system',
          operation: async () => {
            controller.abort(failure)
          },
        })
        assertRuntimeQualificationActive(signal)
        throw new Error('Cancellation did not stop the next phase')
      },
      report: (table) => reports.find((row) => row.table === table)!,
      fail: (error) => {
        expect(error).toBe(failure)
        for (const report of reports) report.status = 'FAIL'
      },
    })
    expect((await runner.qualifyTable(tables[0], controller.signal)).status).toBe('FAIL')
    expect(events.slice(-2)).toEqual(['ROLLBACK', 'SIMULATED_BEARER_REVOKED'])
    const stopped = events.length
    expect((await runner.qualifyTable(tables[1], new AbortController().signal)).status).toBe('FAIL')
    expect(attempts).toBe(1)
    expect(events).toHaveLength(stopped)
    expect(reports.every((report) => report.status === 'FAIL')).toBe(true)
  })
  it('a pre-aborted phase performs no setup or probes and cannot be resumed with a fresh signal', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Stopped before setup'))
    const prepare = vi.fn(async () => undefined),
      qualify = vi.fn(async () => undefined),
      fail = vi.fn()
    const runner = createPreparedRuntimeQualification({
      tables,
      prepare,
      qualify,
      report: (table) => ({ table, status: 'FAIL' }),
      fail,
    })
    await runner.qualifyTable(tables[0], controller.signal)
    await runner.qualifyTable(tables[1])
    expect(prepare).not.toHaveBeenCalled()
    expect(qualify).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledOnce()
  })
  it('rejects concurrent table requests instead of queuing them behind unfinished work', async () => {
    let release: () => void = () => {
      throw new Error('Missing pending operation')
    }
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const runner = createPreparedRuntimeQualification({
      tables,
      prepare: async () => {
        await pending
      },
      qualify: async () => undefined,
      report: (table) => ({ table }),
      fail: () => undefined,
    })
    const first = runner.qualifyTable(tables[0])
    await expect(runner.qualifyTable(tables[1])).rejects.toThrow(
      'CONCURRENT_COLUMN_QUALIFICATION_FORBIDDEN',
    )
    release()
    await first
  })
})

describe('bijective runtime diagnostic order', () => {
  it('moves the exact protected families first and preserves every other report in relative order', () => {
    const rules = ['old-a', 'column-b', 'guard-b', 'old-b', 'guard-a', 'column-a'].map((table) => ({
      table,
    }))
    const ordered = orderRuntimeReports(rules, ['guard-a', 'guard-b'], ['column-a', 'column-b'])
    expect(ordered.map((row) => row.table)).toEqual([
      'guard-a',
      'guard-b',
      'column-a',
      'column-b',
      'old-a',
      'old-b',
    ])
    expect(new Set(ordered)).toEqual(new Set(rules))
    expect(ordered).toHaveLength(rules.length)
  })
  it('keeps absent filtered-out tables absent without omitting any admitted report', () => {
    expect(
      orderRuntimeReports([{ table: 'old' }], ['not-in-this-matrix'], ['also-not-in-this-matrix']),
    ).toEqual([{ table: 'old' }])
  })
  it('rejects duplicate reports or priority declarations rather than silently deduplicating evidence', () => {
    expect(() => orderRuntimeReports([{ table: 'a' }, { table: 'a' }], [], [])).toThrow(
      'DUPLICATE_RUNTIME_REPORT_TABLE_FORBIDDEN',
    )
    expect(() => orderRuntimeReports([{ table: 'a' }], ['a'], ['a'])).toThrow(
      'DUPLICATE_RUNTIME_PRIORITY_TABLE_FORBIDDEN',
    )
  })
})

describe('actual async-generator report pump cancellation', () => {
  it('does not queue subsequent tests behind a timed-out report, and never returns its late value as a pass', async () => {
    const controller = new AbortController(),
      control: { signal?: AbortSignal } = {},
      events: string[] = []
    let release: () => void = () => {
      throw new Error('Uninitialized probe')
    }
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    async function* producer() {
      events.push('entered-producer')
      try {
        await waiting
      } finally {
        events.push('probe-transaction-and-bearer-cleanup')
      }
      yield { status: 'PASS' }
      events.push('forbidden-later-table')
      return { status: 'PASS' }
    }
    const pump = createRuntimeReportPump(producer(), control)
    const first = pump.next(controller.signal)
    expect(control.signal).toBe(controller.signal)
    const failure = new Error('Deliberate test timeout')
    controller.abort(failure)
    await expect(pump.next(new AbortController().signal)).rejects.toBe(failure)
    const settled = pump.settle()
    release()
    await expect(first).rejects.toBe(failure)
    await settled
    expect(events).toEqual(['entered-producer', 'probe-transaction-and-bearer-cleanup'])
  })
  it('rejects a simultaneous next without invoking or queuing the generator a second time', async () => {
    let release: () => void = () => {
      throw new Error('Uninitialized probe')
    }
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    let entries = 0
    async function* producer() {
      entries++
      await waiting
      yield 'first'
      entries++
      return 'done'
    }
    const pump = createRuntimeReportPump(producer(), {})
    const first = pump.next(new AbortController().signal)
    await expect(pump.next(new AbortController().signal)).rejects.toThrow(
      'PRIOR_NATIVE_REPORT_STILL_RUNNING',
    )
    expect(entries).toBe(1)
    release()
    expect(await first).toEqual({ value: 'first', done: false })
    expect(await pump.next(new AbortController().signal)).toEqual({ value: 'done', done: true })
    expect(entries).toBe(2)
  })
})
