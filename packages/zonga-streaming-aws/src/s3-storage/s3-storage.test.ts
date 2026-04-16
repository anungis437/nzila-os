/**
 * Tests — S3 Storage Module
 *
 * Validates key computation, presigned URL generation, and upload logic.
 * AWS SDK calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = vi.fn()
  },
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/signed-url?X-Amz-Credential=test'),
}))

describe('s3-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('computeRawStorageKey', () => {
    it('should produce a deterministic, sanitized key', async () => {
      const { computeRawStorageKey } = await import('.')
      const key = computeRawStorageKey('org-1', 'asset-42', 'My Track (Final).wav')
      expect(key).toBe('raw/org-1/asset-42/My_Track__Final_.wav')
      expect(key).not.toContain('(')
      expect(key).not.toContain(')')
    })

    it('should handle files with special characters', async () => {
      const { computeRawStorageKey } = await import('.')
      const key = computeRawStorageKey('org-1', 'asset-1', '../../etc/passwd')
      expect(key).toMatch(/^raw\/org-1\/asset-1\//)
      expect(key).not.toContain('..')
    })
  })

  describe('computeOutputStorageKey', () => {
    it('should include quality tier in path', async () => {
      const { computeOutputStorageKey } = await import('.')
      const key = computeOutputStorageKey('org-1', 'asset-1', 'high', 'output.m3u8')
      expect(key).toBe('processed/org-1/asset-1/high/output.m3u8')
    })
  })

  describe('createPresignedUpload', () => {
    it('should return a presigned URL and metadata', async () => {
      const { createPresignedUpload } = await import('.')
      const result = await createPresignedUpload(
        { rawBucket: 'test-raw', outputBucket: 'test-output', region: 'us-east-1' },
        {
          orgId: 'org-1',
          assetId: 'asset-1',
          fileName: 'track.wav',
          contentType: 'audio/wav',
          maxSizeBytes: 1024,
        },
      )

      expect(result).toHaveProperty('uploadUrl')
      expect(result).toHaveProperty('storageKey')
      expect(result).toHaveProperty('expiresAt')
      expect(result).toHaveProperty('bucket', 'test-raw')
      expect(result.storageKey).toMatch(/^raw\/org-1\/asset-1\//)
    })
  })
})
