/**
 * Tests — CloudFront Delivery Module
 *
 * Validates signed URL generation, HLS grant composition,
 * and public URL construction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock CloudFront signer
vi.mock('@aws-sdk/cloudfront-signer', () => ({
  getSignedUrl: vi.fn().mockReturnValue('https://d1234.cloudfront.net/path?Policy=test&Signature=abc'),
}))

describe('cloudfront-delivery', () => {
  const config = {
    distributionDomain: 'd1234.cloudfront.net',
    keyPairId: 'KTEST123',
    privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
    defaultTtlSec: 3600,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSignedPlaybackUrl', () => {
    it('should return a signed URL with expiry', async () => {
      const { createSignedPlaybackUrl } = await import('../src/cloudfront-delivery')
      const result = await createSignedPlaybackUrl(config, {
        storageKey: 'processed/org-1/asset-1/high/output.m3u8',
        qualityTier: 'high',
        orgId: 'org-1',
        assetId: 'asset-1',
      })

      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('expiresAt')
      expect(result).toHaveProperty('qualityTier', 'high')
      expect(result).toHaveProperty('storageKey')
      expect(result.url).toContain('cloudfront.net')
    })
  })

  describe('buildPublicUrl', () => {
    it('should construct an unsigned HTTPS URL', async () => {
      const { buildPublicUrl } = await import('../src/cloudfront-delivery')
      const url = buildPublicUrl(config, 'artwork/poster.jpg')
      expect(url).toBe('https://d1234.cloudfront.net/artwork/poster.jpg')
    })
  })

  describe('computeVariantKeys', () => {
    it('should compute master + variant storage keys', async () => {
      const { computeVariantKeys } = await import('../src/cloudfront-delivery')
      const result = computeVariantKeys('org-1', 'asset-1', ['standard', 'high'])
      expect(result.masterKey).toBe('processed/org-1/asset-1/master.m3u8')
      expect(result.variantKeys).toHaveLength(2)
      expect(result.variantKeys[0]).toContain('standard')
      expect(result.variantKeys[1]).toContain('high')
    })
  })

  describe('createHlsPlaybackGrant', () => {
    it('should return signed master + variant URLs', async () => {
      const { createHlsPlaybackGrant } = await import('../src/cloudfront-delivery')
      const result = await createHlsPlaybackGrant(config, {
        orgId: 'org-1',
        assetId: 'asset-1',
        qualities: ['standard', 'high'],
      })

      expect(result).toHaveProperty('masterPlaylistUrl')
      expect(result).toHaveProperty('variantUrls')
      expect(result).toHaveProperty('expiresAt')
      expect(result.variantUrls).toHaveLength(2)
      expect(result.masterPlaylistUrl).toContain('cloudfront.net')
    })
  })
})
