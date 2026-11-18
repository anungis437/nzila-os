import { readYearEndPack, buildAndAuditYearEndPack } from '@/lib/services/year-end-pack-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Year-End Pack
 *
 * GET  /api/finance/year-end-pack?orgId=&fiscalYear=  → completeness status
 * POST /api/finance/year-end-pack                        → build / refresh manifest
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireOrgAccess } from '@/lib/api-guards'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  const fiscalYear = req.nextUrl.searchParams.get('fiscalYear')
  if (!orgId || !fiscalYear) {
    return NextResponse.json({ error: 'orgId and fiscalYear are required' }, { status: 400 })
  }

  const access = await requireOrgAccess(orgId)
  if (!access.ok) return access.response

  const result = await readYearEndPack(orgId, fiscalYear)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const YearEndPackPostSchema = z.object({
    orgId: z.string().min(1),
    fiscalYear: z.string().min(1),
  })
  const parsed = YearEndPackPostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'orgId and fiscalYear are required' }, { status: 400 })
  }
  const { orgId, fiscalYear } = parsed.data

  const access = await requireOrgAccess(orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  // Preserve the original second, fresh member check performed by the GET operation.
  const readAccess = await requireOrgAccess(orgId)
  if (!readAccess.ok) return readAccess.response
  const result = await buildAndAuditYearEndPack(orgId, fiscalYear, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
