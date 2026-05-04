import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { buildNarExportPack, verifyFullChain } from '@nzila/nar'
import type { NarRecord } from '@nzila/nar'

function toNarRecord(row: typeof auditRecords.$inferSelect): NarRecord {
  return {
    id: row.id,
    decisionRecordId: row.decisionRecordId,
    organizationId: row.organizationId,
    decisionType: row.decisionType,
    actionType: row.actionType,
    actorId: row.actorId,
    actorType: row.actorType as 'user' | 'system' | 'api',
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    policyId: row.policyId,
    policyVersion: row.policyVersion,
    inputHash: row.inputHash,
    outcomeHash: row.outcomeHash,
    payload: row.payload as NarRecord['payload'],
    storage: row.storageType && row.storageUri && row.immutable && row.retentionUntil
      ? {
          type: row.storageType as 'azure_blob',
          uri: row.storageUri,
          immutable: row.immutable,
          retentionUntil: row.retentionUntil.toISOString(),
        }
      : undefined,
    createdAt: row.createdAt.toISOString(),
    seal: {
      algorithm: 'sha256',
      keyId: row.keyId,
      hash: row.narHash,
      signature: row.narSignature,
      previousHash: row.previousHash ?? undefined,
      signedAt: row.createdAt.toISOString(),
    },
  }
}

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
        { ok: false, error: { code: 'ORG_SCOPE_MISMATCH', message: 'Auditor token is scoped to a different organization' } },
        { status: 403 },
      )
    }

    const filters = [eq(auditRecords.organizationId, orgId)]
    if (from) {
      filters.push(gte(auditRecords.createdAt, new Date(from)))
    }
    if (to) {
      filters.push(lte(auditRecords.createdAt, new Date(to)))
    }

    const rows = await platformDb
      .select()
      .from(auditRecords)
      .where(and(...filters))
      .orderBy(asc(auditRecords.createdAt))
      .limit(Math.min(Math.max(limit, 1), 5000))

    const records = rows.map((row) => toNarRecord(row))
    const chain = await verifyFullChain({ organizationId: orgId, records })
    const pack = await buildNarExportPack(records, orgId, {
      generatedBy: auth.role === 'auditor' ? `auditor:${auth.tokenId}` : 'control-plane',
    })

    const packWithChain = {
      ...pack,
      chainProof: {
        rootHash: chain.rootHash ?? '',
        totalRecords: chain.totalRecords,
        verified: chain.valid,
      },
    }

    if (format === 'zip') {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      zip.file('audit-pack.json', JSON.stringify(packWithChain, null, 2))
      zip.file('audit-pack.sig', `${packWithChain.verification.checksum}:${packWithChain.verification.signature}`)
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
