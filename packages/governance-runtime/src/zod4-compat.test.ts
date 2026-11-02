import { describe, expect, it } from 'vitest'
import { releaseIdentitySchema } from './release-identity'

const valid = {releaseId:'r1',commitSha:'abcdef0123456789',manifestHash:'sha256:1234567890',builtAt:'2026-11-02T10:00:00.000Z'}

describe('Zod 4 governance-runtime schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(releaseIdentitySchema.safeParse(valid).success).toBe(true)
    expect(releaseIdentitySchema.safeParse({...valid,commitSha:'not-a-sha'}).success).toBe(false)
  })
})
