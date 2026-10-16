import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { ProvisioningError } from './governed-provisioning'
import type { CatalogReader } from './platform-baseline-promotion'
import { catalogQueries } from './platform-baseline-promotion'
import { replayDigest, replayHash } from './post-w4p-replay'
import {
  compileFunctionEffect,
  functionCatalogQueries,
  inspectFunctionEffect,
} from './replay-function-inspection'
import { compileAclEffect, aclQueries } from './replay-acl-inspection'
import { inspectReplayEffect } from './replay-effect-inspection'
import type { ReplayEffectComponent } from './replay-effect-registry'
import {
  compilePolicyHelper,
  frozenHelperSources,
  helperCatalogQueries,
} from './replay-policy-helper-inspection'
import {
  compileProceduralEffect,
  frozenProceduralSources,
  proceduralQueries,
  memberDocumentsAggregateQuery,
} from './replay-procedural-inspection'
import { structuralQueries } from './replay-structural-effects'
import { createCatalogQueries } from './replay-create-inspection'
import { literalPolicyQueries } from './replay-literal-policy'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { ReplayPositionSession } from './replay-position-session'
import {
  captureReplayPositionPredecessor,
  deriveReplayEffectPositionAuthority,
  positionAuthorityQueries as q,
  type ReplayPositionPin,
  type ReplayPositionSnapshot,
} from './replay-position-authority'

const pin: ReplayPositionPin = {
  database: 'independent_database',
  searchPath: ['pg_catalog', 'public'],
  execution: {
    scope: 'UE_OPERATIONAL',
    actorClass: 'MIGRATION_ADMIN',
    actorPrincipal: 'migration_actor',
    targetDigest: 'a'.repeat(64),
    w4pPlanDigest: 'b'.repeat(64),
    w4pVerificationDigest: 'c'.repeat(64),
    supplementPlanDigest: 'd'.repeat(64),
    supplementVerificationDigest: 'e'.repeat(64),
    exclusiveExecutionReference: 'external-exclusive-window',
  },
}
const source = `CREATE OR REPLACE FUNCTION position_probe(p_value text)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true; $$;`
function component(
  source: string,
  compiled: ReplayEffectComponent['compiled'],
): ReplayEffectComponent {
  return {
    effectId: 'position-test-effect',
    boundaryId: 'position-test-boundary',
    boundaryHash: 'f'.repeat(64),
    ordinal: 1,
    sourcePath: 'independent.sql',
    source,
    sourceHash: replayHash(source),
    effectClass: 'FUNCTION_OR_PROCEDURE',
    byteRange: [0, Buffer.byteLength(source)],
    compiled,
  }
}
const functionEffect = component(source, {
  kind: 'FUNCTION',
  contract: compileFunctionEffect(source, replayHash(source)),
})
const ownerAcl = (owner: string) => [
  { grantor: owner, grantee: owner, privilege: 'EXECUTE', grantable: false },
  { grantor: owner, grantee: 'PUBLIC', privilege: 'EXECUTE', grantable: false },
]
function functionRow(owner: string, grants = ownerAcl(owner)) {
  return {
    schema: 'public',
    name: 'position_probe',
    kind: 'f',
    argument_types: [{ schema: 'pg_catalog', name: 'text', kind: 'b' }],
    argument_names: ['p_value'],
    argument_modes: null,
    all_argument_types: null,
    argument_count: 1,
    variadic: '0',
    default_count: 0,
    defaults: null,
    return_schema: 'pg_catalog',
    return_name: 'bool',
    return_kind: 'b',
    returns_set: false,
    language: 'sql',
    security_definer: false,
    volatility: 's',
    strict: false,
    parallel: 'u',
    leakproof: false,
    config: null,
    body: ' SELECT true; ',
    binary: null,
    cost: 100,
    rows: 0,
    support: '0',
    transforms: null,
    sql_body_absent: true,
    owner,
    acl: grants,
    dependents: [],
  }
}
function relation(name: string, patch: Record<string, unknown> = {}) {
  return {
    schema: 'public',
    name,
    kind: 'r',
    owner: 'relation_owner',
    enabled: true,
    forced: true,
    owner_usage: true,
    selectable: true,
    visible: true,
    ...patch,
  }
}
type Options = {
  marker?: string
  functions?: unknown[]
  defaults?: unknown[]
  inventory?: unknown[]
  overrides?: Map<string, unknown[]>
}
/** SQL-keyed independently specified catalog, never an authority-flag fixture. */
function reader(options: Options = {}): CatalogReader {
  return {
    async query(sql, params) {
      const override = options.overrides?.get(sql)
      if (override) return structuredClone(override)
      if (sql === q.snapshot)
        return [
          {
            snapshot: '10:20:12,15',
            observed_at: options.marker ?? '2026-10-12 15:00:00.100Z',
            backend: '410',
          },
        ]
      if (sql === proceduralQueries.identity)
        return [
          {
            actor: 'migration_actor',
            database: 'independent_database',
            search_path: ['pg_catalog', 'public'],
          },
        ]
      if (sql === q.creation) return [{ schema: 'public', explicit_path: ['public'] }]
      if (sql === q.schemas)
        return [
          { name: 'pg_catalog', usable: true, creatable: false },
          { name: 'public', usable: true, creatable: true },
        ]
      if (sql === q.actor)
        return [
          {
            name: 'migration_actor',
            superuser: false,
            bypass_rls: false,
          },
        ]
      if (sql === q.inventory) return structuredClone(options.inventory ?? [])
      if (sql === functionCatalogQueries.functions) return structuredClone(options.functions ?? [])
      if (sql === q.functionDefaults)
        return structuredClone(options.defaults ?? ownerAcl('migration_actor'))
      if ([functionCatalogQueries.owner, aclQueries.role].includes(sql))
        return [{ name: params[0] }]
      if (sql === q.ownerUsage) return [{ name: params[0], usable: true }]
      if (
        [
          functionCatalogQueries.namespace,
          aclQueries.schema,
          createCatalogQueries.namespace,
        ].includes(sql)
      )
        return [{ name: params[0] }]
      if (sql === functionCatalogQueries.type)
        return [
          {
            schema: params[0],
            name: params[1],
            kind: 'b',
            visible: true,
          },
        ]
      if (sql === functionCatalogQueries.language)
        return [{ name: 'sql', trusted: true, owner_usage: true }]
      if (sql === aclQueries.actor) return [{ actor: 'migration_actor' }]
      if (sql === aclQueries.objects)
        return (options.inventory ?? []).map((v) => {
          const r = v as Record<string, unknown>
          return { schema: r.schema, name: r.name, kind: r.kind === 'S' ? 'SEQUENCE' : 'TABLE' }
        })
      if (sql === aclQueries.table) return [{ name: params[1], kind: 'r' }]
      if (sql === aclQueries.tableAcl)
        return [
          {
            grantor: 'relation_owner',
            grantee: 'union_eyes_runtime',
            privilege: 'SELECT',
            grantable: false,
          },
        ]
      if (sql === aclQueries.defaultAcl) return []
      if (sql === q.schemaGrantor) return [{ grantor: 'schema_owner' }]
      if (sql === q.databaseGrantor) return [{ grantor: 'database_owner' }]
      if (sql === proceduralQueries.databaseAcl)
        return [
          {
            database: 'independent_database',
            grantor: 'database_owner',
            grantee: 'union_eyes_runtime',
            privilege: 'CONNECT',
            grantable: false,
          },
        ]
      if (sql === helperCatalogQueries.relation) {
        const r = (options.inventory ?? []).find((v) => {
          const value = v as Record<string, unknown>
          return value.schema === params[0] && value.name === params[1]
        })
        return r ? [{ ...(r as Record<string, unknown>), oid: '900', inheritance: 0 }] : []
      }
      if (sql === proceduralQueries.policies) return []
      if (
        [
          proceduralQueries.visibleColumn,
          proceduralQueries.defaultColumn,
          proceduralQueries.defaultPrivileges,
          proceduralQueries.defaultGenerator,
          proceduralQueries.defaultGeneratorCandidates,
        ].includes(sql)
      )
        return []
      throw new Error(`unsupported independent catalog observation: ${sql}`)
    },
  }
}
function current(options: Options = {}) {
  return reader({ marker: '2026-10-12 15:00:01.200Z', ...options })
}
function procedural(
  kind: string,
  predicate?: (c: ReturnType<typeof compileProceduralEffect>) => boolean,
) {
  const contract = frozenProceduralSources()
    .map((s) => compileProceduralEffect(s.source, s.sourceHash))
    .find((c) => c.geometry.kind === kind && (!predicate || predicate(c)))!
  expect(contract).toBeDefined()
  return {
    ...component(contract.binding.source, { kind: 'PROCEDURAL', contract }),
    effectId: contract.binding.effectId,
    boundaryId: contract.binding.boundaryId,
    boundaryHash: contract.binding.boundaryHash,
    sourcePath: contract.binding.sourcePath,
    ordinal: contract.binding.ordinal,
  }
}
function triggerFixture() {
  const effect = procedural('TRIGGER')
  const ledger = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    BOUNDARIES: {
      BOUNDARY_ID: string
      EFFECTS: {
        EFFECT_ID: string
        SOURCE_ORDINAL: number
        SOURCE_BYTE_RANGE: [number, number]
        EXACT_EFFECT_SHA256: string
        COMPARATOR: { EXACT_SOURCE_SEMANTICS: string }
      }[]
    }[]
  }
  const frozen = ledger.BOUNDARIES.find((b) => b.BOUNDARY_ID === effect.boundaryId)!.EFFECTS.find(
    (e) => /RETURNS trigger/i.test(e.COMPARATOR.EXACT_SOURCE_SEMANTICS),
  )!
  const source = frozen.COMPARATOR.EXACT_SOURCE_SEMANTICS
  const fn: ReplayEffectComponent = {
    ...effect,
    effectId: frozen.EFFECT_ID,
    ordinal: frozen.SOURCE_ORDINAL,
    byteRange: frozen.SOURCE_BYTE_RANGE,
    source,
    sourceHash: frozen.EXACT_EFFECT_SHA256,
    effectClass: 'FUNCTION_OR_PROCEDURE',
    compiled: {
      kind: 'FUNCTION',
      contract: compileFunctionEffect(source, frozen.EXACT_EFFECT_SHA256),
    },
  }
  const observedFunction = {
    ...functionRow('authentic_function_owner'),
    name: 'ue_enforce_workbook_credential_authority',
    argument_types: [],
    argument_names: null,
    argument_count: 0,
    return_name: 'trigger',
    return_kind: 'p',
    language: 'plpgsql',
    volatility: 'v',
    body: source.split('$$')[1],
  }
  const observedTrigger = {
    name: 'ue_workbook_credential_authority',
    type: 23,
    enabled: 'O',
    internal: false,
    arguments: 0,
    argument_bytes: '\\x',
    constraint_oid: '0',
    deferrable: false,
    deferred: false,
    qualification: null,
    old_table: null,
    new_table: null,
    function_schema: 'public',
    function_name: 'ue_enforce_workbook_credential_authority',
  }
  function catalog(marker: string, patch: Options = {}): CatalogReader {
    return reader({
      marker,
      inventory: [relation('workbooks')],
      functions: [observedFunction],
      overrides: new Map([
        [
          functionCatalogQueries.type,
          [{ schema: 'pg_catalog', name: 'trigger', kind: 'p', visible: true }],
        ],
        [functionCatalogQueries.language, [{ name: 'plpgsql', trusted: true, owner_usage: true }]],
        [
          helperCatalogQueries.functionResolution,
          [
            {
              oid: '9001',
              schema: 'public',
              name: 'ue_enforce_workbook_credential_authority',
              visible: true,
              argument_oids: '',
            },
          ],
        ],
        [proceduralQueries.trigger, [observedTrigger]],
      ]),
      ...patch,
    })
  }
  return { effect, fn, observedFunction, catalog }
}
const inlineForeignKey = {
  oid: '42001',
  name: 'independently_allocated_tenant_reference',
  child_schema: 'public',
  child_name: 'member_documents',
  kind: 'f',
  validated: true,
  deferrable: false,
  deferred: false,
  local: true,
  inherited: 0,
  delete_action: 'a',
  update_action: 'a',
  match: 's',
  parent_schema: 'public',
  parent_name: 'organizations',
  columns: ['organization_id'],
  parent_columns: ['id'],
}
function backfillCatalog(
  marker: string,
  constraints: unknown[] = [inlineForeignKey],
  before = false,
  forced = false,
): CatalogReader {
  const base = reader({
    marker,
    inventory: ['member_documents', 'organizations', 'organization_members'].map((n) =>
      relation(n, { forced }),
    ),
  })
  return {
    async query(sql, params) {
      if (sql === q.foreignKeys) return structuredClone(constraints)
      if (sql === proceduralQueries.visibleColumn) return [{ name: params[2] }]
      if (sql === createCatalogQueries.columns)
        return before
          ? []
          : [
              {
                name: 'organization_id',
                postgres_type: 'uuid',
                type_schema: 'pg_catalog',
                type_name: 'uuid',
                type_kind: 'b',
                not_null: false,
                identity: '',
                generated: '',
                collation_default: true,
                acl: null,
                default_expression: null,
              },
            ]
      if (sql === structuralQueries.foreignKey)
        return structuredClone(
          constraints.filter((r) => (r as Record<string, unknown>).name === params[2]),
        )
      if (sql === structuralQueries.index) {
        const column = params[1] === 'idx_member_documents_org' ? 'organization_id' : 'user_id'
        return [
          {
            kind: 'i',
            table_schema: 'public',
            table_name: 'member_documents',
            method: 'btree',
            unique: false,
            valid: true,
            ready: true,
            live: true,
            primary: false,
            exclusion: false,
            nulls_not_distinct: false,
            predicate: null,
            expressions: null,
            key_count: 1,
            total_count: 1,
            columns: [column],
            options: [0],
            key_definitions: [column],
            opclasses_default: true,
            collations_default: true,
          },
        ]
      }
      if (sql === memberDocumentsAggregateQuery('public', 'public'))
        return [{ null_rows: '0', zero_match_groups: '0', multi_match_groups: '0' }]
      return base.query(sql, params)
    },
  }
}
function directHelper() {
  const frozen = frozenHelperSources()
  const call = frozen.calls[0]
  const fn = frozen.functions.find((f) =>
    call.source.includes(compileFunctionEffect(f.source, f.sourceHash).name),
  )!
  const contract = compilePolicyHelper(call, fn)
  const effect: ReplayEffectComponent = {
    ...component(call.source, { kind: 'POLICY_HELPER', contract }),
    effectId: call.effectId,
    boundaryId: call.boundaryId,
    ordinal: call.ordinal,
  }
  const native = {
    current_setting: ['1200', 'show_config_by_name_missing_ok', '25 16', 'text'],
    format: ['1201', 'text_format', '25 2276', 'text'],
    to_regclass: ['1202', 'to_regclass', '25', 'regclass'],
    textin: ['1203', 'textin', '2275', 'text'],
    textout: ['1204', 'textout', '25', 'cstring'],
    uuid_in: ['1205', 'uuid_in', '2275', 'uuid'],
    uuid_out: ['1206', 'uuid_out', '2950', 'cstring'],
  } as const
  const helperFunction = {
    ...functionRow('migration_actor'),
    name: 'ue_create_direct_org_rls_policy',
    argument_types: [
      { schema: 'pg_catalog', name: 'text', kind: 'b' },
      { schema: 'pg_catalog', name: 'text', kind: 'b' },
      { schema: 'pg_catalog', name: 'bool', kind: 'b' },
    ],
    argument_names: ['p_table_name', 'p_org_column', 'p_org_column_is_text'],
    argument_count: 3,
    default_count: 2,
    defaults: "'organization_id'::text, false",
    return_name: 'void',
    return_kind: 'p',
    language: 'plpgsql',
    volatility: 'v',
    body: fn.source.split('$$')[1],
  }
  const catalog = (
    marker: string,
    change?: (sql: string, rows: unknown[]) => unknown[],
  ): CatalogReader => {
    const base = reader({
      marker,
      functions: [helperFunction],
      inventory: [relation(contract.table)],
    })
    return {
      async query(sql, params) {
        let rows: unknown[]
        if (sql === helperCatalogQueries.context)
          rows = [{ role: 'migration_actor', search_path: ['pg_catalog', 'public'] }]
        else if (sql === functionCatalogQueries.type)
          rows = [
            {
              schema: params[0],
              name: params[1],
              kind: params[1] === 'void' ? 'p' : 'b',
              visible: true,
            },
          ]
        else if (sql === functionCatalogQueries.language)
          rows = [{ name: 'plpgsql', trusted: true, owner_usage: true }]
        else if (sql === helperCatalogQueries.functionResolution)
          rows = [
            {
              oid: '18000',
              schema: 'public',
              name: 'ue_create_direct_org_rls_policy',
              visible: true,
              argument_oids: '25 25 16',
            },
          ]
        else if (sql === helperCatalogQueries.column)
          rows = [
            {
              name: params[1],
              schema: 'pg_catalog',
              type: 'text',
              kind: 'b',
              oid: '25',
              element: '0',
              relation: params[0],
              number: 1,
              collation: '100',
              input_body: 'textin',
              output_body: 'textout',
              input_oid: '1203',
              output_oid: '1204',
            },
          ]
        else if (sql === helperCatalogQueries.builtin || sql === helperCatalogQueries.overloads) {
          const name = params[0].split('(')[0] as keyof typeof native
          const [oid, body, args, result] = native[name]
          rows = [
            {
              oid,
              schema: 'pg_catalog',
              name,
              body,
              language: 'internal',
              kind: 'f',
              definer: false,
              config: null,
              argument_oids: args,
              result,
              visible: true,
              variadic: name === 'format' ? '2276' : '0',
            },
          ]
        } else if (sql === helperCatalogQueries.operator)
          rows = [
            {
              oid: '98',
              schema: 'pg_catalog',
              name: '=',
              left_type: '25',
              right_type: '25',
              result: '16',
              body: 'texteq',
              language: 'internal',
              visible: true,
              function_oid: '1207',
              function_schema: 'pg_catalog',
              argument_oids: '25 25',
              function_result: '16',
              function_kind: 'f',
              definer: false,
              config: null,
            },
          ]
        else if (sql === helperCatalogQueries.cast || sql === literalPolicyQueries.policy) rows = []
        else rows = await base.query(sql, params)
        return change ? change(sql, structuredClone(rows)) : rows
      },
    }
  }
  return { effect, catalog }
}
describe('independently observed replay-position prerequisites', () => {
  it('derives a new function from the pinned actor and observed global + schema defaults', async () => {
    const defaults = [
      ...ownerAcl('migration_actor'),
      {
        grantor: 'migration_actor',
        grantee: 'schema_consumer',
        privilege: 'EXECUTE',
        grantable: true,
      },
    ]
    const before = await captureReplayPositionPredecessor(reader({ defaults }), pin, functionEffect)
    const after = current({ functions: [functionRow('migration_actor', defaults)] })
    const evidence = await deriveReplayEffectPositionAuthority(after, pin, functionEffect, before)
    expect(evidence.authority.function).toEqual({
      sourceHash: functionEffect.sourceHash,
      schema: 'public',
      owner: 'migration_actor',
      acl: defaults,
    })
    expect((await inspectReplayEffect(after, functionEffect, evidence.authority)).definition).toBe(
      'EXACT',
    )
    expect(Object.isFrozen(evidence.authority.function?.acl)).toBe(true)
    expect(evidence.readSetDigest).toBe(replayDigest(evidence.reads))
    expect(evidence.snapshotDigest).not.toBe(before.snapshotDigest)
    expect(q.functionDefaults).toContain('d.defaclnamespace=0')
    expect(q.functionDefaults).toContain('d.defaclnamespace=n.oid')
  })
  it('retains independent predecessor owner/ACL rather than accepting a malicious current owner', async () => {
    const before = await captureReplayPositionPredecessor(
      reader({ functions: [functionRow('authentic_owner')] }),
      pin,
      functionEffect,
    )
    const after = current({ functions: [functionRow('malicious_owner')] })
    const result = await deriveReplayEffectPositionAuthority(after, pin, functionEffect, before)
    expect(result.authority.function?.owner).toBe('authentic_owner')
    expect((await inspectReplayEffect(after, functionEffect, result.authority)).definition).toBe(
      'DRIFTED',
    )
  })
  it('does not substitute current defaults for new-object prestate ACL', async () => {
    const before = await captureReplayPositionPredecessor(reader(), pin, functionEffect)
    const maliciousAcl = [
      ...ownerAcl('migration_actor'),
      {
        grantor: 'migration_actor',
        grantee: 'attacker',
        privilege: 'EXECUTE',
        grantable: true,
      },
    ]
    const after = current({
      functions: [functionRow('migration_actor', maliciousAcl)],
      defaults: maliciousAcl,
    })
    const result = await deriveReplayEffectPositionAuthority(after, pin, functionEffect, before)
    expect(result.authority.function?.acl).toEqual(
      ownerAcl('migration_actor').sort((a, b) => a.grantee.localeCompare(b.grantee)),
    )
    expect((await inspectReplayEffect(after, functionEffect, result.authority)).definition).toBe(
      'DRIFTED',
    )
  })
  it('returns genuine replacement prerequisites accepted by the function comparator', async () => {
    const before = await captureReplayPositionPredecessor(
      reader({
        functions: [functionRow('authentic_owner')],
      }),
      pin,
      functionEffect,
    )
    const after = current({ functions: [functionRow('authentic_owner')] })
    const result = await deriveReplayEffectPositionAuthority(after, pin, functionEffect, before)
    expect((await inspectReplayEffect(after, functionEffect, result.authority)).definition).toBe(
      'EXACT',
    )
  })
  it('resolves restrictive DROP through actual path without requiring CREATE privileges', async () => {
    const sql = 'DROP FUNCTION IF EXISTS position_probe(text);'
    const effect = component(sql, {
      kind: 'FUNCTION',
      contract: compileFunctionEffect(sql, replayHash(sql)),
    })
    const catalog = (present: boolean): CatalogReader => {
      const base = reader({
        marker: present ? 'drop-prestate' : 'drop-current',
        overrides: new Map([
          [
            q.schemas,
            [
              { name: 'pg_catalog', usable: true, creatable: false },
              { name: 'public', usable: true, creatable: false },
            ],
          ],
        ]),
      })
      return {
        async query(query, args) {
          if (query === functionCatalogQueries.functions)
            return present && args[0] === 'public' ? [functionRow('authentic_owner')] : []
          return base.query(query, args)
        },
      }
    }
    const before = await captureReplayPositionPredecessor(catalog(true), pin, effect)
    const after = catalog(false)
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.function?.owner).toBe('authentic_owner')
    expect(
      (
        await inspectFunctionEffect(
          after,
          compileFunctionEffect(sql, replayHash(sql)),
          result.authority.function,
        )
      ).definition,
    ).toBe('ABSENT')
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
  })
  it.each([
    ['actor', { actor: 'attacker', database: pin.database, search_path: pin.searchPath }],
    [
      'database',
      { actor: 'migration_actor', database: 'wrong_database', search_path: pin.searchPath },
    ],
    [
      'path',
      { actor: 'migration_actor', database: pin.database, search_path: ['shadow', 'public'] },
    ],
  ])('denies actual %s mismatch even with matching request labels', async (_label, identity) => {
    await expect(
      captureReplayPositionPredecessor(
        reader({
          overrides: new Map([[proceduralQueries.identity, [identity]]]),
        }),
        pin,
        functionEffect,
      ),
    ).rejects.toThrow('ACTUAL_IDENTITY_OR_PATH_DRIFT')
  })
  it('does not skip an unwritable first creation schema', async () => {
    await expect(
      captureReplayPositionPredecessor(
        reader({
          overrides: new Map([
            [
              q.schemas,
              [
                { name: 'pg_catalog', usable: true, creatable: false },
                { name: 'public', usable: true, creatable: false },
              ],
            ],
          ]),
        }),
        pin,
        functionEffect,
      ),
    ).rejects.toThrow('SCHEMA_CREATE_PRIVILEGE_MISSING')
  })
  it('rejects ambiguous owner roles and overloads', async () => {
    await expect(
      captureReplayPositionPredecessor(
        reader({
          overrides: new Map([
            [
              functionCatalogQueries.owner,
              [{ name: 'migration_actor' }, { name: 'migration_actor' }],
            ],
          ]),
        }),
        pin,
        functionEffect,
      ),
    ).rejects.toThrow('FACT_MISSING_OR_AMBIGUOUS')
    await expect(
      captureReplayPositionPredecessor(
        reader({
          functions: [functionRow('authentic_owner'), functionRow('authentic_owner')],
        }),
        pin,
        functionEffect,
      ),
    ).rejects.toThrow('FUNCTION_SIGNATURE_AMBIGUOUS')
  })
  it('denies native type shadowing rather than inventing resolution authority', async () => {
    const before = await captureReplayPositionPredecessor(reader(), pin, functionEffect)
    await expect(
      deriveReplayEffectPositionAuthority(
        current({
          overrides: new Map([
            [
              functionCatalogQueries.type,
              [
                {
                  schema: 'pg_catalog',
                  name: 'text',
                  kind: 'b',
                  visible: false,
                },
              ],
            ],
          ]),
        }),
        pin,
        functionEffect,
        before,
      ),
    ).rejects.toThrow('UNQUALIFIED_TYPE_RESOLUTION_NOT_ESTABLISHED')
  })
  it('rejects a current default-argument function overload', async () => {
    const before = await captureReplayPositionPredecessor(reader(), pin, functionEffect)
    const overload = { ...functionRow('migration_actor'), argument_types: [] }
    await expect(
      deriveReplayEffectPositionAuthority(
        current({
          functions: [functionRow('migration_actor'), overload],
        }),
        pin,
        functionEffect,
        before,
      ),
    ).rejects.toThrow('FUNCTION_OVERLOAD_AMBIGUOUS')
  })
  it('rejects self-authenticating, copied and same-reader snapshots', async () => {
    const r = reader()
    const before = await captureReplayPositionPredecessor(r, pin, functionEffect)
    for (const forged of [structuredClone(before), { ...before, verified: true }]) {
      await expect(
        deriveReplayEffectPositionAuthority(
          current(),
          pin,
          functionEffect,
          forged as ReplayPositionSnapshot,
        ),
      ).rejects.toThrow('INDEPENDENT_PREDECESSOR_REQUIRED')
    }
    await expect(
      deriveReplayEffectPositionAuthority(r, pin, functionEffect, before),
    ).rejects.toThrow('DISTINCT_SNAPSHOT_READER_REQUIRED')
    await expect(
      deriveReplayEffectPositionAuthority(reader(), pin, functionEffect, before),
    ).rejects.toThrow('DISTINCT_OBSERVED_SNAPSHOT_REQUIRED')
  })
  it('binds source contracts, exclusive context, and all external attestation references', async () => {
    const before = await captureReplayPositionPredecessor(reader(), pin, functionEffect)
    await expect(
      deriveReplayEffectPositionAuthority(
        current(),
        {
          ...pin,
          execution: { ...pin.execution, exclusiveExecutionReference: 'another-window' },
        },
        functionEffect,
        before,
      ),
    ).rejects.toThrow('SNAPSHOT_SOURCE_OR_CONTEXT_DRIFT')
    const replacement = source.replace('SELECT true', 'SELECT false')
    const other = component(replacement, {
      kind: 'FUNCTION',
      contract: compileFunctionEffect(replacement, replayHash(replacement)),
    })
    await expect(
      deriveReplayEffectPositionAuthority(current(), pin, other, before),
    ).rejects.toThrow('SNAPSHOT_SOURCE_OR_CONTEXT_DRIFT')
    await expect(
      captureReplayPositionPredecessor(
        reader(),
        {
          ...pin,
          execution: { ...pin.execution, w4pVerificationDigest: '' },
        },
        functionEffect,
      ),
    ).rejects.toThrow('EXTERNAL_ATTESTATION_BINDING_REQUIRED')
    await expect(
      captureReplayPositionPredecessor(reader(), pin, {
        ...functionEffect,
        sourceHash: '0'.repeat(64),
      }),
    ).rejects.toThrow('SOURCE_HASH_DRIFT')
  })
  it('denies malformed observations and read errors using ProvisioningError', async () => {
    for (const rows of [
      [null],
      [{ name: 'migration_actor', superuser: 'true', bypass_rls: false }],
    ]) {
      await expect(
        captureReplayPositionPredecessor(
          reader({
            overrides: new Map([[q.actor, rows]]),
          }),
          pin,
          functionEffect,
        ),
      ).rejects.toBeInstanceOf(ProvisioningError)
    }
    await expect(
      captureReplayPositionPredecessor(
        {
          async query() {
            throw new Error('offline catalog missing fact')
          },
        },
        pin,
        functionEffect,
      ),
    ).rejects.toThrow('REPLAY_POSITION_CATALOG_READ_FAILED')
    await expect(
      captureReplayPositionPredecessor(reader(), pin, {
        ...functionEffect,
        compiled: { kind: 'FUNCTION', contract: {} } as ReplayEffectComponent['compiled'],
      }),
    ).rejects.toBeInstanceOf(ProvisioningError)
    await expect(
      captureReplayPositionPredecessor(reader(), pin, {
        ...functionEffect,
        byteRange: [1, 1],
      }),
    ).rejects.toThrow('SOURCE_BYTE_RANGE_INVALID')
  })
  it('derives exact ALL-object inventory and grantors from prestate, not current grants', async () => {
    const sql = 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO union_eyes_runtime;'
    const effect = component(sql, { kind: 'ACL', contract: compileAclEffect(sql, replayHash(sql)) })
    const inventory = [relation('first'), relation('second')]
    const before = await captureReplayPositionPredecessor(reader({ inventory }), pin, effect)
    const after = current({ inventory })
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.acl?.objects.map((r) => [r.name, r.grantor])).toEqual([
      ['first', 'relation_owner'],
      ['second', 'relation_owner'],
    ])
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
    expect(
      (
        await inspectReplayEffect(
          current({ inventory: [relation('first')] }),
          effect,
          result.authority,
        )
      ).definition,
    ).toBe('PRECONDITION_MISSING')
  })
  it('binds default ACL owner to current_user and denies unresolved delegated grantors', async () => {
    const sql =
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM union_eyes_runtime;'
    const effect = component(sql, { kind: 'ACL', contract: compileAclEffect(sql, replayHash(sql)) })
    const before = await captureReplayPositionPredecessor(reader(), pin, effect)
    const after = current()
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.acl?.defaultOwner).toBe('migration_actor')
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
    const grant = 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO union_eyes_runtime;'
    await expect(
      captureReplayPositionPredecessor(
        reader({
          inventory: [relation('first', { owner_usage: false })],
        }),
        pin,
        component(grant, { kind: 'ACL', contract: compileAclEffect(grant, replayHash(grant)) }),
      ),
    ).rejects.toThrow('ACL_SELECTED_GRANTOR_EVIDENCE_MISSING:public.first')
  })
  it('binds frozen helper function hash and denies unqualified relation shadows', async () => {
    const frozen = frozenHelperSources()
    const call = frozen.calls[0]
    const fn = frozen.functions.find((f) =>
      call.source.includes(compileFunctionEffect(f.source, f.sourceHash).name),
    )!
    const contract = compilePolicyHelper(call, fn)
    const effect = {
      ...component(call.source, { kind: 'POLICY_HELPER' as const, contract }),
      effectId: call.effectId,
      boundaryId: call.boundaryId,
      ordinal: call.ordinal,
    }
    await expect(
      captureReplayPositionPredecessor(
        reader({
          inventory: [relation(contract.table), relation(contract.table, { schema: 'pg_catalog' })],
        }),
        pin,
        effect,
      ),
    ).rejects.toThrow(`RELATION_SHADOW_OR_AMBIGUITY:${contract.table}`)
    await expect(
      captureReplayPositionPredecessor(reader(), pin, {
        ...effect,
        compiled: {
          kind: 'POLICY_HELPER',
          contract: {
            ...contract,
            function: { ...contract.function, sourceHash: '0'.repeat(64) },
          },
        },
      }),
    ).rejects.toThrow('SOURCE_HELPER_FUNCTION_BINDING_MISSING')
  })
  it('constructs frozen helper prerequisites accepted by actual native/function resolution checks', async () => {
    const { effect, catalog } = directHelper()
    const before = await captureReplayPositionPredecessor(catalog('before'), pin, effect)
    const after = catalog('after')
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.helper?.functionHash).toBe(
      effect.compiled.kind === 'POLICY_HELPER' ? effect.compiled.contract.function.sourceHash : '',
    )
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('ABSENT')
    await expect(
      deriveReplayEffectPositionAuthority(
        catalog('native-shadow', (sql, rows) =>
          sql === helperCatalogQueries.overloads
            ? [
                ...rows,
                {
                  oid: '18001',
                  schema: 'public',
                  name: 'current_setting',
                  argument_oids: '25 16',
                  variadic: '0',
                },
              ]
            : rows,
        ),
        pin,
        effect,
        before,
      ),
    ).rejects.toThrow('BODY_FUNCTION_OVERLOAD_RESOLUTION_AMBIGUOUS')
  })
  it('proves public helper guards separately from the unqualified target path', async () => {
    const { effect } = directHelper()
    if (effect.compiled.kind !== 'POLICY_HELPER') throw new Error('expected helper')
    await expect(
      captureReplayPositionPredecessor(
        reader({
          inventory: [relation(effect.compiled.contract.table, { schema: 'pg_catalog' })],
        }),
        pin,
        effect,
      ),
    ).rejects.toThrow('HELPER_PUBLIC_GUARD_MISSING')
  })
  it('creates procedural CONNECT context accepted by real prerequisites with observed database grantor', async () => {
    const effect = procedural('CONNECT')
    if (
      effect.compiled.kind !== 'PROCEDURAL' ||
      effect.compiled.contract.geometry.kind !== 'CONNECT'
    )
      throw new Error('expected CONNECT fixture')
    const roles = effect.compiled.contract.geometry.roles
    const overrides = new Map([
      [
        proceduralQueries.databaseAcl,
        roles.map((role) => ({
          database: pin.database,
          grantor: 'database_owner',
          grantee: role,
          privilege: 'CONNECT',
          grantable: false,
        })),
      ],
    ])
    const before = await captureReplayPositionPredecessor(reader({ overrides }), pin, effect)
    const after = current({ overrides })
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.procedural?.databaseGrantor).toBe('database_owner')
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
    expect(result.authority.procedural?.catalogVisibility.allSchemas).toBe(true)
  })
  it('uses genuine distinct procedural predecessor reads for source guard skips', async () => {
    const effect = procedural(
      'DEFAULTS',
      (c) => c.geometry.kind === 'DEFAULTS' && !!c.geometry.guard,
    )
    if (
      effect.compiled.kind !== 'PROCEDURAL' ||
      effect.compiled.contract.geometry.kind !== 'DEFAULTS'
    )
      throw new Error('expected defaults fixture')
    const inventory = [relation(effect.compiled.contract.geometry.table)]
    const before = await captureReplayPositionPredecessor(reader({ inventory }), pin, effect)
    const after = current({ inventory })
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
    expect(result.authority.predecessor?.snapshotDigest).toBe(before.snapshotDigest)
    expect(result.authority.procedural?.snapshotDigest).toBe(result.snapshotDigest)
    await expect(
      result.authority.predecessor!.reader.query('uncaptured predecessor query', []),
    ).rejects.toThrow('PREDECESSOR_READ_EVIDENCE_MISSING')
  })
  it('denies RLS-filtered counts before any count is accepted as full data visibility', async () => {
    const effect = procedural(
      'DEFAULTS',
      (c) => c.geometry.kind === 'DEFAULTS' && c.geometry.updateNullCategory,
    )
    const inventory = [relation('organization_members')]
    await expect(
      captureReplayPositionPredecessor(reader({ inventory }), pin, effect),
    ).rejects.toThrow('RLS_FILTERED_FULL_ROW_VISIBILITY_DENIED:public.organization_members')
  })
  it('rejects missing procedural prerequisites with an exact source probe denial', async () => {
    const effect = procedural(
      'GUARD',
      (c) => c.geometry.kind === 'GUARD' && c.geometry.mode === 'REQUIRED_RELATIONS',
    )
    await expect(captureReplayPositionPredecessor(reader(), pin, effect)).rejects.toThrow(
      'REQUIRED_RELATION_MISSING',
    )
  })
  it('reports exact absent source integration evidence, not terminal static BLOCKED', async () => {
    const effect = procedural('TRIGGER')
    if (
      effect.compiled.kind !== 'PROCEDURAL' ||
      effect.compiled.contract.geometry.kind !== 'TRIGGER'
    )
      throw new Error('expected trigger fixture')
    await expect(
      captureReplayPositionPredecessor(
        reader({
          inventory: [relation(effect.compiled.contract.geometry.table)],
        }),
        pin,
        effect,
      ),
    ).rejects.toThrow('SOURCE_TRIGGER_FUNCTION_PREDECESSOR_BINDING_REQUIRED')
  })
  it('binds the preceding frozen trigger function and its authentic owner/ACL snapshot', async () => {
    const { effect, fn, catalog } = triggerFixture()
    const functionBefore = await captureReplayPositionPredecessor(
      catalog('2026-10-12 15:00:00.100Z'),
      pin,
      fn,
    )
    const before = await captureReplayPositionPredecessor(
      catalog('2026-10-12 15:00:01.100Z'),
      pin,
      effect,
      { triggerFunction: { effect: fn, predecessor: functionBefore } },
    )
    const after = catalog('2026-10-12 15:00:02.100Z')
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.procedural?.triggerFunction).toEqual({
      sourceHash: fn.sourceHash,
      schema: 'public',
      owner: 'authentic_function_owner',
      acl: ownerAcl('authentic_function_owner').sort((a, b) =>
        `${a.grantor}|${a.grantee}|${a.privilege}|${a.grantable}`.localeCompare(
          `${b.grantor}|${b.grantee}|${b.privilege}|${b.grantable}`,
        ),
      ),
    })
    expect(result.sourcePredecessorDigests).toEqual([functionBefore.snapshotDigest])
    expect(before.sourcePredecessorDigests).toEqual(result.sourcePredecessorDigests)
    expect(Object.isFrozen(result.sourcePredecessorDigests)).toBe(true)
    expect(result.reads.some((r) => r.sql === functionCatalogQueries.functions)).toBe(true)
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
  })
  it.each(['owner', 'acl'] as const)(
    'denies current trigger-function %s drift instead of authenticating it',
    async (field) => {
      const { effect, fn, catalog, observedFunction } = triggerFixture()
      const functionBefore = await captureReplayPositionPredecessor(
        catalog('before-function'),
        pin,
        fn,
      )
      const before = await captureReplayPositionPredecessor(
        catalog('before-trigger'),
        pin,
        effect,
        { triggerFunction: { effect: fn, predecessor: functionBefore } },
      )
      const changed = {
        ...observedFunction,
        ...(field === 'owner'
          ? { owner: 'malicious_current_owner', acl: ownerAcl('malicious_current_owner') }
          : {
              acl: [
                ...observedFunction.acl,
                {
                  grantor: 'authentic_function_owner',
                  grantee: 'unapproved_role',
                  privilege: 'EXECUTE',
                  grantable: false,
                },
              ],
            }),
      }
      await expect(
        deriveReplayEffectPositionAuthority(
          catalog('after-trigger', { functions: [changed] }),
          pin,
          effect,
          before,
        ),
      ).rejects.toThrow('TRIGGER_FUNCTION_PREDECESSOR_NOT_EXACT')
    },
  )
  it('denies copied trigger function snapshots and source self-attestation outside the frozen ledger', async () => {
    const { effect, fn, catalog } = triggerFixture()
    const original = await captureReplayPositionPredecessor(catalog('function-before'), pin, fn)
    await expect(
      captureReplayPositionPredecessor(catalog('trigger-before'), pin, effect, {
        triggerFunction: { effect: fn, predecessor: structuredClone(original) },
      }),
    ).rejects.toThrow('TRIGGER_FUNCTION_MINTED_PREDECESSOR_REQUIRED')
    const source = `${fn.source}\n`
    const counterfeit: ReplayEffectComponent = {
      ...fn,
      source,
      sourceHash: replayHash(source),
      byteRange: [fn.byteRange[0], fn.byteRange[1] + 1],
      compiled: { kind: 'FUNCTION', contract: compileFunctionEffect(source, replayHash(source)) },
    }
    const capturedCounterfeit = await captureReplayPositionPredecessor(
      catalog('counterfeit-before'),
      pin,
      counterfeit,
    )
    await expect(
      captureReplayPositionPredecessor(catalog('trigger-current'), pin, effect, {
        triggerFunction: { effect: counterfeit, predecessor: capturedCounterfeit },
      }),
    ).rejects.toThrow('TRIGGER_FUNCTION_FROZEN_SOURCE_DRIFT')
    await expect(
      captureReplayPositionPredecessor(
        catalog('trigger-pin'),
        {
          ...pin,
          execution: { ...pin.execution, exclusiveExecutionReference: 'another-window' },
        },
        effect,
        { triggerFunction: { effect: fn, predecessor: original } },
      ),
    ).rejects.toThrow('TRIGGER_FUNCTION_PREDECESSOR_DRIFT')
  })
  it('rejects unqualified trigger function shadow resolution and overload ambiguity', async () => {
    const { effect, fn, catalog } = triggerFixture()
    const original = await captureReplayPositionPredecessor(catalog('fn-before'), pin, fn)
    const before = await captureReplayPositionPredecessor(catalog('trigger-before'), pin, effect, {
      triggerFunction: { effect: fn, predecessor: original },
    })
    const base = catalog('trigger-current')
    for (const ambiguous of [false, true]) {
      const shadow: CatalogReader = {
        async query(sql, parameters) {
          const rows = await base.query(sql, parameters)
          if (sql !== helperCatalogQueries.functionResolution) return rows
          const malicious = {
            oid: '666',
            schema: 'pg_catalog',
            name: 'ue_enforce_workbook_credential_authority',
            visible: true,
            argument_oids: '',
          }
          return ambiguous ? [...rows, malicious] : [malicious]
        },
      }
      await expect(
        deriveReplayEffectPositionAuthority(shadow, pin, effect, before),
      ).rejects.toThrow(
        ambiguous ? 'FACT_MISSING_OR_AMBIGUOUS' : 'TRIGGER_FUNCTION_UNQUALIFIED_RESOLUTION_DRIFT',
      )
    }
  })
  it('derives a newly created trigger-function owner from the actor and observed defaults', async () => {
    const { effect, fn, observedFunction, catalog } = triggerFixture()
    const original = await captureReplayPositionPredecessor(
      catalog('before-new-function', { functions: [] }),
      pin,
      fn,
    )
    const created = {
      ...observedFunction,
      owner: pin.execution.actorPrincipal,
      acl: ownerAcl(pin.execution.actorPrincipal),
    }
    const before = await captureReplayPositionPredecessor(
      catalog('before-trigger', { functions: [created] }),
      pin,
      effect,
      { triggerFunction: { effect: fn, predecessor: original } },
    )
    const after = catalog('after-trigger', { functions: [created] })
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.procedural?.triggerFunction?.owner).toBe(pin.execution.actorPrincipal)
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
  })
  it('denies a following function effect and malformed dependency inputs explicitly', async () => {
    const { effect, fn, catalog } = triggerFixture()
    const following = { ...fn, ordinal: effect.ordinal + 1 }
    const original = await captureReplayPositionPredecessor(catalog('before'), pin, following)
    await expect(
      captureReplayPositionPredecessor(catalog('after'), pin, effect, {
        triggerFunction: { effect: following, predecessor: original },
      }),
    ).rejects.toThrow('TRIGGER_FUNCTION_SOURCE_ORDER_OR_SIGNATURE_DRIFT')
    await expect(
      captureReplayPositionPredecessor(catalog('malformed'), pin, effect, {
        triggerFunction: null,
      } as never),
    ).rejects.toThrow('ROW_INVALID')
    await expect(
      captureReplayPositionPredecessor(catalog('malformed'), pin, effect, null as never),
    ).rejects.toThrow('ROW_INVALID')
  })
  it('binds a uniquely observed, nonconventional inline FK name by complete source semantics', async () => {
    const effect = procedural('BACKFILL')
    const before = await captureReplayPositionPredecessor(
      backfillCatalog('before', [], true),
      pin,
      effect,
    )
    const after = backfillCatalog('after')
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect(result.authority.procedural?.memberDocumentsForeignKeyName).toBe(inlineForeignKey.name)
    expect(result.reads.find((r) => r.sql === q.foreignKeys)?.rows).toEqual([inlineForeignKey])
    expect(result.authority.procedural?.dataVisibility?.['public.member_documents']?.basis).toBe(
      'ACTUAL_OWNER_MEMBERSHIP_WITHOUT_FORCE_RLS',
    )
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
  })
  it.each([
    ['missing', []],
    ['wrong-parent', [{ ...inlineForeignKey, parent_name: 'unrelated_parent' }]],
    ['wrong-column', [{ ...inlineForeignKey, columns: ['user_id'] }]],
    ['wrong-action', [{ ...inlineForeignKey, delete_action: 'c' }]],
    ['unvalidated', [{ ...inlineForeignKey, validated: false }]],
  ])('denies inline FK %s catalog state without allocating a name', async (_name, constraints) => {
    const effect = procedural('BACKFILL')
    const before = await captureReplayPositionPredecessor(
      backfillCatalog('before', [], true),
      pin,
      effect,
    )
    await expect(
      deriveReplayEffectPositionAuthority(
        backfillCatalog('after', constraints as unknown[]),
        pin,
        effect,
        before,
      ),
    ).rejects.toThrow('INLINE_FK_SOURCE_MATCHING_CATALOG_IDENTITY_MISSING')
  })
  it('denies ambiguous/malformed inline FK identities and pre-existing identity replacement', async () => {
    const effect = procedural('BACKFILL')
    await expect(
      captureReplayPositionPredecessor(
        backfillCatalog('ambiguous', [
          inlineForeignKey,
          { ...inlineForeignKey, oid: '42002', name: 'another_exact_reference' },
        ]),
        pin,
        effect,
      ),
    ).rejects.toThrow('INLINE_FK_SEMANTIC_IDENTITY_AMBIGUOUS')
    await expect(
      captureReplayPositionPredecessor(
        backfillCatalog('malformed', [{ ...inlineForeignKey, validated: 'true' }]),
        pin,
        effect,
      ),
    ).rejects.toThrow('BOOLEAN_INVALID')
    const before = await captureReplayPositionPredecessor(backfillCatalog('before'), pin, effect)
    await expect(
      deriveReplayEffectPositionAuthority(
        backfillCatalog('after', [
          { ...inlineForeignKey, oid: '42002', name: 'different_exact_reference' },
        ]),
        pin,
        effect,
        before,
      ),
    ).rejects.toThrow('INLINE_FK_PREDECESSOR_IDENTITY_DRIFT')
  })
  it('does not attribute a new FK to an inline ADD COLUMN skipped by a pre-existing column', async () => {
    const effect = procedural('BACKFILL')
    const before = await captureReplayPositionPredecessor(
      backfillCatalog('before-existing-column', []),
      pin,
      effect,
    )
    await expect(
      deriveReplayEffectPositionAuthority(
        backfillCatalog('after-external-FK'),
        pin,
        effect,
        before,
      ),
    ).rejects.toThrow('INLINE_FK_ALLOCATION_NOT_OWNED_BY_SOURCE')
  })
  it('denies RLS-filtered backfill counts even with an exact source-bound FK', async () => {
    await expect(
      captureReplayPositionPredecessor(
        backfillCatalog('filtered', [inlineForeignKey], false, true),
        pin,
        procedural('BACKFILL'),
      ),
    ).rejects.toThrow('RLS_FILTERED_FULL_ROW_VISIBILITY_DENIED:public.member_documents')
  })
  it('derives creation schema for a frozen enum instead of a public request label', async () => {
    const effect = procedural('ENUM')
    if (effect.compiled.kind !== 'PROCEDURAL' || effect.compiled.contract.geometry.kind !== 'ENUM')
      throw new Error('expected enum fixture')
    const g = effect.compiled.contract.geometry
    const overrides = new Map([[catalogQueries.type, [{ kind: 'e', members: g.enum.members }]]])
    const before = await captureReplayPositionPredecessor(reader({ overrides }), pin, effect)
    const after = current({ overrides })
    const result = await deriveReplayEffectPositionAuthority(after, pin, effect, before)
    expect((await inspectReplayEffect(after, effect, result.authority)).definition).toBe('EXACT')
  })
})

describe('actual frozen parent-session scope and primitive identity contract', () => {
  const { frozen, sourceBytes } = loadFrozenReplay()
  const ledgerBytes = readFileSync(
    new URL(
      '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
      import.meta.url,
    ),
    'utf8',
  )
  const plan = compileReplayUnitPlan(
    frozen,
    sourceBytes,
    ledgerBytes,
    pin.execution.supplementPlanDigest,
  )
  const sessionPin: ReplayPositionPin = {
    ...pin,
    execution: { ...pin.execution, w4pPlanDigest: plan.specification.w4pPlanDigest },
  }
  const ordered = plan.specification.units
    .filter((unit) => unit.node.DATABASE_SCOPE === 'UE_OPERATIONAL')
    .flatMap((unit) =>
      plan.components.effects.filter((effect) => effect.boundaryId === unit.node.REPLAY_UNIT_ID),
    )
  const { fn, effect: trigger, catalog } = triggerFixture()
  const functionPosition = ordered.findIndex((effect) => effect.effectId === fn.effectId)
  const triggerPosition = ordered.findIndex((effect) => effect.effectId === trigger.effectId)

  it(`preserves full source coverage and denies skipping ${functionPosition} / ${triggerPosition} effects to function / trigger fixtures`, async () => {
    expect(plan.sourceContracts).toBe(107)
    expect(plan.specification.units).toHaveLength(107)
    expect(plan.components.effects).toHaveLength(762)
    expect(plan.originalTransactionAssignments).toBe(23)
    expect(plan.components.effects.find((effect) => effect.effectId === fn.effectId)).toEqual(fn)
    expect(functionPosition).toBeGreaterThan(0)
    expect(triggerPosition).toBe(functionPosition + 1)
    const session = new ReplayPositionSession(plan, sessionPin)
    expect(session.nextEffectId).toBe(ordered[0].effectId)
    const actual = catalog('2026-10-12 15:00:00.100Z')
    const reads: [string, string[]][] = []
    const observed: CatalogReader = {
      async query(sql, parameters) {
        reads.push([sql, [...parameters]])
        return actual.query(sql, parameters)
      },
    }
    await expect(session.capture(fn.effectId, observed)).rejects.toThrow(
      'REPLAY_POSITION_SESSION_ORDER_DRIFT',
    )
    await expect(session.capture(trigger.effectId, observed)).rejects.toThrow(
      'REPLAY_POSITION_SESSION_ORDER_DRIFT',
    )
    expect(reads).toEqual([])
    expect(session.nextEffectId).toBe(ordered[0].effectId)
    expect(session.verifiedPositions()).toEqual([])
  })

  it('connects the genuine effect-free financial scope without inventing function/trigger coverage', async () => {
    const session = new ReplayPositionSession(plan, {
      ...sessionPin,
      execution: { ...sessionPin.execution, scope: 'FINANCIAL_SERVICE' },
    })
    expect(
      plan.boundaries
        .filter((boundary) => boundary.scope === 'FINANCIAL_SERVICE')
        .map((boundary) => boundary.effects),
    ).toEqual([[]])
    expect(session.nextEffectId).toBeNull()
    expect(session.verifiedPositions()).toEqual([])
    expect(Object.isFrozen(session.verifiedPositions())).toBe(true)
    await expect(session.capture(fn.effectId, catalog('2026-10-12 15:00:00.100Z'))).rejects.toThrow(
      'REPLAY_POSITION_SESSION_ORDER_DRIFT',
    )
    await expect(
      session.verify(trigger.effectId, catalog('2026-10-12 15:00:01.100Z')),
    ).rejects.toThrow('REPLAY_POSITION_SESSION_CAPTURE_REQUIRED')
    expect(session.verifiedPositions()).toEqual([])
    expect(plan.wholeUnitEligibility).toBe('NOT_ESTABLISHED')
    expect(plan.executionAuthorized).toBe(false)
  })

  const primitiveKinds = [
    'SCHEMA',
    'RELATION',
    'COLUMN',
    'FOREIGN_KEY',
    'INDEX',
    'RLS',
    'POLICY_DROP',
    'POLICY_CREATE',
    'DEFAULT',
    'BACKFILL',
  ] as const
  const independentIdentity = {
    actor: 'migration_actor',
    database: 'independent_database',
    search_path: ['pg_catalog', 'public'],
  }
  function identityCatalog(current: boolean, patch: Record<string, unknown> = {}) {
    const calls: [string, string[]][] = []
    const reader: CatalogReader = {
      async query(sql, parameters) {
        calls.push([sql, [...parameters]])
        if (sql === q.snapshot)
          return [
            {
              snapshot: '10:20:12,15',
              observed_at: current ? '2026-10-12 15:00:01.200Z' : '2026-10-12 15:00:00.100Z',
              backend: '410',
            },
          ]
        if (sql === proceduralQueries.identity)
          return [structuredClone({ ...independentIdentity, ...patch })]
        throw new Error('Identity-only capture must not inspect primitive semantics')
      },
    }
    return { reader, calls }
  }
  function primitiveEffect(kind: (typeof primitiveKinds)[number]) {
    const effect = plan.components.effects.find((candidate) => candidate.compiled.kind === kind)
    if (!effect) throw new Error(`Missing actual frozen primitive: ${kind}`)
    return effect
  }

  it.each(primitiveKinds)(
    '%s commits minimal actual identity evidence, not completion or semantic authority',
    async (kind) => {
      const effect = primitiveEffect(kind)
      const beforeCatalog = identityCatalog(false)
      const before = await captureReplayPositionPredecessor(
        beforeCatalog.reader,
        sessionPin,
        effect,
      )
      const after = identityCatalog(true)
      const result = await deriveReplayEffectPositionAuthority(
        after.reader,
        sessionPin,
        effect,
        before,
      )
      expect(result.authority).toEqual({ effectId: effect.effectId, sourceHash: effect.sourceHash })
      expect(beforeCatalog.calls).toEqual([
        [q.snapshot, []],
        [proceduralQueries.identity, []],
      ])
      expect(after.calls).toEqual(beforeCatalog.calls)
      expect(before.reads.map((r) => r.sql)).toEqual([q.snapshot, proceduralQueries.identity])
      expect(result.reads.map((r) => r.sql)).toEqual([q.snapshot, proceduralQueries.identity])
      expect(result.reads[1].rows).toEqual([independentIdentity])
      expect(result.readSetDigest).toBe(replayDigest(result.reads))
      expect(result.predecessorDigest).toBe(before.snapshotDigest)
      expect(result.snapshotDigest).not.toBe(before.snapshotDigest)
      expect(before.sourcePredecessorDigests).toEqual([])
      expect(result.sourcePredecessorDigests).toEqual([])
      expect(Object.isFrozen(result.authority)).toBe(true)
      expect(Object.isFrozen(result.reads[1].rows[0])).toBe(true)
      expect(result).not.toHaveProperty('definition')
      expect(result).not.toHaveProperty('observation')
    },
  )

  it.each(
    primitiveKinds.flatMap((kind) =>
      (['actor', 'database', 'search_path'] as const).map((field) => [kind, field] as const),
    ),
  )('%s denies independently observed %s drift in both phases', async (kind, field) => {
    const effect = primitiveEffect(kind)
    const before = await captureReplayPositionPredecessor(
      identityCatalog(false).reader,
      sessionPin,
      effect,
    )
    const patch = {
      [field]: field === 'search_path' ? ['untrusted_shadow', 'public'] : 'wrong_identity',
    }
    const captureCatalog = identityCatalog(false, patch)
    await expect(
      captureReplayPositionPredecessor(captureCatalog.reader, sessionPin, effect),
    ).rejects.toThrow('REPLAY_POSITION_ACTUAL_IDENTITY_OR_PATH_DRIFT')
    const deriveCatalog = identityCatalog(true, patch)
    await expect(
      deriveReplayEffectPositionAuthority(deriveCatalog.reader, sessionPin, effect, before),
    ).rejects.toThrow('REPLAY_POSITION_ACTUAL_IDENTITY_OR_PATH_DRIFT')
    expect(captureCatalog.calls).toEqual([
      [q.snapshot, []],
      [proceduralQueries.identity, []],
    ])
    expect(deriveCatalog.calls).toEqual(captureCatalog.calls)
  })

  it.each(primitiveKinds)(
    '%s denies copied captures, substituted source components and pin drift',
    async (kind) => {
      const effect = primitiveEffect(kind)
      const before = await captureReplayPositionPredecessor(
        identityCatalog(false).reader,
        sessionPin,
        effect,
      )
      const after = identityCatalog(true)
      await expect(
        deriveReplayEffectPositionAuthority(
          after.reader,
          sessionPin,
          effect,
          structuredClone(before),
        ),
      ).rejects.toThrow('REPLAY_POSITION_INDEPENDENT_PREDECESSOR_REQUIRED')
      const replacement = plan.components.effects.find(
        (candidate) => candidate.compiled.kind === kind && candidate.effectId !== effect.effectId,
      )
      expect(replacement).toBeDefined()
      await expect(
        deriveReplayEffectPositionAuthority(after.reader, sessionPin, replacement!, before),
      ).rejects.toThrow('REPLAY_POSITION_SNAPSHOT_SOURCE_OR_CONTEXT_DRIFT')
      await expect(
        deriveReplayEffectPositionAuthority(
          after.reader,
          {
            ...sessionPin,
            execution: { ...sessionPin.execution, exclusiveExecutionReference: 'another-window' },
          },
          effect,
          before,
        ),
      ).rejects.toThrow('REPLAY_POSITION_SNAPSHOT_SOURCE_OR_CONTEXT_DRIFT')
      expect(after.calls).toEqual([])
    },
  )

  it.each(primitiveKinds)(
    '%s rejects source/contract substitution before any identity read',
    async (kind) => {
      const effect = primitiveEffect(kind)
      const altered = structuredClone(effect)
      altered.compiled.contract.contractDigest = '0'.repeat(64)
      const observed = identityCatalog(false)
      await expect(
        captureReplayPositionPredecessor(observed.reader, sessionPin, altered),
      ).rejects.toThrow('REPLAY_POSITION_CONTRACT_DRIFT')
      await expect(
        captureReplayPositionPredecessor(observed.reader, sessionPin, {
          ...effect,
          source: `${effect.source}\n`,
        }),
      ).rejects.toThrow('REPLAY_POSITION_SOURCE_HASH_DRIFT')
      expect(observed.calls).toEqual([])
    },
  )

  it('binds an actual named-enum relation contract without authenticating its enum or inspecting catalogs', async () => {
    const effect = plan.components.effects.find(
      (candidate) =>
        candidate.compiled.kind === 'RELATION' &&
        candidate.compiled.contract.columns.some((c) => c.type.enum),
    )
    expect(effect).toBeDefined()
    const before = await captureReplayPositionPredecessor(
      identityCatalog(false).reader,
      sessionPin,
      effect!,
    )
    const result = await deriveReplayEffectPositionAuthority(
      identityCatalog(true).reader,
      sessionPin,
      effect!,
      before,
    )
    expect(result.authority).toEqual({ effectId: effect!.effectId, sourceHash: effect!.sourceHash })
    expect(result.reads).toHaveLength(2)
  })
})
