import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { exportAuditRecords } from '@/lib/services/audit-read-service'

export async function GET(request: NextRequest) {
  try {
    if (request.headers.has('x-api-key')) {
      await requireApiAuth(request)
    }

    const auth = await requireAuditReadAuth(request)

    const orgId = request.nextUrl.searchParams.get('orgId')
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')
    const format = (request.nextUrl.searchParams.get('format') ?? 'json').toLowerCase()
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '500')

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: { code: 'ORG_ID_REQUIRED', message: 'orgId query param is required' } },
        { status: 400 },
      )
    }

    if (auth.role === 'auditor' && auth.organizationId !== orgId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'ORG_SCOPE_MISMATCH',
            message: 'Auditor token is scoped to a different organization',
          },
        },
        { status: 403 },
      )
    }

    const packWithChain = await exportAuditRecords({
      orgId,
      from,
      to,
      limit,
      generatedBy: auth.role === 'auditor' ? `auditor:${auth.tokenId}` : 'control-plane',
    })

    if (format === 'zip') {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      zip.file('audit-pack.json', JSON.stringify(packWithChain, null, 2))
      zip.file(
        'audit-pack.sig',
        `${packWithChain.verification.checksum}:${packWithChain.verification.signature}`,
      )
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

      const zipBody = Uint8Array.from(zipBuffer)

      return new NextResponse(zipBody, {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="audit-pack-${orgId}.zip"`,
        },
      })
    }

    return NextResponse.json({ ok: true, data: packWithChain })
  } catch (error) {
    return handleAuthError(error)
  }
}
