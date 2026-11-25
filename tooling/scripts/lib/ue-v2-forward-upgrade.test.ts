import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertStoredShapePreserved,
  planCanonicalForwardUpgrade,
  splitUpgradeDump,
  canonicalFunctionOwnerHandoff,
  canonicalFunctionReplacementRole,
  type UpgradeObject,
} from './ue-v2-forward-upgrade'
import {
  assertForwardOperator,
  assertCanonicalFunctionOwnerStatement,
  assertCanonicalFunctionReplacementStatement,
  assertCanonicalFunctionReplacementMembership,
  executeForwardUpgrade,
  normalizeForwardCatalog,
  forwardUpgradeFailure,
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

test('only the exact default owner-only sequence ACL equals NULL permission storage', () => {
  const sequence = (acl: string | null) =>
    object('relation', 'public.original_sequence', {
      kind: 'S',
      owner: 'ue_v2_owner',
      acl,
    })
  const implicit = normalizeForwardCatalog([sequence(null)])
  assert.deepEqual(normalizeForwardCatalog([sequence('{ue_v2_owner=rwU/ue_v2_owner}')]), implicit)
  for (const acl of [
    '{ue_v2_owner=r/ue_v2_owner}',
    '{ue_v2_owner=rwU/uev2admin}',
    '{ue_v2_owner=rwU/ue_v2_owner,=U/ue_v2_owner}',
    '{ue_v2_owner=rwU/ue_v2_owner,union_eyes_runtime=U/ue_v2_owner}',
  ])
    assert.notDeepEqual(normalizeForwardCatalog([sequence(acl)]), implicit)
  assert.notDeepEqual(
    normalizeForwardCatalog([
      object('function', 'guard()', { owner: 'ue_v2_owner', acl: '{ue_v2_owner=X/ue_v2_owner}' }),
    ]),
    normalizeForwardCatalog([object('function', 'guard()', { owner: 'ue_v2_owner', acl: null })]),
  )
})

test('managed-catalog failure receipts retain the reason and omit assertion data and unclassified errors', () => {
  const reason = 'MANAGED_CATALOG_DEFINITION_DRIFT:relation:public.original_sequence'
  assert.equal(forwardUpgradeFailure(new Error(reason + '\nprivate assertion diff')), reason)
  assert.equal(
    forwardUpgradeFailure(new Error('database connection password=private')),
    'UE_UPGRADE_EXECUTION_REFUSED',
  )
  assert.equal(
    forwardUpgradeFailure(new Error('UE_UPGRADE_ORIGINAL_ROWS_CHANGED\nprivate row data')),
    'UE_UPGRADE_ORIGINAL_ROWS_CHANGED',
  )
  assert.equal(forwardUpgradeFailure(null), 'UE_UPGRADE_UNKNOWN_FAILURE')
})

test('historical administrator ownership is handed off before source function replacement', async () => {
  const before = [...roles, object('function', 'guard()', { owner: 'uev2admin' })]
  const after = [...roles, object('function', 'guard()', { owner: 'ue_v2_owner' })]
  const plan = await planCanonicalForwardUpgrade({
    before,
    after,
    dump: section(
      'FUNCTION',
      'guard()',
      'CREATE FUNCTION public.guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; ALTER FUNCTION public.guard() OWNER TO ue_v2_owner;',
    ),
  })
  const index = plan.findIndex((s) => s.phase === 'canonical-function-owner')
  assert(index >= 0)
  assert.deepEqual(plan[index], {
    phase: 'canonical-function-owner',
    object: 'guard()',
    sql: 'ALTER FUNCTION public.guard() OWNER TO ue_v2_owner',
    role: 'uev2admin',
  })
  assert.match(plan[index + 1].sql, /(?:^|\n)CREATE OR REPLACE FUNCTION/)
  assert.equal(plan[index + 1].role, undefined)
  assert(!plan.some((s) => /DROP FUNCTION|DROP TRIGGER/.test(s.sql)))
})

test('a function handoff cannot admit a provider owner, change schema or widen canonical ownership', () => {
  for (const [id, from, to] of [
    ['guard()', 'azuresu', 'ue_v2_owner'],
    ['guard()', 'uev2admin', 'union_eyes_runtime'],
    ['unreviewed.guard()', 'uev2admin', 'ue_v2_owner'],
    ['guard(text)', 'uev2admin', 'ue_v2_owner'],
    ['guard();DROP TABLE claims', 'uev2admin', 'ue_v2_owner'],
  ])
    assert.throws(
      () =>
        canonicalFunctionOwnerHandoff(
          object('function', id, { owner: from }),
          object('function', id, { owner: to }),
        ),
      /UE_UPGRADE_FUNCTION_OWNER_/,
    )
  assert.throws(
    () =>
      canonicalFunctionOwnerHandoff(
        object('function', 'original()', { owner: 'uev2admin' }),
        object('function', 'other()', { owner: 'ue_v2_owner' }),
      ),
    /IDENTITY_REFUSED/,
  )
})

test('executor ownership capability refuses injected SQL, wrong actor, wrong phase and missing preimage', () => {
  const before = [object('function', 'guard()', { owner: 'uev2admin' })]
  const target = [object('function', 'guard()', { owner: 'ue_v2_owner' })]
  const statement = canonicalFunctionOwnerHandoff(before[0], target[0])!
  assert.doesNotThrow(() => assertCanonicalFunctionOwnerStatement(statement, { before, target }))
  for (const delta of [
    { sql: statement.sql + '; DROP TABLE public.claims' },
    { role: 'ue_v2_owner' },
    { phase: 'function' },
    { object: 'unrelated()' },
  ])
    assert.throws(
      () => assertCanonicalFunctionOwnerStatement({ ...statement, ...delta }, { before, target }),
      /UE_UPGRADE_FUNCTION_OWNER_/,
    )
  assert.throws(
    () => assertCanonicalFunctionOwnerStatement(statement, { before: [], target }),
    /PREIMAGE_REQUIRED/,
  )
})

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

const readerRole = object('role', 'ue_external_read_reader', {
  superuser: false,
  bypassrls: false,
  login: false,
  createrole: false,
  createdb: false,
  inherit: false,
})
const readerFunction = (body: string, owner = 'ue_external_read_reader') =>
  object('function', 'protected(jsonb)', {
    owner,
    definer: true,
    config: ['search_path=pg_catalog'],
    acl: '{ue_external_read_reader=X/ue_external_read_reader}',
    definition: `CREATE OR REPLACE FUNCTION public.protected(p jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog AS $function$ BEGIN RETURN ${body}; END; $function$;`,
  })
const readerDump = (sql: string) =>
  section('FUNCTION', 'protected(jsonb)', sql).replace(
    'Owner: ue_v2_owner',
    'Owner: ue_external_read_reader',
  )

test('an existing isolated-reader function is replaced as its unchanged canonical owner through SET authority', async () => {
  const before = [...roles, readerRole, readerFunction('false')]
  const after = [...roles, readerRole, readerFunction('true')]
  const plan = await planCanonicalForwardUpgrade({
    before,
    after,
    dump: readerDump(
      'CREATE FUNCTION public.protected(p jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog AS $$ BEGIN RETURN true; END; $$; ALTER FUNCTION public.protected(p jsonb) OWNER TO ue_external_read_reader;',
    ),
  })
  const statements = plan.filter((statement) => statement.phase === 'function')
  assert.equal(statements.length, 2)
  assert(statements.every((statement) => statement.role === 'ue_external_read_reader'))
  assert(!plan.some((statement) => statement.phase === 'canonical-function-owner'))
  for (const statement of statements)
    await assertCanonicalFunctionReplacementStatement(statement, { before, target: after })
})

test('new isolated-reader functions retain owner-first creation and deferred owner handoff', async () => {
  const before = [...roles, readerRole]
  const after = [...before, readerFunction('true')]
  const plan = await planCanonicalForwardUpgrade({
    before,
    after,
    dump: readerDump(
      'CREATE FUNCTION public.protected(p jsonb) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RETURN true; END; $$; ALTER FUNCTION public.protected(p jsonb) OWNER TO ue_external_read_reader;',
    ),
  })
  assert(plan.find((statement) => statement.phase === 'function')?.role === undefined)
  assert.equal(plan.filter((statement) => statement.phase === 'isolated-owner-handoff').length, 1)
})

test('replacement owner cannot be unknown, changed, undeclared or privileged', () => {
  for (const owner of ['azuresu', 'arbitrary_reader', 'union_eyes_runtime'])
    assert.throws(
      () =>
        canonicalFunctionReplacementRole(
          readerFunction('false', owner),
          readerFunction('true', owner),
          [...roles, readerRole, object('role', owner)],
        ),
      /OWNER_REFUSED/,
    )
  assert.throws(
    () =>
      canonicalFunctionReplacementRole(
        readerFunction('false'),
        readerFunction('true', 'ue_v2_owner'),
        [...roles, readerRole],
      ),
    /OWNER_CHANGED/,
  )
  assert.throws(
    () =>
      canonicalFunctionReplacementRole(
        readerFunction('false'),
        { ...readerFunction('true'), id: 'another(jsonb)' },
        [...roles, readerRole],
      ),
    /IDENTITY_REFUSED/,
  )
  assert.throws(
    () => canonicalFunctionReplacementRole(readerFunction('false'), readerFunction('true'), roles),
    /ROLE_UNDECLARED/,
  )
  for (const attribute of ['superuser', 'bypassrls', 'login', 'createrole', 'createdb', 'inherit'])
    assert.throws(
      () =>
        canonicalFunctionReplacementRole(readerFunction('false'), readerFunction('true'), [
          ...roles,
          { ...readerRole, definition: { ...readerRole.definition, [attribute]: true } },
        ]),
      /ROLE_PRIVILEGED/,
    )
})

test('private-owner statement capability refuses another function, body, attributes, extra SQL or actor', async () => {
  const before = [...roles, readerRole, readerFunction('false')],
    target = [...roles, readerRole, readerFunction('true')]
  const statement = {
    phase: 'function',
    object: 'protected(jsonb)',
    role: 'ue_external_read_reader',
    sql: String(readerFunction('true').definition.definition),
  }
  await assertCanonicalFunctionReplacementStatement(statement, { before, target })
  for (const delta of [
    { sql: statement.sql.replace('public.protected', 'public.other') },
    { sql: statement.sql.replace('RETURN true', 'RETURN false') },
    { sql: statement.sql.replace('SECURITY DEFINER', 'SECURITY INVOKER') },
    { sql: statement.sql.replace('TO pg_catalog', 'TO public') },
    { sql: statement.sql + ' SELECT true;' },
    { role: 'ue_v2_owner' },
    { object: 'other(jsonb)' },
    { phase: 'target-acl' },
    { sql: 'ALTER FUNCTION public.protected(jsonb) OWNER TO ue_v2_owner' },
  ])
    await assert.rejects(
      assertCanonicalFunctionReplacementStatement({ ...statement, ...delta }, { before, target }),
      /UE_UPGRADE_FUNCTION_REPLACEMENT_/,
    )
})

test('a catalog identity cannot authorize a target definition for a different function or overload', async () => {
  const before = [...roles, readerRole, readerFunction('false')]
  for (const definition of [
    String(readerFunction('true').definition.definition).replace(
      'public.protected',
      'public.other',
    ),
    String(readerFunction('true').definition.definition).replace('p jsonb', 'p text'),
  ]) {
    const target = [
      ...roles,
      readerRole,
      {
        ...readerFunction('true'),
        definition: { ...readerFunction('true').definition, definition },
      },
    ]
    await assert.rejects(
      assertCanonicalFunctionReplacementStatement(
        {
          phase: 'function',
          object: 'protected(jsonb)',
          role: 'ue_external_read_reader',
          sql: definition,
        },
        { before, target },
      ),
      /DEFINITION_IDENTITY_REFUSED/,
    )
  }
})

test('private-owner SET membership must already exist; it is never manufactured on refusal', async () => {
  for (const allowed of [false, null, undefined]) {
    const calls: unknown[][] = []
    const client = {
      query: async (...args: unknown[]) => {
        calls.push(args)
        return { rows: [{ allowed, isolated: true }] }
      },
    } as unknown as Pick<pg.Client, 'query'>
    await assert.rejects(
      assertCanonicalFunctionReplacementMembership(client, 'ue_external_read_reader'),
      /MEMBERSHIP_REQUIRED/,
    )
    assert.equal(calls.length, 1)
    assert.match(String(calls[0][0]), /^SELECT pg_has_role/)
  }
  for (const isolated of [false, null, undefined]) {
    const calls: unknown[][] = []
    const client = {
      query: async (...args: unknown[]) => {
        calls.push(args)
        return { rows: [{ allowed: true, isolated }] }
      },
    } as unknown as Pick<pg.Client, 'query'>
    await assert.rejects(
      assertCanonicalFunctionReplacementMembership(client, 'ue_external_read_reader'),
      /ROLE_PRIVILEGED/,
    )
    assert.equal(calls.length, 1)
    assert.match(String(calls[0][0]), /rolreplication OR rolinherit/)
  }
  const client = {
    query: async () => ({ rows: [{ allowed: true, isolated: true }] }),
  } as unknown as Pick<pg.Client, 'query'>
  await assertCanonicalFunctionReplacementMembership(client, 'ue_external_read_reader')
})
