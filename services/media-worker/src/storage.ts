/**
 * @nzila/media-worker — Storage Abstraction
 *
 * S3-compatible storage layer supporting AWS S3 and Cloudflare R2.
 * Handles raw uploads, processed outputs, HLS segments, artwork,
 * waveform data, and preview clips.
 *
 * @module @nzila/media-worker/storage
 */

// ── Storage Paths ───────────────────────────────────────────────────────────

export const STORAGE_PATHS = {
  RAW: 'audio/raw',
  PROCESSED: 'audio/processed',
  HLS: 'audio/hls',
  ARTWORK: 'artwork',
  WAVEFORM: 'audio/waveform',
  PREVIEW: 'audio/preview',
} as const

export function rawPath(assetId: string, fileName: string): string {
  return `${STORAGE_PATHS.RAW}/${assetId}/${fileName}`
}

export function processedPath(assetId: string, quality: string): string {
  return `${STORAGE_PATHS.PROCESSED}/${assetId}/${quality}.mp4`
}

export function hlsPath(trackId: string): string {
  return `${STORAGE_PATHS.HLS}/${trackId}`
}

export function hlsManifestPath(trackId: string): string {
  return `${STORAGE_PATHS.HLS}/${trackId}/master.m3u8`
}

export function hlsVariantPath(trackId: string, quality: string): string {
  return `${STORAGE_PATHS.HLS}/${trackId}/${quality}/playlist.m3u8`
}

export function hlsSegmentPath(trackId: string, quality: string, segment: number): string {
  return `${STORAGE_PATHS.HLS}/${trackId}/${quality}/segment_${String(segment).padStart(5, '0')}.ts`
}

export function artworkPath(assetId: string, size: number): string {
  return `${STORAGE_PATHS.ARTWORK}/${assetId}/${size}x${size}.webp`
}

export function waveformPath(assetId: string): string {
  return `${STORAGE_PATHS.WAVEFORM}/${assetId}/waveform.json`
}

export function previewPath(assetId: string): string {
  return `${STORAGE_PATHS.PREVIEW}/${assetId}/preview.mp4`
}

// ── Storage Provider Interface ──────────────────────────────────────────────

export interface StorageProvider {
  readonly name: string

  /** Upload a buffer to the given key. */
  upload(params: UploadParams): Promise<UploadResult>

  /** Download an object to a buffer. */
  download(key: string): Promise<Uint8Array>

  /** Delete an object. */
  delete(key: string): Promise<void>

  /** Check if an object exists. */
  exists(key: string): Promise<boolean>

  /** Generate a signed download URL. */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>

  /** Generate a signed upload URL for direct client uploads. */
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>

  /** List objects under a prefix. */
  list(prefix: string): Promise<readonly StorageObject[]>

  /** Get object metadata without downloading the body. */
  getObjectMetadata(key: string): Promise<ObjectMetadata | null>

  /** Copy an object to a new key. */
  copyObject(sourceKey: string, destinationKey: string): Promise<void>

  /** Delete all objects under a prefix. */
  deletePrefix(prefix: string): Promise<number>
}

export interface UploadParams {
  readonly key: string
  readonly body: Uint8Array
  readonly contentType: string
  readonly metadata?: Record<string, string>
  readonly cacheControl?: string
}

export interface UploadResult {
  readonly key: string
  readonly etag: string
  readonly sizeBytes: number
  readonly url: string
}

export interface StorageObject {
  readonly key: string
  readonly sizeBytes: number
  readonly lastModified: Date
  readonly etag: string
}

export interface ObjectMetadata {
  readonly key: string
  readonly sizeBytes: number
  readonly lastModified: Date
  readonly etag: string
  readonly contentType: string
  readonly metadata: Record<string, string>
}

// ── Storage Configuration ───────────────────────────────────────────────────

export interface StorageConfig {
  readonly provider: 's3' | 'r2'
  readonly bucket: string
  readonly region: string
  readonly endpoint?: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly cdnBaseUrl?: string
}

// ── S3-Compatible Adapter (works with AWS S3 + Cloudflare R2) ───────────────

export function createS3StorageAdapter(config: StorageConfig): StorageProvider {
  // Singleton client — reused across all operations
  let _client: import('@aws-sdk/client-s3').S3Client | null = null

  async function getClient(): Promise<import('@aws-sdk/client-s3').S3Client> {
    if (_client) return _client
    const { S3Client } = await import('@aws-sdk/client-s3')
    _client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.provider === 'r2',
    })
    return _client
  }

  function buildUrl(key: string): string {
    return config.cdnBaseUrl
      ? `${config.cdnBaseUrl}/${key}`
      : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`
  }

  return {
    name: config.provider,

    async upload(params: UploadParams): Promise<UploadResult> {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      const result = await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
          Metadata: params.metadata,
          CacheControl: params.cacheControl ?? 'public, max-age=31536000, immutable',
        }),
      )
      return {
        key: params.key,
        etag: result.ETag ?? '',
        sizeBytes: params.body.byteLength,
        url: buildUrl(params.key),
      }
    },

    async download(key: string): Promise<Uint8Array> {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      const result = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      )
      const body = await result.Body?.transformToByteArray()
      if (!body) throw new Error(`Empty body for key: ${key}`)
      return body
    },

    async delete(key: string): Promise<void> {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      )
    },

    async exists(key: string): Promise<boolean> {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        )
        return true
      } catch {
        return false
      }
    },

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl: s3GetSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const client = await getClient()
      return s3GetSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      )
    },

    async getSignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl: s3GetSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const client = await getClient()
      return s3GetSignedUrl(
        client,
        new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType }),
        { expiresIn: expiresInSeconds },
      )
    },

    async list(prefix: string): Promise<readonly StorageObject[]> {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      const objects: StorageObject[] = []
      let continuationToken: string | undefined

      // Paginate through all objects
      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        )
        for (const obj of result.Contents ?? []) {
          objects.push({
            key: obj.Key ?? '',
            sizeBytes: obj.Size ?? 0,
            lastModified: obj.LastModified ?? new Date(),
            etag: obj.ETag ?? '',
          })
        }
        continuationToken = result.NextContinuationToken
      } while (continuationToken)

      return objects
    },

    async getObjectMetadata(key: string): Promise<ObjectMetadata | null> {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        )
        return {
          key,
          sizeBytes: result.ContentLength ?? 0,
          lastModified: result.LastModified ?? new Date(),
          etag: result.ETag ?? '',
          contentType: result.ContentType ?? 'application/octet-stream',
          metadata: (result.Metadata as Record<string, string>) ?? {},
        }
      } catch {
        return null
      }
    },

    async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
      const { CopyObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucket,
          CopySource: `${config.bucket}/${sourceKey}`,
          Key: destinationKey,
        }),
      )
    },

    async deletePrefix(prefix: string): Promise<number> {
      const { DeleteObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      const client = await getClient()
      let deleted = 0
      let continuationToken: string | undefined

      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        )
        for (const obj of result.Contents ?? []) {
          if (obj.Key) {
            await client.send(
              new DeleteObjectCommand({ Bucket: config.bucket, Key: obj.Key }),
            )
            deleted++
          }
        }
        continuationToken = result.NextContinuationToken
      } while (continuationToken)

      return deleted
    },
  }
}

// ── In-Memory Storage (for tests) ───────────────────────────────────────────

export function createInMemoryStorageAdapter(): StorageProvider & { readonly store: Map<string, { body: Uint8Array; contentType: string; metadata: Record<string, string>; cacheControl: string }> } {
  const store = new Map<string, { body: Uint8Array; contentType: string; metadata: Record<string, string>; cacheControl: string }>()

  return {
    name: 'memory',
    store,

    async upload(params: UploadParams): Promise<UploadResult> {
      store.set(params.key, {
        body: params.body,
        contentType: params.contentType,
        metadata: params.metadata ?? {},
        cacheControl: params.cacheControl ?? '',
      })
      return {
        key: params.key,
        etag: `"${params.key}"`,
        sizeBytes: params.body.byteLength,
        url: `mem://${params.key}`,
      }
    },

    async download(key: string): Promise<Uint8Array> {
      const entry = store.get(key)
      if (!entry) throw new Error(`Not found: ${key}`)
      return entry.body
    },

    async delete(key: string): Promise<void> {
      store.delete(key)
    },

    async exists(key: string): Promise<boolean> {
      return store.has(key)
    },

    async getSignedUrl(key: string): Promise<string> {
      return `mem-signed://${key}`
    },

    async getSignedUploadUrl(key: string): Promise<string> {
      return `mem-upload://${key}`
    },

    async list(prefix: string): Promise<readonly StorageObject[]> {
      const results: StorageObject[] = []
      for (const [key, entry] of store) {
        if (key.startsWith(prefix)) {
          results.push({
            key,
            sizeBytes: entry.body.byteLength,
            lastModified: new Date(),
            etag: `"${key}"`,
          })
        }
      }
      return results
    },

    async getObjectMetadata(key: string): Promise<ObjectMetadata | null> {
      const entry = store.get(key)
      if (!entry) return null
      return {
        key,
        sizeBytes: entry.body.byteLength,
        lastModified: new Date(),
        etag: `"${key}"`,
        contentType: entry.contentType,
        metadata: entry.metadata,
      }
    },

    async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
      const entry = store.get(sourceKey)
      if (!entry) throw new Error(`Not found: ${sourceKey}`)
      store.set(destinationKey, { ...entry })
    },

    async deletePrefix(prefix: string): Promise<number> {
      let deleted = 0
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          store.delete(key)
          deleted++
        }
      }
      return deleted
    },
  }
}
