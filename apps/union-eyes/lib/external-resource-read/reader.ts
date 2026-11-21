/** Canonical external reads never open the represented organization's tenant
 * context. The private database reader checks the representative's own live
 * canonical session and an exact protected qualification on every invocation. */
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { BlobTooLargeError, readBlobBounded } from '@/lib/blob-client'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'

export const EXTERNAL_READ_MAX_BYTES = 50 * 1024 * 1024
export type ExternalReadOperation = 'matter' | 'documents' | 'document' | 'download'
export interface ExternalReadResource { organizationId: string; matterType: string; matterId: string; documentId?: string }

const uuid = z.string().uuid(), digest = z.string().regex(/^[a-f0-9]{64}$/)
const nullableText = z.string().nullable()
const matter = z.object({ id: uuid, caseNumber: nullableText, title: nullableText, status: nullableText,
  step: nullableText, filedDate: nullableText, responseDeadline: nullableText, summary: z.null() }).strict()
const document = z.object({ id: uuid, title: nullableText, filename: nullableText, documentType: nullableText,
  mimeType: nullableText, privacyLabel: z.string(), uploadedAt: nullableText, createdAt: nullableText }).strict()
const listedDocument = document.extend({ canDownload: z.boolean() }).strict()
const locatedDownload = z.object({ qualificationId: uuid, qualificationHash: digest, documentId: uuid, versionId: uuid,
  versionNo: z.number().int().min(1), storageKey: z.string().min(1).max(2000), storageKeySha256: digest,
  checksumSha256: digest, sizeBytes: z.number().int().min(0).max(EXTERNAL_READ_MAX_BYTES),
  filename: nullableText, mimeType: nullableText }).strict()
type Download = z.infer<typeof locatedDownload>

function attachmentName(raw: string | null): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? ''
  return base.replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, 200) || 'document'
}

async function invoke(resource: ExternalReadResource, operation: string, expectedHash: string | null = null,
  receipt: { qualificationId: string; documentId: string; versionId: string; versionNo: number; checksumSha256: string; sizeBytes: number } | null = null) {
  // No explicit target-org context: the canonical transaction stays bound to
  // the authenticated representative's own organization. The fixed RPC is the
  // only bridge to the exact separately qualified external resource.
  return withRLSContext(async tx => {
    const rows = await tx.execute<{ payload: unknown }>(sql`
      SELECT payload FROM public.ue_external_resource_read_v1(
        ${resource.organizationId}::uuid,${resource.matterId}::uuid,${resource.documentId ?? null}::uuid,
        ${operation}::text,${expectedHash}::text,${receipt ? JSON.stringify(receipt) : null}::jsonb)
    `)
    const row = rows[0]
    if (rows.length !== 1 || !row || row.payload == null) throw new ExternalReadDenied()
    return row.payload
  })
}

class ExternalReadDenied extends Error {}
function unauthenticated(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ('code' in error && error.code === 'UNAUTHENTICATED') return true
  return 'cause' in error ? unauthenticated((error as { cause?: unknown }).cause) : false
}
function denied(error: unknown): boolean {
  if (error instanceof ExternalReadDenied) return true
  if (!error || typeof error !== 'object') return false
  // The driver wraps the database's refusal (EXTERNAL_READ_DENIED, SQLSTATE 42501) in a query error whose cause carries the code:
  // that refusal is a 403, never a 503 "unavailable".
  const cause = 'cause' in error ? (error as { cause?: unknown }).cause : null
  if (cause && typeof cause === 'object' && 'code' in cause && denied(cause)) return true
  const code = 'code' in error ? error.code : null
  return code === '42501' || code === 'MEMBERSHIP_REQUIRED' || code === 'ROLE_REQUIRED' || code === 'ACTOR_MISMATCH'
    || code === 'UNAUTHENTICATED' || code === 'SESSION_AUTHORITY_REQUIRED'
}

/** A response is constructed only after the reader/audit transaction commits.
 * Downloads fetch bounded bytes between transactions and then revalidate the
 * exact qualification, version and digest before the final audit commit. */
export async function readCanonicalExternalResource(operation: ExternalReadOperation, resource: ExternalReadResource): Promise<Response> {
  if (!uuid.safeParse(resource.organizationId).success || !uuid.safeParse(resource.matterId).success
    || resource.matterType !== 'grievance' || (resource.documentId !== undefined && !uuid.safeParse(resource.documentId).success)
    || ((operation === 'document' || operation === 'download') && !resource.documentId))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    if (operation === 'matter') return NextResponse.json({ data: matter.parse(await invoke(resource, 'matter')) })
    if (operation === 'documents') return NextResponse.json({ data: z.array(listedDocument).parse(await invoke(resource, 'documents')) })
    if (operation === 'document') return NextResponse.json({ data: document.parse(await invoke(resource, 'document')) })

    const located: Download = locatedDownload.parse(await invoke(resource, 'locate_download'))
    if (located.documentId !== resource.documentId
      || createHash('sha256').update(located.storageKey).digest('hex') !== located.storageKeySha256)
      throw new ExternalReadDenied()
    const bytes = await readBlobBounded(located.storageKey, EXTERNAL_READ_MAX_BYTES)
    const checksum = createHash('sha256').update(bytes).digest('hex')
    if (bytes.length !== located.sizeBytes || checksum !== located.checksumSha256) {
      logger.error('external_read_bytes_integrity_failed')
      return NextResponse.json({ error: 'Download is unavailable' }, { status: 503 })
    }
    const receipt = { qualificationId: located.qualificationId, documentId: located.documentId,
      versionId: located.versionId, versionNo: located.versionNo, checksumSha256: checksum, sizeBytes: bytes.length }
    const finalized = z.object({ released: z.literal(true), qualificationId: uuid, qualificationHash: digest }).strict()
      .parse(await invoke(resource, 'finalize_download', located.qualificationHash, receipt))
    if (finalized.qualificationId !== located.qualificationId || finalized.qualificationHash !== located.qualificationHash)
      throw new ExternalReadDenied()
    return new Response(new Uint8Array(bytes), { status: 200, headers: {
      'Content-Type': located.mimeType || 'application/octet-stream', 'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachmentName(located.filename))}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    if (error instanceof BlobTooLargeError) return NextResponse.json({ error: 'This file is too large to download here' }, { status: 413 })
    // No authenticated session at all is not a refusal of an identified subject: 401, as every other route answers it.
    if (unauthenticated(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (denied(error)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // Error objects may contain bound credentials or storage references. Report
    // only a fixed event and release no projection or bytes on any failure.
    logger.error('external_read_failed_closed')
    return NextResponse.json({ error: 'External resource is unavailable' }, { status: 503 })
  }
}
