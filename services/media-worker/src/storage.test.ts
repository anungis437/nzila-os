import { describe, it, expect } from 'vitest'
import {
  STORAGE_PATHS,
  rawPath,
  processedPath,
  hlsPath,
  hlsManifestPath,
  hlsVariantPath,
  hlsSegmentPath,
  artworkPath,
  waveformPath,
  previewPath,
  createInMemoryStorageAdapter,
} from './storage'

describe('Storage Paths', () => {
  it('rawPath builds correct key', () => {
    expect(rawPath('asset-1', 'song.mp3')).toBe('audio/raw/asset-1/song.mp3')
  })

  it('processedPath builds correct key', () => {
    expect(processedPath('asset-1', 'high')).toBe('audio/processed/asset-1/high.mp4')
  })

  it('hlsPath builds correct base path', () => {
    expect(hlsPath('track-1')).toBe('audio/hls/track-1')
  })

  it('hlsManifestPath builds master manifest key', () => {
    expect(hlsManifestPath('track-1')).toBe('audio/hls/track-1/master.m3u8')
  })

  it('hlsVariantPath builds variant key', () => {
    expect(hlsVariantPath('track-1', 'medium')).toBe('audio/hls/track-1/medium/playlist.m3u8')
  })

  it('hlsSegmentPath pads segment number', () => {
    expect(hlsSegmentPath('track-1', 'low', 3)).toBe('audio/hls/track-1/low/segment_00003.ts')
  })

  it('artworkPath builds correct key', () => {
    expect(artworkPath('asset-1', 300)).toBe('artwork/asset-1/300x300.webp')
  })

  it('waveformPath builds correct key', () => {
    expect(waveformPath('asset-1')).toBe('audio/waveform/asset-1/waveform.json')
  })

  it('previewPath builds correct key', () => {
    expect(previewPath('asset-1')).toBe('audio/preview/asset-1/preview.mp4')
  })

  it('STORAGE_PATHS has all expected keys', () => {
    expect(STORAGE_PATHS).toHaveProperty('RAW')
    expect(STORAGE_PATHS).toHaveProperty('PROCESSED')
    expect(STORAGE_PATHS).toHaveProperty('HLS')
    expect(STORAGE_PATHS).toHaveProperty('ARTWORK')
    expect(STORAGE_PATHS).toHaveProperty('WAVEFORM')
    expect(STORAGE_PATHS).toHaveProperty('PREVIEW')
  })
})

describe('InMemoryStorageAdapter', () => {
  it('upload and download round-trips', async () => {
    const storage = createInMemoryStorageAdapter()
    const data = new TextEncoder().encode('hello audio')
    const result = await storage.upload({
      key: 'test/file.mp3',
      body: data,
      contentType: 'audio/mpeg',
    })

    expect(result.key).toBe('test/file.mp3')
    expect(result.sizeBytes).toBe(data.byteLength)

    const downloaded = await storage.download('test/file.mp3')
    expect(new TextDecoder().decode(downloaded)).toBe('hello audio')
  })

  it('exists returns true for uploaded and false for missing', async () => {
    const storage = createInMemoryStorageAdapter()
    expect(await storage.exists('nope')).toBe(false)

    await storage.upload({ key: 'yes', body: new Uint8Array([1]), contentType: 'application/octet-stream' })
    expect(await storage.exists('yes')).toBe(true)
  })

  it('delete removes an object', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({ key: 'k', body: new Uint8Array([1]), contentType: 'application/octet-stream' })
    await storage.delete('k')
    expect(await storage.exists('k')).toBe(false)
  })

  it('list filters by prefix', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({ key: 'a/1', body: new Uint8Array([1]), contentType: 'text/plain' })
    await storage.upload({ key: 'a/2', body: new Uint8Array([2]), contentType: 'text/plain' })
    await storage.upload({ key: 'b/1', body: new Uint8Array([3]), contentType: 'text/plain' })

    const results = await storage.list('a/')
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.key)).toEqual(['a/1', 'a/2'])
  })

  it('getObjectMetadata returns metadata for existing key', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({
      key: 'meta-test',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'audio/mpeg',
      metadata: { artist: 'test' },
    })

    const meta = await storage.getObjectMetadata('meta-test')
    expect(meta).not.toBeNull()
    expect(meta!.contentType).toBe('audio/mpeg')
    expect(meta!.sizeBytes).toBe(3)
    expect(meta!.metadata.artist).toBe('test')
  })

  it('getObjectMetadata returns null for missing key', async () => {
    const storage = createInMemoryStorageAdapter()
    expect(await storage.getObjectMetadata('missing')).toBeNull()
  })

  it('copyObject duplicates content', async () => {
    const storage = createInMemoryStorageAdapter()
    const data = new Uint8Array([10, 20, 30])
    await storage.upload({ key: 'src', body: data, contentType: 'audio/mpeg' })
    await storage.copyObject('src', 'dst')

    expect(await storage.exists('dst')).toBe(true)
    const downloaded = await storage.download('dst')
    expect(Array.from(downloaded)).toEqual([10, 20, 30])
  })

  it('deletePrefix removes all matching objects', async () => {
    const storage = createInMemoryStorageAdapter()
    await storage.upload({ key: 'pfx/a', body: new Uint8Array([1]), contentType: 'text/plain' })
    await storage.upload({ key: 'pfx/b', body: new Uint8Array([2]), contentType: 'text/plain' })
    await storage.upload({ key: 'other/c', body: new Uint8Array([3]), contentType: 'text/plain' })

    const deleted = await storage.deletePrefix('pfx/')
    expect(deleted).toBe(2)
    expect(await storage.exists('pfx/a')).toBe(false)
    expect(await storage.exists('other/c')).toBe(true)
  })

  it('getSignedUrl returns memory-scheme URL', async () => {
    const storage = createInMemoryStorageAdapter()
    const url = await storage.getSignedUrl('key', 300)
    expect(url).toContain('mem-signed://')
  })

  it('download throws for missing key', async () => {
    const storage = createInMemoryStorageAdapter()
    await expect(storage.download('nope')).rejects.toThrow('Not found')
  })
})
