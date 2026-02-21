// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Documents (with Azure Blob Storage integration)
 * GET  /api/entities/[entityId]/documents   → list documents
 * POST /api/entities/[entityId]/documents   → upload document
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { documents } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { uploadBuffer, generateSasUrl } from '@nzila/blob'

const BLOB_CONTAINER = 'nzila-documents'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId)
  if (!guard.ok) return guard.response

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.entityId, entityId))
    .orderBy(desc(documents.createdAt))

  // Optionally generate SAS URLs for download
  const withUrls = req.nextUrl.searchParams.get('withUrls') === 'true'

  const result = rows.map((doc) => ({
    ...doc,
    downloadUrl: withUrls
      ? generateSasUrl(doc.blobContainer, doc.blobPath, 60)
      : undefined,
  }))

  return NextResponse.json(result)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!guard.ok) return guard.response
  const { userId } = guard.context

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null
  const category = formData.get('category') as string | null
  const classification = formData.get('classification') as string | null
  const linkedType = formData.get('linkedType') as string | null
  const linkedId = formData.get('linkedId') as string | null

  if (!file || !title || !category) {
    return NextResponse.json(
      { error: 'file, title, and category are required' },
      { status: 400 },
    )
  }

  const validCategories = [
    'minute_book', 'filing', 'resolution', 'minutes',
    'certificate', 'year_end', 'export', 'other',
  ]
  if (!validCategories.includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${validCategories.join(', ')}` },
      { status: 400 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const blobPath = `${entityId}/${category}/${Date.now()}-${file.name}`

  const uploaded = await uploadBuffer({
    container: BLOB_CONTAINER,
    blobPath,
    buffer,
    contentType: file.type || 'application/octet-stream',
  })

  const [doc] = await db
    .insert(documents)
    .values({
      entityId,
      category: category as 'minute_book' | 'filing' | 'resolution' | 'minutes' | 'certificate' | 'year_end' | 'export' | 'other',
      title,
      blobContainer: BLOB_CONTAINER,
      blobPath: uploaded.blobPath,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: BigInt(uploaded.sizeBytes),
      sha256: uploaded.sha256,
      uploadedBy: userId,
      classification: (classification as 'public' | 'internal' | 'confidential') ?? 'internal',
      linkedType: linkedType ?? null,
      linkedId: linkedId ?? null,
    })
    .returning()

  return NextResponse.json(doc, { status: 201 })
}
