import {
  listClosePeriods,
  createClosePeriod,
  loadClosePeriod,
  changeClosePeriodStatus,
} from '@/lib/services/finance-close-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Close Periods
 * GET   /api/finance/close?orgId=...  → list close periods
 * POST  /api/finance/close               → create close period
 * PATCH /api/finance/close               → update close period status
 *
 * PR5 — Governance enforcement:
 *  • Org-scoped auth via requireOrgAccess
 *  • Hash-chained audit events via recordFinanceAuditEvent
 *  • Close gate: all exceptions must be resolved before closing
 *  • Policy engine gate: financial-budget-gate and financial-margin-floor
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireOrgAccess, authenticateUser } from '@/lib/api-guards'

// ── Request schemas ──────────────────────────────────────────────────────────

const ClosePeriodPostSchema = z.object({
  orgId: z.string().min(1),
  periodLabel: z.string().min(1),
  periodType: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

const ClosePeriodPatchSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  orgId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  }

  const access = await requireOrgAccess(orgId)
  if (!access.ok) return access.response

  const result = await listClosePeriods(orgId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const parsed = ClosePeriodPostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { orgId } = parsed.data

  const access = await requireOrgAccess(orgId, { minRole: 'org_secretary' })
  if (!access.ok) return access.response

  const result = await createClosePeriod(parsed.data, access.context)
  return NextResponse.json(result.body, { status: result.status })
}

export async function PATCH(req: NextRequest) {
  const parsed = ClosePeriodPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { id, status } = parsed.data

  // Fetch the period to know orgId and prior status
  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const existing = await loadClosePeriod(id)

  if (!existing) {
    return NextResponse.json({ error: 'Close period not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(existing.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await changeClosePeriodStatus(id, status, existing, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
