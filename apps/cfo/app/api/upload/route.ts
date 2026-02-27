/**
 * CFO — File upload API route.
 *
 * Accepts multipart/form-data, uploads the file to Azure Blob Storage
 * via @nzila/blob, and returns the blob path + SAS URL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { uploadBuffer, generateSasUrl } from '@nzila/blob'
import { logger } from '@/lib/logger'

const CONTAINER = 'cfo-documents'
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.ms-excel', // xls
  'text/plain',
])

export async function POST(request: NextRequest) {
  return withRequestContext(request, () =>
    withSpan('api.upload', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
            { status: 400 },
          )
        }

        if (!ALLOWED_TYPES.has(file.type)) {
          return NextResponse.json(
            { error: `File type "${file.type}" not allowed.` },
            { status: 400 },
          )
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Build a unique blob path: userId/timestamp-originalFilename
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const blobPath = `${auth.userId}/${timestamp}-${safeName}`

        const result = await uploadBuffer({
          container: CONTAINER,
          blobPath,
          buffer,
          contentType: file.type,
        })

        // Generate a 24-hour read-only SAS URL
        const sasUrl = generateSasUrl(CONTAINER, result.blobPath, 60 * 24)

        logger.info('File uploaded to blob storage', {
          userId: auth.userId,
          blobPath: result.blobPath,
          sha256: result.sha256,
          sizeBytes: result.sizeBytes,
        })

        return NextResponse.json({
          blobPath: result.blobPath,
          sha256: result.sha256,
          sizeBytes: result.sizeBytes,
          url: sasUrl,
          fileName: file.name,
        })
      } catch (error) {
        logger.error('File upload failed', { error })
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
    }),
  )
}
