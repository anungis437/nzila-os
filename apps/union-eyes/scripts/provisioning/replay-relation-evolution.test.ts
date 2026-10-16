import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayDigest } from './post-w4p-replay'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { compileOriginalRelationEvolution } from './replay-relation-evolution'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { inspectOriginalRelation } from './replay-original-relation'
const { frozen, sourceBytes } = loadFrozenReplay()
const plan = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  replayDigest('fake-keys'),
)
const prefix = plan.specification.units.slice(0, 6)
const through = String(prefix.at(-1)!.node.REPLAY_UNIT_ID)
const fake = () =>
  new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_owner'],
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public'],
      defaultAcl: [],
    },
  })
describe('source-bound exact relation evolution across actual six-unit frozen prefix;not full107temporal qualification', () => {
  it('preserves whole-byte ordering and proves all evolved relation definitions after genuine nullable adds', async () => {
    const catalog = fake()
    for (const unit of prefix)
      await catalog.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
    const evolved = compileOriginalRelationEvolution(plan, through)
    expect(evolved).toHaveLength(23)
    expect(
      plan.components.effects.filter(
        (effect) =>
          prefix.some((unit) => unit.node.REPLAY_UNIT_ID === effect.boundaryId) &&
          effect.compiled.kind === 'RELATION',
      ),
    ).toHaveLength(23)
    const assessment = evolved.find((contract) => contract.relation.name === 'icra_assessments')!
    expect(assessment.sourceUnits.map((unit) => unit.unitId)).toEqual([
      prefix[0].node.REPLAY_UNIT_ID,
      prefix[2].node.REPLAY_UNIT_ID,
      prefix[5].node.REPLAY_UNIT_ID,
    ])
    for (const contract of evolved)
      expect((await inspectOriginalRelation(catalog, contract.relation)).definition).toBe('EXACT')
    expect(catalog.trace).toEqual(
      prefix.map((unit) => `FAKE_UNIT_TRANSITION:${unit.node.EXACT_UNIT_SHA256}`),
    )
  })
  it('does not excuse invented extra columns or changed source-owned definitions as later evolution', async () => {
    const catalog = fake()
    for (const unit of prefix)
      await catalog.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
    const contract = compileOriginalRelationEvolution(plan, through).find(
      (contract) => contract.relation.name === 'icra_assessments',
    )!
    const table = catalog.inspectTable('public', 'icra_assessments')!
    table.columns.push({ ...table.columns[0], name: 'invented_unowned_column' })
    catalog.replaceTable(table)
    expect((await inspectOriginalRelation(catalog, contract.relation)).definition).toBe('DRIFTED')
  })
  it('denies changed whole boundaries and missing original source births rather than ignoring them', () => {
    const changed = structuredClone(plan)
    changed.specification.units[2].sql += '--source drift'
    expect(() => compileOriginalRelationEvolution(changed, through)).toThrow(
      'REPLAY_RELATION_EVOLUTION_BOUNDARY_BINDING_INVALID',
    )
    expect(() => compileOriginalRelationEvolution(plan, 'unknown')).toThrow(
      'REPLAY_RELATION_EVOLUTION_POSITION_UNKNOWN',
    )
  })
})
