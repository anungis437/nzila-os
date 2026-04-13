import { afterEach, describe, it, expect, vi } from 'vitest'
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
  createS3StorageAdapter,
  createInMemoryStorageAdapter,
} from './storage'

afterEach(() => {
  vi.resetAllMocks()
  vi.resetModules()
  vi.doUnmock('@aws-sdk/client-s3')
  vi.doUnmock('@aws-sdk/s3-request-presigner')
})

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

describe('S3StorageAdapter', () => {
  it('covers upload, list, metadata, copy, signed URLs, and prefix deletion via the mocked SDK', async () => {
    const sentInputs: Array<{ type: string; input: Record<string, unknown> }> = []
    const send = vi.fn(async (command: { input: Record<string, unknown>; constructor: { name: string } }) => {
      sentInputs.push({ type: command.constructor.name, input: command.input })

      switch (command.constructor.name) {
        case 'PutObjectCommand':
          return { ETag: 'etag-1' }
        case 'GetObjectCommand':
          return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }
        case 'HeadObjectCommand':
          return {
            ContentLength: 3,
            LastModified: new Date('2026-04-12T00:00:00.000Z'),
            ETag: 'etag-head',
            ContentType: 'audio/mp4',
            Metadata: { artist: 'Nzila' },
          }
        case 'ListObjectsV2Command':
          if (!command.input.ContinuationToken) {
            return {
              Contents: [{ Key: 'tracks/a.m3u8', Size: 4, LastModified: new Date('2026-04-12T00:00:00.000Z'), ETag: '1' }],
              NextContinuationToken: 'page-2',
            }
          }
          return {
            Contents: [{ Key: 'tracks/b.ts', Size: 5, LastModified: new Date('2026-04-12T00:00:01.000Z'), ETag: '2' }],
          }
        case 'DeleteObjectCommand':
        case 'CopyObjectCommand':
          return {}
        default:
          throw new Error(`Unexpected command: ${command.constructor.name}`)
      }
    })

    vi.doMock('@aws-sdk/client-s3', () => {
      class S3Client {
        send = send
      }
      class PutObjectCommand { constructor(public input: Record<string, unknown>) {} }
      class GetObjectCommand { constructor(public input: Record<string, unknown>) {} }
      class DeleteObjectCommand { constructor(public input: Record<string, unknown>) {} }
      class HeadObjectCommand { constructor(public input: Record<string, unknown>) {} }
      class ListObjectsV2Command { constructor(public input: Record<string, unknown>) {} }
      class CopyObjectCommand { constructor(public input: Record<string, unknown>) {} }

      return {
        S3Client,
        PutObjectCommand,
        GetObjectCommand,
        DeleteObjectCommand,
        HeadObjectCommand,
        ListObjectsV2Command,
        CopyObjectCommand,
      }
    })
    vi.doMock('@aws-sdk/s3-request-presigner', () => ({
      getSignedUrl: vi.fn(async (_client, command) => `signed://${command.input.Key}`),
    }))

    const storage = createS3StorageAdapter({
      provider: 'r2',
      bucket: 'nzila-media',
      region: 'us-east-1',
      endpoint: 'https://r2.example.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      cdnBaseUrl: 'https://cdn.example.com',
    })

    const upload = await storage.upload({
      key: 'tracks/source.m4a',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'audio/mp4',
    })
    const download = await storage.download('tracks/source.m4a')
    const exists = await storage.exists('tracks/source.m4a')
    const signedDownloadUrl = await storage.getSignedUrl('tracks/source.m4a', 300)
    const signedUploadUrl = await storage.getSignedUploadUrl('tracks/upload.m4a', 'audio/mp4', 300)
    const listed = await storage.list('tracks/')
    const metadata = await storage.getObjectMetadata('tracks/source.m4a')
    await storage.copyObject('tracks/source.m4a', 'tracks/copy.m4a')
    const deleted = await storage.deletePrefix('tracks/')

    expect(upload.url).toBe('https://cdn.example.com/tracks/source.m4a')
    expect(Array.from(download)).toEqual([1, 2, 3])
    expect(exists).toBe(true)
    expect(signedDownloadUrl).toBe('signed://tracks/source.m4a')
    expect(signedUploadUrl).toBe('signed://tracks/upload.m4a')
    expect(listed).toHaveLength(2)
    expect(metadata?.metadata.artist).toBe('Nzila')
    expect(deleted).toBe(2)
    expect(sentInputs.some((entry) => entry.type === 'CopyObjectCommand')).toBe(true)
  })

  it('returns false/null for head failures and throws for empty downloads', async () => {
    const send = vi.fn(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'GetObjectCommand') {
        return { Body: null }
      }
      throw new Error('not found')
    })

    vi.doMock('@aws-sdk/client-s3', () => {
      class S3Client {
        send = send
      }
      class GetObjectCommand { constructor(public input: Record<string, unknown>) {} }
      class HeadObjectCommand { constructor(public input: Record<string, unknown>) {} }

      return {
        S3Client,
        GetObjectCommand,
        HeadObjectCommand,
      }
    })

    const storage = createS3StorageAdapter({
      provider: 's3',
      bucket: 'nzila-media',
      region: 'ca-central-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    })

    await expect(storage.download('missing')).rejects.toThrow('Empty body for key: missing')
    await expect(storage.exists('missing')).resolves.toBe(false)
    await expect(storage.getObjectMetadata('missing')).resolves.toBeNull()
  })
})
