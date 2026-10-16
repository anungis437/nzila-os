import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayObject, replayRecords, replayText, replayHash } from './post-w4p-replay'
import { compileDefaultEffect, inspectDefaultEffect } from './replay-default-inspection'
import { createCatalogQueries } from './replay-create-inspection'
import { parentKeyQueries } from './parent-key-supplement'
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter((effect) => effect.EFFECT_CLASS === 'DEFAULT_OR_NULLABILITY_CHANGE')
describe('seven source-bound default effects;not full boundary qualification', () => {
  it('accounts all7frozen default effects', () => {
    expect(effects).toHaveLength(7)
  })
  for (const effect of effects) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
      spec = compileDefaultEffect(source, replayHash(source))
    const expected = spec.action === 'ADD_DEFAULT_COLUMN' ? spec.column.column : null
    const actual: Record<string, unknown> = {
      name: expected?.name ?? (spec.action === 'SET_BOOLEAN_DEFAULT' ? spec.name : ''),
      postgres_type: expected?.type.display ?? 'boolean',
      type_schema: 'pg_catalog',
      type_name: expected?.type.name ?? 'bool',
      type_kind: 'b',
      not_null: expected?.notNull ?? true,
      default_expression:
        expected?.defaultExpression ??
        (spec.action === 'SET_BOOLEAN_DEFAULT' ? String(spec.value) : null),
      identity: '',
      generated: '',
      collation_default: true,
      acl: null,
    }
    const reader = (
      columns: unknown[],
      clock: unknown[] = [
        {
          schema: 'pg_catalog',
          name: 'now',
          language: 'internal',
          result: 'timestamptz',
          executable: true,
        },
      ],
    ) => ({
      async query(sql: string) {
        if (sql === parentKeyQueries.relation) return [{ kind: 'r', standalone: true }]
        if (sql === createCatalogQueries.typePrerequisite) return [{ kind: 'b' }]
        if (sql === createCatalogQueries.clock) return clock
        expect(sql).toBe(createCatalogQueries.columns)
        return columns
      },
    })
    it(`precise default:${effect.EFFECT_ID}`, async () => {
      expect((await inspectDefaultEffect(reader([actual]), spec)).definition).toBe('EXACT')
      expect(
        (await inspectDefaultEffect(reader([{ ...actual, type_schema: 'unapproved' }]), spec))
          .definition,
      ).toBe('DRIFTED')
      expect(
        (await inspectDefaultEffect(reader([{ ...actual, default_expression: null }]), spec))
          .definition,
      ).toBe(spec.action === 'ADD_DEFAULT_COLUMN' ? 'DRIFTED' : 'ABSENT')
      expect((await inspectDefaultEffect(reader([]), spec)).definition).toBe(
        spec.action === 'ADD_DEFAULT_COLUMN' ? 'ABSENT' : 'PRECONDITION_MISSING',
      )
      if (expected?.normalizedDefault.kind === 'FUNCTION') {
        expect((await inspectDefaultEffect(reader([actual], []), spec)).definition).toBe(
          'PRECONDITION_MISSING',
        )
        expect(
          (
            await inspectDefaultEffect(
              reader(
                [actual],
                [
                  {
                    schema: 'public',
                    name: 'now',
                    language: 'sql',
                    result: 'timestamptz',
                    executable: true,
                  },
                ],
              ),
              spec,
            )
          ).definition,
        ).toBe('PRECONDITION_MISSING')
      }
    })
  }
  it('rejects quoted identifiers pretending to be booleans and unsupported ALTER defaults', () => {
    const source = 'ALTER TABLE public.t ALTER COLUMN c SET DEFAULT "false";'
    expect(() => compileDefaultEffect(source, replayHash(source))).toThrow(
      'REPLAY_DEFAULT_GRAMMAR_UNSUPPORTED',
    )
  })
})
