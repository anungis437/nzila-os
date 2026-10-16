import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { replayObject, replayRecords, replayText, replayHash } from './post-w4p-replay'
import {
  compileRlsToggle,
  compilePolicyDrop,
  inspectRlsToggle,
  inspectPolicyDrop,
  rlsPrimitiveQueries,
} from './replay-rls-primitives'
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter((effect) => effect.EFFECT_CLASS === 'POLICY_OR_RLS')
const text = (effect: (typeof effects)[number]) =>
  replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
const toggles = effects.filter(
  (effect) => sqlTokens(text(effect))[0].value.toUpperCase() === 'ALTER',
)
const drops = effects.filter((effect) => sqlTokens(text(effect))[0].value.toUpperCase() === 'DROP')
describe('source-bound RLS bits and policy-drop primitives;not full boundary qualification', () => {
  it('accounts exactly20RLS toggles and61DROP effects', () => {
    expect(toggles).toHaveLength(20)
    expect(drops).toHaveLength(61)
  })
  for (const effect of toggles) {
    const source = text(effect),
      spec = compileRlsToggle(source, replayHash(source))
    it(`owned RLS bit:${effect.EFFECT_ID}`, async () => {
      const current = {
        kind: 'r',
        standalone: true,
        enabled: false,
        forced: false,
        [spec.field]: spec.value,
      }
      const reader = (rows: unknown[]) => ({
        async query(sql: string, parameters: string[]) {
          expect(sql).toBe(rlsPrimitiveQueries.table)
          expect(parameters).toEqual([spec.schema, spec.table])
          return rows
        },
      })
      const exact = await inspectRlsToggle(reader([current]), spec)
      expect(exact.state).toBe('ALREADY_COMPLETE')
      expect(
        (await inspectRlsToggle(reader([{ ...current, [spec.field]: !spec.value }]), spec)).state,
      ).toBe('REPLAY_REQUIRED')
      expect((await inspectRlsToggle(reader([]), spec)).state).toBe('PRECONDITION_MISSING')
      expect((await inspectRlsToggle(reader([{ ...current, kind: 'v' }]), spec)).state).toBe(
        'DRIFTED',
      )
      expect(
        (await inspectRlsToggle(reader([{ ...current, standalone: false }]), spec)).state,
      ).toBe('DRIFTED')
      const other = spec.field === 'enabled' ? 'forced' : 'enabled'
      expect(
        (await inspectRlsToggle(reader([{ ...current, [other]: !current[other] }]), spec))
          .ownedStateDigest,
      ).toBe(exact.ownedStateDigest)
      await expect(inspectRlsToggle(reader([{ complete: true }]), spec)).rejects.toThrow(
        'REPLAY_RLS_CATALOG_ROW_INVALID',
      )
    })
  }
  for (const effect of drops) {
    const source = text(effect),
      spec = compilePolicyDrop(source, replayHash(source))
    it(`literal policy drop:${effect.EFFECT_ID}`, async () => {
      const reader = (
        policies: unknown[],
        tables: unknown[] = [{ kind: 'r', standalone: true, enabled: true, forced: true }],
      ) => ({
        async query(sql: string, parameters: string[]) {
          if (sql === rlsPrimitiveQueries.table) {
            expect(parameters).toEqual([spec.schema, spec.table])
            return tables
          }
          expect(sql).toBe(rlsPrimitiveQueries.policy)
          expect(parameters).toEqual([spec.schema, spec.table, spec.name])
          return policies
        },
      })
      expect((await inspectPolicyDrop(reader([]), spec)).state).toBe('ALREADY_COMPLETE')
      expect(
        (await inspectPolicyDrop(reader([{ name: spec.name, name_matches: true }]), spec)).state,
      ).toBe('REPLAY_REQUIRED')
      expect(
        (await inspectPolicyDrop(reader([{ name: 'wrong', name_matches: false }]), spec)).state,
      ).toBe('DRIFTED')
      expect((await inspectPolicyDrop(reader([], []), spec)).state).toBe('PRECONDITION_MISSING')
      await expect(inspectPolicyDrop(reader([{ complete: true }]), spec)).rejects.toThrow(
        'REPLAY_RLS_CATALOG_ROW_INVALID',
      )
    })
  }
  it('supports source-native inverse toggles and rejects trailing SQL/hash drift', () => {
    for (const clause of ['DISABLE', 'NO FORCE']) {
      const sql = `ALTER TABLE "public"."exact_source" ${clause} ROW LEVEL SECURITY;`
      expect(compileRlsToggle(sql, replayHash(sql)).value).toBe(false)
    }
    const sql = 'DROP POLICY IF EXISTS p ON public.t;'
    expect(() => compilePolicyDrop(sql + ' SELECT 1;', replayHash(sql + ' SELECT 1;'))).toThrow(
      'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED',
    )
    expect(() => compilePolicyDrop(sql + ' ', replayHash(sql))).toThrow(
      'REPLAY_STRUCTURAL_SOURCE_HASH_DRIFT',
    )
  })
})
