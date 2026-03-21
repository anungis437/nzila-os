import { describe, it, expect } from 'vitest'
import {
  getAccessPolicy,
  resolveQuality,
  createStreamingDeliveryService,
  STREAM_ACCESS_TIERS,
} from './streaming'
import { createInMemoryStorageAdapter } from './storage'

describe('getAccessPolicy', () => {
  it('free tier caps at medium quality', () => {
    const policy = getAccessPolicy(STREAM_ACCESS_TIERS.FREE)
    expect(policy.maxQuality).toBe('medium')
    expect(policy.hlsEnabled).toBe(false)
    expect(policy.offlineEnabled).toBe(false)
    expect(policy.requireSignedUrls).toBe(false)
  })

  it('premium tier allows HLS and offline', () => {
    const policy = getAccessPolicy(STREAM_ACCESS_TIERS.PREMIUM)
    expect(policy.maxQuality).toBe('high')
    expect(policy.hlsEnabled).toBe(true)
    expect(policy.offlineEnabled).toBe(true)
    expect(policy.requireSignedUrls).toBe(true)
  })

  it('creator tier has longest TTL', () => {
    const creator = getAccessPolicy(STREAM_ACCESS_TIERS.CREATOR)
    const premium = getAccessPolicy(STREAM_ACCESS_TIERS.PREMIUM)
    expect(creator.urlTtlSeconds).toBeGreaterThan(premium.urlTtlSeconds)
  })
})

describe('resolveQuality', () => {
  it('returns preferred when within range', () => {
    expect(resolveQuality('medium', 'high', false)).toBe('medium')
  })

  it('caps to max allowed', () => {
    expect(resolveQuality('high', 'medium', false)).toBe('medium')
  })

  it('forces low in low-data mode', () => {
    expect(resolveQuality('high', 'high', true)).toBe('low')
  })

  it('returns low when preferred is low', () => {
    expect(resolveQuality('low', 'high', false)).toBe('low')
  })
})

describe('StreamingDeliveryService', () => {
  function createTestService() {
    const storage = createInMemoryStorageAdapter()
    const service = createStreamingDeliveryService({
      storage,
      cdnBaseUrl: 'https://cdn.test.com',
    })
    return { storage, service }
  }

  it('resolves progressive URL for free tier', async () => {
    const { storage, service } = createTestService()
    await storage.upload({
      key: 'audio/processed/asset-1/medium.mp4',
      body: new Uint8Array([1]),
      contentType: 'audio/mp4',
    })

    const result = await service.resolveStreamUrl({
      assetId: 'asset-1',
      listenerId: 'user-1',
      accessTier: 'free',
      preferredQuality: 'high',
      protocol: 'progressive',
      lowDataMode: false,
    })

    expect(result.protocol).toBe('progressive')
    expect(result.quality).toBe('medium') // capped by free tier
    expect(result.url).toContain('cdn.test.com')
  })

  it('resolves HLS URL for premium tier with manifest', async () => {
    const { storage, service } = createTestService()
    await storage.upload({
      key: 'audio/hls/asset-1/master.m3u8',
      body: new Uint8Array([1]),
      contentType: 'application/vnd.apple.mpegurl',
    })

    const result = await service.resolveStreamUrl({
      assetId: 'asset-1',
      listenerId: 'user-1',
      accessTier: 'premium',
      preferredQuality: 'high',
      protocol: 'hls',
      lowDataMode: false,
    })

    expect(result.protocol).toBe('hls')
    // Premium uses signed URLs
    expect(result.url).toContain('mem-signed://')
    expect(result.hlsManifestUrl).not.toBeNull()
  })

  it('resolves download URL for premium tier', async () => {
    const { storage, service } = createTestService()
    await storage.upload({
      key: 'audio/processed/asset-1/high.mp4',
      body: new Uint8Array([1]),
      contentType: 'audio/mp4',
    })

    const result = await service.resolveDownloadUrl({
      assetId: 'asset-1',
      quality: 'high',
      accessTier: 'premium',
    })

    expect(result).not.toBeNull()
    expect(result!.url).toContain('mem-signed://')
  })

  it('returns null for download on free tier', async () => {
    const { service } = createTestService()
    const result = await service.resolveDownloadUrl({
      assetId: 'asset-1',
      quality: 'medium',
      accessTier: 'free',
    })
    expect(result).toBeNull()
  })

  it('resolves preview URL when available', async () => {
    const { storage, service } = createTestService()
    await storage.upload({
      key: 'audio/preview/asset-1/preview.mp4',
      body: new Uint8Array([1]),
      contentType: 'audio/mp4',
    })

    const url = await service.resolvePreviewUrl('asset-1')
    expect(url).toBe('https://cdn.test.com/audio/preview/asset-1/preview.mp4')
  })

  it('returns null when preview not available', async () => {
    const { service } = createTestService()
    const url = await service.resolvePreviewUrl('missing')
    expect(url).toBeNull()
  })

  it('resolves waveform URL when available', async () => {
    const { storage, service } = createTestService()
    await storage.upload({
      key: 'audio/waveform/asset-1/waveform.json',
      body: new Uint8Array([1]),
      contentType: 'application/json',
    })

    const url = await service.resolveWaveformUrl('asset-1')
    expect(url).toBe('https://cdn.test.com/audio/waveform/asset-1/waveform.json')
  })
})
