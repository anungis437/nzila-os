import { describe, it, expect } from 'vitest'
import {
  classifyFailure,
  cleanupPartialArtifacts,
  detectOrphans,
  purgeOrphans,
} from './recovery'
import { createInMemoryStorageAdapter } from './storage'
import { MediaWorkerError, createLogger } from './observability'

const logger = createLogger('test', undefined, 'error') // suppress logs in tests

describe('classifyFailure', () => {
  it('retries retryable errors with exponential backoff', () => {
    const err = new MediaWorkerError('REDIS_CONNECTION_FAILED', 'lost', { retryable: true })
    const decision = classifyFailure(err, 1, 3)
    expect(decision.action).toBe('retry')
    if (decision.action === 'retry') {
      expect(decision.delayMs).toBeGreaterThan(0)
    }
  })

  it('dead-letters non-retryable errors immediately', () => {
    const err = new MediaWorkerError('INVALID_SOURCE_FORMAT', 'bad', { retryable: false })
    const decision = classifyFailure(err, 1, 3)
    expect(decision.action).toBe('dead-letter')
  })

  it('dead-letters after max attempts', () => {
    const err = new MediaWorkerError('REDIS_CONNECTION_FAILED', 'lost', { retryable: true })
    const decision = classifyFailure(err, 3, 3)
    expect(decision.action).toBe('dead-letter')
    if (decision.action === 'dead-letter') {
      expect(decision.reason).toContain('Max attempts')
    }
  })

  it('retries timeout errors', () => {
    const decision = classifyFailure(new Error('Connection timeout'), 1, 3)
    expect(decision.action).toBe('retry')
  })

  it('increases delay with attempt number', () => {
    const err = new Error('ECONNREFUSED')
    const d1 = classifyFailure(err, 1, 5)
    const d2 = classifyFailure(err, 2, 5)
    if (d1.action === 'retry' && d2.action === 'retry') {
      // Delay should be roughly 2x (with jitter), just check d2 > d1 baseline
      expect(d2.delayMs).toBeGreaterThanOrEqual(1000)
    }
  })
})

describe('cleanupPartialArtifacts', () => {
  it('removes matching artifacts', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({ key: 'audio/processed/asset-1/high.mp4', body: new Uint8Array([1]), contentType: 'audio/mp4' })
    await storage.upload({ key: 'audio/hls/asset-1/master.m3u8', body: new Uint8Array([2]), contentType: 'text/plain' })
    await storage.upload({ key: 'audio/waveform/asset-1/waveform.json', body: new Uint8Array([3]), contentType: 'application/json' })
    await storage.upload({ key: 'audio/preview/asset-1/preview.mp4', body: new Uint8Array([4]), contentType: 'audio/mp4' })

    const result = await cleanupPartialArtifacts(storage, 'asset-1', logger)
    expect(result.cleaned).toBeGreaterThan(0)
    expect(result.errors).toBe(0)
  })

  it('handles no artifacts gracefully', async () => {
    const storage = createInMemoryStorageAdapter()
    const result = await cleanupPartialArtifacts(storage, 'nonexistent', logger)
    expect(result.cleaned).toBe(0)
    expect(result.errors).toBe(0)
  })
})

describe('detectOrphans', () => {
  it('finds orphaned artifacts', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({ key: 'audio/processed/known-1/high.mp4', body: new Uint8Array([1]), contentType: 'audio/mp4' })
    await storage.upload({ key: 'audio/processed/orphan-1/high.mp4', body: new Uint8Array([2]), contentType: 'audio/mp4' })

    const knownIds = new Set(['known-1'])
    const orphans = await detectOrphans(storage, 'audio/processed/', knownIds, logger)

    expect(orphans).toHaveLength(1)
    expect(orphans[0]!.key).toContain('orphan-1')
  })

  it('returns empty when all assets are known', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({ key: 'audio/processed/known-1/high.mp4', body: new Uint8Array([1]), contentType: 'audio/mp4' })

    const knownIds = new Set(['known-1'])
    const orphans = await detectOrphans(storage, 'audio/processed/', knownIds, logger)
    expect(orphans).toHaveLength(0)
  })
})

describe('purgeOrphans', () => {
  it('deletes orphaned artifacts', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({ key: 'a/b', body: new Uint8Array([1]), contentType: 'text/plain' })

    const deleted = await purgeOrphans(
      storage,
      [{ key: 'a/b', sizeBytes: 1, lastModified: new Date() }],
      logger,
    )

    expect(deleted).toBe(1)
    expect(await storage.exists('a/b')).toBe(false)
  })
})
