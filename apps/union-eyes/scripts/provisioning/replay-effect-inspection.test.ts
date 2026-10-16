import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { compileReplayComponents } from './replay-effect-registry'
import { inspectReplayEffect } from './replay-effect-inspection'
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
describe('actual source-bound inspector dispatch;not whole-unit completion', () => {
  for (const effect of components.effects) {
    it(`absence or missing position authority cannot fabricate completion:${effect.effectId}`, async () => {
      const result = await inspectReplayEffect(
        {
          async query() {
            return []
          },
        },
        effect,
      )
      expect(['ABSENT', 'PRECONDITION_MISSING']).toContain(result.definition)
      expect(result.effectId).toBe(effect.effectId)
      expect(result.contractDigest).toBe(effect.compiled.contract.contractDigest)
      expect(result.observationDigest).toMatch(/^[a-f0-9]{64}$/)
      expect(result.stateDigest).toMatch(/^[a-f0-9]{64}$/)
    })
  }
  it('rejects borrowed position authority before any catalog access', async () => {
    const effect = components.effects[0]
    await expect(
      inspectReplayEffect(
        {
          async query() {
            throw new Error('CATALOG_MUST_NOT_BE_READ')
          },
        },
        effect,
        {
          effectId: 'different-effect',
          sourceHash: effect.sourceHash,
        },
      ),
    ).rejects.toThrow('REPLAY_EFFECT_POSITION_AUTHORITY_DRIFT')
  })
})
