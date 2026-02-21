// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Finance-Governance Links
 * GET  /api/finance/governance-links?entityId=...&sourceId=...  → list links
 * POST /api/finance/governance-links                            → create link
 *
 * PR5 — Entity-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { financeGovernanceLinks } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

const GovernanceLinkPostSchema = z.object({
  entityId: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  governanceType: z.string().min(1),
  governanceId: z.string().min(1),
  linkDescription: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get('entityId')
  const sourceId = req.nextUrl.searchParams.get('sourceId')

  if (!entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }

  const access = await requireEntityAccess(entityId)
  if (!access.ok) return access.response

  const conditions = sourceId
    ? and(eq(financeGovernanceLinks.entityId, entityId), eq(financeGovernanceLinks.sourceId, sourceId))
    : eq(financeGovernanceLinks.entityId, entityId)

  const rows = await platformDb.select().from(financeGovernanceLinks).where(conditions)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const parsed = GovernanceLinkPostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { entityId, sourceType, sourceId, governanceType, governanceId, linkDescription } = parsed.data

  const access = await requireEntityAccess(entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  const [row] = await platformDb
    .insert(financeGovernanceLinks)
    .values({
      entityId,
      sourceType,
      sourceId,
      governanceType,
      governanceId,
      linkDescription,
      createdBy: access.context.userId,
    })
    .returning()

  await recordFinanceAuditEvent({
    entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: FINANCE_AUDIT_ACTIONS.GOVERNANCE_LINK_CREATE,
    targetType: 'finance_governance_link',
    targetId: row.id,
    afterJson: { sourceType, sourceId, governanceType, governanceId, linkDescription },
  })

  return NextResponse.json(row, { status: 201 })
}
