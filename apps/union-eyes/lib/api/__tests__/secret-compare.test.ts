import { describe, expect, it } from 'vitest'
import { secretsEqual } from '../secret-compare'

describe('secretsEqual', () => {
  it('accepts only an identical non-empty secret', () => {
    expect(secretsEqual('cron-secret', 'cron-secret')).toBe(true)
    expect(secretsEqual('cron-secret', 'cron-secreT')).toBe(false)
    expect(secretsEqual('short', 'a-much-longer-secret')).toBe(false)
    expect(secretsEqual('', '')).toBe(false)
    expect(secretsEqual('anything', '')).toBe(false)
  })
})
