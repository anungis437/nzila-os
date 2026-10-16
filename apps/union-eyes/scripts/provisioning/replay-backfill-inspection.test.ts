import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayObject, replayRecords, replayText, replayHash } from './post-w4p-replay'
import {
  compileBackfill,
  inspectBackfill,
  backfillQueries,
  backfillCountQuery,
} from './replay-backfill-inspection'
import { createCatalogQueries } from './replay-create-inspection'
import { parentKeyQueries } from './parent-key-supplement'
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter((effect) => effect.EFFECT_CLASS === 'DATA_BACKFILL')
describe('four frozen backfill components, not whole-boundary replay qualification', () => {
  it('accounts the exact four effects', () => {
    expect(effects).toHaveLength(4)
  })
  for (const effect of effects) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
      spec = compileBackfill(source, replayHash(source))
    const columns = spec.dependencies.map((name) => ({
      name,
      type_schema: 'pg_catalog',
      type_name: name === 'id' ? 'uuid' : spec.type,
      type_kind: 'b',
      not_null: name === 'id',
      identity: '',
      generated: '',
    }))
    const reader = (overrides: Record<string, unknown[]> = {}) => ({
      async query(sql: string, parameters: unknown[]) {
        if (Object.hasOwn(overrides, sql)) return overrides[sql]
        if (sql === parentKeyQueries.relation) {
          expect(parameters).toEqual(['public', spec.table])
          return [{ kind: 'r', standalone: true }]
        }
        if (sql === createCatalogQueries.columns) return columns
        if (sql === backfillQueries.visibility) return [{ row_count_visible: true }]
        if (sql === backfillQueries.builtins)
          return [{ text_equality: true, text_concat: true, uuid_output: true }]
        expect(sql).toBe(backfillCountQuery(spec))
        return [{ qualifying_rows: '0' }]
      },
    })
    const inspect = (overrides: Record<string, unknown[]> = {}) =>
      inspectBackfill(reader(overrides), spec)
    it(`source hash, exact dependencies, complete visibility:${effect.EFFECT_ID}`, async () => {
      expect((await inspect()).definition).toBe('EXACT')
      expect(() => compileBackfill(source, '0'.repeat(64))).toThrow(
        'REPLAY_BACKFILL_SOURCE_HASH_DRIFT',
      )
      expect((await inspect({ [parentKeyQueries.relation]: [] })).definition).toBe(
        'PRECONDITION_MISSING',
      )
      expect(
        (await inspect({ [parentKeyQueries.relation]: [{ kind: 'r', standalone: false }] }))
          .definition,
      ).toBe('DRIFTED')
      expect((await inspect({ [createCatalogQueries.columns]: [] })).definition).toBe(
        'PRECONDITION_MISSING',
      )
      expect(
        (await inspect({ [backfillQueries.visibility]: [{ row_count_visible: false }] }))
          .definition,
      ).toBe('PRECONDITION_MISSING')
      expect(
        (await inspect({ [backfillCountQuery(spec)]: [{ qualifying_rows: '4' }] })).definition,
      ).toBe('ABSENT')
      expect(
        (
          await inspect({
            [backfillCountQuery(spec)]: [{ qualifying_rows: '9223372036854775807' }],
          })
        ).definition,
      ).toBe('ABSENT')
      await expect(
        inspect({ [backfillCountQuery(spec)]: [{ qualifying_rows: 0 }] }),
      ).rejects.toThrow('REPLAY_BACKFILL_COUNT_INVALID')
      await expect(
        inspect({ [backfillCountQuery(spec)]: [{ qualifying_rows: '00' }] }),
      ).rejects.toThrow('REPLAY_BACKFILL_COUNT_INVALID')
      await expect(inspect({ [backfillCountQuery(spec)]: [] })).rejects.toThrow(
        'REPLAY_BACKFILL_CATALOG_CARDINALITY_INVALID',
      )
    })
    for (const column of columns) {
      for (const mutation of [
        { type_schema: 'public' },
        { type_kind: 'd' },
        { type_name: 'varchar' },
        { identity: 'a' },
        { generated: 's' },
      ]) {
        it(`rejects dependency drift:${effect.EFFECT_ID}:${column.name}:${JSON.stringify(mutation)}`, async () => {
          expect(
            (
              await inspect({
                [createCatalogQueries.columns]: columns.map((entry) =>
                  entry.name === column.name ? { ...entry, ...mutation } : entry,
                ),
              })
            ).definition,
          ).toBe('DRIFTED')
        })
      }
    }
    if (spec.type === 'text')
      it(`attests native NULLIF dependencies:${effect.EFFECT_ID}`, async () => {
        expect(
          (
            await inspect({
              [backfillQueries.builtins]: [
                { text_equality: false, text_concat: true, uuid_output: true },
              ],
            })
          ).definition,
        ).toBe('PRECONDITION_MISSING')
      })
    if (spec.column === 'file_url')
      it('requires nonnull UUID for every possible placeholder and native cast/concatenation', async () => {
        expect(
          (
            await inspect({
              [createCatalogQueries.columns]: columns.map((column) => ({
                ...column,
                not_null: false,
              })),
            })
          ).definition,
        ).toBe('DRIFTED')
        for (const name of ['text_concat', 'uuid_output']) {
          expect(
            (
              await inspect({
                [backfillQueries.builtins]: [
                  { text_equality: true, text_concat: true, uuid_output: true, [name]: false },
                ],
              })
            ).definition,
          ).toBe('PRECONDITION_MISSING')
        }
      })
  }
  it('rejects changed assignments, predicates, literals, and multiple statements', () => {
    const sql = replayText(replayObject(effects[0].COMPARATOR).EXACT_SOURCE_SEMANTICS)
    for (const changed of [
      sql.replace('false', 'true'),
      sql.replace('IS NULL', 'IS NOT NULL'),
      `${sql}\nSELECT 1;`,
    ]) {
      expect(() => compileBackfill(changed, replayHash(changed))).toThrow(
        'REPLAY_BACKFILL_SOURCE_GRAMMAR_UNSUPPORTED',
      )
    }
  })
})
