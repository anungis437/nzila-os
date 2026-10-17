import { describe, expect, it } from 'vitest'
import { assertRationaleIsImmutable } from './institutional'

describe('Checkpoint 3 guarded rationale boundary', () => {
  it('has no direct decided-payload update path', () => {
    expect(() => assertRationaleIsImmutable()).toThrow('DECIDED_RATIONALE_IMMUTABLE_USE_SUPERSESSION')
  })
})
