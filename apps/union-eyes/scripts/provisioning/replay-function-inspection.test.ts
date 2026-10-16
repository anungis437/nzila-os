import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import * as lexer from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import {
  replayDigest,
  replayHash,
  replayObject,
  replayRecords,
  replayText,
} from './post-w4p-replay'
import {
  compileFunctionEffect,
  functionCatalogQueries,
  inspectFunctionEffect,
  type FunctionEffect,
  type FunctionPrerequisites,
} from './replay-function-inspection'
import type { CatalogReader } from './platform-baseline-promotion'

const root = new URL('../../../../', import.meta.url)
const ledger = replayObject(
  JSON.parse(
    readFileSync(
      new URL(
        'docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
        root,
      ),
      'utf8',
    ),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES).flatMap((boundary) =>
  replayRecords(boundary.EFFECTS)
    .filter((effect) => effect.EFFECT_CLASS === 'FUNCTION_OR_PROCEDURE')
    .map((effect) => ({
      effect,
      boundary,
      source: replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
      hash: replayText(effect.EXACT_EFFECT_SHA256),
    })),
)
const expected = [
  [
    'ue_create_direct_org_rls_policy',
    ['p_table_name', 'p_org_column', 'p_org_column_is_text'],
    ['text', 'text', 'bool'],
    "'organization_id'::text, false",
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_parent_owned_rls_policy',
    ['p_table_name', 'p_parent_fk_column'],
    ['text', 'text'],
    "'thread_id'::text",
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_user_self_rls_policy',
    ['p_table_name', 'p_user_column', 'p_org_column'],
    ['text', 'text', 'text'],
    "'user_id'::text, 'organization_id'::text",
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_mixed_global_tenant_rls_policy',
    ['p_table_name', 'p_org_column'],
    ['text', 'text'],
    "'organization_id'::text",
    'void',
    'plpgsql',
    'v',
  ],
  // DROP's existing target may have the legacy names/body; they are not the
  // subsequently recreated effect's expected definition.
  [
    'ue_create_multi_party_rls_policy',
    ['p_table_name', 'p_org_column_a', 'p_org_column_b'],
    ['text', 'text', 'text'],
    null,
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_multi_party_rls_policy',
    ['p_table_name', 'p_party_column_1', 'p_party_column_2'],
    ['text', 'text', 'text'],
    null,
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_parent_owned_rls_policy_v2',
    [
      'p_table_name',
      'p_fk_column',
      'p_parent_table',
      'p_parent_org_column',
      'p_parent_org_is_text',
    ],
    ['text', 'text', 'text', 'text', 'bool'],
    "'organization_id'::text, false",
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_user_rls_policy',
    ['p_table_name', 'p_user_column'],
    ['text', 'text'],
    "'user_id'::text",
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_parent_owned_via_user_rls_policy_v2',
    ['p_table_name', 'p_fk_column', 'p_parent_table', 'p_parent_user_column'],
    ['text', 'text', 'text', 'text'],
    "'user_id'::text",
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_shared_library_rls_policy',
    ['p_table_name', 'p_org_column', 'p_sharing_level_column', 'p_shared_with_column'],
    ['text', 'text', 'text', 'text'],
    null,
    'void',
    'plpgsql',
    'v',
  ],
  [
    'ue_create_shared_library_child_rls_policy',
    ['p_table_name', 'p_fk_column'],
    ['text', 'text'],
    null,
    'void',
    'plpgsql',
    'v',
  ],
  ['ue_is_workbook_system_principal', [], [], null, 'bool', 'sql', 's'],
  ['ue_enforce_workbook_credential_authority', [], [], null, 'trigger', 'plpgsql', 'v'],
] as const

const acl = [
  {
    grantor: 'fixture_owner',
    grantee: 'fixture_owner',
    privilege: 'EXECUTE' as const,
    grantable: false,
  },
  { grantor: 'fixture_owner', grantee: 'PUBLIC', privilege: 'EXECUTE' as const, grantable: false },
]
function prerequisites(spec: FunctionEffect): FunctionPrerequisites {
  return { sourceHash: spec.sourceHash, schema: 'fixture_schema', owner: 'fixture_owner', acl }
}
function catalogRow(index: number): Record<string, unknown> {
  const [name, names, types, defaults, returnName, language, volatility] = expected[index]
  const source = effects[index].source
  const bodyStart = source.indexOf('$$') + 2
  const bodyEnd = source.indexOf('$$', bodyStart)
  return {
    schema: 'fixture_schema',
    name,
    kind: 'f',
    argument_types: types.map((name) => ({ schema: 'pg_catalog', name, kind: 'b' })),
    argument_names: names.length ? [...names] : null,
    argument_modes: null,
    all_argument_types: null,
    argument_count: types.length,
    variadic: '0',
    default_count: defaults === null ? 0 : defaults.split(',').length,
    defaults,
    return_schema: 'pg_catalog',
    return_name: returnName,
    return_kind: returnName === 'bool' ? 'b' : 'p',
    returns_set: false,
    language,
    security_definer: false,
    volatility,
    strict: false,
    parallel: 'u',
    leakproof: false,
    config: null,
    body: index === 4 ? '\nBEGIN\n  RETURN;\nEND;\n' : source.slice(bodyStart, bodyEnd),
    binary: null,
    cost: 100,
    rows: 0,
    support: '0',
    transforms: null,
    sql_body_absent: true,
    owner: 'fixture_owner',
    acl,
    dependents: [],
  }
}
type QueryKey = keyof typeof functionCatalogQueries
function fakeReader(
  spec: FunctionEffect,
  functions: unknown[],
  overrides: Partial<Record<QueryKey, unknown[]>> = {},
) {
  const calls: { key: QueryKey; parameters: string[] }[] = []
  const reader: CatalogReader = {
    async query(sql, parameters) {
      const key = (Object.keys(functionCatalogQueries) as QueryKey[]).find(
        (key) => functionCatalogQueries[key] === sql,
      )
      expect(key).toBeDefined()
      if (!key) throw new Error('unapproved query')
      calls.push({ key, parameters })
      if (key === 'namespace') expect(parameters).toEqual(['fixture_schema'])
      if (key === 'owner') expect(parameters).toEqual(['fixture_owner'])
      if (key === 'functions') expect(parameters).toEqual(['fixture_schema', spec.name])
      if (key === 'language') expect(parameters).toEqual([spec.language, 'fixture_owner'])
      if (key === 'type') {
        expect(parameters[0]).toBe('pg_catalog')
        expect(['text', 'bool', 'void', 'trigger']).toContain(parameters[1])
      }
      if (overrides[key]) return structuredClone(overrides[key])
      if (key === 'namespace') return [{ name: 'fixture_schema' }]
      if (key === 'owner') return [{ name: 'fixture_owner' }]
      if (key === 'type')
        return [
          {
            schema: parameters[0],
            name: parameters[1],
            kind: ['void', 'trigger'].includes(parameters[1]) ? 'p' : 'b',
            visible: true,
          },
        ]
      if (key === 'language') return [{ name: spec.language, trusted: true, owner_usage: true }]
      return structuredClone(functions)
    },
  }
  return { reader, calls }
}

describe('source-local function definition comparators (not replay qualification)', () => {
  it('accounts for exactly 13 frozen effects: 12 declarations and one restrictive drop', () => {
    expect(effects).toHaveLength(13)
    expect(effects.filter(({ source }) => /\bDROP FUNCTION IF EXISTS\b/.test(source))).toHaveLength(
      1,
    )
    expect(new Set(effects.map(({ hash }) => hash)).size).toBe(13)
  })
  effects.forEach(({ effect, boundary, source, hash }, index) => {
    const id = replayText(effect.EFFECT_ID)
    const spec = compileFunctionEffect(source, hash)
    const context = prerequisites(spec)
    const exact = catalogRow(index)
    it(`source bytes, full signature and body: ${id}`, () => {
      const bytes = readFileSync(fileURLToPath(new URL(replayText(boundary.SOURCE_PATH), root)))
      const range = effect.SOURCE_BYTE_RANGE as number[]
      expect(bytes.subarray(range[0], range[1]).toString('utf8')).toBe(source)
      expect(replayHash(bytes.toString('utf8'))).toBe(boundary.SOURCE_SHA256)
      expect(replayHash(source)).toBe(hash)
      expect(spec.schema).toBeNull()
      expect(spec.name).toBe(expected[index][0])
      expect(spec.arguments.map((arg) => arg.type.name)).toEqual(expected[index][2])
      expect(spec.arguments.map((arg) => arg.name)).toEqual(
        index === 4 ? [null, null, null] : expected[index][1],
      )
      expect(spec.returns?.name ?? null).toBe(index === 4 ? null : expected[index][4])
      expect(spec.language).toBe(index === 4 ? null : expected[index][5])
      expect(spec.body).toBe(index === 4 ? null : exact.body)
      expect(() => compileFunctionEffect(source + '\n', hash)).toThrow(
        'REPLAY_FUNCTION_SOURCE_HASH_DRIFT',
      )
      const wrongSource = source + '\n-- changed source position'
      expect(compileFunctionEffect(wrongSource, replayHash(wrongSource)).contractDigest).not.toBe(
        spec.contractDigest,
      )
    })
    it(`actual guarded reader comparison and digest: ${id}`, async () => {
      const { reader, calls } = fakeReader(spec, [exact])
      const observation = await inspectFunctionEffect(reader, spec, context)
      expect(observation.definition).toBe(index === 4 ? 'DRIFTED' : 'EXACT')
      expect(observation.denial).toBeNull()
      expect(observation.stateDigest).toMatch(/^[a-f0-9]{64}$/)
      expect(await inspectFunctionEffect(fakeReader(spec, [exact]).reader, spec, context)).toEqual(
        observation,
      )
      expect(calls.at(-1)).toEqual({ key: 'functions', parameters: ['fixture_schema', spec.name] })
      expect(
        (await inspectFunctionEffect(fakeReader(spec, []).reader, spec, context)).definition,
      ).toBe('ABSENT')
      expect(
        (await inspectFunctionEffect(fakeReader(spec, []).reader, spec, context)).stateDigest,
      ).not.toBe(observation.stateDigest)
    })
    it(`explicit source-bound context denial: ${id}`, async () => {
      const { reader, calls } = fakeReader(spec, [exact])
      expect(await inspectFunctionEffect(reader, spec)).toMatchObject({
        definition: 'PRECONDITION_MISSING',
        denial: 'SOURCE_RESOLUTION_OWNER_ACL_CONTEXT_REQUIRED',
      })
      expect(calls).toHaveLength(0)
      await expect(
        inspectFunctionEffect(reader, spec, { ...context, sourceHash: '0'.repeat(64) }),
      ).rejects.toThrow('REPLAY_FUNCTION_PREREQUISITE_BINDING_INVALID')
      await expect(
        inspectFunctionEffect(reader, { ...spec, name: 'tampered' }, context),
      ).rejects.toThrow('REPLAY_FUNCTION_IR_DRIFT')
      await expect(
        inspectFunctionEffect(reader, { ...spec, body: 'tampered' }, context),
      ).rejects.toThrow('REPLAY_FUNCTION_IR_DRIFT')
    })
    for (const [key, denial] of [
      ['namespace', 'FUNCTION_SCHEMA_MISSING'],
      ['owner', 'FUNCTION_OWNER_MISSING'],
      ['type', 'FUNCTION_TYPE_MISSING'],
      ...(index === 4 ? [] : [['language', 'FUNCTION_LANGUAGE_MISSING']]),
    ] as [QueryKey, string][]) {
      it(`missing ${key} prerequisite: ${id}`, async () => {
        const { reader, calls } = fakeReader(spec, [exact], { [key]: [] })
        expect(await inspectFunctionEffect(reader, spec, context)).toMatchObject({
          definition: 'PRECONDITION_MISSING',
          denial,
        })
        expect(calls.some((call) => call.key === 'functions')).toBe(false)
      })
      it(`malformed ${key} prerequisite: ${id}`, async () => {
        await expect(
          inspectFunctionEffect(
            fakeReader(spec, [exact], { [key]: [{ complete: true }] }).reader,
            spec,
            context,
          ),
        ).rejects.toThrow(ProvisioningError)
      })
      it(`ambiguous ${key} prerequisite: ${id}`, async () => {
        await expect(
          inspectFunctionEffect(
            fakeReader(spec, [exact], { [key]: [{}, {}] }).reader,
            spec,
            context,
          ),
        ).rejects.toThrow('REPLAY_FUNCTION_CATALOG_CARDINALITY_INVALID')
      })
    }
    it(`catalog row validation and duplicate identity denial: ${id}`, async () => {
      await expect(
        inspectFunctionEffect(fakeReader(spec, [{ complete: true }]).reader, spec, context),
      ).rejects.toThrow('REPLAY_FUNCTION_CATALOG_ROW_INVALID')
      await expect(
        inspectFunctionEffect(fakeReader(spec, [exact, exact]).reader, spec, context),
      ).rejects.toThrow('REPLAY_FUNCTION_CATALOG_CARDINALITY_INVALID')
      await expect(
        inspectFunctionEffect(
          fakeReader(spec, [{ ...exact, schema: 'wrong_schema' }]).reader,
          spec,
          context,
        ),
      ).rejects.toThrow('REPLAY_FUNCTION_CATALOG_CARDINALITY_INVALID')
      await expect(
        inspectFunctionEffect(
          fakeReader(spec, [{ ...exact, name: 'wrong_name' }]).reader,
          spec,
          context,
        ),
      ).rejects.toThrow('REPLAY_FUNCTION_CATALOG_CARDINALITY_INVALID')
    })
    it(`owner and ACL are not inferred from source or presence: ${id}`, async () => {
      for (const change of [
        { owner: 'other_owner' },
        { acl: [] },
        {
          acl: [
            ...acl,
            {
              grantor: 'fixture_owner',
              grantee: 'unexpected_grantee',
              privilege: 'EXECUTE',
              grantable: false,
            },
          ],
        },
        { acl: acl.map((entry) => ({ ...entry, grantable: true })) },
        { acl: acl.map((entry) => ({ ...entry, grantor: 'other_owner' })) },
      ]) {
        expect(
          (
            await inspectFunctionEffect(
              fakeReader(spec, [{ ...exact, ...change }]).reader,
              spec,
              context,
            )
          ).definition,
        ).toBe('DRIFTED')
      }
      expect(
        (
          await inspectFunctionEffect(
            fakeReader(spec, [{ ...exact, acl: [...acl].reverse() }]).reader,
            spec,
            context,
          )
        ).definition,
      ).toBe(index === 4 ? 'DRIFTED' : 'EXACT')
    })
    if (index === 4) {
      it('restrictive DROP never substitutes the subsequent CREATE definition', async () => {
        const dependent = { class_id: '2620', object_id: '17001', sub_id: 0, kind: 'n' }
        expect(
          await inspectFunctionEffect(
            fakeReader(spec, [{ ...exact, dependents: [dependent] }]).reader,
            spec,
            context,
          ),
        ).toMatchObject({
          definition: 'PRECONDITION_MISSING',
          denial: 'DROP_RESTRICT_DEPENDENTS_REQUIRE_SEPARATE_ANALYSIS',
        })
        const created = compileFunctionEffect(effects[5].source, effects[5].hash)
        expect(
          (await inspectFunctionEffect(fakeReader(spec, [catalogRow(5)]).reader, spec, context))
            .definition,
        ).toBe('DRIFTED')
        expect(
          (
            await inspectFunctionEffect(
              fakeReader(created, [catalogRow(5)]).reader,
              created,
              prerequisites(created),
            )
          ).definition,
        ).toBe('EXACT')
        expect(spec.contractDigest).not.toBe(created.contractDigest)
        expect(
          (
            await inspectFunctionEffect(
              fakeReader(created, [exact]).reader,
              created,
              prerequisites(created),
            )
          ).definition,
        ).toBe('DRIFTED')
      })
      return
    }
    const drift = [
      ['return_schema', 'unapproved_schema'],
      ['return_name', 'record'],
      ['return_kind', 'b'],
      ['returns_set', true],
      ['kind', 'p'],
      ['argument_modes', spec.arguments.map(() => 'i')],
      ['all_argument_types', '{}'],
      ['variadic', '25'],
      ['language', spec.language === 'sql' ? 'plpgsql' : 'sql'],
      ['security_definer', true],
      ['volatility', spec.volatility === 'v' ? 's' : 'v'],
      ['strict', true],
      ['parallel', 's'],
      ['parallel', 'r'],
      ['leakproof', true],
      ['config', ['search_path=unapproved_schema, pg_catalog']],
      ['config', ['search_path=public']],
      ['config', []],
      ['config', ['statement_timeout=1s']],
      ['body', String(exact.body).replace('BEGIN', 'BEGIN\n  PERFORM 1;') + '\n-- changed'],
      ['binary', 'unexpected_library'],
      ['cost', 1],
      ['rows', 1],
      ['support', '25'],
      ['transforms', '{}'],
      ['sql_body_absent', false],
      ['argument_names', spec.arguments.length ? spec.arguments.map(() => 'renamed') : []],
    ] as [string, unknown][]
    // bool's kind is already b, so use a genuinely different return kind.
    if (spec.returns?.kind === 'b') drift[2] = ['return_kind', 'p']
    for (const [field, value] of drift) {
      it(`drift in ${field}=${JSON.stringify(value)}: ${id}`, async () => {
        const actual = await inspectFunctionEffect(
          fakeReader(spec, [{ ...exact, [field]: value }]).reader,
          spec,
          context,
        )
        expect(actual.definition).toBe('DRIFTED')
        expect(actual.stateDigest).not.toBe(
          (await inspectFunctionEffect(fakeReader(spec, [exact]).reader, spec, context))
            .stateDigest,
        )
      })
    }
    it(`other overload is not this signature: ${id}`, async () => {
      const other = {
        ...exact,
        argument_types: [{ schema: 'pg_catalog', name: 'int4', kind: 'b' }],
        argument_names: ['other'],
        argument_count: 1,
        default_count: 0,
        defaults: null,
      }
      expect(
        (await inspectFunctionEffect(fakeReader(spec, [other]).reader, spec, context)).definition,
      ).toBe('ABSENT')
      expect(
        (await inspectFunctionEffect(fakeReader(spec, [other, exact]).reader, spec, context))
          .definition,
      ).toBe('EXACT')
    })
    if (spec.arguments.length) {
      it(`argument type identity and kind: ${id}`, async () => {
        const types = structuredClone(exact.argument_types) as Record<string, string>[]
        types[0].kind = 'd'
        expect(
          (
            await inspectFunctionEffect(
              fakeReader(spec, [{ ...exact, argument_types: types }]).reader,
              spec,
              context,
            )
          ).definition,
        ).toBe('DRIFTED')
      })
    }
    if (spec.arguments.some((arg) => arg.default)) {
      for (const defaults of [
        "'wrong'::text",
        "'organization_id'::unapproved.text, false",
        'current_user',
        "'organization_id'::text, true",
        "'organization_id'::text, false; SELECT 1",
        "'unterminated",
      ]) {
        it(`literal default drift ${defaults}: ${id}`, async () => {
          expect(
            (
              await inspectFunctionEffect(
                fakeReader(spec, [{ ...exact, defaults }]).reader,
                spec,
                context,
              )
            ).definition,
          ).toBe('DRIFTED')
        })
      }
      it(`default count drift: ${id}`, async () => {
        expect(
          (
            await inspectFunctionEffect(
              fakeReader(spec, [{ ...exact, default_count: 0, defaults: null }]).reader,
              spec,
              context,
            )
          ).definition,
        ).toBe('DRIFTED')
      })
    }
    for (const [field, value] of [
      ['security_definer', 'false'],
      ['strict', 0],
      ['parallel', 'unknown'],
      ['volatility', 'unknown'],
      ['config', 'search_path=public'],
      ['config', [null]],
      ['body', null],
      ['argument_types', [null]],
      ['argument_names', 'not-array'],
      ['argument_count', -1],
      ['default_count', 900],
      ['defaults', undefined],
      ['acl', [{ complete: true }]],
      ['acl', [...acl, acl[0]]],
      ['dependents', [{ complete: true }]],
      ['sql_body_absent', undefined],
      ['cost', Number.NaN],
    ] as [string, unknown][]) {
      it(`malformed ${field}: ${id}`, async () => {
        await expect(
          inspectFunctionEffect(
            fakeReader(spec, [{ ...exact, [field]: value }]).reader,
            spec,
            context,
          ),
        ).rejects.toThrow('REPLAY_FUNCTION_CATALOG_ROW_INVALID')
      })
    }
  })

  it('preserves body whitespace, comments, quoted strings and source supersession', async () => {
    const original = effects[5]
    for (const source of [
      original.source.replace('END;\n$$', () => 'END;\n-- different source body\n$$'),
      original.source.replace('current_setting', 'CURRENT_SETTING'),
      original.source.replace('BEGIN\n', 'BEGIN \n'),
      original.source.replace('p_party_column_1', 'p_org_column_a'),
    ]) {
      const spec = compileFunctionEffect(source, replayHash(source))
      expect(
        (
          await inspectFunctionEffect(
            fakeReader(spec, [catalogRow(5)]).reader,
            spec,
            prerequisites(spec),
          )
        ).definition,
      ).toBe('DRIFTED')
      expect(spec.contractDigest).not.toBe(
        compileFunctionEffect(original.source, original.hash).contractDigest,
      )
    }
  })
  it('permits only harmless header changes while retaining their distinct source commitments', async () => {
    const source = effects[11].source
    const changed = source
      .replace('LANGUAGE sql\nSTABLE\nAS $$', 'AS $ue$\n')
      .replace('$$;', '$ue$ LANGUAGE sql STABLE;')
    const a = compileFunctionEffect(source, effects[11].hash)
    const b = compileFunctionEffect(changed, replayHash(changed))
    expect(b.body).toBe('\n\n' + String(a.body).slice(1))
    expect(a.sourceHash).not.toBe(b.sourceHash)
    // Removing a header newline preserves the body itself, not the source hash.
    const sameBody = changed.replace('AS $ue$\n\n', 'AS $ue$\n')
    const c = compileFunctionEffect(sameBody, replayHash(sameBody))
    expect(c.body).toBe(a.body)
    expect(
      (await inspectFunctionEffect(fakeReader(c, [catalogRow(11)]).reader, c, prerequisites(c)))
        .definition,
    ).toBe('EXACT')
  })
  it('qualifies identifiers without inventing an unqualified public schema', async () => {
    const source = effects[11].source.replace(
      'FUNCTION ue_is_workbook_system_principal',
      'FUNCTION "fixture_schema"."ue_is_workbook_system_principal"',
    )
    const spec = compileFunctionEffect(source, replayHash(source))
    expect(spec.schema).toBe('fixture_schema')
    expect(
      (
        await inspectFunctionEffect(
          fakeReader(spec, [catalogRow(11)]).reader,
          spec,
          prerequisites(spec),
        )
      ).definition,
    ).toBe('EXACT')
    await expect(
      inspectFunctionEffect(fakeReader(spec, []).reader, spec, {
        ...prerequisites(spec),
        schema: 'public',
      }),
    ).rejects.toThrow('REPLAY_FUNCTION_PREREQUISITE_BINDING_INVALID')
  })
  it('denies hidden type bindings, absent trusted languages and missing language privileges', async () => {
    const spec = compileFunctionEffect(effects[0].source, effects[0].hash)
    for (const [key, rows, denial] of [
      [
        'type',
        [{ schema: 'pg_catalog', name: 'text', kind: 'b', visible: false }],
        'UNQUALIFIED_TYPE_RESOLUTION_NOT_ESTABLISHED',
      ],
      [
        'language',
        [{ name: 'plpgsql', trusted: false, owner_usage: true }],
        'FUNCTION_LANGUAGE_OWNER_USAGE_NOT_ESTABLISHED',
      ],
      [
        'language',
        [{ name: 'plpgsql', trusted: true, owner_usage: false }],
        'FUNCTION_LANGUAGE_OWNER_USAGE_NOT_ESTABLISHED',
      ],
    ] as [QueryKey, unknown[], string][]) {
      expect(
        await inspectFunctionEffect(
          fakeReader(spec, [catalogRow(0)], { [key]: rows }).reader,
          spec,
          prerequisites(spec),
        ),
      ).toMatchObject({ definition: 'PRECONDITION_MISSING', denial })
    }
  })
  it('rejects forged ACL prerequisites and IR contract digests before trusting catalog presence', async () => {
    const spec = compileFunctionEffect(effects[0].source, effects[0].hash)
    await expect(
      inspectFunctionEffect(fakeReader(spec, []).reader, spec, {
        ...prerequisites(spec),
        acl: [{ ...acl[0], grantable: 'true' } as never],
      }),
    ).rejects.toThrow('REPLAY_FUNCTION_CATALOG_ROW_INVALID')
    await expect(
      inspectFunctionEffect(
        fakeReader(spec, []).reader,
        { ...spec, contractDigest: replayDigest('forged') },
        prerequisites(spec),
      ),
    ).rejects.toThrow('REPLAY_FUNCTION_IR_DRIFT')
  })
  const unsupported = [
    'CREATE PROCEDURE f() LANGUAGE sql AS $$ SELECT 1; $$;',
    'CREATE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true; $$;',
    'CREATE OR REPLACE FUNCTION f(x INTEGER) RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true; $$;',
    'CREATE OR REPLACE FUNCTION f(x TEXT DEFAULT current_user) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END; $$;',
    "CREATE OR REPLACE FUNCTION f(x TEXT DEFAULT 'x', y TEXT) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END; $$;",
    'CREATE OR REPLACE FUNCTION f(OUT x TEXT) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END; $$;',
    'CREATE OR REPLACE FUNCTION f(VARIADIC x TEXT) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END; $$;',
    'CREATE OR REPLACE FUNCTION f(x TEXT, x TEXT) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END; $$;',
    'CREATE OR REPLACE FUNCTION f() RETURNS TABLE(x TEXT) LANGUAGE sql AS $$ SELECT 1; $$;',
    "CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql AS 'SELECT true';",
    'CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true; $$; SELECT 1;',
    'CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE c AS $$ SELECT true; $$;',
    'CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql LANGUAGE sql AS $$ SELECT true; $$;',
    'CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql STABLE STABLE AS $$ SELECT true; $$;',
    'CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql AS $$ $$;',
    'DROP FUNCTION IF EXISTS f(text) CASCADE;',
    'DROP FUNCTION IF EXISTS f(text) RESTRICT;',
    'DROP FUNCTION f(text);',
    'DROP FUNCTION IF EXISTS f(text), g(text);',
    ...[
      'SECURITY DEFINER',
      'SECURITY INVOKER',
      'STRICT',
      'CALLED ON NULL INPUT',
      'IMMUTABLE',
      'VOLATILE',
      'PARALLEL SAFE',
      'SET search_path TO public',
      'COST 1',
      'SUPPORT helper',
    ].map(
      (clause) =>
        `CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql ${clause} AS $$ SELECT true; $$;`,
    ),
  ]
  for (const source of unsupported) {
    it(`closed grammar denies: ${source}`, () => {
      expect(() => compileFunctionEffect(source, replayHash(source))).toThrow(
        'REPLAY_FUNCTION_GRAMMAR_UNSUPPORTED',
      )
    })
  }
  for (const [source, error] of [
    ['/* unclosed', 'UNTERMINATED_SQL_COMMENT'],
    ["'unclosed", 'UNTERMINATED_SQL_LITERAL'],
    [
      'CREATE OR REPLACE FUNCTION f() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true;',
      'UNTERMINATED_SQL_DOLLAR_BODY',
    ],
  ]) {
    it(`preserves explicit lexer assertion: ${error}`, () => {
      const compile = () => compileFunctionEffect(source, replayHash(source))
      expect(compile).toThrow(error)
      expect(compile).toThrowError(expect.objectContaining({ code: 'ERR_ASSERTION' }))
    })
  }
  it('propagates unexpected lexer failures unchanged', () => {
    const failure = new Error('unexpected lexer failure')
    const spy = vi.spyOn(lexer, 'sqlTokens').mockImplementationOnce(() => {
      throw failure
    })
    try {
      expect(() => compileFunctionEffect(effects[0].source, effects[0].hash)).toThrow(failure)
    } finally {
      spy.mockRestore()
    }
  })
  it('catalog queries are static scoped SELECTs and never evaluate the frozen bodies', () => {
    for (const sql of Object.values(functionCatalogQueries)) {
      expect(sql).toMatch(/^SELECT /)
      expect(sql).toContain('pg_catalog.')
      expect(sql).toContain('$1')
      expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DROP|CALL|EXECUTE)\b/)
      for (const { source } of effects) expect(sql).not.toContain(source)
    }
    expect(functionCatalogQueries.functions).toContain('p.proargtypes')
    expect(functionCatalogQueries.functions).toContain('pg_catalog.aclexplode')
    expect(functionCatalogQueries.functions).toContain('pg_catalog.pg_depend')
    expect(functionCatalogQueries.functions).toContain('p.proconfig')
    expect(functionCatalogQueries.functions).toContain(
      'CASE WHEN pg_catalog.cardinality(p.protrftypes::oid[])=0',
    )
    expect(functionCatalogQueries.functions).toContain(
      'THEN NULL ELSE p.protrftypes::text END AS transforms',
    )
  })
})
