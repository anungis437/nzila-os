/**
 * Blob storage bridge — Union-Eyes.
 *
 * Provides Vercel-Blob-compatible wrappers over @nzila/blob (Azure Blob Storage).
 * All Union-Eyes blob operations route through this module so the rest of the app
 * doesn't need to know about the underlying provider.
 */
import {
  uploadBuffer,
  downloadBuffer,
  generateSasUrl,
  computeSha256,
  container,
} from '@nzila/blob'
import crypto from 'node:crypto'
import { assertBufferSafeForUpload, type MalwareScanResult } from '@/lib/security/clamav'

export { uploadBuffer, downloadBuffer, generateSasUrl, computeSha256, container }

/** Default container for Union-Eyes documents */
const UE_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes'

/** Result shape compatible with Vercel Blob SDK `put()` return value */
export interface PutBlobResult {
  url: string
  pathname: string
  contentType: string
  sha256: string
  sizeBytes: number
  malwareScan: MalwareScanResult
}

/**
 * Upload a file or buffer to blob storage.
 * Drop-in replacement for Vercel Blob SDK `put()`.
 *
 * @param path — blob path (e.g. `grievances/{id}/{filename}`)
 * @param data — File, Blob, or Buffer
 * @param opts — contentType, addRandomSuffix
 */
export async function putBlob(
  path: string,
  data: File | Blob | Buffer,
  opts?: { contentType?: string; addRandomSuffix?: boolean },
): Promise<PutBlobResult> {
  let buffer: Buffer
  let contentType = opts?.contentType ?? 'application/octet-stream'

  if (Buffer.isBuffer(data)) {
    buffer = data
  } else {
    // File or Blob — convert to Buffer
    const arrayBuf = await (data as Blob).arrayBuffer()
    buffer = Buffer.from(arrayBuf)
    if ('type' in data && data.type) {
      contentType = data.type
    }
  }

  // Add random suffix like the Vercel Blob SDK does
  let blobPath = path
  if (opts?.addRandomSuffix) {
    const suffix = crypto.randomBytes(8).toString('hex')
    const dotIndex = path.lastIndexOf('.')
    if (dotIndex > 0) {
      blobPath = `${path.slice(0, dotIndex)}-${suffix}${path.slice(dotIndex)}`
    } else {
      blobPath = `${path}-${suffix}`
    }
  }

  const malwareScan = await assertBufferSafeForUpload(buffer, path)

  const result = await uploadBuffer({
    container: UE_CONTAINER,
    blobPath,
    buffer,
    contentType,
  })

  const url = await generateSasUrl(UE_CONTAINER, result.blobPath)

  return {
    url,
    pathname: result.blobPath,
    contentType,
    sha256: result.sha256,
    sizeBytes: result.sizeBytes,
    malwareScan,
  }
}

/**
 * Delete a blob by path or URL.
 * Replacement for Vercel Blob SDK `del()`.
 * Accepts a plain blob path **or** a full SAS / HTTPS URL (extracts the path).
 */
export async function deleteBlob(pathOrUrl: string): Promise<void> {
  let blobPath = pathOrUrl

  // If it looks like a URL, extract the blob path from it
  if (pathOrUrl.startsWith('http')) {
    try {
      const parsed = new URL(pathOrUrl)
      // Azure blob URL format: /<container>/<blobPath>
      const segments = parsed.pathname.split('/').filter(Boolean)
      if (segments.length > 1) {
        // Drop the container name (first segment)
        blobPath = segments.slice(1).join('/')
      }
    } catch {
      // Not a valid URL — treat as plain path
    }
  }

  const client = container(UE_CONTAINER)
  const blockBlob = client.getBlockBlobClient(blobPath)
  await blockBlob.deleteIfExists()
}
