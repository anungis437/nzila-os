import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import {
  replayHash,
  replayObject,
  replayRecords,
  replayText,
  replayDigest,
} from './post-w4p-replay'
import { compileEnumWrapper, makeEnumReplayHandler } from './replay-enum-inspection'
import { compileLiteralPolicy, inspectLiteralPolicy } from './replay-literal-policy'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import {
  compileSchema,
  inspectSchema,
  compileAddedColumn,
  inspectAddedColumn,
  compileSimpleIndex,
  inspectSimpleIndex,
  compileForeignKey,
  inspectForeignKey,
} from './replay-structural-effects'
import {
  compilePolicyDrop,
  compileRlsToggle,
  inspectPolicyDrop,
  inspectRlsToggle,
} from './replay-rls-primitives'
import { compileBackfill, inspectBackfill } from './replay-backfill-inspection'
import { exactReplaySource } from './replay-effect-registry'
import {
  FakeReplayCatalog,
  type FakeReplayColumn,
  type FakeReplayTable,
} from './replay-fake-catalog'
import type { ReplayExecutionContext, ReplayExecutionUnit } from './post-w4p-execution'
import { compileCreateStatement, makeCreateReplayHandler } from './replay-create-inspection'
import { replayEnumAuthority } from './replay-effect-registry'
import { compileDefaultEffect, inspectDefaultEffect } from './replay-default-inspection'
const { frozen, sourceBytes } = loadFrozenReplay()
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES).flatMap((boundary) =>
  replayRecords(boundary.EFFECTS),
)
const sources = effects.map((effect) => ({
  id: replayText(effect.EFFECT_ID),
  effectClass: replayText(effect.EFFECT_CLASS),
  sql: replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
  hash: replayText(effect.EXACT_EFFECT_SHA256),
}))
function table(schema: string, name: string, columns: FakeReplayColumn[] = []): FakeReplayTable {
  return {
    schema,
    name,
    kind: 'r',
    standalone: true,
    enabled: false,
    forced: false,
    rowCountVisible: true,
    columns,
    rows: [],
    policies: [],
    primaryKey: [],
  }
}
function column(name: string, type: 'text' | 'bool' | 'uuid'): FakeReplayColumn {
  return {
    name,
    type_schema: 'pg_catalog',
    type_name: type,
    type_kind: 'b',
    postgres_type: type === 'bool' ? 'boolean' : type,
    not_null: name === 'id',
    identity: '',
    generated: '',
    default_expression: null,
    collation_default: true,
    acl: null,
  }
}
const documents = () =>
  table('public', 'documents', [
    column('id', 'uuid'),
    column('name', 'text'),
    column('title', 'text'),
    column('filename', 'text'),
    column('file_url', 'text'),
    column('uploaded_by', 'text'),
  ])
const context: ReplayExecutionContext = {
  scope: 'UE_OPERATIONAL',
  actorClass: 'MIGRATION_ADMIN',
  actorPrincipal: 'fake-only',
  targetDigest: replayDigest('fake-target'),
  w4pPlanDigest: replayText(frozen.input.promotionPlan.PLAN_DIGEST),
  w4pVerificationDigest: replayDigest('fake-w4p'),
  supplementPlanDigest: replayDigest('fake-supplement'),
  supplementVerificationDigest: replayDigest('fake-keys'),
  exclusiveExecutionReference: 'fake-transaction',
}
describe('independent offline catalog transitions;bounded subcoverage,not full107proof', () => {
  const nodes = frozen.nodes.filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT')
  const creates = frozen.nodes.filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_STATEMENT_UNIT')
  const enums = replayEnumAuthority(frozen, sourceBytes)
  for (const node of creates) {
    it(`independent CREATE transition:${node.REPLAY_UNIT_ID}`, async () => {
      const sql = exactReplaySource(frozen, sourceBytes, node),
        contract = compileCreateStatement(sql, replayHash(sql), enums)
      const unit: ReplayExecutionUnit = {
        node,
        sql,
        contractDigest: contract.contractDigest,
        transactionClass: 'TRANSACTION_COMPATIBLE',
        predecessors: [],
      }
      const inspector = makeCreateReplayHandler(unit, enums)
      const fake = new FakeReplayCatalog({
        schemas: ['public'],
        enums: enums.map((entry) => ({
          schema: entry.schema,
          name: entry.name,
          members: entry.members,
        })),
      })
      expect((await inspector.inspect(fake, context, unit, null)).state).toBe('REPLAY_REQUIRED')
      await fake.applyFrozenUnit(sql, replayHash(sql))
      expect((await inspector.inspect(fake, context, unit, null)).state).toBe('ALREADY_COMPLETE')
      const changed = fake.inspectTable(contract.schema, contract.name)!
      changed.columns[0].type_schema = 'unapproved'
      fake.replaceTable(changed)
      expect((await inspector.inspect(fake, context, unit, null)).state).toBe('DRIFTED')
    })
  }
  it('composes all84prospective unit transitions in frozen order and then observes84noops withzeroadditional transitions', async () => {
    const baselineEnums = replayRecords(frozen.input.promotionImplementation.registry).flatMap(
      (entry) => {
        const invariant = replayObject(entry.MATCHING_INVARIANTS)
        if (!Array.isArray(invariant.enumMembers)) return []
        if (!invariant.enumMembers.every((value) => typeof value === 'string'))
          throw new Error('BASELINE_ENUM_SOURCE_INVALID')
        return [
          {
            schema: replayText(invariant.schema),
            name: replayText(invariant.name),
            members: invariant.enumMembers,
          },
        ]
      },
    )
    const fake = new FakeReplayCatalog({ schemas: ['public'], enums: baselineEnums })
    const ordered = frozen.order
      .map(
        (ordered) => frozen.nodes.find((node) => node.REPLAY_UNIT_ID === ordered.REPLAY_UNIT_ID)!,
      )
      .filter((node) =>
        ['FROZEN_WRAPPER_UNIT', 'FROZEN_STATEMENT_UNIT'].includes(
          replayText(node.REPLAY_UNIT_CLASS),
        ),
      )
    const handlers = ordered.map((node) => {
      const sql = exactReplaySource(frozen, sourceBytes, node)
      const contract =
        node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT'
          ? compileEnumWrapper(sql, replayHash(sql))
          : compileCreateStatement(sql, replayHash(sql), enums)
      const unit: ReplayExecutionUnit = {
        node,
        sql,
        contractDigest: contract.contractDigest,
        predecessors: [],
        transactionClass: 'TRANSACTION_COMPATIBLE',
      }
      return {
        unit,
        handler:
          node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT'
            ? makeEnumReplayHandler(unit)
            : makeCreateReplayHandler(unit, enums),
      }
    })
    for (const { unit, handler } of handlers) {
      const before = await handler.inspect(fake, context, unit, null)
      expect(['REPLAY_REQUIRED', 'ALREADY_COMPLETE']).toContain(before.state)
      if (before.state === 'REPLAY_REQUIRED')
        await fake.applyFrozenUnit(unit.sql, replayHash(unit.sql))
      expect((await handler.inspect(fake, context, unit, null)).state).toBe('ALREADY_COMPLETE')
    }
    const traceLength = fake.trace.length,
      before = fake.digest()
    let noop = 0
    for (const { unit, handler } of handlers) {
      expect((await handler.inspect(fake, context, unit, null)).state).toBe('ALREADY_COMPLETE')
      noop++
    }
    expect(noop).toBe(84)
    expect(fake.trace).toHaveLength(traceLength)
    expect(fake.digest()).toBe(before)
  })
  it('supports exactly41enum,2schema,20RLS,61policy-drop and4backfill frozen effect transitions', () => {
    expect(nodes).toHaveLength(41)
    expect(
      sources.filter(
        (source) => source.effectClass === 'RELATION_DDL' && /\bCREATE SCHEMA\b/i.test(source.sql),
      ),
    ).toHaveLength(2)
    expect(
      sources.filter(
        (source) => source.effectClass === 'POLICY_OR_RLS' && /\bALTER TABLE\b/i.test(source.sql),
      ),
    ).toHaveLength(20)
    expect(
      sources.filter(
        (source) => source.effectClass === 'POLICY_OR_RLS' && /\bDROP POLICY\b/i.test(source.sql),
      ),
    ).toHaveLength(61)
    expect(sources.filter((source) => source.effectClass === 'DATA_BACKFILL')).toHaveLength(4)
  })
  for (const node of nodes) {
    it(`actual enum transition and immutable predecessor:${node.REPLAY_UNIT_ID}`, async () => {
      const sql = exactReplaySource(frozen, sourceBytes, node)
      const contract = compileEnumWrapper(sql, replayHash(sql))
      const unit: ReplayExecutionUnit = {
        node,
        sql,
        contractDigest: contract.contractDigest,
        transactionClass: 'TRANSACTION_COMPATIBLE',
        predecessors: [],
      }
      const inspector = makeEnumReplayHandler(unit)
      const fake = new FakeReplayCatalog({ schemas: ['public'] }),
        before = fake.snapshot()
      expect((await inspector.inspect(fake, context, unit, null)).state).toBe('REPLAY_REQUIRED')
      await fake.applyFrozenUnit(sql, replayHash(sql))
      expect((await inspector.inspect(fake, context, unit, null)).state).toBe('ALREADY_COMPLETE')
      expect((await inspector.inspect(before, context, unit, null)).state).toBe('REPLAY_REQUIRED')
      const digest = fake.digest()
      await fake.applyFrozenUnit(sql, replayHash(sql))
      expect(fake.digest()).toBe(digest)
    })
  }
  for (const source of sources.filter(
    (source) =>
      source.effectClass === 'POLICY_OR_RLS' &&
      sqlTokens(source.sql)[0]?.value.toUpperCase() === 'CREATE',
  )) {
    it(`independent literal policy transition:${source.id}`, async () => {
      const spec = compileLiteralPolicy(source.sql, source.hash)
      const fixture = table(
        spec.schema,
        spec.table,
        ['user_id', 'organization_id', 'representative_user_id', 'granted_by'].map((name) =>
          column(name, spec.schema === 'user_management' ? 'text' : 'uuid'),
        ),
      )
      const fake = new FakeReplayCatalog({
        schemas: [spec.schema],
        tables: [fixture],
        roles: ['union_eyes_runtime', 'union_eyes_system'],
      })
      expect((await inspectLiteralPolicy(fake, spec)).definition).toBe('ABSENT')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectLiteralPolicy(fake, spec)).definition).toBe('EXACT')
      const changed = fake.inspectPolicy(spec.schema, spec.table, spec.name)!
      changed.permissive = false
      fake.replacePolicy(changed)
      expect((await inspectLiteralPolicy(fake, spec)).definition).toBe('DRIFTED')
    })
  }
  for (const source of sources.filter((source) => source.effectClass === 'CONSTRAINT_DDL')) {
    it(`independent FOREIGN KEY transition:${source.id}`, async () => {
      const spec = compileForeignKey(source.sql, source.hash)
      const child = table(
        spec.schema,
        spec.table,
        spec.columns.map((name) => column(name, 'uuid')),
      )
      const parent = table(
        spec.parentSchema,
        spec.parent,
        spec.parentColumns.map((name) => column(name, 'uuid')),
      )
      parent.primaryKey = [...spec.parentColumns]
      const fake = new FakeReplayCatalog({
        schemas: [spec.schema, spec.parentSchema],
        tables: [child, parent],
      })
      expect((await inspectForeignKey(fake, spec)).definition).toBe('ABSENT')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectForeignKey(fake, spec)).definition).toBe('EXACT')
      const changed = fake.inspectForeignKey(spec.schema, spec.table, spec.name)!
      changed.validated = false
      fake.replaceForeignKey(changed)
      expect((await inspectForeignKey(fake, spec)).definition).toBe('DRIFTED')
    })
  }
  for (const source of sources.filter((source) => source.effectClass === 'INDEX_DDL')) {
    it(`independent exact index transition:${source.id}`, async () => {
      const spec = compileSimpleIndex(source.sql, source.hash)
      const seed = table(
        spec.schema,
        spec.table,
        spec.columns.map((name) => column(name, 'uuid')),
      )
      const fake = new FakeReplayCatalog({ schemas: [spec.schema], tables: [seed] })
      expect((await inspectSimpleIndex(fake, spec)).definition).toBe('ABSENT')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectSimpleIndex(fake, spec)).definition).toBe('EXACT')
      const changed = fake.inspectIndex(spec.schema, spec.name)!
      changed.live = false
      fake.replaceIndex(changed)
      expect((await inspectSimpleIndex(fake, spec)).definition).toBe('DRIFTED')
    })
  }
  for (const source of sources.filter((source) => source.effectClass === 'COLUMN_DDL')) {
    it(`actual added-column transition:${source.id}`, async () => {
      const spec = compileAddedColumn(source.sql, source.hash)
      const fake = new FakeReplayCatalog({
        schemas: [spec.schema],
        tables: [table(spec.schema, spec.table)],
      })
      expect((await inspectAddedColumn(fake, spec)).definition).toBe('ABSENT')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectAddedColumn(fake, spec)).definition).toBe('EXACT')
      const changed = fake.inspectTable(spec.schema, spec.table)!
      changed.columns[0].generated = 's'
      fake.replaceTable(changed)
      expect((await inspectAddedColumn(fake, spec)).definition).toBe('DRIFTED')
    })
  }
  for (const source of sources.filter(
    (source) => source.effectClass === 'DEFAULT_OR_NULLABILITY_CHANGE',
  )) {
    it(`actual exact default transition:${source.id}`, async () => {
      const spec = compileDefaultEffect(source.sql, source.hash)
      const schema = spec.action === 'ADD_DEFAULT_COLUMN' ? spec.column.schema : spec.schema
      const name = spec.action === 'ADD_DEFAULT_COLUMN' ? spec.column.table : spec.table
      const seed = table(
        schema,
        name,
        spec.action === 'SET_BOOLEAN_DEFAULT' ? [column(spec.name, 'bool')] : [],
      )
      const fake = new FakeReplayCatalog({ schemas: [schema], tables: [seed] })
      expect((await inspectDefaultEffect(fake, spec)).definition).toBe('ABSENT')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectDefaultEffect(fake, spec)).definition).toBe('EXACT')
    })
  }
  for (const source of sources.filter(
    (source) => source.effectClass === 'RELATION_DDL' && /\bCREATE SCHEMA\b/i.test(source.sql),
  )) {
    it(`schema transition:${source.id}`, async () => {
      const fake = new FakeReplayCatalog({ schemas: ['public'] }),
        spec = compileSchema(source.sql, source.hash)
      expect((await inspectSchema(fake, spec)).definition).toBe('ABSENT')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectSchema(fake, spec)).definition).toBe('EXACT')
    })
  }
  for (const source of sources.filter(
    (source) => source.effectClass === 'POLICY_OR_RLS' && /\bALTER TABLE\b/i.test(source.sql),
  )) {
    it(`actual RLS bit transition and independent drift:${source.id}`, async () => {
      const spec = compileRlsToggle(source.sql, source.hash),
        seed = table(spec.schema, spec.table)
      seed[spec.field] = !spec.value
      const fake = new FakeReplayCatalog({ schemas: [spec.schema], tables: [seed] })
      expect((await inspectRlsToggle(fake, spec)).state).toBe('REPLAY_REQUIRED')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectRlsToggle(fake, spec)).state).toBe('ALREADY_COMPLETE')
      const changed = fake.inspectTable(spec.schema, spec.table)!
      changed.standalone = false
      fake.replaceTable(changed)
      expect((await inspectRlsToggle(fake, spec)).state).toBe('DRIFTED')
    })
  }
  for (const source of sources.filter(
    (source) => source.effectClass === 'POLICY_OR_RLS' && /\bDROP POLICY\b/i.test(source.sql),
  )) {
    it(`actual policy removal:${source.id}`, async () => {
      const spec = compilePolicyDrop(source.sql, source.hash),
        seed = table(spec.schema, spec.table)
      seed.policies = [spec.name, 'unrelated-preserved']
      const fake = new FakeReplayCatalog({ schemas: [spec.schema], tables: [seed] })
      expect((await inspectPolicyDrop(fake, spec)).state).toBe('REPLAY_REQUIRED')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectPolicyDrop(fake, spec)).state).toBe('ALREADY_COMPLETE')
      expect(fake.inspectTable(spec.schema, spec.table)?.policies).toEqual(['unrelated-preserved'])
    })
  }
  for (const source of sources.filter((source) => source.effectClass === 'DATA_BACKFILL')) {
    it(`actual rows,not a completion flag:${source.id}`, async () => {
      const spec = compileBackfill(source.sql, source.hash)
      const seed =
        spec.table === 'documents'
          ? documents()
          : table('public', 'organization_members', [column('exempt_from_per_capita', 'bool')])
      seed.rows =
        spec.table === 'documents'
          ? [
              {
                id: '12345678-1234-1234-1234-1234567890ab',
                name: null,
                title: '',
                filename: 'original.pdf',
                file_url: null,
                uploaded_by: null,
              },
              {
                id: 'abcdefab-1234-1234-1234-1234567890ab',
                name: 'keep',
                title: 'other',
                filename: '',
                file_url: 'existing',
                uploaded_by: 'owner',
              },
            ]
          : [{ exempt_from_per_capita: null }, { exempt_from_per_capita: true }]
      const fake = new FakeReplayCatalog({ schemas: ['public'], tables: [seed] })
      expect((await inspectBackfill(fake, spec)).definition).toBe('ABSENT')
      await fake.applyFrozenUnit(source.sql, source.hash)
      expect((await inspectBackfill(fake, spec)).definition).toBe('EXACT')
      const rows = fake.inspectTable('public', spec.table)!.rows
      const expected =
        spec.column === 'name'
          ? 'original.pdf'
          : spec.column === 'file_url'
            ? 'phase-g://placeholder/12345678-1234-1234-1234-1234567890ab'
            : spec.column === 'uploaded_by'
              ? 'phase-g-seed'
              : false
      expect(rows[0][spec.column]).toBe(expected)
      expect(rows[1]).toEqual(seed.rows[1])
      const changed = fake.inspectTable('public', spec.table)!
      changed.rows[0][spec.column] = null
      fake.replaceTable(changed)
      expect((await inspectBackfill(fake, spec)).definition).toBe('ABSENT')
    })
  }
  it('rolls back actual row mutations and staged receipts on commit failure', async () => {
    const source = sources.find(
      (source) =>
        source.effectClass === 'DATA_BACKFILL' && source.sql.includes('exempt_from_per_capita'),
    )!
    const seed = table('public', 'organization_members', [column('exempt_from_per_capita', 'bool')])
    seed.rows = [{ exempt_from_per_capita: null }]
    const fake = new FakeReplayCatalog({ schemas: ['public'], tables: [seed] }),
      before = fake.digest()
    await expect(
      fake.transaction(async (catalog) => {
        await catalog.applyFrozenUnit(source.sql, source.hash)
        catalog.stageReceipt(source.id, { deliberatelyNotAGovernanceReceipt: true })
      }, true),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(fake.digest()).toBe(before)
    expect(fake.readReceipt(source.id)).toBeNull()
  })
  it('does not invent primary uniqueness for a foreign-key parent or validate orphan rows', async () => {
    const sql =
      'ALTER TABLE public.child ADD CONSTRAINT child_parent_fk FOREIGN KEY (parent_id) REFERENCES public.parent (id);'
    const child = table('public', 'child', [column('parent_id', 'uuid')]),
      parent = table('public', 'parent', [column('id', 'uuid')])
    const fake = new FakeReplayCatalog({ schemas: ['public'], tables: [child, parent] }),
      before = fake.digest()
    await expect(fake.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow(
      'FAKE_FOREIGN_KEY_PARENT_UNIQUE_REQUIRED',
    )
    expect(fake.digest()).toBe(before)
    parent.primaryKey = ['id']
    fake.replaceTable(parent)
    child.rows = [{ parent_id: '12345678-1234-1234-1234-1234567890ab' }]
    fake.replaceTable(child)
    const orphan = fake.digest()
    await expect(fake.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow(
      'FAKE_FOREIGN_KEY_EXISTING_ROW_VIOLATION',
    )
    expect(fake.digest()).toBe(orphan)
  })
  it('rejects missing policy columns and UUID/text equality before publishing fake catalog state', async () => {
    const fake = new FakeReplayCatalog({
      schemas: ['public'],
      tables: [table('public', 't', [column('id', 'uuid')])],
      roles: ['union_eyes_runtime'],
    })
    const before = fake.digest()
    for (const [expression, error] of [
      ["missing::text = current_setting('app.current_user_id',true)", 'FAKE_COLUMN_REQUIRED'],
      ["id = current_setting('app.current_user_id',true)", 'FAKE_POLICY_EXPRESSION_UNSUPPORTED'],
      ['id IS NOT NULL OR true', 'FAKE_POLICY_EXPRESSION_UNSUPPORTED'],
    ]) {
      const sql = `CREATE POLICY p ON public.t FOR SELECT TO union_eyes_runtime USING (${expression});`
      await expect(fake.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow(error)
      expect(fake.digest()).toBe(before)
      expect(fake.inspectPolicy('public', 't', 'p')).toBeNull()
    }
  })
  it('does not fabricate dynamic defaults or add uninitialized NOT NULL columns on populated targets', async () => {
    const seed = table('public', 't', [column('id', 'uuid')])
    seed.rows = [{ id: '12345678-1234-1234-1234-1234567890ab' }]
    const fake = new FakeReplayCatalog({ schemas: ['public'], tables: [seed] }),
      before = fake.digest()
    for (const [sql, error] of [
      [
        'ALTER TABLE public.t ADD COLUMN created_at timestamptz DEFAULT now();',
        'FAKE_POPULATED_DYNAMIC_DEFAULT_UNSUPPORTED',
      ],
      [
        'ALTER TABLE public.t ADD COLUMN required_name text NOT NULL;',
        'FAKE_NONNULL_COLUMN_EXISTING_ROWS',
      ],
    ]) {
      await expect(fake.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow(error)
      expect(fake.digest()).toBe(before)
    }
  })
  it('preserves a guarded wrong existing index and lets the actual comparator deny it', async () => {
    const sql = 'CREATE INDEX IF NOT EXISTS t_id_index ON public.t (id);'
    const spec = compileSimpleIndex(sql, replayHash(sql))
    const fake = new FakeReplayCatalog({
      schemas: ['public'],
      tables: [table('public', 't', [column('id', 'uuid')])],
    })
    await fake.applyFrozenUnit(sql, replayHash(sql))
    const index = fake.inspectIndex('public', 't_id_index')!
    index.opclasses_default = false
    fake.replaceIndex(index)
    const before = fake.digest()
    await fake.applyFrozenUnit(sql, replayHash(sql))
    expect(fake.digest()).toBe(before)
    expect((await inspectSimpleIndex(fake, spec)).definition).toBe('DRIFTED')
  })
  it('keeps whole-unit atomicity when an unsupported trailing effect follows supported DDL', async () => {
    const fake = new FakeReplayCatalog({ schemas: ['public'] }),
      before = fake.digest()
    const source = 'CREATE SCHEMA example;\nSELECT 1;'
    await expect(fake.applyFrozenUnit(source, replayHash(source))).rejects.toThrow(
      'FAKE_SOURCE_TRANSITION_UNSUPPORTED',
    )
    expect(fake.digest()).toBe(before)
    expect(fake.trace).toEqual([])
  })
  it('does not infer an empty aggregate or native table facts for an unsupported query', async () => {
    const fake = new FakeReplayCatalog({ schemas: ['public'] })
    await expect(fake.query('SELECT missing_facts', [])).rejects.toThrow(
      'FAKE_CATALOG_QUERY_UNSUPPORTED',
    )
    await expect(fake.applyFrozenUnit('SELECT 1;', '0'.repeat(64))).rejects.toThrow(
      'FAKE_FROZEN_SOURCE_DRIFT',
    )
  })
  it('denies RLS-hidden row mutation and preserves data', async () => {
    const seed = documents()
    seed.rowCountVisible = false
    seed.rows = [
      {
        id: '12345678-1234-1234-1234-1234567890ab',
        name: null,
        title: 'title',
        filename: '',
        file_url: null,
        uploaded_by: null,
      },
    ]
    const fake = new FakeReplayCatalog({ schemas: ['public'], tables: [seed] }),
      before = fake.digest()
    const source = sources.find(
      (source) => source.effectClass === 'DATA_BACKFILL' && source.sql.includes('SET name'),
    )!
    await expect(fake.applyFrozenUnit(source.sql, source.hash)).rejects.toThrow(
      'FAKE_COMPLETE_ROW_VISIBILITY_REQUIRED',
    )
    expect(fake.digest()).toBe(before)
  })
})
