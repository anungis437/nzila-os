import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildRegistry,
  classify,
  files,
  main,
  outputs,
  materialProperties,
  parseDeclaration,
  parseHistoricalTable,
  validateInactiveSql,
  validateUniverse,
} from './author-w4-canonical-definitions'
import { digest, exactIds, read, sha } from './w4-physical-producers'
import type { adoptionModel } from './adopt-w4-platform-ownership'
import type { buildAdjudication } from './adjudicate-w4-ownership'

type Model = ReturnType<typeof adoptionModel>
const governance: {
  canonicalDefinitionObligations: Model['definitions']
  lateDefinitionRegister: Model['lateDefinitions']
} = JSON.parse(read(files.w4g))
const producer: { djangoProducerRegistry: { PHYSICAL_IDENTITY: string }[] } = JSON.parse(
  read(files.producer),
)
const declaration = (columns: string, callback = '') =>
  `import { pgTable, uuid, text, varchar, timestamp, decimal, jsonb, integer, index } from 'drizzle-orm/pg-core';\nexport const example = pgTable('example', { ${columns} }${callback});`
function parse(columns: string, callback = '') {
  const source = declaration(columns, callback)
  return parseDeclaration(source, 'fixture.ts', sha(source), 2, 'public.example')
}
function historical(source: string) {
  const original: Awaited<ReturnType<typeof buildAdjudication>> = JSON.parse(read(files.w4d))
  const candidate = structuredClone(original.decisionAdjudication[0].HISTORICAL_CANDIDATES[0])
  candidate.SOURCE_FILE = 'fixture.sql'
  candidate.SOURCE_FILE_SHA256 = sha(source)
  candidate.SOURCE_LINE = 1
  candidate.PHYSICAL_OBJECT = 'public.example'
  return parseHistoricalTable(source, candidate)
}
describe('W4F explicit physical evidence, no inferred semantics', () => {
  it('extracts exact PG types,length,precision and timezone,not application type aliases', () => {
    const table = parse(
      "id: uuid('id').primaryKey().defaultRandom(), name: varchar('name',{length:255}).notNull(), amount:decimal('amount',{precision:12,scale:2}), event:timestamp('event',{withTimezone:true}), content:jsonb('content').$type<Record<string,unknown>>()",
    )
    expect(table.COLUMNS.map((c) => c.PROPERTIES.POSTGRES_TYPE.VALUE)).toEqual([
      'uuid',
      'character varying(255)',
      'numeric(12,2)',
      'timestamp with time zone',
      'jsonb',
    ])
    expect(table.COLUMNS[0].PROPERTIES.DEFAULT.VALUE).toBe('gen_random_uuid()')
    expect(table.COLUMNS[0].PROPERTIES.NULLABILITY.VALUE).toBe('NOT_NULL')
    expect(table.COLUMNS[0].PROPERTIES.PRIMARY_KEY_PARTICIPATION.VALUE).toBe('PRIMARY_KEY')
    expect(table.REFERENCE.CREATION_AUTHORITY).toBe('NO')
    expect(table.REFERENCE.EXECUTION_AUTHORITY).toBe('NO')
  })
  it('does not infer nullable,no default,no identity or constraint absence from omitted chains', () => {
    const props = parse("id:uuid('id')").COLUMNS[0].PROPERTIES
    for (const key of materialProperties.filter((p) => p !== 'POSTGRES_TYPE'))
      expect(props[key].STATE).toBe('UNRESOLVED')
    expect(classify([props], []).DEFINITION_DISPOSITION).toBe('DESIGN_DECISION_REQUIRED')
  })
  it('does not default timezone,numeric precision or character length', () => {
    const table = parse("time:timestamp('time'), amount:decimal('amount'), label:varchar('label')")
    expect(table.COLUMNS.every((c) => c.PROPERTIES.POSTGRES_TYPE.STATE === 'UNRESOLVED')).toBe(true)
  })
  it('retains exact timezone distinction and JSON versus text', () => {
    const table = parse(
      "time:timestamp('time',{withTimezone:false}), content:text('content'), payload:jsonb('payload')",
    )
    expect(table.COLUMNS.map((c) => c.PROPERTIES.POSTGRES_TYPE.VALUE)).toEqual([
      'timestamp without time zone',
      'text',
      'jsonb',
    ])
  })
  it('never assumes omitted FK actions or imported physical targets', () => {
    const props = parse(
      "owner:uuid('owner').notNull().references(()=>organizations.id,{onDelete:'cascade'})",
    ).COLUMNS[0].PROPERTIES
    expect(props.FOREIGN_KEY.STATE).toBe('UNRESOLVED')
    expect(props.FOREIGN_KEY.EVIDENCE).toContain('ON_UPDATE:UNRESOLVED')
    expect(props.FOREIGN_KEY.EVIDENCE).toContain('organizations.id')
  })
  it('keeps table callback constraints/indexes as exact evidence,not guessed DDL', () => {
    const table = parse("id:uuid('id')", ", t=>[index('example_idx').on(t.id)]")
    expect(table.CONSTRAINT_SOURCE).toBe("t=>[index('example_idx').on(t.id)]")
    expect(table.LIMITATIONS.some((l) => l.includes('not silently lowered'))).toBe(true)
  })
  it('does not execute runtime default functions or discard unknown builder methods', () => {
    const props = parse("id:uuid('id').$defaultFn(()=>crypto.randomUUID())")
    expect(props.COLUMNS[0].PROPERTIES.DEFAULT.STATE).toBe('UNRESOLVED')
    expect(props.LIMITATIONS.some((l) => l.includes('$defaultFn'))).toBe(true)
  })
  it('fails source hash/range/object drift explicitly', () => {
    const text = declaration("id:uuid('id')")
    expect(() => parseDeclaration(text, 'fixture.ts', 'wrong', 2, 'public.example')).toThrow(
      'DECLARATION_SOURCE_HASH_DRIFT',
    )
    expect(() => parseDeclaration(text, 'fixture.ts', sha(text), 99, 'public.example')).toThrow(
      'EXACT_REFERENCED_PGTABLE_DECLARATION_MISSING',
    )
    expect(() => parseDeclaration(text, 'fixture.ts', sha(text), 2, 'public.other')).toThrow(
      'EXACT_REFERENCED_PGTABLE_DECLARATION_MISSING',
    )
  })
  it('requires verified pg-core imports for builders', () => {
    const text = "const example=pgTable('example',{id:uuid('id')});"
    expect(() => parseDeclaration(text, 'fixture.ts', sha(text), 1, 'public.example')).toThrow()
  })
  it('parses historical exact column types and explicit PK/null/defaults without adopting authority', () => {
    const source =
      'CREATE TABLE "public"."example" ("id" uuid DEFAULT gen_random_uuid() NOT NULL, "amount" numeric(12, 2) DEFAULT \'0\', CONSTRAINT "pk" PRIMARY KEY("id"));'
    const table = historical(source)
    expect(table.COLUMNS[0].PROPERTIES.POSTGRES_TYPE.VALUE).toBe('uuid')
    expect(table.COLUMNS[0].PROPERTIES.PRIMARY_KEY_PARTICIPATION.VALUE).toBe('PRIMARY_KEY')
    expect(table.COLUMNS[1].PROPERTIES.POSTGRES_TYPE.VALUE).toBe('numeric(12,2)')
    expect(table.REFERENCE.CLASS).toBe('HISTORICAL_SQL_DESIGN_EVIDENCE')
    expect(table.REFERENCE.CREATION_AUTHORITY).toBe('NO')
  })
  it('does not split SQL numeric precision or string commas as columns', () => {
    const table = historical(
      "CREATE TABLE public.example (amount numeric(12,2) DEFAULT 0, title text DEFAULT 'a,b', content jsonb DEFAULT '[]'::jsonb);",
    )
    expect(table.COLUMNS.map((c) => c.NAME)).toEqual(['amount', 'title', 'content'])
  })
  it('does not read constraint keywords inside SQL string defaults as constraints', () => {
    const table = historical(
      "CREATE TABLE public.example(title text DEFAULT 'NOT NULL PRIMARY KEY UNIQUE');",
    )
    const properties = table.COLUMNS[0].PROPERTIES
    expect(properties.NULLABILITY.STATE).toBe('UNRESOLVED')
    expect(properties.PRIMARY_KEY_PARTICIPATION.STATE).toBe('UNRESOLVED')
    expect(properties.UNIQUE_PARTICIPATION.STATE).toBe('UNRESOLVED')
    expect(properties.DEFAULT.VALUE).toBe('"NOT NULL PRIMARY KEY UNIQUE"')
  })
  it('detects actual conflicting explicit types,not missing evidence', () => {
    const a = parse("id:text('id')"),
      b = historical('CREATE TABLE public.example(id varchar(255) NOT NULL);')
    const result = classify(
      [a.COLUMNS[0].PROPERTIES, b.COLUMNS[0].PROPERTIES],
      [a.REFERENCE, b.REFERENCE],
    )
    expect(result.DEFINITION_DISPOSITION).toBe('DEFINITION_CONFLICT')
    expect(result.CONFLICTS[0].VALUES).toEqual(['text', 'character varying(255)'])
  })
  it('does not misclassify equivalent typed numeric/JSON defaults as contradictory', () => {
    const a = parse(
      "amount:decimal('amount',{precision:12,scale:2}).default('0'), content:jsonb('content').default([])",
    )
    const b = historical(
      "CREATE TABLE public.example(amount numeric(12,2) DEFAULT 0, content jsonb DEFAULT '[]'::jsonb);",
    )
    for (let i = 0; i < 2; i++)
      expect(
        classify([a.COLUMNS[i].PROPERTIES, b.COLUMNS[i].PROPERTIES], [a.REFERENCE, b.REFERENCE])
          .CONFLICTS,
      ).toEqual([])
  })
  it('complete classification requires every material property,no implicit success', () => {
    const table = parse("id:uuid('id')")
    const props = table.COLUMNS[0].PROPERTIES
    for (const key of materialProperties)
      props[key] = {
        STATE: 'EXPLICIT',
        VALUE: key === 'POSTGRES_TYPE' ? 'uuid' : 'EXPLICIT_FIXTURE_VALUE',
        EVIDENCE: 'Human-reviewed offline fixture only',
      }
    expect(classify([props], [table.REFERENCE]).DEFINITION_DISPOSITION).toBe(
      'CANONICAL_DEFINITION_AUTHORED',
    )
    props.DEFAULT = { STATE: 'UNRESOLVED', VALUE: null, EVIDENCE: 'not known' }
    expect(classify([props], [table.REFERENCE]).DEFINITION_DISPOSITION).toBe(
      'DESIGN_DECISION_REQUIRED',
    )
  })
  it.each([
    'DROP TABLE public.x CASCADE;',
    'INSERT INTO public.x VALUES(1);',
    'UPDATE public.x SET a=1;',
    'DELETE FROM public.x;',
    'CREATE ROLE x;',
    'GRANT SELECT ON public.x TO x;',
    'CREATE EXTENSION pgcrypto;',
    'CREATE FUNCTION public.f() RETURNS void;',
    "CREATE TYPE public.fake AS ENUM ('invented');",
    'CREATE TABLE x(id uuid);',
  ])('rejects unsafe/out-of-scope/unqualified SQL %s', (sql) => {
    expect(() => validateInactiveSql(sql)).toThrow()
  })
  it('accepts only safely qualified inactive relation shape', () => {
    expect(() => validateInactiveSql('CREATE TABLE "public"."fixture" ("id" uuid);')).not.toThrow()
  })
  it.each(['denominator', 'duplicate', 'financial', 'owner', 'kind', 'django', 'late'] as const)(
    'rejects %s universe drift',
    (kind) => {
      const obligations = structuredClone(governance.canonicalDefinitionObligations)
      const django = structuredClone(producer.djangoProducerRegistry)
      const late = structuredClone(governance.lateDefinitionRegister)
      if (kind === 'denominator') obligations.pop()
      if (kind === 'duplicate') obligations[1] = obligations[0]
      if (kind === 'financial') obligations[0].DATABASE_SCOPE_ID = 'FINANCIAL_SERVICE'
      if (kind === 'owner') obligations[0].CANONICAL_OWNER = 'DJANGO'
      if (kind === 'kind') obligations[0].OBJECT_KIND = 'TYPE'
      if (kind === 'django') django[0].PHYSICAL_IDENTITY = obligations[0].PHYSICAL_IDENTITY
      if (kind === 'late') late[0].PHYSICAL_IDENTITY = obligations[0].PHYSICAL_IDENTITY
      expect(() => validateUniverse(obligations, django, late)).toThrow()
    },
  )
})
describe('W4F bounded183 registry and honest blockers', () => {
  let report: Awaited<ReturnType<typeof buildRegistry>>
  beforeAll(async () => {
    report = await buildRegistry()
  }, 120000)
  it('preserves exact183 obligation IDs,183 decisions and no late denominator overlap', () => {
    exactIds(
      report.definitionRecords.map((d) => d.DEFINITION_OBLIGATION_ID),
      governance.canonicalDefinitionObligations.map((d) => d.DEFINITION_OBLIGATION_ID),
    )
    exactIds(
      report.definitionRecords.map((d) => d.SOURCE_W4_DECISION_ID),
      governance.canonicalDefinitionObligations.map((d) => d.SOURCE_W4_DECISION_ID),
    )
    expect(report.summary.SUM).toBe(183)
    expect(report.summary.UNACCOUNTED).toBe(0)
    expect(report.summary.CANONICAL_DEFINITION_AUTHORED).toBe(0)
    expect(report.summary.DESIGN_DECISION_REQUIRED).toBe(182)
    expect(report.summary.DEFINITION_CONFLICT).toBe(1)
  })
  it('groups125 unique relations and retains every source/column ID', () => {
    expect(report.relationDefinitions).toHaveLength(125)
    expect(
      new Set(report.relationDefinitions.map((r) => `${r.SCHEMA_NAME}.${r.RELATION_NAME}`)).size,
    ).toBe(125)
    exactIds(
      report.relationDefinitions.flatMap((r) => r.SOURCE_OBLIGATION_IDS).sort(),
      governance.canonicalDefinitionObligations.map((o) => o.DEFINITION_OBLIGATION_ID).sort(),
    )
    expect(report.summary.RELATIONS_PARTIALLY_DEFINED + report.summary.RELATIONS_CONFLICTED).toBe(
      125,
    )
  })
  it('reports the real case_documents text/varchar conflict and no fake default conflicts', () => {
    const conflicts = report.definitionRecords.filter(
      (d) => d.DEFINITION_DISPOSITION === 'DEFINITION_CONFLICT',
    )
    expect(conflicts[0].PHYSICAL_IDENTITY).toBe('union-eyes::RELATION::public.case_documents')
    expect(conflicts[0].CONFLICTS.every((c) => c.PROPERTY === 'POSTGRES_TYPE')).toBe(true)
  })
  it('enumerates183 unresolved IDs across126 exact relation-blueprint decision groups', () => {
    expect(report.designDecisions).toHaveLength(126)
    expect(
      report.incompleteDefinitionRecords.every(
        (d) =>
          d.DESIGN_CHOICE_ID && d.DESIGN_OPTIONS.length === 2 && d.MINIMUM_HUMAN_DECISION_REQUIRED,
      ),
    ).toBe(true)
    exactIds(
      report.designDecisions.flatMap((d) => d.DEFINITION_OBLIGATION_IDS).sort(),
      governance.canonicalDefinitionObligations.map((o) => o.DEFINITION_OBLIGATION_ID).sort(),
    )
    expect(
      report.designDecisions.every(
        (d) =>
          d.REQUIRES_HUMAN_APPROVAL === 'YES' &&
          d.SELECTED_VALUE === null &&
          d.OBLIGATION_SPECIFIC_PROPERTIES.length === d.DEFINITION_OBLIGATION_IDS.length,
      ),
    ).toBe(true)
  })
  it('preserves accepted fixed bytes,exact source hashes and inactive producer state', () => {
    for (const [file, hash] of Object.entries(report.preservation))
      expect(sha(read(file))).toBe(hash)
    for (const [file, hash] of Object.entries(report.sourceHashes))
      expect(sha(read(file))).toBe(hash)
    expect(report.acceptedPreservation.DJANGO_372).toBe(digest(producer.djangoProducerRegistry))
    expect(report.producerMetadataUpdates).toEqual([])
    expect(report.inactiveSqlPayloads).toEqual([])
    expect(
      report.relationDefinitions.every(
        (r) => r.INACTIVE_SQL_PAYLOAD === null && r.PRODUCER_ACTIVATED === 'NO',
      ),
    ).toBe(true)
  })
  it('retains exact declaration/historical text digests without module execution', () => {
    for (const relation of report.relationDefinitions)
      for (const table of relation.DECLARATIONS)
        expect(sha(table.REFERENCE.TEXT)).toBe(table.REFERENCE.DIGEST)
    expect(report.summary.SOURCE_FILES_HASH_CHECKED).toBe(117)
  })
  it('keeps honest blocked gate,1.3.1,no1.3.2,no W4P/W5/no runtime proof', () => {
    expect(report.phaseStatus.PHASE_1B_3C_A1I_W4F_GATE).toBe('BLOCKED')
    expect(report.phaseStatus.W4).toBe('BLOCKED_DEFINITION_DECISIONS_PENDING')
    expect(report.phaseStatus.CANONICAL_CONTRACT_VERSION).toBe('1.3.1')
    expect(report.phaseStatus.CONTRACT_1_3_2_CREATED).toBe('NO')
    expect(report.phaseStatus.W4P).toBe('NOT_AUTHORIZED')
    expect(report.phaseStatus.W5).toBe('NOT_AUTHORIZED')
    expect(report.phaseStatus.CANONICAL_DEFINITION_SQL_EXECUTED).toBe('NO')
    expect(report.phaseStatus.NO_FURTHER_W4F_GENERIC_DISCOVERY).toBe('YES')
  })
  it('matches persistent registry/report/decision data; CLI check verifies exact formatted bytes', () => {
    const saved = JSON.parse(read(outputs.report))
    expect(saved).toEqual(report)
    const registry = JSON.parse(read(outputs.registry))
    expect(registry.definitionRecords).toEqual(report.definitionRecords)
    expect(registry.relationDefinitions).toEqual(report.relationDefinitions)
    expect(JSON.parse(read(outputs.decisions)).designDecisions).toEqual(report.designDecisions)
    expect(read(outputs.registryMarkdown)).toContain('Gate: BLOCKED')
    expect(read(outputs.reportMarkdown)).toContain('Gate: BLOCKED')
  })
  it.each([['--apply'], ['--execute'], ['--check', '--check']])(
    'rejects unauthorized flag %j',
    async (...args) => {
      await expect(main(args)).rejects.toThrow()
    },
  )
})
