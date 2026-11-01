import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/encryption', () => ({
  encryptSecret: async (value: string) => `sealed(${value})`,
  decryptSecret: async (value: string) => value.replace(/^sealed\((.*)\)$/, '$1'),
}))

import { openOptionalToken, openToken, sealOptionalToken, sealToken } from '../token-vault'

describe('social token vault', () => {
  it('stores a token sealed and opens it back', async () => {
    const stored = await sealToken('secret-token')
    expect(stored).toBe('enc:v1:sealed(secret-token)')
    expect(stored).not.toContain('secret-token'.padEnd(40, 'x'))
    expect(await openToken(stored)).toBe('secret-token')
  })

  it('does not seal a value twice', async () => {
    const once = await sealToken('t')
    expect(await sealToken(once)).toBe(once)
  })

  it('returns a token written before sealing existed as it is, so a stored account keeps working until it is rewritten', async () => {
    expect(await openToken('legacy-plaintext-token')).toBe('legacy-plaintext-token')
  })

  it('treats an absent optional token as absent', async () => {
    expect(await sealOptionalToken(null)).toBeNull()
    expect(await openOptionalToken(null)).toBeUndefined()
    expect(await openOptionalToken(await sealOptionalToken('r'))).toBe('r')
  })
})
