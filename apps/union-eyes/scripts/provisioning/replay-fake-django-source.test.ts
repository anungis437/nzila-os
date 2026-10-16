import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayHash, replayObject, replayRecords, replayText } from './post-w4p-replay'

const reader = resolve(import.meta.dirname, 'read-fake-django-fields.py')
function extract(sources: { FILE: string; TEXT: string }[]) {
  const result = spawnSync('python', [reader], {
    input: JSON.stringify(sources),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr)
  return replayRecords(JSON.parse(result.stdout))
}
const fixture = (body: string) => ({
  FILE: 'syntax-only.py',
  TEXT: `raise RuntimeError("MIGRATION_SOURCE_MUST_NOT_EXECUTE")
import missing_django_dependency
class Migration:
    dependencies = []
    operations = [${body}]
`,
})

describe('independent Django AST source reader;not a full macro or runtime proof', () => {
  it('preserves UTF-8 byte commitments without importing or executing source', () => {
    const source = fixture(`migrations.CreateModel(
        name="Example",
        fields=[("id", models.UUIDField(default=uuid.uuid4, primary_key=True)),
                ("label", models.TextField(help_text="caf\\u00e9 \\u2014", null=True))],
        options={"db_table": "example"})`)
    const [parsed] = extract([source])
    expect(parsed.SOURCE_SHA256).toBe(replayHash(source.TEXT))
    expect(parsed.FILE).toBe(source.FILE)
    const operation = replayRecords(parsed.OPERATIONS)[0]
    const declaration = replayObject(operation.VALUE)
    expect(declaration).toMatchObject({
      call: 'migrations.CreateModel',
      kwargs: {
        fields: [
          ['id', { call: 'models.UUIDField', kwargs: { default: { symbol: 'uuid.uuid4' } } }],
          ['label', { call: 'models.TextField', kwargs: { help_text: 'caf\u00e9 \u2014' } }],
        ],
      },
    })
    expect(operation.LINE).toBe(5)
    expect(operation.END_LINE).toBe(9)
  })

  it('preserves unresolved comprehensions with exact syntax and source positions', () => {
    const [parsed] = extract([
      fixture('migrations.AddIndex(indexes=[build_index(name) for name in names])'),
    ])
    expect(
      replayObject(replayObject(replayRecords(parsed.OPERATIONS)[0].VALUE).kwargs).indexes,
    ).toEqual({
      UNRESOLVED_EXPRESSION: '[build_index(name) for name in names]',
      EXPRESSION_CLASS: 'ListComp',
      LINE: 5,
      END_LINE: 5,
    })
  })

  it('expands only literal source RunSQL/noop comprehensions without executing Python', () => {
    const source = fixture(
      'migrations.SeparateDatabaseAndState(database_operations=[migrations.RunSQL(sql=sql, reverse_sql=migrations.RunSQL.noop) for sql in SQL])',
    )
    source.TEXT = `SQL = ["ALTER TABLE example ADD COLUMN label text", "SELECT 'caf\u00e9'"]\n${source.TEXT}`
    const [parsed] = extract([source])
    const declaration = replayObject(replayRecords(parsed.OPERATIONS)[0].VALUE)
    expect(replayObject(declaration.kwargs).database_operations).toEqual([
      {
        call: 'migrations.RunSQL',
        args: [],
        kwargs: {
          sql: 'ALTER TABLE example ADD COLUMN label text',
          reverse_sql: { symbol: 'migrations.RunSQL.noop' },
        },
      },
      {
        call: 'migrations.RunSQL',
        args: [],
        kwargs: { sql: "SELECT 'caf\u00e9'", reverse_sql: { symbol: 'migrations.RunSQL.noop' } },
      },
    ])
    expect(replayRecords(parsed.SYNTACTIC_EXPANSIONS)[0]).toMatchObject({
      ITERABLE: 'SQL',
      ITERABLE_LINE: 1,
      LINE: 6,
      STATEMENT_SHA256: [
        replayHash('ALTER TABLE example ADD COLUMN label text'),
        replayHash("SELECT 'caf\u00e9'"),
      ],
    })
    expect(parsed.SOURCE_SHA256).toBe(replayHash(source.TEXT))
    expect(extract([source])).toEqual([parsed])
  })

  it.each([
    ['SQL = build()', 'for sql in SQL'],
    ['SQL = ["SELECT 1"]', 'for sql in SQL if permitted(sql)'],
    ['SQL = ["SELECT 1"]', 'for sql in SQL for other in SQL'],
  ])('retains an explicit ceiling rather than evaluating dynamic expansion:%s', (binding, tail) => {
    const source = fixture(
      `migrations.SeparateDatabaseAndState(database_operations=[migrations.RunSQL(sql=sql, reverse_sql=migrations.RunSQL.noop) ${tail}])`,
    )
    source.TEXT = `${binding}\n${source.TEXT}`
    const [parsed] = extract([source])
    const declaration = replayObject(replayRecords(parsed.OPERATIONS)[0].VALUE)
    expect(replayObject(declaration.kwargs).database_operations).toMatchObject({
      EXPRESSION_CLASS: 'ListComp',
    })
    expect(parsed.SYNTACTIC_EXPANSIONS).toEqual([])
  })

  it('denies ambiguous module constant bindings instead of selecting a convenient value', () => {
    const source = fixture('migrations.CreateModel(name="Example", fields=[])')
    source.TEXT = `SQL = []\nSQL = ["SELECT 1"]\n${source.TEXT}`
    expect(() => extract([source])).toThrow('FAKE_DJANGO_DUPLICATE_MODULE_BINDING_UNSUPPORTED')
  })

  it('does not borrow constants assigned after the migration or shadowed inside its class', () => {
    const body =
      'migrations.SeparateDatabaseAndState(database_operations=[migrations.RunSQL(sql=sql, reverse_sql=migrations.RunSQL.noop) for sql in SQL])'
    const later = fixture(body)
    later.TEXT += '\nSQL = ["SELECT 1"]'
    const shadowed = fixture(body)
    shadowed.TEXT = `SQL = ["SELECT 1"]\n${shadowed.TEXT.replace(
      '    dependencies = []',
      '    SQL = build()\n    dependencies = []',
    )}`
    for (const source of [later, shadowed]) {
      const [parsed] = extract([source])
      const declaration = replayObject(replayRecords(parsed.OPERATIONS)[0].VALUE)
      expect(replayObject(declaration.kwargs).database_operations).toMatchObject({
        EXPRESSION_CLASS: 'ListComp',
      })
      expect(parsed.SYNTACTIC_EXPANSIONS).toEqual([])
    }
  })

  it('denies duplicate class operation bindings instead of losing declared operations', () => {
    const source = fixture('migrations.CreateModel(name="Example", fields=[])')
    source.TEXT += '\n    operations = []'
    expect(() => extract([source])).toThrow('FAKE_DJANGO_DUPLICATE_MIGRATION_BINDING_UNSUPPORTED')
  })

  it.each([
    ['migrations.CreateModel(**dynamic)', 'FAKE_DJANGO_DYNAMIC_KEYWORDS_UNSUPPORTED'],
    ['migrations.CreateModel(name="a", name="b")', 'FAKE_DJANGO_DUPLICATE_KEYWORDS_UNSUPPORTED'],
    [
      'migrations.CreateModel(options={dynamic: True})',
      'FAKE_DJANGO_LITERAL_DICTIONARY_KEYS_REQUIRED',
    ],
    [
      'migrations.CreateModel(options={"managed": True, "managed": False})',
      'FAKE_DJANGO_DUPLICATE_DICTIONARY_KEYS_UNSUPPORTED',
    ],
    ['migrations.CreateModel(value=b"bytes")', 'FAKE_DJANGO_JSON_LITERAL_REQUIRED'],
  ])('denies ambiguous declaration syntax:%s', (body, error) => {
    expect(() => extract([fixture(body)])).toThrow(`syntax-only.py:5:${error}`)
  })

  it('requires a literal whole operation list and a unique migration class', () => {
    expect(() =>
      extract([{ FILE: 'dynamic.py', TEXT: 'class Migration:\n operations = build()' }]),
    ).toThrow('FAKE_DJANGO_EXPLICIT_OPERATIONS_REQUIRED')
    expect(() => extract([{ FILE: 'missing.py', TEXT: 'class Other: pass' }])).toThrow(
      'FAKE_DJANGO_MIGRATION_CLASS_REQUIRED',
    )
  })

  it('authenticates every local frozen W1 source hash including Unicode source', () => {
    const lock = replayObject(
      JSON.parse(
        read(
          'docs/union-eyes/reality-remediation/PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json',
        ),
      ),
    )
    const nodes = replayRecords(lock.migrationNodes).filter((node) => node.SOURCE_CLASS === 'LOCAL')
    const sources = nodes.map((node) => ({
      FILE: replayText(node.SOURCE_FILE),
      TEXT: read(replayText(node.SOURCE_FILE)),
    }))
    const output = extract(sources)
    expect(output).toHaveLength(29)
    for (const [index, source] of output.entries()) {
      expect(source.FILE).toBe(nodes[index].SOURCE_FILE)
      expect(source.SOURCE_SHA256).toBe(nodes[index].FILE_SHA256)
      expect(source.SOURCE_SHA256).toBe(
        replayHash(
          readFileSync(resolve(import.meta.dirname, '../../../..', replayText(nodes[index].SOURCE_FILE))).toString(
            'utf8',
          ),
        ),
      )
    }
    const expanded = output.filter(
      (source) => replayRecords(source.SYNTACTIC_EXPANSIONS).length > 0,
    )
    expect(expanded.map((source) => source.FILE)).toEqual([
      'apps/union-eyes/backend/auth_core/migrations/0005_organizationmembers_deleted_at_and_more.py',
      'apps/union-eyes/backend/content/migrations/0004_documents_access_level_documents_blob_container_and_more.py',
    ])
    expect(
      expanded.map(
        (source) =>
          replayRecords(source.SYNTACTIC_EXPANSIONS).flatMap((row) => row.STATEMENT_SHA256).length,
      ),
    ).toEqual([12, 8])
    expect(JSON.stringify(output)).not.toContain('UNRESOLVED_EXPRESSION')
  })
})
