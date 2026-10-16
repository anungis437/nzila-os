import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { replayDigest, replayHash } from './post-w4p-replay'
import { catalogQueries, type CatalogReader } from './platform-baseline-promotion'
import { createCatalogQueries } from './replay-create-inspection'
import { helperCatalogQueries } from './replay-policy-helper-inspection'
import { literalPolicyQueries } from './replay-literal-policy'
import { structuralQueries } from './replay-structural-effects'
import { functionCatalogQueries } from './replay-function-inspection'
import {
  compileProceduralEffect,
  frozenProceduralSources,
  inspectProceduralEffect,
  proceduralPolicyNormalForm,
  proceduralQueries,
  tableCountQuery,
  memberDocumentsAggregateQuery,
  categoryAggregateQuery,
  type ProceduralPredecessor,
  type ProceduralContext,
  type ProceduralSource,
} from './replay-procedural-inspection'

const root = new URL('../../../../', import.meta.url)
const frozen = frozenProceduralSources()
const contracts = frozen.map((s, i) => {
  try {
    return compileProceduralEffect(s.source, s.sourceHash)
  } catch (error) {
    throw new Error(`compile source ${i + 1} ${s.effectId}`, { cause: error })
  }
})
const snapshotDigest = replayDigest('independent-fake-position-snapshot')
const acl = [
  {
    grantor: 'fixture_owner',
    grantee: 'fixture_owner',
    privilege: 'EXECUTE' as const,
    grantable: true,
  },
]
const triggerSource = readFileSync(
  new URL(
    'apps/union-eyes/db/migrations-cache/0013_workbook_credential_payment_authority.sql',
    root,
  ),
  'utf8',
)
const ledger = JSON.parse(
  readFileSync(
    new URL('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json', root),
    'utf8',
  ),
) as {
  BOUNDARIES: {
    SOURCE_PATH: string
    SOURCE_SHA256: string
    EFFECTS: {
      EFFECT_CLASS: string
      EXACT_EFFECT_SHA256: string
      SOURCE_BYTE_RANGE: [number, number]
      COMPARATOR: { EXACT_SOURCE_SEMANTICS: string }
    }[]
  }[]
}
const functionSource = ledger.BOUNDARIES.flatMap((b) => b.EFFECTS).find(
  (e) =>
    e.EFFECT_CLASS === 'FUNCTION_OR_PROCEDURE' &&
    e.COMPARATOR.EXACT_SOURCE_SEMANTICS.includes('ue_enforce_workbook_credential_authority'),
)!
const functionBody =
  /CREATE OR REPLACE FUNCTION ue_enforce_workbook_credential_authority\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$/i.exec(
    triggerSource,
  )![1]
const allRelations = [
  'member_documents',
  'organizations',
  'organization_members',
  'messages',
  'message_threads',
  'grievances',
  'message_read_receipts',
  'message_notifications',
  'cross_org_access_log',
  'grievance_deadlines',
  'workbooks',
]
const retrofits: Record<
  string,
  {
    column: string
    type: string
    notNull: boolean
    index?: string
    fk?: string
    cascade?: boolean
    default?: string
  }[]
> = {
  member_documents: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: false,
      fk: 'member_documents_organization_id_fkey',
      index: 'idx_member_documents_org',
    },
    { column: 'user_id', type: 'uuid', notNull: true, index: 'idx_member_documents_user' },
  ],
  chat_sessions: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'chat_sessions_organization_id_organizations_id_fk',
      cascade: true,
      index: 'chat_sessions_organization_id_idx',
    },
  ],
  board_packets: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'board_packets_organization_id_organizations_id_fk',
      cascade: true,
      index: 'board_packets_organization_id_idx',
    },
  ],
  policy_rules: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'policy_rules_organization_id_organizations_id_fk',
      cascade: true,
      index: 'policy_rules_organization_id_idx',
    },
  ],
  voting_sessions: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'voting_sessions_organization_id_organizations_id_fk',
      cascade: true,
      index: 'voting_sessions_organization_id_idx',
    },
  ],
  bargaining_notes: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      index: 'bargaining_notes_organization_id_idx',
    },
  ],
  budget_pool: [
    {
      column: 'organization_id',
      type: 'character varying(255)',
      notNull: true,
      index: 'idx_budget_pool_org',
    },
  ],
  calendar_events: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'calendar_events_organization_id_organizations_id_fk',
      cascade: true,
      index: 'calendar_events_organization_id_idx',
    },
  ],
  clause_comparisons: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      index: 'clause_comparisons_organization_idx',
    },
  ],
  clc_sync_log: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: false,
      fk: 'clc_sync_log_organization_id_fkey',
      index: 'idx_sync_log_org',
    },
  ],
  consent_records: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'consent_records_organization_id_organizations_id_fk',
      cascade: true,
      index: 'consent_records_organization_id_idx',
    },
  ],
  cookie_consents: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'cookie_consents_organization_id_organizations_id_fk',
      cascade: true,
      index: 'cookie_consents_organization_id_idx',
    },
  ],
  defensibility_packs: [{ column: 'organization_id', type: 'uuid', notNull: true }],
  geofences: [{ column: 'union_local_id', type: 'uuid', notNull: false }],
  mobile_devices: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: false,
      fk: 'mobile_devices_organization_id_organizations_id_fk',
      cascade: true,
    },
  ],
  pilot_metrics: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'pilot_metrics_organization_id_organizations_id_fk',
      cascade: true,
      index: 'pilot_metrics_organization_id_idx',
    },
  ],
  reward_wallet_ledger: [
    {
      column: 'org_id',
      type: 'uuid',
      notNull: true,
      fk: 'reward_wallet_ledger_org_id_organizations_id_fk',
      cascade: true,
      index: 'reward_wallet_ledger_org_user_idx',
    },
  ],
  strike_fund_disbursements: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'strike_fund_disbursements_organization_id_organizations_id_fk',
      cascade: true,
    },
  ],
  user_consents: [
    {
      column: 'organization_id',
      type: 'uuid',
      notNull: true,
      fk: 'user_consents_organization_id_organizations_id_fk',
      cascade: true,
      index: 'user_consents_organization_id_idx',
    },
  ],
  shared_clause_library: [
    {
      column: 'sharing_level',
      type: 'character varying(50)',
      notNull: true,
      default: "'private'::character varying",
      index: 'idx_shared_clauses_sharing',
    },
    { column: 'shared_with_org_ids', type: 'uuid[]', notNull: false },
  ],
}
function context(source: ProceduralSource): ProceduralContext {
  return {
    effectId: source.effectId,
    sourceHash: source.sourceHash,
    boundaryHash: source.boundaryHash,
    ordinal: source.ordinal,
    window: 'IMMEDIATE_PRE_SUCCESSOR',
    snapshotDigest,
    actor: 'fixture_actor',
    database: 'fixture_db',
    searchPath: ['pg_catalog', 'public'],
    relations: Object.fromEntries(
      [...allRelations, ...Object.keys(retrofits), 'organization_members', 'claim_updates'].map(
        (t) => [t, 'public'],
      ),
    ),
    creationSchema: 'public',
    catalogVisibility: { snapshotDigest, schemas: ['public'], allSchemas: true },
    dataVisibility: Object.fromEntries(
      [...Object.keys(retrofits), 'organization_members'].map((t) => [
        `public.${t}`,
        { snapshotDigest, basis: 'independent full-row fixture inventory' },
      ]),
    ),
    databaseGrantor: 'fixture_owner',
    triggerFunction: {
      sourceHash: functionSource.EXACT_EFFECT_SHA256,
      schema: 'public',
      owner: 'fixture_owner',
      acl,
    },
    memberDocumentsForeignKeyName: 'member_documents_organization_id_fkey',
  }
}
type Mutation =
  | 'NONE'
  | 'MUTATE'
  | 'ABSENT_TARGET'
  | 'ABSENT_EFFECT'
  | 'MALFORMED'
  | 'MISSING_COLUMN'
  | 'MISSING_PARENT'
  | 'INDEX_DRIFT'
  | 'FK_DRIFT'
  | 'AGGREGATE_MISSING'
  | 'NONEMPTY'
function fake(
  index: number,
  mutation: Mutation = 'NONE',
  before = false,
): CatalogReader & { calls: [string, string[]][] } {
  const source = frozen[index]
  const table = Object.keys(retrofits).find((t) => source.source.includes(`'public.${t}'`))
  const fixture = table ? retrofits[table] : []
  const calls: [string, string[]][] = []
  return {
    calls,
    async query(sql, p) {
      calls.push([sql, p])
      if (sql === proceduralQueries.identity)
        return mutation === 'MALFORMED'
          ? [{ actor: 3 }]
          : [
              {
                actor: 'fixture_actor',
                database: 'fixture_db',
                search_path: ['pg_catalog', 'public'],
              },
            ]
      if (
        sql === createCatalogQueries.namespace ||
        sql === functionCatalogQueries.namespace ||
        sql === literalPolicyQueries.role ||
        sql === functionCatalogQueries.owner
      )
        return [{ name: p[0] }]
      if (sql === catalogQueries.type) {
        if (mutation === 'ABSENT_EFFECT') return []
        // Independent literal extraction, not the compiled enum contract.
        const labels = /AS ENUM \(([\s\S]*?)\);/i
          .exec(source.source)![1]
          .match(/'(?:[^']|'')*'/g)!
          .map((v) => v.slice(1, -1).replaceAll("''", "'"))
        return [{ kind: 'e', members: mutation === 'MUTATE' ? [...labels, 'extra_label'] : labels }]
      }
      if (sql === helperCatalogQueries.relation) {
        if (
          mutation === 'ABSENT_TARGET' ||
          (mutation === 'MISSING_PARENT' &&
            ['messages', 'message_threads', 'grievances'].includes(p[1]))
        )
          return []
        if (index === 34 && mutation === 'MUTATE') return []
        return [
          {
            oid: String(parseInt(replayHash(p.join('.')).slice(0, 8), 16)),
            schema: p[0],
            name: p[1],
            kind: 'r',
            enabled: true,
            forced: true,
            visible: true,
            inheritance: 0,
          },
        ]
      }
      if (sql === proceduralQueries.visibleColumn)
        return mutation === 'MISSING_COLUMN' ? [] : [{ name: p[2] }]
      if (index >= 72) {
        if (sql === proceduralQueries.defaultColumn) {
          if (mutation === 'MISSING_COLUMN') return []
          const literal = p[2] === 'member_category'
          return [
            {
              name: p[2],
              type_oid: literal ? '25' : '2950',
              typmod: -1,
              type_name: literal ? 'text' : 'uuid',
              type_schema: 'pg_catalog',
              type_kind: 'b',
              category: literal ? 'S' : 'U',
              base_oid: '0',
              postgres_type: literal ? 'text' : 'uuid',
              not_null: !literal,
              identity: '',
              generated: '',
              input_schema: 'pg_catalog',
              input_name: literal ? 'textin' : 'uuid_in',
              input_language: 'internal',
              input_source: literal ? 'textin' : 'uuid_in',
              labels: [],
              default_expression: before
                ? null
                : mutation === 'MUTATE'
                  ? "'drift'"
                  : literal
                    ? "'full_member'::text"
                    : 'gen_random_uuid()',
              default_functions: before || literal ? [] : ['3432'],
              function_dependencies: [],
              type_dependencies: [],
            },
          ]
        }
        if (sql === proceduralQueries.defaultGenerator)
          return [
            {
              oid: '3432',
              schema: 'pg_catalog',
              name: 'gen_random_uuid',
              language: 'internal',
              source: 'gen_random_uuid',
              binary: null,
              arguments: 0,
              kind: 'f',
              volatility: 'v',
              set_returning: false,
              security_definer: false,
              configuration: null,
              result: 'uuid',
              result_schema: 'pg_catalog',
              executable: true,
              extension: null,
            },
          ]
        if (sql === proceduralQueries.defaultGeneratorCandidates)
          return [{ oid: '3432', schema: 'pg_catalog', arguments: 0, defaults: 0, variadic: '0' }]
        if (sql === proceduralQueries.uuidAssignmentCast) return []
        if (sql === proceduralQueries.defaultPrivileges)
          return [
            {
              can_alter: true,
              can_select: true,
              can_update: true,
              constraints: [],
              triggers: [],
              rules: [],
            },
          ]
        if (sql === categoryAggregateQuery('public'))
          return before
            ? [
                { value: null, total: '2' },
                { value: 'full_member', total: '3' },
                { value: 'associate', total: '4' },
              ]
            : [
                { value: 'full_member', total: '5' },
                { value: 'associate', total: '4' },
              ]
      }
      if (sql === proceduralQueries.policies) {
        if (index === 11)
          return [
            {
              schemaname: 'another_schema',
              tablename: 'claims',
              policyname: 'arbitrary',
              cmd: 'ALL',
              roles: ['other_role'],
              source_prohibited: mutation === 'MUTATE',
              qual:
                mutation === 'MUTATE'
                  ? "(current_setting('app.current_org_id',true) IS NULL)"
                  : 'true',
            },
          ]
        const guardTable = index === 5 ? 'claims' : index === 12 ? 'holidays' : 'workbooks'
        return [
          {
            schemaname: 'public',
            tablename: guardTable,
            policyname: 'ue_org_isolation_select',
            // 0011/0012 really only check roles: an unexpected command still passes.
            cmd: index === 5 ? 'SELECT' : 'DELETE',
            roles: mutation === 'MUTATE' ? ['public'] : ['union_eyes_runtime'],
            qual: 'true',
          },
        ]
      }
      if (sql === proceduralQueries.databaseAcl) {
        if (mutation === 'ABSENT_EFFECT') return []
        return ['union_eyes_runtime', 'union_eyes_system'].map((grantee) => ({
          database: 'fixture_db',
          grantor: 'fixture_owner',
          grantee,
          privilege: 'CONNECT',
          grantable: mutation === 'MUTATE',
        }))
      }
      if (sql === createCatalogQueries.columns) {
        if (
          mutation === 'ABSENT_EFFECT' ||
          (index !== 6 && ['AGGREGATE_MISSING', 'NONEMPTY'].includes(mutation))
        )
          return []
        return fixture.map((c) => ({
          name: c.column,
          postgres_type: c.type,
          type_schema: 'pg_catalog',
          type_name:
            mutation === 'MUTATE'
              ? 'text'
              : c.type.startsWith('character')
                ? 'varchar'
                : c.type === 'uuid[]'
                  ? '_uuid'
                  : 'uuid',
          type_kind: 'b',
          not_null: c.notNull,
          identity: '',
          generated: '',
          collation_default: true,
          acl: null,
          default_expression: c.default ?? null,
        }))
      }
      if (sql === structuralQueries.foreignKey) {
        const c = fixture.find((c) => c.fk === p[2])
        if (!c) throw new Error(`unknown independent FK ${p[2]}`)
        return [
          {
            kind: 'f',
            validated: true,
            deferrable: false,
            deferred: false,
            local: true,
            inherited: 0,
            delete_action: mutation === 'FK_DRIFT' ? 'n' : c.cascade ? 'c' : 'a',
            update_action: 'a',
            match: 's',
            parent_schema: 'public',
            parent_name: 'organizations',
            columns: [c.column],
            parent_columns: ['id'],
          },
        ]
      }
      if (sql === structuralQueries.index) {
        const c = fixture.find((c) => c.index === p[1])
        if (!c) throw new Error(`unknown independent index ${p[1]}`)
        return [
          {
            kind: 'i',
            table_schema: 'public',
            table_name: table,
            method: 'btree',
            unique: false,
            valid: mutation !== 'INDEX_DRIFT',
            ready: true,
            live: true,
            primary: false,
            exclusion: false,
            nulls_not_distinct: false,
            predicate: null,
            expressions: null,
            key_count: 1,
            total_count: 1,
            columns: [c.column],
            options: [0],
            key_definitions: [c.column],
            opclasses_default: true,
            collations_default: true,
          },
        ]
      }
      if (table && sql === tableCountQuery('public', table))
        return mutation === 'AGGREGATE_MISSING'
          ? []
          : [{ total: mutation === 'NONEMPTY' ? '9' : '0' }]
      if (sql === memberDocumentsAggregateQuery('public', 'public'))
        return mutation === 'AGGREGATE_MISSING'
          ? []
          : [
              {
                null_rows: mutation === 'NONEMPTY' ? '9' : '0',
                zero_match_groups: '0',
                multi_match_groups: '0',
              },
            ]
      if (sql === literalPolicyQueries.setting)
        return [
          {
            schema: 'pg_catalog',
            name: 'current_setting',
            language: 'internal',
            result: 'text',
            volatility: 's',
            executable: true,
            text_operator_builtin: true,
          },
        ]
      if (sql === literalPolicyQueries.policy) {
        if (mutation === 'ABSENT_EFFECT') return []
        const command = p[2].endsWith('_select')
          ? 'r'
          : p[2].endsWith('_insert')
            ? 'a'
            : p[2].endsWith('_update')
              ? 'w'
              : p[2].endsWith('_delete')
                ? 'd'
                : '*'
        const system = p[2] === 'ue_system_full_access'
        const expression = system
          ? 'true'
          : p[1] === 'grievance_deadlines'
            ? "EXISTS (SELECT 1 FROM grievances g WHERE ((g.id = grievance_deadlines.grievance_id) AND ((g.organization_id)::text = current_setting('app.current_org_id'::text, true))))"
            : `EXISTS (SELECT 1 FROM (messages m JOIN message_threads mt ON (mt.id = m.thread_id)) WHERE ((m.id = ${p[1]}.message_id) AND ((mt.organization_id)::text = current_setting('app.current_org_id'::text, true))))`
        return [
          {
            name: p[2],
            name_matches: true,
            command,
            permissive: true,
            roles:
              mutation === 'MUTATE'
                ? ['public']
                : [system ? 'union_eyes_system' : 'union_eyes_runtime'],
            using_expression: command === 'a' ? null : expression,
            check_expression: command === 'r' || command === 'd' ? null : expression,
          },
        ]
      }
      if (sql === functionCatalogQueries.type)
        return [{ schema: p[0], name: p[1], kind: 'p', visible: true }]
      if (sql === functionCatalogQueries.language)
        return [{ name: 'plpgsql', trusted: true, owner_usage: true }]
      if (sql === functionCatalogQueries.functions)
        return [
          {
            schema: 'public',
            name: 'ue_enforce_workbook_credential_authority',
            kind: 'f',
            argument_types: [],
            argument_names: null,
            argument_modes: null,
            all_argument_types: null,
            argument_count: 0,
            variadic: '0',
            default_count: 0,
            defaults: null,
            return_schema: 'pg_catalog',
            return_name: 'trigger',
            return_kind: 'p',
            returns_set: false,
            language: 'plpgsql',
            security_definer: false,
            volatility: 'v',
            strict: false,
            parallel: 'u',
            leakproof: false,
            config: null,
            body: functionBody,
            binary: null,
            cost: 100,
            rows: 0,
            support: '0',
            transforms: null,
            sql_body_absent: true,
            owner: 'fixture_owner',
            acl,
            dependents: [],
          },
        ]
      if (sql === proceduralQueries.trigger) {
        if (mutation === 'ABSENT_EFFECT') return []
        return [
          {
            name: 'ue_workbook_credential_authority',
            type: mutation === 'MUTATE' ? 21 : 23,
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
          },
        ]
      }
      throw new Error(`UNEXPECTED_READ_ONLY_QUERY ${sql} ${p.join(',')}`)
    },
  }
}
const beforeDigest = replayDigest('independent-pre-block-snapshot')
function predecessor(index: number): ProceduralPredecessor | undefined {
  return index >= 72
    ? {
        reader: fake(index, 'NONE', true),
        snapshotDigest: beforeDigest,
        dataVisibility: {
          'public.organization_members': {
            snapshotDigest: beforeDigest,
            basis: 'independent pre-block full-row inventory',
          },
        },
      }
    : undefined
}
type DefaultPatch = (
  sql: string,
  parameters: string[],
  rows: Record<string, unknown>[],
  phase: 'BEFORE' | 'AFTER',
) => Record<string, unknown>[]
async function defaultScenario(index: number, patch: DefaultPatch, ctx = context(frozen[index])) {
  const wrap = (phase: 'BEFORE' | 'AFTER'): CatalogReader => {
    const base = fake(index, 'NONE', phase === 'BEFORE')
    return {
      query: async (sql, parameters) =>
        patch(
          sql,
          parameters,
          (await base.query(sql, parameters)).map((r) => r as Record<string, unknown>),
          phase,
        ),
    }
  }
  return inspectProceduralEffect(wrap('AFTER'), contracts[index], ctx, {
    ...predecessor(index)!,
    reader: wrap('BEFORE'),
  })
}
describe('native assignment and exact exception/subtransaction semantics', () => {
  for (const index of [72, 74]) {
    for (const caught of ['undefined_function', 'datatype_mismatch'] as const) {
      it(`accepts ${caught} with independent unchanged catalog facts for source ${index + 1}`, async () => {
        const observation = await defaultScenario(index, (sql, _p, rows) => {
          if (
            caught === 'undefined_function' &&
            [
              proceduralQueries.defaultGenerator,
              proceduralQueries.defaultGeneratorCandidates,
            ].includes(sql)
          )
            return []
          if (sql === proceduralQueries.defaultColumn)
            return rows.map((row) => ({
              ...row,
              default_expression: null,
              default_functions: [],
              ...(caught === 'datatype_mismatch'
                ? {
                    type_oid: '23',
                    type_name: 'int4',
                    postgres_type: 'integer',
                    category: 'N',
                    input_name: 'int4in',
                    input_source: 'int4in',
                  }
                : {}),
            }))
          return rows
        })
        expect(observation.state).toBe('EXACT')
        expect(observation.branch).toContain(caught)
        expect(observation.branch).toContain('SUBTRANSACTION_ROLLBACK')
      })
      it(`rejects changed defaults on accepted ${caught} branch for source ${index + 1}`, async () => {
        const observation = await defaultScenario(index, (sql, _p, rows, phase) => {
          if (
            caught === 'undefined_function' &&
            [
              proceduralQueries.defaultGenerator,
              proceduralQueries.defaultGeneratorCandidates,
            ].includes(sql)
          )
            return []
          if (sql === proceduralQueries.defaultColumn)
            return rows.map((row) => ({
              ...row,
              default_expression: phase === 'BEFORE' ? null : "'changed'",
              default_functions: [],
              ...(caught === 'datatype_mismatch'
                ? {
                    type_oid: '23',
                    type_name: 'int4',
                    postgres_type: 'integer',
                    category: 'N',
                    input_name: 'int4in',
                    input_source: 'int4in',
                  }
                : {}),
            }))
          return rows
        })
        expect(observation.state).toBe('DRIFTED')
      })
    }
    for (const field of ['result', 'source', 'language', 'volatility', 'schema', 'extension']) {
      it(`rejects generator ${field} drift for source ${index + 1}`, async () => {
        expect(
          (
            await defaultScenario(index, (sql, _p, rows, phase) =>
              sql === proceduralQueries.defaultGenerator && phase === 'AFTER'
                ? rows.map((r) => ({ ...r, [field]: 'altered' }))
                : rows,
            )
          ).state,
        ).toBe('DRIFTED')
      })
    }
    for (const field of ['default_functions', 'function_dependencies', 'type_dependencies']) {
      it(`rejects changed ${field} for source ${index + 1}`, async () => {
        expect(
          (
            await defaultScenario(index, (sql, _p, rows, phase) =>
              sql === proceduralQueries.defaultColumn && phase === 'AFTER'
                ? rows.map((r) => ({ ...r, [field]: ['9999'] }))
                : rows,
            )
          ).state,
        ).toBe('DRIFTED')
      })
    }
    it(`rejects defaulted/variadic overloads as synthetic undefined_function for source ${index + 1}`, async () => {
      for (const variadic of ['0', '2950']) {
        expect(
          (
            await defaultScenario(index, (sql, _p, rows) => {
              if (sql === proceduralQueries.defaultGenerator) return []
              if (sql === proceduralQueries.defaultGeneratorCandidates)
                return [
                  {
                    oid: '9000',
                    schema: 'public',
                    arguments: 1,
                    defaults: variadic === '0' ? 1 : 0,
                    variadic,
                  },
                ]
              return rows
            })
          ).state,
        ).toBe('DRIFTED')
      }
    })
    it(`uses native string assignment IO rather than treating uuid to text as datatype_mismatch for source ${index + 1}`, async () => {
      expect(
        (
          await defaultScenario(index, (sql, _p, rows, phase) =>
            sql === proceduralQueries.defaultColumn
              ? rows.map((r) => ({
                  ...r,
                  type_oid: '25',
                  type_name: 'text',
                  postgres_type: 'text',
                  category: 'S',
                  input_name: 'textin',
                  input_source: 'textin',
                  default_expression: phase === 'BEFORE' ? null : '(gen_random_uuid())::text',
                }))
              : rows,
          )
        ).state,
      ).toBe('EXACT')
    })
    it(`native pgcrypto extension requires actual extension dependency for source ${index + 1}`, async () => {
      for (const dependency of [true, false]) {
        const observation = await defaultScenario(index, (sql, _p, rows, phase) => {
          if (sql === proceduralQueries.defaultGenerator)
            return rows.map((r) => ({
              ...r,
              oid: '9010',
              schema: 'public',
              language: 'c',
              source: 'pg_random_uuid',
              binary: '$libdir/pgcrypto',
              extension: 'pgcrypto',
            }))
          if (sql === proceduralQueries.defaultGeneratorCandidates)
            return [{ oid: '9010', schema: 'public', arguments: 0, defaults: 0, variadic: '0' }]
          if (sql === proceduralQueries.defaultColumn && phase === 'AFTER')
            return rows.map((r) => ({
              ...r,
              default_expression: 'public.gen_random_uuid()',
              default_functions: ['9010'],
              function_dependencies: dependency ? ['9010'] : [],
            }))
          return rows
        })
        expect(observation.state).toBe(dependency ? 'EXACT' : 'DRIFTED')
      }
    })
    it(`executable ACL facts deny rather than becoming caught undefined_function for source ${index + 1}`, async () => {
      expect(
        (
          await defaultScenario(index, (sql, _p, rows) =>
            sql === proceduralQueries.defaultGenerator
              ? rows.map((r) => ({ ...r, executable: false }))
              : rows,
          )
        ).state,
      ).toBe('MISSING_PREREQUISITE')
    })
  }
  for (const index of [73, 74]) {
    it(`accepts undefined_column using genuine absent-column rows for source ${index + 1}`, async () => {
      const observation = await defaultScenario(index, (sql, _p, rows) =>
        sql === proceduralQueries.defaultColumn ? [] : rows,
      )
      expect(observation.state).toBe('EXACT')
      expect(observation.branch).toContain('undefined_column')
      if (index === 73) expect(observation.branch).toContain('UPDATE_NULLS:undefined_column')
    })
    it(`column absence does not bypass uncaught ALTER ownership failure for source ${index + 1}`, async () => {
      expect(
        (
          await defaultScenario(index, (sql, _p, rows) => {
            if (sql === proceduralQueries.defaultColumn) return []
            if (sql === proceduralQueries.defaultPrivileges)
              return rows.map((r) => ({ ...r, can_alter: false }))
            return rows
          })
        ).state,
      ).toBe('MISSING_PREREQUISITE')
    })
  }
  it('a caught id datatype_mismatch leaves update_id independently installable', async () => {
    const observation = await defaultScenario(74, (sql, p, rows) =>
      sql === proceduralQueries.defaultColumn && p[2] === 'id'
        ? rows.map((r) => ({
            ...r,
            type_oid: '23',
            type_name: 'int4',
            postgres_type: 'integer',
            category: 'N',
            input_name: 'int4in',
            input_source: 'int4in',
            default_expression: "'42'::integer",
            default_functions: [],
          }))
        : rows,
    )
    expect(observation.state).toBe('EXACT')
    expect(observation.branch).toContain('id:datatype_mismatch')
    expect(observation.branch).toContain('update_id:SET_DEFAULT')
  })
  it('a caught first missing column does not suppress the second default', async () => {
    const observation = await defaultScenario(74, (sql, p, rows) =>
      sql === proceduralQueries.defaultColumn && p[2] === 'id' ? [] : rows,
    )
    expect(observation.state).toBe('EXACT')
    expect(observation.branch).toContain('id:undefined_column')
    expect(observation.branch).toContain('update_id:SET_DEFAULT')
  })
  it('explicit-only UUID casts are not assignment casts and preserve accepted datatype_mismatch', async () => {
    const observation = await defaultScenario(74, (sql, _p, rows) => {
      if (sql === proceduralQueries.uuidAssignmentCast)
        return [{ context: 'e', method: 'f', function_oid: '9100' }]
      if (sql === proceduralQueries.defaultColumn)
        return rows.map((r) => ({
          ...r,
          type_oid: '23',
          type_name: 'int4',
          postgres_type: 'integer',
          category: 'N',
          input_name: 'int4in',
          input_source: 'int4in',
          default_expression: "'42'::integer",
          default_functions: [],
        }))
      return rows
    })
    expect(observation.state).toBe('EXACT')
    expect(observation.branch).toContain('datatype_mismatch')
  })
  it('an enum UUID target has a real native datatype_mismatch rather than a guessed successful cast', async () => {
    const observation = await defaultScenario(74, (sql, _p, rows) =>
      sql === proceduralQueries.defaultColumn
        ? rows.map((r) => ({
            ...r,
            type_oid: '5001',
            type_schema: 'public',
            type_name: 'member_category',
            type_kind: 'e',
            category: 'E',
            postgres_type: 'member_category',
            input_name: 'enum_in',
            input_source: 'enum_in',
            labels: ['full_member', 'associate'],
            default_expression: null,
            default_functions: [],
          }))
        : rows,
    )
    expect(observation.state).toBe('EXACT')
    expect(observation.branch).toContain('datatype_mismatch')
  })
  it('member-category literal assignment supports independent native enum input and exact type dependencies', async () => {
    for (const typeDependency of [true, false]) {
      const observation = await defaultScenario(73, (sql, _p, rows, phase) =>
        sql === proceduralQueries.defaultColumn
          ? rows.map((r) => ({
              ...r,
              type_oid: '5001',
              type_schema: 'public',
              type_name: 'member_category',
              type_kind: 'e',
              category: 'E',
              postgres_type: 'member_category',
              input_name: 'enum_in',
              input_source: 'enum_in',
              labels: ['full_member', 'associate'],
              default_expression: phase === 'BEFORE' ? null : "'full_member'::member_category",
              type_dependencies: phase === 'AFTER' && typeDependency ? ['5001'] : [],
            }))
          : rows,
      )
      expect(observation.state).toBe(typeDependency ? 'EXACT' : 'DRIFTED')
    }
  })
  it('member-category literal assignment respects native varchar input rather than guessing enum-only resolution', async () => {
    expect(
      (
        await defaultScenario(73, (sql, _p, rows, phase) =>
          sql === proceduralQueries.defaultColumn
            ? rows.map((r) => ({
                ...r,
                type_oid: '1043',
                type_name: 'varchar',
                postgres_type: 'character varying(255)',
                typmod: 259,
                input_name: 'varcharin',
                input_source: 'varcharin',
                default_expression: phase === 'BEFORE' ? null : "'full_member'::character varying",
              }))
            : rows,
        )
      ).state,
    ).toBe('EXACT')
  })
  it('generator/type input shadowing and non-native assignment casts never manufacture exact', async () => {
    expect(
      (
        await defaultScenario(74, (sql, _p, rows) =>
          sql === proceduralQueries.defaultColumn
            ? rows.map((r) => ({ ...r, input_schema: 'public' }))
            : rows,
        )
      ).state,
    ).toBe('MISSING_PREREQUISITE')
    expect(
      (
        await defaultScenario(74, (sql, _p, rows) =>
          sql === proceduralQueries.uuidAssignmentCast
            ? [{ context: 'a', method: 'f', function_oid: '9100' }]
            : sql === proceduralQueries.defaultColumn
              ? rows.map((r) => ({
                  ...r,
                  type_oid: '25',
                  type_name: 'text',
                  postgres_type: 'text',
                  category: 'S',
                  input_name: 'textin',
                  input_source: 'textin',
                }))
              : rows,
        )
      ).state,
    ).toBe('DRIFTED')
  })
  it('custom schema function resolution is not replaced by a default pg_catalog assumption', async () => {
    expect(
      (
        await defaultScenario(74, (sql, _p, rows) => {
          if (sql === proceduralQueries.defaultGenerator)
            return rows.map((r) => ({ ...r, schema: 'public' }))
          if (sql === proceduralQueries.defaultGeneratorCandidates)
            return rows.map((r) => ({ ...r, schema: 'public' }))
          return rows
        })
      ).state,
    ).toBe('DRIFTED')
    const current = context(frozen[74])
    current.catalogVisibility = { snapshotDigest, schemas: ['public'] }
    expect((await defaultScenario(74, (_sql, _p, rows) => rows, current)).state).toBe(
      'MISSING_PREREQUISITE',
    )
  })
  it('partially installed independent defaults remain PARTIAL, not success', async () => {
    expect(
      (
        await defaultScenario(74, (sql, p, rows) =>
          sql === proceduralQueries.defaultColumn && p[2] === 'update_id'
            ? rows.map((r) => ({ ...r, default_expression: null, default_functions: [] }))
            : rows,
        )
      ).state,
    ).toBe('PARTIAL')
  })
  it('id guard preserves an independently present non-generator default without inspecting generator availability', async () => {
    const observation = await defaultScenario(72, (sql, _p, rows) => {
      expect(sql).not.toBe(proceduralQueries.defaultGenerator)
      return sql === proceduralQueries.defaultColumn
        ? rows.map((r) => ({
            ...r,
            default_expression: "'00000000-0000-0000-0000-000000000001'::uuid",
            default_functions: [],
          }))
        : rows
    })
    expect(observation.state).toBe('EXACT')
    expect(observation.branch).toContain('GUARD_SKIPS')
  })
  it('id guard genuinely skips missing or information-schema invisible columns', async () => {
    for (const physicalAbsent of [false, true]) {
      expect(
        (
          await defaultScenario(72, (sql, _p, rows) => {
            if (
              sql === proceduralQueries.visibleColumn ||
              (physicalAbsent && sql === proceduralQueries.defaultColumn)
            )
              return []
            if (sql === proceduralQueries.defaultColumn)
              return rows.map((r) => ({ ...r, default_expression: null, default_functions: [] }))
            return rows
          })
        ).state,
      ).toBe('EXACT')
    }
  })
  for (const index of [72, 73, 74]) {
    it(`requires distinct independently scoped pre-block snapshot for source ${index + 1}`, async () => {
      const current = context(frozen[index])
      expect((await inspectProceduralEffect(fake(index), contracts[index], current)).state).toBe(
        'MISSING_PREREQUISITE',
      )
      expect(
        (
          await inspectProceduralEffect(fake(index), contracts[index], current, {
            ...predecessor(index)!,
            snapshotDigest: current.snapshotDigest,
          })
        ).state,
      ).toBe('MISSING_PREREQUISITE')
    })
    it(`rejects semantic frozen-source exception mutation with recomputed hash for source ${index + 1}`, () => {
      const source = frozen[index].source.replace('undefined_', 'ambiguous_')
      expect(() => compileProceduralEffect(source, replayHash(source))).toThrow(
        'PROCEDURAL_UNFROZEN_SOURCE',
      )
    })
    for (const [query, field, invalid] of [
      [proceduralQueries.defaultColumn, 'default_functions', ['not-an-oid']],
      [proceduralQueries.defaultColumn, 'labels', true],
      [proceduralQueries.defaultColumn, 'input_language', null],
      [proceduralQueries.defaultPrivileges, 'can_alter', 'yes'],
      ...(index !== 73
        ? [
            [proceduralQueries.defaultGenerator, 'executable', 'yes'],
            [proceduralQueries.defaultGeneratorCandidates, 'arguments', '0'],
            [proceduralQueries.uuidAssignmentCast, 'context', 'x'],
          ]
        : []),
    ] as [string, string, unknown][]) {
      it(`rejects malformed ${field} facts for source ${index + 1}`, async () => {
        await expect(
          defaultScenario(index, (sql, _p, rows) =>
            sql === query
              ? (rows.length ? rows : [{}]).map((r) => ({ ...r, [field]: invalid }))
              : rows,
          ),
        ).rejects.toThrow()
      })
    }
    it(`changed type identity cannot justify a source exception for source ${index + 1}`, async () => {
      expect(
        (
          await defaultScenario(index, (sql, _p, rows, phase) =>
            sql === proceduralQueries.defaultColumn && phase === 'AFTER'
              ? rows.map((r) => ({ ...r, type_oid: '23' }))
              : rows,
          )
        ).state,
      ).toBe('DRIFTED')
    })
  }
  it('member-category default and null-row update are independent observed effects', async () => {
    for (const unchanged of ['default', 'data', 'both']) {
      const observation = await defaultScenario(73, (sql, _p, rows, phase) => {
        if (phase === 'AFTER' && sql === proceduralQueries.defaultColumn && unchanged !== 'data')
          return rows.map((r) => ({ ...r, default_expression: null }))
        if (
          phase === 'AFTER' &&
          sql === categoryAggregateQuery('public') &&
          unchanged !== 'default'
        )
          return [
            { value: null, total: '2' },
            { value: 'full_member', total: '3' },
            { value: 'associate', total: '4' },
          ]
        return rows
      })
      expect(observation.state).toBe(unchanged === 'both' ? 'UNSATISFIED' : 'PARTIAL')
    }
  })
  it('member-category aggregates preserve existing nonnull values, not merely zero null counts', async () => {
    for (const rows of [
      [{ value: 'full_member', total: '5' }],
      [
        { value: 'full_member', total: '6' },
        { value: 'associate', total: '3' },
      ],
    ]) {
      expect(
        (
          await defaultScenario(73, (sql, _p, original, phase) =>
            sql === categoryAggregateQuery('public') && phase === 'AFTER' ? rows : original,
          )
        ).state,
      ).toBe('DRIFTED')
    }
  })
  it('genuine empty before/after aggregate inventories certify the zero-row update branch', async () => {
    expect(
      (
        await defaultScenario(73, (sql, _p, rows) =>
          sql === categoryAggregateQuery('public') ? [] : rows,
        )
      ).state,
    ).toBe('EXACT')
  })
  it('requires full-row visibility at both snapshots, with no inferred zero counts', async () => {
    const current = context(frozen[73])
    const prior = predecessor(73)!
    for (const omit of ['BEFORE', 'AFTER']) {
      expect(
        (
          await inspectProceduralEffect(
            fake(73),
            contracts[73],
            omit === 'AFTER' ? { ...current, dataVisibility: undefined } : current,
            omit === 'BEFORE' ? { ...prior, dataVisibility: undefined } : prior,
          )
        ).state,
      ).toBe('MISSING_PREREQUISITE')
    }
    await expect(
      defaultScenario(73, (sql, _p, rows) =>
        sql === categoryAggregateQuery('public') ? [{ value: null, total: 'bogus' }] : rows,
      ),
    ).rejects.toThrow()
    await expect(
      defaultScenario(73, (sql, _p, rows) =>
        sql === categoryAggregateQuery('public')
          ? [
              { value: null, total: '1' },
              { value: null, total: '2' },
            ]
          : rows,
      ),
    ).rejects.toThrow()
  })
  it('uncaught triggers/checks require their real semantics when UPDATE touches rows, not a catch-success flag', async () => {
    expect(
      (
        await defaultScenario(73, (sql, _p, rows) =>
          sql === proceduralQueries.defaultPrivileges
            ? rows.map((r) => ({ ...r, triggers: ['CREATE TRIGGER external ...'] }))
            : rows,
        )
      ).state,
    ).toBe('MISSING_PREREQUISITE')
    expect(
      (
        await defaultScenario(73, (sql, _p, rows) =>
          sql === proceduralQueries.defaultPrivileges
            ? rows.map((r) => ({ ...r, triggers: ['CREATE TRIGGER statement_level ...'] }))
            : sql === categoryAggregateQuery('public')
              ? []
              : rows,
        )
      ).state,
    ).toBe('MISSING_PREREQUISITE')
  })
})
describe('frozen procedural components, not original whole-unit integration', () => {
  it('verifies all75exact effect and original boundary bytes without changing frozen graph/source', () => {
    expect(frozen).toHaveLength(75)
    for (const boundary of ledger.BOUNDARIES) {
      const bytes = readFileSync(new URL(boundary.SOURCE_PATH, root))
      expect(replayHash(bytes.toString())).toBe(boundary.SOURCE_SHA256)
      for (const effect of boundary.EFFECTS.filter(
        (e) => e.EFFECT_CLASS === 'DO_OR_PROCEDURAL_BLOCK',
      )) {
        const source = bytes.subarray(...effect.SOURCE_BYTE_RANGE).toString()
        expect(source).toBe(effect.COMPARATOR.EXACT_SOURCE_SEMANTICS)
        expect(replayHash(source)).toBe(effect.EXACT_EFFECT_SHA256)
      }
    }
  })
  it('measures all75 supported: 41enum,19retrofit,5guard,4policy,3defaults,1grant,1trigger,1backfill', () => {
    const counts = Object.fromEntries(
      [...new Set(contracts.map((c) => c.geometry.kind))].map((kind) => [
        kind,
        contracts.filter((c) => c.geometry.kind === kind).length,
      ]),
    )
    expect(counts).toEqual({
      ENUM: 41,
      CONNECT: 1,
      GUARD: 5,
      DEFAULTS: 3,
      BACKFILL: 1,
      POLICIES: 4,
      RETROFIT: 19,
      TRIGGER: 1,
    })
    expect(contracts.slice(72).map((c) => c.geometry)).toEqual([
      {
        kind: 'DEFAULTS',
        table: 'organization_members',
        guard: 'PUBLIC_VISIBLE_ID_NULL_DEFAULT',
        assignments: [
          {
            column: 'id',
            value: 'UUID_GENERATOR',
            catches: ['undefined_function', 'datatype_mismatch'],
          },
        ],
        updateNullCategory: false,
      },
      {
        kind: 'DEFAULTS',
        table: 'organization_members',
        guard: null,
        assignments: [
          { column: 'member_category', value: 'FULL_MEMBER', catches: ['undefined_column'] },
        ],
        updateNullCategory: true,
      },
      {
        kind: 'DEFAULTS',
        table: 'claim_updates',
        guard: null,
        assignments: ['id', 'update_id'].map((column) => ({
          column,
          value: 'UUID_GENERATOR',
          catches: ['undefined_column', 'datatype_mismatch', 'undefined_function'],
        })),
        updateNullCategory: false,
      },
    ])
    expect(contracts[5].geometry).toMatchObject({
      mode: 'COMMAND_AND_ROLE',
      tables: expect.arrayContaining(['claims']),
    })
    expect(contracts[12].geometry).toMatchObject({
      mode: 'ROLE_ONLY',
      columns: [
        ['user_notification_preferences', 'user_id'],
        ['per_capita_remittances', 'from_organization_id'],
        ['per_capita_remittances', 'to_organization_id'],
      ],
    })
    expect(contracts[13].geometry).toMatchObject({
      mode: 'ROLE_ONLY',
      columns: expect.arrayContaining([
        ['workbooks', 'claimed_by_user_id'],
        ['profiles', 'user_id'],
      ]),
    })
    for (const [index, targets, parents] of [
      [5, 24, 0],
      [12, 144, 0],
      [13, 55, 13],
      [34, 100, 14],
    ]) {
      const g = contracts[index].geometry
      if (g.kind !== 'GUARD') throw new Error('fixture guard mismatch')
      expect(g.tables).toHaveLength(targets)
      expect(g.parents).toHaveLength(parents)
    }
  })
  for (const [i, source] of frozen.entries()) {
    it(`source binding denies mutated bytes: ${i + 1}:${source.effectId}`, () => {
      expect(() => compileProceduralEffect(`${source.source}\n`, source.sourceHash)).toThrow(
        'PROCEDURAL_SOURCE_HASH_DRIFT',
      )
      const altered = source.source.replace(
        'DO',
        'DO /* semantic mutation rejected even with a new digest */',
      )
      expect(() => compileProceduralEffect(altered, replayHash(altered))).toThrow(
        'PROCEDURAL_UNFROZEN_SOURCE',
      )
    })
    it(`independent positive: ${i + 1}:${source.effectId}`, async () => {
      const reader = fake(i)
      const observed = await inspectProceduralEffect(
        reader,
        contracts[i],
        context(source),
        predecessor(i),
      )
      expect(observed.wholeUnitEligibility).toBe('NOT_ESTABLISHED')
      expect(observed.state).toBe('EXACT')
      expect(reader.calls.length).toBeGreaterThan(1)
    })
    it(`mutation and malformed observations deny exact: ${i + 1}:${source.effectId}`, async () => {
      const mutated = await inspectProceduralEffect(
        fake(i, 'MUTATE'),
        contracts[i],
        context(source),
        predecessor(i),
      )
      expect(mutated.state).toBe(i === 34 ? 'MISSING_PREREQUISITE' : 'DRIFTED')
      await expect(
        inspectProceduralEffect(
          fake(i, 'MALFORMED'),
          contracts[i],
          context(source),
          predecessor(i),
        ),
      ).rejects.toThrow()
      expect((await inspectProceduralEffect(fake(i), contracts[i])).state).toBe(
        'MISSING_PREREQUISITE',
      )
    })
    it(`absence branch remains source-specific: ${i + 1}:${source.effectId}`, async () => {
      const g = contracts[i].geometry
      const mutation = ['ENUM', 'CONNECT'].includes(g.kind) ? 'ABSENT_EFFECT' : 'ABSENT_TARGET'
      const observed = await inspectProceduralEffect(
        fake(i, mutation),
        contracts[i],
        context(source),
        predecessor(i),
      )
      expect(observed.state).toBe(
        ['ENUM', 'CONNECT'].includes(g.kind)
          ? 'UNSATISFIED'
          : i === 34 || i >= 72
            ? 'MISSING_PREREQUISITE'
            : 'EXACT',
      )
    })
    it(`malformed primary catalog/data reading denies: ${i + 1}:${source.effectId}`, async () => {
      const g = contracts[i].geometry
      const [query, field, value] =
        g.kind === 'ENUM'
          ? [catalogQueries.type, 'members', true]
          : g.kind === 'CONNECT'
            ? [proceduralQueries.databaseAcl, 'grantable', 'yes']
            : g.kind === 'RETROFIT'
              ? [createCatalogQueries.columns, 'not_null', 'yes']
              : g.kind === 'BACKFILL'
                ? [memberDocumentsAggregateQuery('public', 'public'), 'null_rows', null]
                : g.kind === 'TRIGGER'
                  ? [proceduralQueries.trigger, 'type', '23']
                  : g.kind === 'DEFAULTS'
                    ? [proceduralQueries.defaultColumn, 'typmod', 'not-an-integer']
                    : g.kind === 'POLICIES'
                      ? [literalPolicyQueries.policy, 'command', null]
                      : [helperCatalogQueries.relation, 'inheritance', '0']
      const reader = fake(i)
      const malformed: CatalogReader = {
        query: async (q, p) => {
          const rows = await reader.query(q, p)
          return q === query
            ? rows.map((row) => ({ ...(row as object), [field as string]: value }))
            : rows
        },
      }
      await expect(
        inspectProceduralEffect(malformed, contracts[i], context(source), predecessor(i)),
      ).rejects.toThrow()
    })
  }
  it('refuses forged contracts before any reader invocation', async () => {
    const reader = fake(4)
    const forged = structuredClone(contracts[4])
    if (forged.geometry.kind !== 'CONNECT') throw new Error('fixture geometry mismatch')
    forged.geometry.roles = ['public']
    await expect(inspectProceduralEffect(reader, forged, context(frozen[4]))).rejects.toThrow(
      'PROCEDURAL_CONTRACT_DRIFT',
    )
    expect(reader.calls).toHaveLength(0)
  })
  it('does not confuse 0010command guard with 0011/0012role-only temporal semantics', async () => {
    for (const i of [5, 12, 13]) {
      const reader = fake(i)
      const wrapped: CatalogReader = {
        query: async (q, p) => {
          const rows = await reader.query(q, p)
          return q === proceduralQueries.policies
            ? rows.map((r) => ({ ...(r as object), cmd: 'DELETE' }))
            : rows
        },
      }
      expect((await inspectProceduralEffect(wrapped, contracts[i], context(frozen[i]))).state).toBe(
        i === 5 ? 'DRIFTED' : 'EXACT',
      )
    }
  })
  it('requires original-position identity/resolution/visibility rather than inferred public/owner/zero rows', async () => {
    for (const i of [0, 4, 7, 14, 33]) {
      const c = context(frozen[i])
      c.ordinal++
      expect((await inspectProceduralEffect(fake(i), contracts[i], c)).state).toBe(
        'MISSING_PREREQUISITE',
      )
    }
    const enumContext = context(frozen[0])
    delete enumContext.creationSchema
    expect((await inspectProceduralEffect(fake(0), contracts[0], enumContext)).branch).toBe(
      'ENUM_CREATION_SCHEMA_MISSING',
    )
    const columnContext = context(frozen[14])
    delete columnContext.relations.chat_sessions
    expect((await inspectProceduralEffect(fake(14), contracts[14], columnContext)).state).toBe(
      'MISSING_PREREQUISITE',
    )
    const countContext = context(frozen[14])
    delete countContext.dataVisibility
    expect(
      (await inspectProceduralEffect(fake(14, 'ABSENT_EFFECT'), contracts[14], countContext))
        .branch,
    ).toBe('FULL_ROW_VISIBILITY_MISSING')
    expect(
      (
        await inspectProceduralEffect(
          fake(14, 'AGGREGATE_MISSING'),
          contracts[14],
          context(frozen[14]),
        )
      ).branch,
    ).toBe('VISIBLE_AGGREGATE_MISSING')
    expect(
      (await inspectProceduralEffect(fake(14, 'NONEMPTY'), contracts[14], context(frozen[14])))
        .branch,
    ).toBe('NONEMPTY_WITHOUT_DETERMINISTIC_AUTHORITY_SOURCE')
    expect(
      (await inspectProceduralEffect(fake(14, 'ABSENT_EFFECT'), contracts[14], context(frozen[14])))
        .state,
    ).toBe('UNSATISFIED')
  })
  it('measures owned FK/index/column partial states, not just column existence', async () => {
    for (const m of ['FK_DRIFT', 'INDEX_DRIFT'] as const)
      expect(
        (await inspectProceduralEffect(fake(14, m), contracts[14], context(frozen[14]))).state,
      ).toBe('DRIFTED')
    const reader = fake(14)
    const missingIndex: CatalogReader = {
      query: (q, p) => (q === structuralQueries.index ? Promise.resolve([]) : reader.query(q, p)),
    }
    expect(
      (await inspectProceduralEffect(missingIndex, contracts[14], context(frozen[14]))).state,
    ).toBe('PARTIAL')
    expect(
      (
        await inspectProceduralEffect(
          fake(13, 'MISSING_COLUMN'),
          contracts[13],
          context(frozen[13]),
        )
      ).state,
    ).toBe('MISSING_PREREQUISITE')
  })
  it('prohibits cross-schema empty-context patterns exactly as source; WITH CHECK and unrelated tables are not silently added to that guard', async () => {
    expect(
      (await inspectProceduralEffect(fake(11, 'MUTATE'), contracts[11], context(frozen[11]))).state,
    ).toBe('DRIFTED')
    const c = context(frozen[11])
    delete c.catalogVisibility.allSchemas
    expect((await inspectProceduralEffect(fake(11), contracts[11], c)).state).toBe(
      'MISSING_PREREQUISITE',
    )
    const reader = fake(11)
    const wildcard: CatalogReader = {
      query: async (q, p) => {
        const rows = await reader.query(q, p)
        // SQL ILIKE's '_' matches one arbitrary character, not a literal underscore.
        return q === proceduralQueries.policies
          ? rows.map((r) => ({
              ...(r as object),
              qual: "(current_setting('app.currentXorgYid',true) IS NULL)",
              source_prohibited: true,
            }))
          : rows
      },
    }
    expect(
      (await inspectProceduralEffect(wildcard, contracts[11], context(frozen[11]))).state,
    ).toBe('DRIFTED')
    const malformedPredicate: CatalogReader = {
      query: async (q, p) => {
        const rows = await reader.query(q, p)
        return q === proceduralQueries.policies
          ? rows.map((r) => ({ ...(r as object), source_prohibited: 'false' }))
          : rows
      },
    }
    await expect(
      inspectProceduralEffect(malformedPredicate, contracts[11], context(frozen[11])),
    ).rejects.toThrow()
  })
  it('compares real nested policy expressions without weakening OR/cast or changing parent bindings', async () => {
    for (const i of [7, 8, 9]) {
      expect(
        (await inspectProceduralEffect(fake(i, 'MISSING_PARENT'), contracts[i], context(frozen[i])))
          .state,
      ).toBe('MISSING_PREREQUISITE')
      expect(
        (await inspectProceduralEffect(fake(i, 'MISSING_COLUMN'), contracts[i], context(frozen[i])))
          .state,
      ).toBe('MISSING_PREREQUISITE')
      expect(
        (await inspectProceduralEffect(fake(i, 'ABSENT_EFFECT'), contracts[i], context(frozen[i])))
          .state,
      ).toBe(i === 7 ? 'UNSATISFIED' : 'PARTIAL')
    }
    expect(() =>
      proceduralPolicyNormalForm("true OR current_setting('app.current_org_id',true) IS NULL"),
    ).toThrow()
    expect(() => proceduralPolicyNormalForm('organization_id::uuid = organization_id')).toThrow()
    expect(() => proceduralPolicyNormalForm('true)')).toThrow()
    expect(() => proceduralPolicyNormalForm('(true')).toThrow()
  })
  it('trigger is BEFORE INSERT OR UPDATE EACH ROW; owner/ACL/body comparison remains mandatory', async () => {
    const c = context(frozen[33])
    delete c.triggerFunction
    expect((await inspectProceduralEffect(fake(33), contracts[33], c)).state).toBe(
      'MISSING_PREREQUISITE',
    )
    expect(
      (await inspectProceduralEffect(fake(33, 'ABSENT_EFFECT'), contracts[33], context(frozen[33])))
        .state,
    ).toBe('UNSATISFIED')
    const reader = fake(33)
    const wrongBody: CatalogReader = {
      query: async (q, p) => {
        const rows = await reader.query(q, p)
        return q === functionCatalogQueries.functions
          ? rows.map((r) => ({ ...(r as object), body: 'BEGIN RETURN NEW; END;' }))
          : rows
      },
    }
    expect(
      (await inspectProceduralEffect(wrongBody, contracts[33], context(frozen[33]))).state,
    ).toBe('DRIFTED')
  })
  it('backfill uses full visible group counts; zero/multiple matches raise and roll back the entire DO', async () => {
    expect(
      (await inspectProceduralEffect(fake(6, 'NONEMPTY'), contracts[6], context(frozen[6]))).state,
    ).toBe('PARTIAL')
    expect(
      (
        await inspectProceduralEffect(
          fake(6, 'AGGREGATE_MISSING'),
          contracts[6],
          context(frozen[6]),
        )
      ).state,
    ).toBe('MISSING_PREREQUISITE')
    for (const counts of [
      { null_rows: '2', zero_match_groups: '1', multi_match_groups: '0' },
      { null_rows: '2', zero_match_groups: '0', multi_match_groups: '1' },
    ]) {
      const reader = fake(6)
      const ambiguous: CatalogReader = {
        query: (q, p) =>
          q === memberDocumentsAggregateQuery('public', 'public')
            ? Promise.resolve([counts])
            : reader.query(q, p),
      }
      expect(
        (await inspectProceduralEffect(ambiguous, contracts[6], context(frozen[6]))).branch,
      ).toBe('BACKFILL_SOURCE_INVARIANT_WOULD_RAISE_AND_ROLL_BACK_WHOLE_DO')
    }
    const c = context(frozen[6])
    delete c.dataVisibility!['public.organization_members']
    expect((await inspectProceduralEffect(fake(6), contracts[6], c)).state).toBe(
      'MISSING_PREREQUISITE',
    )
    const reader = fake(6)
    const inconsistent: CatalogReader = {
      query: (q, p) =>
        q === memberDocumentsAggregateQuery('public', 'public')
          ? Promise.resolve([{ null_rows: '0', zero_match_groups: '1', multi_match_groups: '0' }])
          : reader.query(q, p),
    }
    await expect(
      inspectProceduralEffect(inconsistent, contracts[6], context(frozen[6])),
    ).rejects.toThrow('PROCEDURAL_BACKFILL_AGGREGATE_INCONSISTENT')
  })
})
