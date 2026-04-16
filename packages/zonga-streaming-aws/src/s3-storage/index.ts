/**
 * S3 Storage — raw media upload and retrieval for Zonga assets.
 *
 * Handles presigned upload URLs, direct uploads, and object management.
 * Zonga asset metadata stays in the DB — S3 is only the storage substrate.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { S3Config } from '../types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PresignedUploadResult {
  uploadUrl: string
  storageKey: string
  expiresAt: number
  bucket: string
}

export interface S3ObjectMeta {
  storageKey: string
  bucket: string
  contentType: string
  contentLength: number
  lastModified: Date | undefined
  etag: string | undefined
}

export interface UploadToS3Input {
  orgId: string
  assetId: string
  fileName: string
  contentType: string
  body: Buffer | Uint8Array | ReadableStream
}

// ── Client Factory ──────────────────────────────────────────────────────────

function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            ...(config.sessionToken ? { sessionToken: config.sessionToken } : {}),
          },
        }
      : {}),
  })
}

// ── Storage Key Generation ──────────────────────────────────────────────────

/**
 * Deterministic storage key for raw uploads.
 * Pattern: raw/{orgId}/{assetId}/{fileName}
 */
export function computeRawStorageKey(orgId: string, assetId: string, fileName: string): string {
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.\.+/g, '_')
  return `raw/${orgId}/${assetId}/${sanitized}`
}

/**
 * Storage key for processed output variants.
 * Pattern: processed/{orgId}/{assetId}/{quality}/{filename}
 */
export function computeOutputStorageKey(
  orgId: string,
  assetId: string,
  quality: string,
  fileName: string,
): string {
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.\.+/g, '_')
  return `processed/${orgId}/${assetId}/${quality}/${sanitized}`
}

// ── Presigned Upload ────────────────────────────────────────────────────────

/**
 * Generate a presigned PUT URL for client-side upload.
 * The URL is valid for the specified TTL (default 15 minutes).
 */
export async function createPresignedUpload(
  config: S3Config,
  input: {
    orgId: string
    assetId: string
    fileName: string
    contentType: string
    maxSizeBytes?: number
    ttlSec?: number
  },
): Promise<PresignedUploadResult> {
  const client = createS3Client(config)
  const storageKey = computeRawStorageKey(input.orgId, input.assetId, input.fileName)
  const ttl = input.ttlSec ?? 900

  const command = new PutObjectCommand({
    Bucket: config.rawBucket,
    Key: storageKey,
    ContentType: input.contentType,
    ...(input.maxSizeBytes ? { ContentLength: input.maxSizeBytes } : {}),
    Metadata: {
      'zonga-org-id': input.orgId,
      'zonga-asset-id': input.assetId,
    },
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: ttl })

  return {
    uploadUrl,
    storageKey,
    expiresAt: Math.floor(Date.now() / 1000) + ttl,
    bucket: config.rawBucket,
  }
}

// ── Direct Upload ───────────────────────────────────────────────────────────

/**
 * Upload media directly to S3 (server-side upload path).
 */
export async function uploadToS3(
  config: S3Config,
  input: UploadToS3Input,
): Promise<{ storageKey: string; bucket: string; etag: string | undefined }> {
  const client = createS3Client(config)
  const storageKey = computeRawStorageKey(input.orgId, input.assetId, input.fileName)

  const params: PutObjectCommandInput = {
    Bucket: config.rawBucket,
    Key: storageKey,
    Body: input.body as PutObjectCommandInput['Body'],
    ContentType: input.contentType,
    Metadata: {
      'zonga-org-id': input.orgId,
      'zonga-asset-id': input.assetId,
    },
  }

  const result = await client.send(new PutObjectCommand(params))

  return {
    storageKey,
    bucket: config.rawBucket,
    etag: result.ETag,
  }
}

// ── Object Info ─────────────────────────────────────────────────────────────

/**
 * Get object metadata from S3 without downloading the body.
 */
export async function getObjectMeta(
  config: S3Config,
  bucket: string,
  storageKey: string,
): Promise<S3ObjectMeta> {
  const client = createS3Client(config)
  const resp = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }))

  return {
    storageKey,
    bucket,
    contentType: resp.ContentType ?? 'application/octet-stream',
    contentLength: resp.ContentLength ?? 0,
    lastModified: resp.LastModified,
    etag: resp.ETag,
  }
}

// ── Presigned Download ──────────────────────────────────────────────────────

/**
 * Generate a presigned GET URL for direct S3 download (fallback / admin path).
 */
export async function createPresignedDownload(
  config: S3Config,
  bucket: string,
  storageKey: string,
  ttlSec: number = 3600,
): Promise<string> {
  const client = createS3Client(config)
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    { expiresIn: ttlSec },
  )
}

// ── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete an object from S3.
 */
export async function deleteFromS3(
  config: S3Config,
  bucket: string,
  storageKey: string,
): Promise<void> {
  const client = createS3Client(config)
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }))
}
