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
import { resolveOrgContext, CfoScopeError } from '@/lib/resolve-org'
import { recordUploadedDocument } from '@/lib/services/workspace-records'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

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

        return await resolveOrgContext(
          'organization',
          {
            permission: 'documents:upload',
            organizationId:
              typeof formData.get('orgId') === 'string' ? String(formData.get('orgId')) : undefined,
          },
          async (context) => {
            const name = z
              .string()
              .trim()
              .min(1)
              .parse(formData.get('name') ?? file.name)
            const type = z
              .enum(['invoice', 'receipt', 'contract', 'report', 'statement', 'other'])
              .parse(formData.get('type') ?? 'other')
            const buffer = Buffer.from(await file.arrayBuffer())
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const blobPath = `${context.organizationId}/${encodeURIComponent(context.userId)}/${randomUUID()}-${safeName}`
            const result = await uploadBuffer({
              container: CONTAINER,
              blobPath,
              buffer,
              contentType: file.type,
            })
            if (result.blobPath !== blobPath || result.sizeBytes !== file.size)
              throw new Error('Upload result does not match requested resource')
            const sasUrl = generateSasUrl(CONTAINER, result.blobPath, 60 * 24)
            const record = await recordUploadedDocument(context, {
              name,
              type,
              size: result.sizeBytes,
              url: sasUrl,
              blobPath: result.blobPath,
              sha256: result.sha256,
            })
            logger.info('Document upload recorded', {
              userId: context.userId,
              organizationId: context.organizationId,
              recordId: record.id,
            })
            return NextResponse.json({
              uploadId: record.id,
              blobPath: result.blobPath,
              sha256: result.sha256,
              sizeBytes: result.sizeBytes,
              url: sasUrl,
              fileName: file.name,
            })
          },
        )
      } catch (error) {
        if (error instanceof CfoScopeError)
          return NextResponse.json(
            { error: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 403 },
          )
        if (error instanceof z.ZodError)
          return NextResponse.json({ error: 'Invalid upload metadata' }, { status: 400 })
        logger.error('File upload failed', { error })
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
    }),
  )
}
