/** Disposable native qualification protocol, never application authority. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  authenticatedOrgBindingSql,
  type AuthenticatedOrgBinding,
} from '../../../../packages/platform-auth/src/org-binding'
export type { AuthenticatedOrgBinding }
export type RuntimeBindingRunner = <T>(
  callback: (binding: AuthenticatedOrgBinding) => Promise<T>,
) => Promise<T>
export type PublicRuntimeIdentity = Pick<AuthenticatedOrgBinding, 'userId' | 'organizationId'>
export type RuntimeContextChange = 'user' | 'org' | 'bearer' | 'foreign-org' | 'foreign-user'
/** Cancellation never replaces the transaction/bearer cleanup in a probe. */
export function assertRuntimeQualificationActive(signal?: AbortSignal) {
  signal?.throwIfAborted()
}
/** A table request cannot start another table's probes, or restart after abort. */
export function createPreparedRuntimeQualification<Table extends string, Report>(input: {
  tables: readonly Table[]
  prepare(signal?: AbortSignal): Promise<void>
  qualify(table: Table, signal?: AbortSignal): Promise<void>
  report(table: Table): Report
  fail(error: unknown): void
}) {
  let preparation: Promise<void> | undefined
  let running = false
  let terminal = false
  const completed = new Set<Table>()
  return {
    async qualifyTable(name: string, signal?: AbortSignal): Promise<Report> {
      const table = input.tables.find((entry) => entry === name)
      assert.ok(table, 'EXACT_SOURCE_COLUMN_TABLE_REQUIRED')
      assert.equal(running, false, 'CONCURRENT_COLUMN_QUALIFICATION_FORBIDDEN')
      if (terminal) return input.report(table)
      running = true
      try {
        assertRuntimeQualificationActive(signal)
        if (completed.has(table)) return input.report(table)
        preparation ??= input.prepare(signal)
        await preparation
        assertRuntimeQualificationActive(signal)
        await input.qualify(table, signal)
        assertRuntimeQualificationActive(signal)
        completed.add(table)
      } catch (error) {
        terminal = true
        input.fail(error)
      } finally {
        running = false
      }
      return input.report(table)
    },
  }
}
/** Async generators queue next() calls themselves. Never queue a new test
 * behind an abandoned producer: stop terminally and await its real cleanup. */
export function createRuntimeReportPump<Yield, Result>(
  iterator: AsyncIterator<Yield, Result, unknown>,
  control: { signal?: AbortSignal },
) {
  let pending: Promise<IteratorResult<Yield, Result>> | undefined
  let terminal = false
  let terminalFailure: unknown
  return {
    async next(signal: AbortSignal): Promise<IteratorResult<Yield, Result>> {
      if (terminal) throw terminalFailure
      assert.equal(pending, undefined, 'PRIOR_NATIVE_REPORT_STILL_RUNNING')
      control.signal = signal
      const aborted = () => {
        terminal = true
        terminalFailure = signal.reason ?? new Error('NATIVE_REPORT_ABORTED')
      }
      if (signal.aborted) {
        aborted()
        throw terminalFailure
      }
      signal.addEventListener('abort', aborted, { once: true })
      try {
        pending = iterator.next()
        const result = await pending
        assertRuntimeQualificationActive(signal)
        return result
      } catch (error) {
        terminal = true
        terminalFailure = error
        throw error
      } finally {
        pending = undefined
        signal.removeEventListener('abort', aborted)
      }
    },
    async settle() {
      // Deliberately propagate failure; the caller still disposes all owned
      // resources in finally and records the failed cleanup/qualification.
      if (pending) await pending
    },
  }
}
export const runtimeIdentifier = (name: string) => {
  assert.ok(
    name.length > 0 && Buffer.byteLength(name) <= 63 && !name.includes('\0'),
    'VALID_PHYSICAL_IDENTIFIER_REQUIRED',
  )
  return `"${name.replaceAll('"', '""')}"`
}
export function requireSameOwnedRuntimeClients(
  operator: pg.Client,
  clients: readonly pg.Client[],
  database: string,
) {
  assert.match(database, /^ue_[a-zA-Z0-9_]+$/)
  assert.equal(
    new Set([operator, ...clients]).size,
    clients.length + 1,
    'DISTINCT_CLIENTS_REQUIRED',
  )
  for (const client of [operator, ...clients]) {
    assert.ok(
      ['localhost', '127.0.0.1', '::1'].includes(client.host),
      'OWNED_LOOPBACK_CLIENT_REQUIRED',
    )
    assert.equal(client.host, operator.host, 'SAME_OWNED_SERVER_REQUIRED')
    assert.equal(client.port, operator.port, 'SAME_OWNED_SERVER_PORT_REQUIRED')
    assert.equal(client.database, database, 'SAME_OWNED_DATABASE_REQUIRED')
  }
}
export async function assertRestrictedRuntimeTransaction(
  client: { query(text: string): Promise<{ rows: Record<string, unknown>[] }> },
  role: string,
  database: string,
) {
  const {
    rows: [identity],
  } =
    await client.query(`SELECT current_user AS role,session_user AS login,pg_catalog.current_database() AS database,
    effective.rolsuper,effective.rolbypassrls,effective.rolcreatedb AS effective_createdb,effective.rolcreaterole AS effective_createrole,login.rolcanlogin,login.rolinherit,login.rolsuper AS login_superuser,
    login.rolbypassrls AS login_bypass,login.rolcreatedb,login.rolcreaterole
    FROM pg_catalog.pg_roles effective,pg_catalog.pg_roles login WHERE effective.rolname=current_user AND login.rolname=session_user`)
  assert.equal(identity.role, role, 'RESTRICTED_EFFECTIVE_ROLE_REQUIRED')
  assert.equal(identity.database, database)
  assert.notEqual(identity.login, role)
  assert.equal(identity.rolcanlogin, true)
  for (const key of [
    'rolsuper',
    'rolbypassrls',
    'effective_createdb',
    'effective_createrole',
    'rolinherit',
    'login_superuser',
    'login_bypass',
    'rolcreatedb',
    'rolcreaterole',
  ])
    assert.equal(identity[key], false, 'RESTRICTED_LOGIN_ATTRIBUTES_REQUIRED')
}
const dialect = new PgDialect()
/** Fresh production child bearer per probe; parent bearer remains inside runner. */
export function withRuntimeColumnScope<T>(input: {
  client: pg.Client
  database: string
  withBinding: RuntimeBindingRunner
  role?: 'union_eyes_runtime' | 'union_eyes_system'
  change?: RuntimeContextChange
  foreign?: PublicRuntimeIdentity
  expected?: PublicRuntimeIdentity
  commit?: boolean
  constraints?: boolean
  operation: (binding: AuthenticatedOrgBinding) => Promise<T>
}): Promise<T> {
  return input.withBinding(async (binding) => {
    assert.equal(binding.authority, 'pg-session', 'PRODUCTION_OPAQUE_SESSION_REQUIRED')
    assert.ok(binding.sessionToken.length >= 32, 'OPAQUE_BEARER_REQUIRED')
    assert.ok(
      Number.isFinite(binding.expiresAt.getTime()) && binding.expiresAt.getTime() > Date.now(),
      'LIVE_FINITE_SESSION_REQUIRED',
    )
    if (input.expected) {
      assert.equal(binding.userId, input.expected.userId, 'ORIGINAL_ACTOR_REQUIRED')
      assert.equal(
        binding.organizationId,
        input.expected.organizationId,
        'ORIGINAL_ORGANIZATION_REQUIRED',
      )
    }
    const role = input.role ?? 'union_eyes_runtime'
    await input.client.query('BEGIN')
    let ended = false
    try {
      await input.client.query('SET LOCAL search_path = pg_catalog, public, pg_temp')
      await input.client.query(`SET LOCAL ROLE ${runtimeIdentifier(role)}`)
      const compiled = dialect.sqlToQuery(authenticatedOrgBindingSql(binding))
      await input.client.query(compiled.sql, compiled.params)
      if (input.change) {
        const setting =
          input.change === 'bearer'
            ? 'app.current_session_token'
            : input.change.endsWith('org') || input.change === 'org'
              ? 'app.current_org_id'
              : 'app.current_user_id'
        const value =
          input.change === 'foreign-org'
            ? input.foreign!.organizationId
            : input.change === 'foreign-user'
              ? input.foreign!.userId
              : ''
        await input.client.query('SELECT set_config($1,$2,true)', [setting, value])
      }
      await assertRestrictedRuntimeTransaction(input.client, role, input.database)
      if (role === 'union_eyes_runtime') {
        const live = (
          await input.client.query(
            'SELECT user_management.auth_business_org_authorized($1,NULL::text[]) AS authorized',
            [binding.organizationId],
          )
        ).rows[0]
        assert.equal(
          live.authorized === true,
          !input.change,
          'LIVE_ORIGINAL_BEARER_CONTEXT_REQUIRED',
        )
      }
      const result = await input.operation(binding)
      if (input.constraints) await input.client.query('SET CONSTRAINTS ALL IMMEDIATE')
      await input.client.query(input.commit ? 'COMMIT' : 'ROLLBACK')
      ended = true
      return result
    } finally {
      if (!ended) await input.client.query('ROLLBACK')
    }
  })
}
export function runtimeFieldHistoryQuery(tables: readonly string[]) {
  const names = [...new Set(tables)].sort()
  assert.ok(names.length > 0, 'NONEMPTY_HISTORY_TABLES_REQUIRED')
  return {
    text: names
      .map(
        (table, index) => `SELECT $${index + 1}::text AS table,
      COALESCE(pg_catalog.jsonb_agg(source.row ORDER BY source.row),'[]'::jsonb) AS rows
      FROM (SELECT pg_catalog.to_jsonb(t)::text AS row FROM public.${runtimeIdentifier(table)} t) source`,
      )
      .join(' UNION ALL '),
    values: names,
  }
}
export function runtimeFieldHistoryResult(
  tables: readonly string[],
  result: readonly { table: unknown; rows: unknown }[],
) {
  const names = [...new Set(tables)].sort()
  assert.equal(result.length, names.length, 'EXACT_HISTORY_TABLE_RESULTS_REQUIRED')
  return names.map((table) => {
    const matches = result.filter((row) => row.table === table)
    assert.equal(matches.length, 1, 'UNIQUE_HISTORY_TABLE_RESULT_REQUIRED')
    const fields = matches[0].rows
    assert.ok(Array.isArray(fields), 'HISTORY_FIELD_ARRAY_REQUIRED')
    assert.ok(
      fields.every((row) => typeof row === 'string'),
      'RAW_HISTORY_FIELD_BYTES_REQUIRED',
    )
    // Each item is PostgreSQL's complete JSON row as TEXT. JSON aggregation
    // transports strings, so bigint/numeric values never pass through Number.
    const rows = fields.map((row) => ({ row }))
    return {
      table,
      rows: rows.length,
      sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    }
  })
}
export async function runtimeFieldHistory(client: pg.Client, tables: readonly string[]) {
  const query = runtimeFieldHistoryQuery(tables)
  const result = await client.query<{ table: string; rows: string[] }>(query.text, query.values)
  return runtimeFieldHistoryResult(tables, result.rows)
}

/** Receipt completeness is source-derived; a successful SELECT * denial is
 * never a substitute for the positive column, identity and history witnesses. */
export function completeRuntimeColumnReport(
  report: { status: string; cases: readonly string[]; failure?: string; failedProof?: string },
  insert: boolean,
  admission: boolean,
) {
  if (report.status !== 'PASS' || report.failure !== undefined || report.failedProof !== undefined)
    return false
  const required = [
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
    admission ? 'COLUMN_READONLY_HISTORY_UNCHANGED' : 'COLUMN_HISTORY_UNCHANGED',
    ...(insert ? ['COLUMN_SOURCE_AUTHORIZED_INSERT_AND_AUDIT_ROLLED_BACK'] : []),
  ]
  return ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'].every((actor) =>
    required.every((proof) => report.cases.includes(`${actor}:${proof}`)),
  )
}
