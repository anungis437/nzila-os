/**
 * @nzila/blob — Azure Blob Storage utilities
 *
 * Upload/download documents, generate SAS URLs, compute SHA-256.
 */
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  ContainerClient,
} from '@azure/storage-blob'
import { createHash } from 'node:crypto'

// ── Config ──────────────────────────────────────────────────────────────────

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

let _service: BlobServiceClient | null = null
let _credential: StorageSharedKeyCredential | null = null

function getCredential(): StorageSharedKeyCredential {
  if (!_credential) {
    _credential = new StorageSharedKeyCredential(
      requiredEnv('AZURE_STORAGE_ACCOUNT_NAME'),
      requiredEnv('AZURE_STORAGE_ACCOUNT_KEY'),
    )
  }
  return _credential
}

function getService(): BlobServiceClient {
  if (!_service) {
    const cred = getCredential()
    _service = new BlobServiceClient(
      `https://${requiredEnv('AZURE_STORAGE_ACCOUNT_NAME')}.blob.core.windows.net`,
      cred,
    )
  }
  return _service
}

// ── Public helpers ──────────────────────────────────────────────────────────

export function container(name: string): ContainerClient {
  return getService().getContainerClient(name)
}

/** Upload a buffer and return { blobPath, sha256, sizeBytes }. */
export async function uploadBuffer(opts: {
  container: string
  blobPath: string
  buffer: Buffer
  contentType: string
}): Promise<{ blobPath: string; sha256: string; sizeBytes: number }> {
  const sha256 = computeSha256(opts.buffer)
  const client = container(opts.container).getBlockBlobClient(opts.blobPath)
  await client.uploadData(opts.buffer, {
    blobHTTPHeaders: { blobContentType: opts.contentType },
  })
  return { blobPath: opts.blobPath, sha256, sizeBytes: opts.buffer.length }
}

/** Download blob to a Buffer. */
export async function downloadBuffer(containerName: string, blobPath: string): Promise<Buffer> {
  const client = container(containerName).getBlockBlobClient(blobPath)
  return client.downloadToBuffer()
}

/** Generate a SAS URL valid for `expiresInMinutes` (default 60). */
export function generateSasUrl(
  containerName: string,
  blobPath: string,
  expiresInMinutes = 60,
): string {
  const cred = getCredential()
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60_000)
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    },
    cred,
  ).toString()

  return `https://${requiredEnv('AZURE_STORAGE_ACCOUNT_NAME')}.blob.core.windows.net/${containerName}/${blobPath}?${sas}`
}

/** Compute SHA-256 hex digest of a buffer. */
export function computeSha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}
