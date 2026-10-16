import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayObject, replayRecords, replayText, replayHash } from './post-w4p-replay'
import {
  compileForeignKey,
  inspectForeignKey,
  compileSimpleIndex,
  inspectSimpleIndex,
  structuralQueries,
  compileAddedColumn,
  inspectAddedColumn,
  compileSchema,
  inspectSchema,
} from './replay-structural-effects'
import { createCatalogQueries } from './replay-create-inspection'
import { parentKeyQueries } from './parent-key-supplement'
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES).flatMap((boundary) =>
  replayRecords(boundary.EFFECTS),
)
const keys = effects.filter((effect) => effect.EFFECT_CLASS === 'CONSTRAINT_DDL')
const indices = effects.filter((effect) => effect.EFFECT_CLASS === 'INDEX_DDL')
const additions = effects.filter((effect) => effect.EFFECT_CLASS === 'COLUMN_DDL')
const schemas = effects.filter(
  (effect) =>
    effect.EFFECT_CLASS === 'RELATION_DDL' &&
    /\bCREATE SCHEMA\b/i.test(replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)),
)
describe('concrete source-bound FK and simple-index comparators', () => {
  it('accounts every17frozen standalone foreign-key effect', () => {
    expect(keys).toHaveLength(17)
  })
  it('accounts every89frozen index effects', () => {
    expect(indices).toHaveLength(89)
  })
  it('accounts all43frozen added-column effects', () => {
    expect(additions).toHaveLength(43)
  })
  it('accounts both frozen CREATE SCHEMA effects', () => {
    expect(schemas).toHaveLength(2)
  })
  for (const effect of schemas) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
    const spec = compileSchema(source, replayHash(source))
    it(`exact schema declaration:${effect.EFFECT_ID}`, async () => {
      expect(
        (
          await inspectSchema(
            {
              async query(sql, parameters) {
                expect(sql).toBe(createCatalogQueries.namespace)
                expect(parameters).toEqual([spec.name])
                return [{ name: spec.name }]
              },
            },
            spec,
          )
        ).definition,
      ).toBe('EXACT')
      expect(
        (
          await inspectSchema(
            {
              async query() {
                return []
              },
            },
            spec,
          )
        ).definition,
      ).toBe('ABSENT')
      expect(
        (
          await inspectSchema(
            {
              async query() {
                return [{ name: 'unapproved' }]
              },
            },
            spec,
          )
        ).definition,
      ).toBe('DRIFTED')
      await expect(
        inspectSchema(
          {
            async query() {
              return [{ complete: true }]
            },
          },
          spec,
        ),
      ).rejects.toThrow('REPLAY_STRUCTURAL_CATALOG_ROW_INVALID')
    })
  }
  for (const effect of additions) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
    const spec = compileAddedColumn(source, replayHash(source))
    const exact = {
      name: spec.column.name,
      postgres_type: spec.column.type.display,
      type_schema: spec.column.type.schema,
      type_name: spec.column.type.name,
      type_kind: 'b',
      not_null: spec.column.notNull,
      default_expression: null,
      identity: '',
      generated: '',
      collation_default: true,
      acl: null,
    }
    const reader = (
      columns: unknown[],
      relation: unknown[] = [{ kind: 'r', standalone: true }],
      types: unknown[] = [{ kind: 'b' }],
    ) => ({
      async query(sql: string, parameters: string[]) {
        if (sql === parentKeyQueries.relation) {
          expect(parameters).toEqual([spec.schema, spec.table])
          return relation
        }
        if (sql === createCatalogQueries.typePrerequisite) {
          expect(parameters).toEqual([spec.column.type.schema, spec.column.type.name])
          return types
        }
        expect(sql).toBe(createCatalogQueries.columns)
        expect(parameters).toEqual([spec.schema, spec.table])
        return columns
      },
    })
    it(`full added-column definition:${effect.EFFECT_ID}`, async () => {
      expect((await inspectAddedColumn(reader([exact]), spec)).definition).toBe('EXACT')
      expect((await inspectAddedColumn(reader([{ name: 'unrelated' }]), spec)).definition).toBe(
        'ABSENT',
      )
      expect((await inspectAddedColumn(reader([exact], []), spec)).definition).toBe(
        'PRECONDITION_MISSING',
      )
      expect((await inspectAddedColumn(reader([exact], undefined, []), spec)).definition).toBe(
        'PRECONDITION_MISSING',
      )
      for (const change of [
        { type_schema: 'unapproved' },
        { type_name: 'unapproved' },
        { postgres_type: 'unapproved' },
        { type_kind: 'd' },
        { not_null: !spec.column.notNull },
        { default_expression: 'now()' },
        { identity: 'a' },
        { generated: 's' },
        { collation_default: false },
        { acl: 'unapproved' },
      ])
        expect((await inspectAddedColumn(reader([{ ...exact, ...change }]), spec)).definition).toBe(
          'DRIFTED',
        )
      expect(
        (await inspectAddedColumn(reader([exact], [{ kind: 'r', standalone: false }]), spec))
          .definition,
      ).toBe('DRIFTED')
      await expect(
        inspectAddedColumn(reader([{ name: spec.column.name, complete: true }]), spec),
      ).rejects.toThrow('REPLAY_STRUCTURAL_CATALOG_ROW_INVALID')
    })
  }
  for (const effect of keys) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
    const spec = compileForeignKey(source, replayHash(source))
    const exact = {
      kind: 'f',
      columns: spec.columns,
      parent_schema: spec.parentSchema,
      parent_name: spec.parent,
      parent_columns: spec.parentColumns,
      delete_action: spec.deleteAction,
      update_action: spec.updateAction,
      match: 's',
      deferrable: false,
      deferred: false,
      validated: true,
      local: true,
      inherited: 0,
    }
    it(`exact full FK definition and absence:${effect.EFFECT_ID}`, async () => {
      expect(
        (
          await inspectForeignKey(
            {
              async query(sql, parameters) {
                expect(sql).toBe(structuralQueries.foreignKey)
                expect(parameters).toEqual([spec.schema, spec.table, spec.name])
                return [exact]
              },
            },
            spec,
          )
        ).definition,
      ).toBe('EXACT')
      expect(
        (
          await inspectForeignKey(
            {
              async query() {
                return []
              },
            },
            spec,
          )
        ).definition,
      ).toBe('ABSENT')
      for (const change of [
        { delete_action: 'a' },
        { validated: false },
        { deferrable: true },
        { parent_schema: 'unapproved' },
        { columns: ['wrong'] },
      ])
        expect(
          (
            await inspectForeignKey(
              {
                async query() {
                  return [{ ...exact, ...change }]
                },
              },
              spec,
            )
          ).definition,
        ).toBe('DRIFTED')
    })
  }
  for (const effect of indices) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
    const spec = compileSimpleIndex(source, replayHash(source))
    const exact = {
      kind: 'i',
      table_schema: spec.schema,
      table_name: spec.table,
      method: spec.method,
      unique: spec.unique,
      valid: true,
      ready: true,
      live: true,
      primary: false,
      exclusion: false,
      nulls_not_distinct: false,
      predicate: spec.predicate
        ? spec.predicate.operation === 'IS_NOT_NULL'
          ? `("${spec.predicate.column}" IS NOT NULL)`
          : `("${spec.predicate.column}" = ${spec.predicate.value ? 'true' : 'false'})`
        : null,
      expressions: null,
      columns: spec.columns,
      key_definitions: spec.columns.map((column) => `"${column}"`),
      options: spec.columns.map(() => 0),
      opclasses_default: true,
      collations_default: true,
      key_count: spec.columns.length,
      total_count: spec.columns.length,
    }
    it(`full ordinary index definition:${effect.EFFECT_ID}`, async () => {
      expect(
        (
          await inspectSimpleIndex(
            {
              async query(sql, parameters) {
                expect(sql).toBe(structuralQueries.index)
                expect(parameters).toEqual([spec.schema, spec.name])
                return [exact]
              },
            },
            spec,
          )
        ).definition,
      ).toBe('EXACT')
      expect(
        (
          await inspectSimpleIndex(
            {
              async query() {
                return []
              },
            },
            spec,
          )
        ).definition,
      ).toBe('ABSENT')
      for (const change of [
        { valid: false },
        { ready: false },
        { live: false },
        { columns: ['wrong'] },
        { unique: !spec.unique },
        { predicate: 'unapproved' },
        { options: [1] },
        { key_definitions: ['wrong_ops'] },
        { kind: 'r' },
      ])
        expect(
          (
            await inspectSimpleIndex(
              {
                async query() {
                  return [{ ...exact, ...change }]
                },
              },
              spec,
            )
          ).definition,
        ).toBe('DRIFTED')
    })
  }
  it('rejects completion assertions and source/unsupported grammar changes explicitly', async () => {
    const source = replayText(replayObject(keys[0].COMPARATOR).EXACT_SOURCE_SEMANTICS)
    const spec = compileForeignKey(source, replayHash(source))
    await expect(
      inspectForeignKey(
        {
          async query() {
            return [{ complete: true }]
          },
        },
        spec,
      ),
    ).rejects.toThrow('REPLAY_STRUCTURAL_CATALOG_ROW_INVALID')
    expect(() => compileForeignKey(source + ' ', replayHash(source))).toThrow(
      'REPLAY_STRUCTURAL_SOURCE_HASH_DRIFT',
    )
  })
})
