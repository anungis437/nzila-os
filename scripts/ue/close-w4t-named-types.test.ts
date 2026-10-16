import { describe, expect, it } from 'vitest'
import {
  assignOwnership,
  buildTypeClosure,
  classifyDefinitions,
  enumDescriptor,
  files,
  main,
  parseCurrentEnums,
  parseHistoricalTypes,
  resolveDirectImports,
  sqlTokens,
} from './close-w4t-named-types'
import { digest, read, sha } from './w4-physical-producers'

const names = new Set(['status'])
const current = (members = "'second', 'first'") =>
  parseCurrentEnums(
    'fixture.ts',
    `import {pgEnum} from 'drizzle-orm/pg-core';export const statusEnum=pgEnum('status',[${members}]);`,
    names,
  )
const historical = (members = "'second', 'first'") =>
  parseHistoricalTypes(
    'fixture.sql',
    `DO $$ BEGIN CREATE TYPE public.status AS ENUM (${members}); END $$;`,
    names,
  )

describe('W4T bounded declaration and physical completeness', () => {
  it('preserves exact enum declaration, order, ranges and digests', () => {
    const candidate = current()[0]
    expect(candidate.ORDERED_ENUM_MEMBERS).toEqual(['second', 'first'])
    expect(candidate.EXACT_DEFINITION_TEXT).toBe("statusEnum=pgEnum('status',['second', 'first'])")
    expect(candidate.DEFINITION_DIGEST).toBe(sha(candidate.EXACT_DEFINITION_TEXT))
    expect(candidate.SOURCE_RANGE).toEqual([1, 1])
    expect(candidate.TYPE_KIND).toBe('ENUM')
    expect(candidate.DEFINITION_COMPLETE).toBe(true)
  })
  it('supports exact pg-core import aliases', () => {
    expect(
      parseCurrentEnums(
        'f.ts',
        "import {pgEnum as exact} from 'drizzle-orm/pg-core';const x=exact('status',['a']);",
        names,
      )[0].ORDERED_ENUM_MEMBERS,
    ).toEqual(['a'])
  })
  it.each([
    "const pgEnum=(...args)=>args;const x=pgEnum('status',['a']);",
    "import {pgEnum} from 'unverified';const x=pgEnum('status',['a']);",
    "import {pgEnum} from 'drizzle-orm/pg-core';const x=pgEnum('unrelated',['a']);",
  ])('does not authorize untrusted factories or enlarge the denominator', (text) => {
    expect(parseCurrentEnums('f.ts', text, names)).toEqual([])
  })
  it.each(['members', "['a', ...members]", "['a', dynamic]", "['a','a']"])(
    'holds nonreproducible enum %s',
    (values) => {
      const parsed = parseCurrentEnums(
        'f.ts',
        `import {pgEnum} from 'drizzle-orm/pg-core';const x=pgEnum('status',${values});`,
        names,
      )
      expect(parsed[0].DEFINITION_COMPLETE).toBe(false)
      expect(classifyDefinitions(parsed).DEFINITION_STATUS).toBe('HOLD_DEFINITION_INCOMPLETE')
    },
  )
  it('does not infer members from defaults, UI, validations or unrelated constants', () => {
    expect(classifyDefinitions([])).toMatchObject({
      EVIDENCE_CLASS: 'REFERENCE_ONLY_NO_DEFINITION',
      DEFINITION_STATUS: 'HOLD_DEFINITION_INCOMPLETE',
      SELECTED: null,
    })
  })
  it('extracts quoted guarded SQL, escaped literals and original order without comments or literal false matches', () => {
    const text = `-- CREATE TYPE status AS ENUM ('bad');
/* nested /* CREATE TYPE status AS ENUM ('bad'); */ */
SELECT 'CREATE TYPE status AS ENUM (''bad'');';
DO $body$ BEGIN CREATE TYPE "public"."status" AS ENUM ('second','it''s','first'); END $body$;`
    const parsed = parseHistoricalTypes('f.sql', text, names)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].ORDERED_ENUM_MEMBERS).toEqual(['second', "it's", 'first'])
    expect(parsed[0].SCHEMA_NAME).toBe('public')
    expect(parsed[0].SOURCE_RANGE).toEqual([4, 4])
  })
  it.each(["'a',", "'a' || 'b'", "'a','a'"])(
    'holds malformed or duplicate historical members',
    (members) => {
      expect(classifyDefinitions(historical(members)).DEFINITION_STATUS).toBe(
        'HOLD_DEFINITION_INCOMPLETE',
      )
    },
  )
  it.each([
    ['DOMAIN', "CREATE DOMAIN public.status AS text NOT NULL CHECK (VALUE <> '');"],
    ['COMPOSITE', 'CREATE TYPE public.status AS (value text, rank integer);'],
    ['OTHER_EXPLICIT_POSTGRES_NAMED_TYPE', 'CREATE TYPE public.status;'],
  ])('records %s without inventing unsupported complete physical properties', (kind, text) => {
    const candidate = parseHistoricalTypes('f.sql', text, names)[0]
    expect(candidate.TYPE_KIND).toBe(kind)
    expect(candidate.DEFINITION_COMPLETE).toBe(false)
    expect(classifyDefinitions([candidate]).DEFINITION_STATUS).toBe('HOLD_DEFINITION_INCOMPLETE')
  })
  it.each(['/* incomplete', "SELECT 'unterminated", 'DO $$ incomplete'])(
    'surfaces lexical errors',
    (text) => {
      expect(() => sqlTokens(text)).toThrow('UNTERMINATED')
    },
  )
  it('resolves only named direct imports;no barrel/reexport recursion or unrelated imports', () => {
    const imports = resolveDirectImports(
      'apps/union-eyes/db/schema/fixture.ts',
      "import {typeEnum as used} from './types';import {unrelated} from './other';export {typeEnum} from './barrel';",
      new Set(['used']),
    )
    expect(imports).toHaveLength(1)
    expect(imports[0]).toMatchObject({
      MODULE: './types',
      LOCAL_SYMBOL: 'used',
      EXPORTED_SYMBOL: 'typeEnum',
    })
    expect(imports[0].CANDIDATE_FILES.every((file) => file.includes('schema'))).toBe(true)
  })
  it('preserves external direct-import unavailability instead of inventing a source', () => {
    expect(
      resolveDirectImports('f.ts', "import {e} from 'external';", new Set(['e']))[0]
        .CANDIDATE_FILES,
    ).toEqual([])
  })
  it.each([
    [current(), 'EXACT_CURRENT_TYPE_DECLARATION'],
    [historical(), 'EXACT_HISTORICAL_TYPE_DEFINITION'],
    [[...current(), ...historical()], 'CONSISTENT_CURRENT_AND_HISTORICAL_DEFINITION'],
  ])(
    'classifies exact sources without creating historical ownership',
    (candidates, evidenceClass) => {
      expect(classifyDefinitions(candidates)).toMatchObject({
        EVIDENCE_CLASS: evidenceClass,
        DEFINITION_STATUS: 'EXACT_DEFINITION_AVAILABLE',
      })
    },
  )
  it('retains ordered conflicts;does not union, alphabetize or prefer current chronology', () => {
    expect(classifyDefinitions([...current(), ...historical("'first','second'")])).toEqual({
      EVIDENCE_CLASS: 'CONFLICTING_TYPE_DEFINITIONS',
      DEFINITION_STATUS: 'HOLD_DEFINITION_CONFLICT',
      SELECTED: null,
    })
  })
  it('settles ownership independently of held definitions under new human authority', () => {
    expect(assignOwnership('status', 'public', [], true)).toMatchObject({
      OWNERSHIP_STATUS: 'PLATFORM_BASELINE_GOVERNANCE_ADOPTED',
      OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4T',
      CANONICAL_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
    })
    expect(classifyDefinitions([]).DEFINITION_STATUS).toBe('HOLD_DEFINITION_INCOMPLETE')
  })
  it('preserves existing external/financial/frozen authorities and holds collisions', () => {
    const external = {
      CLASS: 'EXTERNAL',
      AUTHORITY: 'EXTERNAL_PACKAGE',
      EVIDENCE: 'exact identity',
    }
    expect(assignOwnership('status', 'public', [external], true).OWNERSHIP_STATUS).toBe(
      'EXISTING_CANONICAL_AUTHORITY',
    )
    expect(
      assignOwnership(
        'status',
        'public',
        [external, { ...external, AUTHORITY: 'FINANCIAL_SERVICE' }],
        true,
      ).OWNERSHIP_STATUS,
    ).toBe('HOLD_CONFLICTING_AUTHORITY')
  })
  it.each([
    ['text', 'public'],
    ['vector', 'public'],
    ['status', 'pg_catalog'],
    ['status', 'information_schema'],
  ])('prevents system/extension capture %s.%s', (name, schema) => {
    expect(() => assignOwnership(name, schema, [], true)).toThrow(
      'BUILTIN_OR_EXTENSION_TYPE_CAPTURE',
    )
  })
  it('prevents prospective adoption without an accepted platform consumer', () => {
    expect(() => assignOwnership('status', 'public', [], false)).toThrow(
      'TYPE_NOT_PLATFORM_DEFINITION_DEPENDENCY',
    )
  })
  it('provides type-only nonexecutable qualified ordered descriptors', () => {
    expect(enumDescriptor('public', 'status', ['second', "it's", 'first'])).toMatchObject({
      SQL: `CREATE TYPE "public"."status" AS ENUM ('second', 'it''s', 'first');`,
      SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
      EXECUTION_ALLOWED: 'NO',
    })
  })
  it('rejects unsafe identity and duplicate or invalid enum values', () => {
    expect(() => enumDescriptor('public', 'x;DROP', ['a'])).toThrow('INVALID_TYPE_IDENTITY')
    expect(() => enumDescriptor('public', 'status', ['a', 'a'])).toThrow()
    expect(() => enumDescriptor('public', 'status', ['a'.repeat(64)])).toThrow()
  })
  it.each(['--execute', '--regenerate-w4fr', '--publish', '--write-contract'])(
    'refuses later workstream and unknown flags %s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG')
    },
  )
})
describe('W4T frozen bounded consumer and authority closure', () => {
  const model = buildTypeClosure()
  it('reconciles all36 types/38 references/28 relations and obligations without denominator expansion', () => {
    expect(model.registry.typeRecords).toHaveLength(36)
    expect(model.registry.referenceLinks).toHaveLength(38)
    expect(model.registry.summary).toMatchObject({
      AFFECTED_RELATIONS: 28,
      AFFECTED_OBLIGATIONS: 28,
      UNACCOUNTED: 0,
      PLATFORM_BASELINE_GOVERNANCE_ADOPTED: 36,
      EXISTING_CANONICAL_AUTHORITY: 0,
      HELD_CONFLICTING_AUTHORITY: 0,
      EXACT_DEFINITION_AVAILABLE: 32,
      HELD_DEFINITION_CONFLICT: 4,
      HELD_DEFINITION_INCOMPLETE: 0,
      SOURCE_FILES_CHECKED: 20,
      INACTIVE_TYPE_DESCRIPTORS: 32,
    })
    for (const record of model.registry.typeRecords) {
      expect(record.CONSUMER_REFERENCE_COUNT).toBe(record.CONSUMER_COLUMNS.length)
      expect(record.SOURCE_W4_DEFINITION_OBLIGATION_IDS.length).toBeGreaterThan(0)
      expect(record.TYPE_KIND).toBe('ENUM')
      expect(record.OWNERSHIP_AUTHORITY).toBe('HUMAN_GOVERNANCE_W4T')
    }
  })
  it('links exact frozen type/column/obligation evidence,not a count-only proxy', () => {
    const frozen: {
      dependencyBlockers: {
        GOVERNED_TYPE_NAME: string
        RELATION: string
        COLUMN: string
        AFFECTED_DEFINITION_OBLIGATION_IDS: string[]
      }[]
    } = JSON.parse(read(files.w4fr))
    expect(
      model.registry.referenceLinks.map((record) => ({
        GOVERNED_TYPE_NAME: record.GOVERNED_TYPE_NAME,
        RELATION: record.CONSUMER_RELATION,
        COLUMN: record.CONSUMER_COLUMN,
        AFFECTED_DEFINITION_OBLIGATION_IDS: record.SOURCE_W4_DEFINITION_OBLIGATION_IDS,
      })),
    ).toEqual(
      frozen.dependencyBlockers.map((record) => ({
        GOVERNED_TYPE_NAME: record.GOVERNED_TYPE_NAME,
        RELATION: record.RELATION,
        COLUMN: record.COLUMN,
        AFFECTED_DEFINITION_OBLIGATION_IDS: record.AFFECTED_DEFINITION_OBLIGATION_IDS,
      })),
    )
  })
  it('holds exactly four observed member-set conflicts and excludes their descriptors', () => {
    expect(model.residual.residual.map((record) => record.CANONICAL_TYPE_IDENTITY)).toEqual([
      'public.fee_adjustment_type',
      'public.ledger_event_type',
      'public.ledger_source_type',
      'public.platform_cost_type',
    ])
    for (const record of model.registry.typeRecords.filter(
      (record) => record.TYPE_APPROVAL_STATUS === 'HELD',
    )) {
      expect(record.SELECTED).toBeNull()
      expect(record.INACTIVE_TYPE_DESCRIPTOR).toBeNull()
      expect(
        new Set(
          record.TYPE_DEFINITION_EVIDENCE.map((candidate) =>
            JSON.stringify(candidate.ORDERED_ENUM_MEMBERS),
          ),
        ).size,
      ).toBe(2)
    }
  })
  it('does not authorize retry or claim materialization on bounded BLOCKED', () => {
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4T_GATE: 'BLOCKED',
      W4FR_RETRY: 'NOT_AUTHORIZED',
      NO_FURTHER_W4T_GENERIC_DISCOVERY: 'YES',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
    })
    expect(model.report.proofBoundaries.NAMED_TYPES_MATERIALIZED).toBe('NO')
  })
  it('preserves all frozen source and upstream bytes;no edits to historical artifacts', () => {
    for (const [file, hash] of Object.entries({
      ...model.report.preservation,
      ...model.report.sourceHashes,
    }))
      expect(sha(read(file))).toBe(hash)
    expect(model.report.preservation[files.canonical]).toBe(
      '6b4c81a8ceded4f70ae59e313656149e9c3246aa0feeee1973062d63ea8c114e',
    )
    expect(model.report.governanceAccounting).toMatchObject({
      DESIGN_GROUPS_CLOSED: 126,
      DEFINITION_OBLIGATIONS_GOVERNED: 183,
      RELATION_BLUEPRINTS: 125,
      RELATION_COLUMN_GOVERNANCE_CHANGED: 'NO',
    })
  })
  it('is model deterministic without expensive formatter recursion in unit tests', () => {
    expect(digest(buildTypeClosure())).toBe(digest(model))
  })
})
