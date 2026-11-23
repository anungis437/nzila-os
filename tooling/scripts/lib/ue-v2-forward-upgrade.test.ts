import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertStoredShapePreserved,
  planCanonicalForwardUpgrade,
  splitUpgradeDump,
  type UpgradeObject,
} from './ue-v2-forward-upgrade'
import {
  assertForwardOperator,
  executeForwardUpgrade,
  type ForwardOperatorProfile,
  type ForwardUpgradeBundle,
} from './ue-v2-forward-upgrade-runtime'
import type pg from 'pg'

const operator: ForwardOperatorProfile = {
  actor: 'uev2admin',
  session: 'uev2admin',
  database: 'ue_v2_staging',
  version: 160012,
  rolsuper: false,
  rolbypassrls: false,
  rolcanlogin: true,
  rolcreatedb: true,
  rolcreaterole: true,
  rolreplication: false,
  rolinherit: true,
}

test('the existing managed administrator supports both recorded BYPASSRLS profiles without changing either', () => {
  for (const rolbypassrls of [false, true]) {
    const profile = { ...operator, rolbypassrls }
    assert.strictEqual(assertForwardOperator(profile), profile)
    assert.equal(profile.rolbypassrls, rolbypassrls)
  }
})

test('wrong operator identity, database, version and superuser fail before any DDL or privilege bridge', async () => {
  for (const delta of [
    { actor: 'union_eyes_runtime' },
    { session: 'ue_staging_runtime' },
    { database: 'production' },
    { version: 150012 },
    { version: 170000 },
    { rolsuper: true },
    { rolbypassrls: undefined },
  ]) {
    const queries: string[] = []
    const client = {
      query: async (sql: string) => {
        queries.push(sql)
        return { rows: [{ ...operator, ...delta }] }
      },
    } as unknown as pg.Client
    await assert.rejects(
      executeForwardUpgrade(client, { version: 1 } as ForwardUpgradeBundle),
      /UE_UPGRADE_OPERATOR_/,
    )
    assert.equal(queries.length, 1)
    assert.match(queries[0], /^SELECT current_user/)
  }
})

const object = (
  kind: string,
  id: string,
  definition: Record<string, unknown> = {},
): UpgradeObject => ({ kind, id, definition })
const roles = [object('role', 'ue_v2_owner'), object('role', 'union_eyes_runtime')]
const section = (type: string, name: string, sql: string) =>
  `-- Name: ${name}; Type: ${type}; Schema: public; Owner: ue_v2_owner\n--\n${sql}\n`

test('a removal or conversion of an existing stored column cannot become an upgrade', () => {
  const before = [
    object('relation', 'public.cases', { kind: 'r' }),
    object('column', 'public.cases.id', { type: 'uuid', notnull: true }),
  ]
  assert.throws(
    () => assertStoredShapePreserved(before, before.slice(0, 1)),
    /COLUMN_REMOVAL_REFUSED/,
  )
  assert.throws(
    () =>
      assertStoredShapePreserved(before, [
        before[0],
        object('column', 'public.cases.id', { type: 'text', notnull: true }),
      ]),
    /STORED_SHAPE_CHANGED/,
  )
  assert.throws(
    () => assertStoredShapePreserved(before.slice(0, 1), before),
    /COLUMN_BACKFILL_REFUSED/,
  )
})

test('historical relations outside the new snapshot remain retained', () => {
  const before = [
    object('relation', 'public.old_receipt', { kind: 'r' }),
    object('column', 'public.old_receipt.digest', { type: 'text' }),
  ]
  assert.doesNotThrow(() => assertStoredShapePreserved(before, []))
})

test('a sequence restart, changed enum or changed default requires a separately qualified migration', () => {
  for (const [kind, id, field, a, b] of [
    ['sequence', 'public.counter', 'start', 1, 2],
    ['enum', 'public.state', 'labels', ['open'], ['open', 'closed']],
    ['column', 'public.cases.id', 'default', 'gen_random_uuid()', 'other()'],
  ] as const) {
    assert.throws(
      () =>
        assertStoredShapePreserved(
          [object(kind, id, { [field]: a })],
          [object(kind, id, { [field]: b })],
        ),
      /STORED_SHAPE_CHANGED/,
    )
  }
})

test('a TOC-looking comment inside a function body cannot select a different section', () => {
  const dump = section(
    'FUNCTION',
    'guard()',
    `CREATE FUNCTION public.guard() RETURNS void LANGUAGE plpgsql AS $body$\nBEGIN\n-- Name: secret; Type: TABLE; Schema: public; Owner: ue_v2_owner\nNULL; END $body$;`,
  )
  const result = splitUpgradeDump(dump)
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'FUNCTION')
  assert.match(result[0].sql, /Name: secret/)
})

test('ambiguous escaped literals and unclosed quoted atoms fail closed', () => {
  assert.throws(
    () =>
      splitUpgradeDump(
        section(
          'TABLE',
          'x',
          "SELECT E'\\\'\n-- Name: injected; Type: TABLE; Schema: public; Owner: ue_v2_owner",
        ),
      ),
    /ESCAPE_LITERAL_REFUSED/,
  )
  assert.throws(
    () => splitUpgradeDump(section('FUNCTION', 'x()', 'CREATE FUNCTION x() RETURNS void AS $x$')),
    /UNTERMINATED_ATOM/,
  )
})

test('transaction control, DML and destructive table operations are not admitted by a selected section', async () => {
  for (const sql of [
    'DELETE FROM public.cases',
    'TRUNCATE public.cases',
    'DROP TABLE public.cases',
    'COMMIT',
    'ALTER TABLE public.cases DROP COLUMN id',
    'ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY',
  ]) {
    await assert.rejects(
      planCanonicalForwardUpgrade({
        before: roles,
        after: [...roles, object('relation', 'public.cases', { kind: 'r' })],
        dump: section('TABLE', 'cases', sql),
      }),
      /DDL_KIND_REFUSED|ALTER_TABLE_REFUSED/,
    )
  }
})

test('only check constraints may replace an existing constraint', async () => {
  await assert.rejects(
    planCanonicalForwardUpgrade({
      before: [
        ...roles,
        object('constraint', 'cases.key', { type: 'p', definition: 'PRIMARY KEY (id)' }),
      ],
      after: [
        ...roles,
        object('constraint', 'cases.key', { type: 'p', definition: 'PRIMARY KEY (other)' }),
      ],
      dump: section(
        'CONSTRAINT',
        'cases key',
        'ALTER TABLE ONLY public.cases ADD CONSTRAINT key PRIMARY KEY (other);',
      ),
    }),
    /ONLY_CHECK_REPLACEMENT_ALLOWED/,
  )
})

test('a retained table is never recreated; its formerly broad grant is explicitly removed', async () => {
  const table = object('relation', 'public.cases', { kind: 'r' })
  const plan = await planCanonicalForwardUpgrade({
    before: [...roles, table],
    after: [...roles, table],
    dump: section(
      'TABLE',
      'cases',
      'CREATE TABLE public.cases (id uuid); ALTER TABLE public.cases OWNER TO ue_v2_owner;',
    ),
  })
  assert(!plan.some((s) => /CREATE TABLE/.test(s.sql)))
  assert(
    plan.some(
      (s) =>
        s.phase === 'reset-table-acl' &&
        s.sql.includes('"public"."cases"') &&
        s.sql.includes('"union_eyes_runtime"'),
    ),
  )
})

test('an undeclared obsolete function cannot be dropped as cleanup', async () => {
  await assert.rejects(
    planCanonicalForwardUpgrade({
      before: [...roles, object('function', 'arbitrary()')],
      after: roles,
      dump: section('ACL', 'SCHEMA public', 'GRANT USAGE ON SCHEMA public TO union_eyes_runtime;'),
    }),
    /OBSOLETE_FUNCTION_REFUSED/,
  )
})
