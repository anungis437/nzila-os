/**
 * API — Procurement Proof Center
 * GET  /api/proof-center  — fetch proof sections & overall score (real collectors)
 * POST /api/proof-center  — trigger full pack collection + signing
 */
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'
import { createLogger } from '@nzila/os-core'
import { z } from 'zod'
import {
  collectProcurementPack,
  signProcurementPack,
  exportAsJson,
  createRealPorts,
} from '@nzila/platform-procurement-proof'
import { createPortDeps } from '@/lib/proof-center-ports'

const logger = createLogger('api:proof-center')

/** POST body schema — trigger params (all optional) */
const PostBodySchema = z.object({
  /** When true, include RFP answers alongside the pack */
  includeRfp: z.boolean().default(false),
}).default({})

export async function GET(_req: NextRequest) {
  try {
    const auth = await authenticateUser()
    if (!auth.ok) return auth.response

    // Wire real collectors
    const portDeps = createPortDeps(auth.userId)
    const ports = createRealPorts(portDeps)
    const pack = await collectProcurementPack(auth.userId, auth.userId, ports)

    const sec = pack.sections.security
    const dl = pack.sections.dataLifecycle
    const ops = pack.sections.operational
    const gov = pack.sections.governance
    const sov = pack.sections.sovereignty

    const secScore = sec.vulnerabilitySummary.score
    const dlScore = dl.retentionControls.policiesEnforced === dl.retentionControls.policiesTotal ? 100 : 80
    const opsScore = ops.sloCompliance.overall >= 99 ? 95 : 80
    const govScore = gov.snapshotChainValid ? 95 : 60
    const sovScore = sov.validated ? 100 : 50

    const overallScore = Math.round((secScore + dlScore + opsScore + govScore + sovScore) / 5)
    const gradeOf = (s: number) => s >= 90 ? 'A' as const : s >= 80 ? 'B' as const : s >= 70 ? 'C' as const : s >= 60 ? 'D' as const : 'F' as const

    const result = {
      orgId: pack.orgId,
      generatedAt: pack.generatedAt,
      sections: {
        security: { score: secScore, grade: gradeOf(secScore), status: secScore > 0 ? 'ok' : 'not_available' },
        dataLifecycle: { score: dlScore, grade: gradeOf(dlScore), status: 'ok' },
        operational: { score: opsScore, grade: gradeOf(opsScore), status: 'ok' },
        governance: { score: govScore, grade: gradeOf(govScore), status: gov.snapshotChainLength > 0 ? 'ok' : 'not_available' },
        sovereignty: { score: sovScore, grade: gradeOf(sovScore), status: 'ok' },
      },
      overallScore,
      overallGrade: gradeOf(overallScore),
    }

    return NextResponse.json(result)
  } catch (err) {
    logger.error('[Proof Center GET Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest) {
  try {
    const auth = await authenticateUser()
    if (!auth.ok) return auth.response

    const body = await _req.json().catch(() => ({}))
    const parsed = PostBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Wire real collectors → collect → sign → export
    const portDeps = createPortDeps(auth.userId)
    const ports = createRealPorts(portDeps)

    let pack = await collectProcurementPack(auth.userId, auth.userId, ports)
    pack = await signProcurementPack(pack, ports)
    const _exportResult = exportAsJson(pack)

    await recordAuditEvent({
      orgId: auth.userId,
      targetType: 'org',
      targetId: auth.userId,
      action: 'procurement_pack_generated',
      actorClerkUserId: auth.userId,
      afterJson: { sectionCount: 5, packId: pack.packId },
    })

    logger.info('Procurement pack generated', { userId: auth.userId, packId: pack.packId })

    return NextResponse.json({
      MANIFEST: pack.manifest,
      pack: {
        packId: pack.packId,
        orgId: pack.orgId,
        generatedAt: pack.generatedAt,
        status: pack.status,
      },
      SIGNATURE: pack.signature ?? null,
    }, { status: 201 })
  } catch (err) {
    logger.error('[Proof Center POST Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
