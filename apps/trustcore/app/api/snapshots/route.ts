/**
 * TrustCore — Compliance Snapshot API
 *
 * POST /api/snapshots        — trigger a new snapshot (org_admin only)
 * GET  /api/snapshots        — list snapshots for the org
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { evaluateCompliance } from '@/lib/compliance/engine'
import {
  createComplianceSnapshot,
  listComplianceSnapshots,
} from '@nzila/db/queries/trustcore'

export const POST = withRequiredRole(
  ['org_admin', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    let triggeredBy = 'manual'
    try {
      const body = await request.json() as { triggeredBy?: unknown }
      if (typeof body.triggeredBy === 'string') triggeredBy = body.triggeredBy
    } catch {
      // default to manual
    }

    const evaluation = await evaluateCompliance(ctx.orgId)
    const blockingCount = evaluation.risks.filter((r) => r.blocking).length

    const snapshot = await createComplianceSnapshot({
      orgId: ctx.orgId,
      score: evaluation.score,
      confidence: evaluation.confidence,
      status: evaluation.status,
      risks: evaluation.risks as unknown as Record<string, unknown>[],
      summary: evaluation.summary as unknown as Record<string, unknown>,
      riskCount: evaluation.risks.length,
      blockingCount,
      triggeredBy,
    })

    return NextResponse.json({ success: true, data: snapshot }, { status: 201 })
  },
)

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    const snapshots = await listComplianceSnapshots(ctx.orgId)
    return NextResponse.json({ success: true, data: snapshots })
  },
)
