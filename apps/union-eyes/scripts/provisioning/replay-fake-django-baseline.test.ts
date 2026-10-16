import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayDigest, replayObject, replayRecords, replayText } from './post-w4p-replay'
import { frozenHelperSources } from './replay-policy-helper-inspection'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import {
  createSourceBoundDjangoCatalog,
  loadSourceBoundDjangoBaseline,
  sourceBoundDjangoTable,
  type SourceBoundDjangoBaseline,
} from './replay-fake-django-baseline'

const repositoryRoot = resolve(import.meta.dirname, '../../../..')
const wheelhouse =
  process.env.UE_FAKE_DJANGO_WHEELHOUSE ??
  'C:\\Users\\AubertNungisa\\.copilot\\session-state\\72f80c17-f5ba-4bac-bc6c-35d3f4d306dd\\files\\w1\\wheelhouse'
const request = { repositoryRoot, wheelhouse }
let baseline: SourceBoundDjangoBaseline

/** Unbound syntax fixtures exercise semantics; they cannot pass the bound-result API. */
function syntaxFixture(operations: string) {
  const source = {
    FILE: 'fixture.py',
    TEXT: `raise RuntimeError("NEVER_RUN")
import nonexistent_framework
class Migration:
    dependencies = []
    operations = [${operations}]
`,
  }
  const script = `
import importlib.util,json,sys
spec=importlib.util.spec_from_file_location("compiler",sys.argv[1])
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
source=json.load(sys.stdin)
parsed=m.reader.read_source(source)
node={**parsed,"MIGRATION_ID":"fixture::0001","APP_LABEL":"fixture","SOURCE_FILE":source["FILE"],
      "FILE_SHA256":parsed["SOURCE_SHA256"],"LITERAL_SQL_BINDINGS":{}}
compiler=m.PhysicalCompiler({"data_types":{"UUIDField":"uuid","CharField":{"backend_function":"_get_varchar_column"},
 "TextField":"text","IntegerField":"integer","DateTimeField":"timestamp with time zone","AutoField":"integer",
 "PositiveIntegerField":"integer"},"data_type_check_constraints":{"PositiveIntegerField":'"%(column)s" >= 0'}})
print(json.dumps(compiler.run([node])))
`
  const result = spawnSync(
    'python',
    ['-c', script, resolve(import.meta.dirname, 'compile-fake-django-baseline.py')],
    {
      input: JSON.stringify(source),
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      maxBuffer: 4 * 1024 * 1024,
    },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr)
  return JSON.parse(result.stdout) as Omit<SourceBoundDjangoBaseline, 'authority'>
}

const example = `migrations.CreateModel(name="Example", fields=[
 ("id", models.UUIDField(primary_key=True, default=uuid.uuid4)),
 ("label", models.CharField(max_length=32, null=True, unique=True)),
 ("quantity", models.PositiveIntegerField(default=0, db_index=True))],
 options={"db_table":"example"})`

describe('source-bound incoming Django physical subset;not live/full graph authority', () => {
  beforeAll(() => {
    baseline = loadSourceBoundDjangoBaseline(request)
  })

  it('authenticates every cached wheel and all82 migration commitments without initialization', () => {
    expect(baseline.authority).toMatchObject({
      scope: 'OFFLINE_SOURCE_BOUND_PHYSICAL_SUBSET',
      authenticatedWheels: 87,
      authenticatedLocalSources: 29,
      authenticatedExternalSources: 53,
      fullDjangoGraphVerified: false,
      sourceExecuted: false,
      djangoInitialized: false,
      emptyInitialTables: true,
      implicitKeyIndexNamesModeled: false,
    })
    expect(baseline.tables).toHaveLength(539)
    expect(baseline.tables.flatMap((table) => table.columns)).toHaveLength(3374)
    expect(baseline.indexes).toHaveLength(276)
    expect(baseline.foreignKeys).toHaveLength(178)
    expect(baseline.tables.filter((table) => table.primaryKey.length > 0)).toHaveLength(539)
    expect(baseline.tables.flatMap((table) => table.uniqueConstraints ?? [])).toHaveLength(48)
    expect(baseline.tables.flatMap((table) => table.checkConstraints ?? [])).toHaveLength(12)
    expect(baseline.clientDefaults).toHaveLength(861)
    expect(
      baseline.tables
        .flatMap((table) => table.columns)
        .filter((column) => column.default_expression !== null),
    ).toHaveLength(5)
    expect(baseline.operationCount).toBe(924)
    expect(
      baseline.unsupported.filter((ceiling) => ceiling.file.startsWith('apps/union-eyes/')),
    ).toEqual([])
    expect(baseline.unsupported).toHaveLength(18)
    expect(baseline.sqlEffects).toHaveLength(26)
    expect(baseline.sqlEffects.every((effect) => effect.modeled)).toBe(true)
  })

  it('deterministically recompiles source rather than accepting copied or caller-attested IR', () => {
    expect(replayDigest(loadSourceBoundDjangoBaseline(request))).toBe(replayDigest(baseline))
    expect(() => sourceBoundDjangoTable(structuredClone(baseline), 'organizations')).toThrow(
      'FAKE_DJANGO_BASELINE_SOURCE_BOUND_RESULT_REQUIRED',
    )
    expect(() =>
      loadSourceBoundDjangoBaseline({
        ...request,
        fullDjangoGraphVerified: true,
      } as typeof request),
    ).toThrow('FAKE_DJANGO_BASELINE_REQUEST_REQUIRED')
  })

  it('binds all69 actual ADD_COLUMN payload targets to genuine incoming source declarations', () => {
    const payloads = replayObject(
      JSON.parse(
        read(
          'docs/union-eyes/reality-remediation/UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
        ),
      ),
    )
    const additions = replayRecords(payloads.ADD_COLUMN_PAYLOADS)
    expect(additions).toHaveLength(69)
    for (const payload of additions) {
      const match = /ALTER TABLE "public"\."([^"]+)"/.exec(replayText(payload.SQL))
      expect(match).not.toBeNull()
      const table = sourceBoundDjangoTable(baseline, match![1])
      expect(table.primaryKey).toEqual(['id'])
      expect(table.columns.find((column) => column.name === 'id')).toMatchObject({
        type_schema: 'pg_catalog',
        type_name: 'uuid',
        postgres_type: 'uuid',
        not_null: true,
        default_expression: null,
      })
    }
  })

  it('classifies all320 real helpers against produced Django tables without fabricating absent ones', () => {
    const calls = frozenHelperSources().calls
    expect(calls).toHaveLength(320)
    const targetNames = calls.map((call) => sqlTokens(call.source)[3].value)
    const incoming = targetNames.filter((name) =>
      baseline.tables.some((table) => table.name === name),
    )
    expect(incoming).toHaveLength(215)
    expect(targetNames.filter((name) => !incoming.includes(name))).toHaveLength(105)
    for (const name of new Set(incoming))
      expect(sourceBoundDjangoTable(baseline, name).name).toBe(name)
    for (const name of new Set(targetNames.filter((name) => !incoming.includes(name))))
      expect(() => sourceBoundDjangoTable(baseline, name)).toThrow(
        'FAKE_DJANGO_BASELINE_TABLE_REQUIRED',
      )
  })

  it('preserves UUID client defaults and true backend typmods versus raw SQL server defaults', () => {
    const organizations = sourceBoundDjangoTable(baseline, 'organizations')
    const id = organizations.columns.find((column) => column.name === 'id')!
    expect(id.default_expression).toBeNull()
    expect(
      baseline.clientDefaults.find(
        (entry) => entry.table === 'organizations' && entry.column === 'id',
      )?.declaration,
    ).toEqual({ symbol: 'uuid.uuid4' })
    expect(
      organizations.columns.find((column) => column.name === 'auth_provider_org_id')?.postgres_type,
    ).toBe('text')
    expect(
      sourceBoundDjangoTable(baseline, 'organization_members').columns.find(
        (column) => column.name === 'joined_at',
      )?.default_expression,
    ).toBe('now()')
    const session = sourceBoundDjangoTable(baseline, 'exit_interview_sessions')
    expect(session.columns.find((column) => column.name === 'id')?.default_expression).toBe(
      'gen_random_uuid()',
    )
    expect(
      session.columns.find((column) => column.name === 'duration_minutes')?.default_expression,
    ).toBe('30')
    expect(
      sourceBoundDjangoTable(baseline, 'automation_rules').columns.find(
        (column) => column.name === 'organization_id',
      ),
    ).toMatchObject({ postgres_type: 'character varying(255)', not_null: true })
  })

  it('retains physical legacy columns/indexes when SeparateDatabaseAndState is state-only', () => {
    const organizations = sourceBoundDjangoTable(baseline, 'organizations')
    expect(organizations.columns.some((column) => column.name === 'legacy_tenant_id')).toBe(true)
    expect(organizations.columns.some((column) => column.name === 'legacy_org_id')).toBe(false)
    expect(baseline.indexes.some((index) => index.name === 'idx_org_legacy_tenant')).toBe(true)
    expect(baseline.indexes.some((index) => index.name === 'idx_org_legacy_org')).toBe(false)
    expect(
      baseline.indexes.find(
        (index) => index.name === 'organizations_clerk_organization_id_c3351c93_like',
      ),
    ).toMatchObject({
      columns: ['auth_provider_org_id'],
      opclasses_default: false,
      key_definitions: ['auth_provider_org_id text_pattern_ops'],
    })
  })

  it('installs native source-bound table/index/FK/check state for a scoped closure', async () => {
    const catalog = await createSourceBoundDjangoCatalog(baseline, ['organization_members'], {
      schemas: ['pg_catalog', 'public'],
    })
    expect(catalog.inspectTable('public', 'organization_members')).toEqual(
      sourceBoundDjangoTable(baseline, 'organization_members'),
    )
    expect(catalog.inspectTable('public', 'organizations')?.primaryKey).toEqual(['id'])
    for (const index of baseline.indexes.filter(
      (index) => index.table_name === 'organization_members',
    ))
      expect(catalog.inspectIndex('public', index.name)).toEqual(index)
    for (const fk of baseline.foreignKeys.filter((fk) => fk.table === 'organization_members')) {
      expect(catalog.inspectForeignKey('public', fk.table, fk.name)).toEqual(fk)
      expect(fk).toMatchObject({
        delete_action: 'a',
        update_action: 'a',
        deferrable: true,
        deferred: true,
      })
    }
  })

  it('denies mutation of an authenticated result and table-specific custom field ceilings', () => {
    const original = baseline.tables[0].name
    baseline.tables[0].name = 'fabricated'
    expect(() => sourceBoundDjangoTable(baseline, original)).toThrow(
      'FAKE_DJANGO_BASELINE_SOURCE_BOUND_RESULT_REQUIRED',
    )
    baseline.tables[0].name = original
    expect(() => sourceBoundDjangoTable(baseline, 'django_celery_beat_crontabschedule')).toThrow(
      'FAKE_DJANGO_BASELINE_TABLE_CEILING',
    )
  })

  it('installs every incoming helper target and ADD_COLUMN target with native parent closure', async () => {
    const payloads = replayObject(
      JSON.parse(
        read(
          'docs/union-eyes/reality-remediation/UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
        ),
      ),
    )
    const additionNames = replayRecords(payloads.ADD_COLUMN_PAYLOADS).map(
      (payload) => /ALTER TABLE "public"\."([^"]+)"/.exec(replayText(payload.SQL))![1],
    )
    const incoming = frozenHelperSources()
      .calls.map((call) => sqlTokens(call.source)[3].value)
      .filter((name) => baseline.tables.some((table) => table.name === name))
    const names = [...new Set([...additionNames, ...incoming])]
    const catalog = await createSourceBoundDjangoCatalog(baseline, names, {
      schemas: ['pg_catalog', 'public'],
    })
    for (const name of names)
      expect(catalog.inspectTable('public', name)).toEqual(sourceBoundDjangoTable(baseline, name))
    for (const index of baseline.indexes.filter((index) => names.includes(index.table_name)))
      expect(catalog.inspectIndex('public', index.name)).toEqual(index)
  })
})

describe('unbound physical compiler syntax fixtures', () => {
  it('uses explicit UUID keys, sized and unsized varchar, positive checks and client-only defaults', () => {
    const result = syntaxFixture(`${example},
      migrations.AddField(model_name="example", name="unbounded", field=models.CharField())`)
    expect(result.unsupported).toEqual([])
    expect(result.tables[0].primaryKey).toEqual(['id'])
    expect(result.tables[0].columns.map((column) => column.postgres_type)).toEqual([
      'uuid',
      'character varying(32)',
      'integer',
      'character varying',
    ])
    expect(result.tables[0].checkConstraints).toEqual([
      {
        name: expect.any(String),
        expression: '"quantity" >= 0',
        columns: ['quantity'],
      },
    ])
    expect(result.tables[0].columns.every((column) => column.default_expression === null)).toBe(
      true,
    )
  })

  it('preserves migration order and physical/state separation, including raw SQL field types', () => {
    const result = syntaxFixture(`${example},
      migrations.SeparateDatabaseAndState(
        state_operations=[migrations.AddField(model_name="example", name="state_only",
          field=models.UUIDField())], database_operations=[]),
      migrations.SeparateDatabaseAndState(
        state_operations=[migrations.AddField(model_name="example", name="physical",
          field=models.CharField(max_length=255))],
        database_operations=[migrations.RunSQL(
          sql="ALTER TABLE example ADD COLUMN IF NOT EXISTS physical text")]),
      migrations.RenameField(model_name="example", old_name="label", new_name="renamed"),
      migrations.AlterField(model_name="example", name="renamed", field=models.CharField(max_length=64))`)
    expect(result.unsupported).toEqual([])
    expect(result.tables[0].columns.some((column) => column.name === 'state_only')).toBe(false)
    expect(result.tables[0].columns.find((column) => column.name === 'physical')).toMatchObject({
      postgres_type: 'text',
      not_null: false,
    })
    expect(result.tables[0].columns.find((column) => column.name === 'renamed')).toMatchObject({
      postgres_type: 'character varying(64)',
      not_null: true,
    })
  })

  it('rolls back unsupported compound effects instead of silently dropping trailing operations', () => {
    const result = syntaxFixture(`${example},
      migrations.SeparateDatabaseAndState(database_operations=[
        migrations.AddField(model_name="example", name="partial", field=models.TextField()),
        migrations.UnknownOperation(model_name="example")], state_operations=[])`)
    expect(result.tables[0].columns.some((column) => column.name === 'partial')).toBe(false)
    expect(result.unsupported[0].reason).toBe('OPERATION_UNSUPPORTED:migrations.UnknownOperation')
  })

  it('surfaces custom fields and dynamic key/default expressions without calling them', () => {
    const result = syntaxFixture(`migrations.CreateModel(name="Example", fields=[
      ("id", custom.Field(primary_key=True)),
      ("flag", models.TextField(null=dynamic()))], options={"db_table":"example"})`)
    expect(result.tables[0].columns).toEqual([])
    expect(result.unsupported.map((ceiling) => ceiling.reason)).toEqual([
      'CUSTOM_FIELD_UNSUPPORTED:custom.Field',
      'FIELD_BOOLEAN_LITERAL_REQUIRED',
    ])
    expect(result.unsupported.every((ceiling) => ceiling.tables.includes('example'))).toBe(true)
  })

  it('denies implicit synthesized IDs and temporal FK target type inference', () => {
    const implicit = syntaxFixture(
      'migrations.CreateModel(name="NoKey", fields=[("value",models.TextField())])',
    )
    expect(implicit.tables[0].primaryKey).toEqual([])
    expect(implicit.unsupported[0].reason).toBe('IMPLICIT_PRIMARY_KEY_UNSUPPORTED')
    const temporal = syntaxFixture(`${example},
      migrations.CreateModel(name="Child",fields=[
        ("id",models.UUIDField(primary_key=True)),
        ("parent",models.ForeignKey(to="fixture.Example",on_delete=models.CASCADE))]),
      migrations.SeparateDatabaseAndState(database_operations=[],state_operations=[
        migrations.AlterField(model_name="example",name="id",
          field=models.CharField(primary_key=True,max_length=32))])`)
    expect(temporal.unsupported.map((ceiling) => ceiling.reason)).toContain(
      'FOREIGN_KEY_TEMPORAL_TARGET_MUTATION_UNSUPPORTED',
    )
    expect(temporal.foreignKeys).toEqual([])
  })
})
