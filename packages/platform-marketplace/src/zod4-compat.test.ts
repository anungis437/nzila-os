import { describe, expect, it } from 'vitest'
import { providerManifestSchema } from './types'

const manifest = { providerKey: 'sample', name: 'Sample', version: '1', description: 'test', category: 'integration', scopes: ['read'], webhookSigning: { algorithm: 'hmac-sha256', headerName: 'X-Signature' }, retryPolicy: { maxAttempts: 2, initialDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 }, requiredSecrets: [], metadata: { region: 'ca' } }

describe('Zod 4 provider manifest boundary', () => {
  it('preserves string metadata and required nested schemas', () => {
    expect(providerManifestSchema.parse(manifest).metadata).toEqual({ region: 'ca' })
  })
  it('rejects non-string metadata and invalid signing headers', () => {
    expect(providerManifestSchema.safeParse({ ...manifest, metadata: { region: 4 } }).success).toBe(false)
    expect(providerManifestSchema.safeParse({ ...manifest, webhookSigning: { algorithm: 'hmac-sha256', headerName: '' } }).success).toBe(false)
  })
})
