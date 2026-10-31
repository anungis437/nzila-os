import { describe, expect, it } from 'vitest'
import { ErrorCode } from '@/lib/api/errors'
import { governanceMomentumEngine, responseElasticityEngine } from '../kernel-bridge'

/** These engines previously converted entry counts into invented institutional measurements. */
describe('unmeasured institutional cognition engines', () => {
  it.each([
    ['response elasticity', responseElasticityEngine],
    ['governance momentum', governanceMomentumEngine],
  ])('%s refuses to manufacture an analysis from memory-entry counts', async (_label, engine) => {
    await expect(engine('00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({
      code: ErrorCode.NOT_IMPLEMENTED,
      message: expect.stringContaining('not computed from the organization'),
    })
  })
})
