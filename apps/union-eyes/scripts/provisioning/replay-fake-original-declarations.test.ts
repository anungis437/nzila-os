import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayComponents, exactReplaySource } from './replay-effect-registry'
import { replayHash } from './post-w4p-replay'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { inspectReplayEffect } from './replay-effect-inspection'
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
const declarations = components.effects.filter((effect) => effect.compiled.kind === 'RELATION')
async function fixture() {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public', 'user_management', 'audit_security'],
    roles: ['fake_owner'],
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public'],
      defaultAcl: [],
    },
  })
  for (const wrapper of components.wrappers) {
    const node = frozen.nodes.find((node) => node.REPLAY_UNIT_ID === wrapper.unitId)!
    const exact = exactReplaySource(frozen, sourceBytes, node)
    await catalog.applyFrozenUnit(exact, replayHash(exact))
  }
  for (const sql of [
    'CREATE TABLE public.organizations (id uuid PRIMARY KEY NOT NULL);',
    'CREATE TABLE public.documents (id uuid PRIMARY KEY NOT NULL);',
  ])
    await catalog.applyFrozenUnit(sql, replayHash(sql))
  const users = declarations.find(
    (effect) =>
      effect.compiled.kind === 'RELATION' &&
      effect.compiled.contract.schema === 'user_management' &&
      effect.compiled.contract.name === 'users',
  )!
  await catalog.applyFrozenUnit(users.source, users.sourceHash)
  const parents = declarations.filter(
    (effect) =>
      effect.compiled.kind === 'RELATION' &&
      ['representation_authorities', 'external_matter_access_grants'].includes(
        effect.compiled.contract.name,
      ),
  )
  for (const parent of parents) await catalog.applyFrozenUnit(parent.source, parent.sourceHash)
  return catalog
}
describe('76independent raw original table transitions;fixture external parents,not whole107proof', () => {
  it('pins all76original declarations', () => expect(declarations).toHaveLength(76))
  for (const effect of declarations) {
    it(`actual source-created native relation comparison:${effect.effectId}`, async () => {
      const catalog = await fixture()
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect((await inspectReplayEffect(catalog, effect)).definition).toBe('EXACT')
    })
  }
})
