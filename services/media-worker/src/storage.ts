/**
 * @nzila/media-worker — Storage Abstraction
 *
 * S3-compatible storage layer supporting AWS S3 and Cloudflare R2.
 * Handles raw uploads, processed outputs, HLS segments, and artwork.
 *
 * @module @nzila/media-worker/storage
 */

// ── Storage Paths ───────────────────────────────────────────────────────────

export const STORAGE_PATHS = {
  RAW: 'audio/raw',
  PROCESSED: 'audio/processed',
  HLS: 'audio/hls',
  ARTWORK: 'artwork',
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

// ── Storage Provider Interface ──────────────────────────────────────────────

export interface StorageProvider {
  readonly name: 's3' | 'r2'

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

// ── S3 Adapter ──────────────────────────────────────────────────────────────

export function createS3StorageAdapter(config: StorageConfig): StorageProvider {
  return {
    name: 's3',

    async upload(params: UploadParams): Promise<UploadResult> {
      // In production, would use @aws-sdk/client-s3
      // For now, define the contract with validated structure
      const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.provider === 'r2',
      })

      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        Metadata: params.metadata,
        CacheControl: params.cacheControl ?? 'public, max-age=31536000, immutable',
      })

      const result = await client.send(command)
      const url = config.cdnBaseUrl
        ? `${config.cdnBaseUrl}/${params.key}`
        : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${params.key}`

      return {
        key: params.key,
        etag: result.ETag ?? '',
        sizeBytes: params.body.byteLength,
        url,
      }
    },

    async download(key: string): Promise<Uint8Array> {
      const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.provider === 'r2',
      })
      const result = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      )
      const body = await result.Body?.transformToByteArray()
      if (!body) throw new Error(`Empty body for key: ${key}`)
      return body
    },

    async delete(key: string): Promise<void> {
      const { DeleteObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.provider === 'r2',
      })
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      )
    },

    async exists(key: string): Promise<boolean> {
      const { HeadObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.provider === 'r2',
      })
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
      const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
      const { getSignedUrl: s3GetSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.provider === 'r2',
      })
      return s3GetSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      )
    },

    async getSignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
      const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
      const { getSignedUrl: s3GetSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.provider === 'r2',
      })
      return s3GetSignedUrl(
        client,
        new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType }),
        { expiresIn: expiresInSeconds },
      )
    },

    async list(prefix: string): Promise<readonly StorageObject[]> {
      const { ListObjectsV2Command, S3Client } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.provider === 'r2',
      })
      const result = await client.send(
        new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix }),
      )
      return (result.Contents ?? []).map((obj) => ({
        key: obj.Key ?? '',
        sizeBytes: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
        etag: obj.ETag ?? '',
      }))
    },
  }
}
