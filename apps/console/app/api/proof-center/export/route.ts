/**
 * API — Procurement Pack Export
 * POST /api/proof-center/export — export signed zip procurement pack
 *
 * Returns a real zip file containing:
 *   MANIFEST.json, procurement-pack.json, signatures.json, verification.json,
 *   and per-section JSON files under sections/.
 *
 * The pack is Ed25519-signed. Uses real port-based collectors.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'
import { resolveActiveOrgId } from '@/lib/org-context'
import { createLogger } from '@nzila/os-core'
import {
  collectProcurementPack,
  signProcurementPack,
  exportAsSignedZip,
  exportAsJson,
  createRealPorts,
} from '@nzila/platform-procurement-proof'
import { createPortDeps } from '@/lib/proof-center-ports'

const logger = createLogger('api:proof-center:export')

const ExportRequestSchema = z.object({
  format: z.enum(['json', 'zip']).default('zip'),
  includeRfp: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateUser()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const parsed = ExportRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const orgId = await resolveActiveOrgId(auth.userId)
    if (!orgId) {
      return NextResponse.json({ error: 'Forbidden: no active organization' }, { status: 403 })
    }

    // Wire real collectors via ports
    const portDeps = createPortDeps(orgId)
    const ports = createRealPorts(portDeps)

    // Collect + sign using real port chain
    let pack = await collectProcurementPack(orgId, auth.userId, ports)
    pack = await signProcurementPack(pack, ports)

    if (parsed.data.format === 'json') {
      const result = exportAsJson(pack)

      await recordAuditEvent({
        orgId,
        targetType: 'org',
        targetId: orgId,
        action: 'procurement_pack_exported',
        actorClerkUserId: auth.userId,
        afterJson: { format: 'json', sectionCount: 5 },
      })

      logger.info('Procurement pack exported (JSON)', { userId: auth.userId, orgId })

      return new NextResponse(result.data, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${result.filename}"`,
        },
      })
    }

    // Default: signed ZIP export
    const result = exportAsSignedZip(pack, orgId)

    await recordAuditEvent({
      orgId,
      targetType: 'org',
      targetId: orgId,
      action: 'procurement_pack_exported',
      actorClerkUserId: auth.userId,
      afterJson: {
        format: 'zip',
        sectionCount: 5,
        keyId: result.signature.keyId,
        algorithm: 'Ed25519',
        filename: result.filename,
      },
    })

    logger.info('Procurement pack exported (ZIP)', {
      userId: auth.userId,
      orgId,
      filename: result.filename,
      keyId: result.signature.keyId,
    })

    return new NextResponse(Buffer.from(result.zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Pack-Id': result.packId,
        'X-Signature-Key-Id': result.signature.keyId,
        'X-Signature-Algorithm': 'Ed25519',
      },
    })
  } catch (err) {
    logger.error('[Proof Center Export Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
