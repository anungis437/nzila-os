// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Accounts
 * GET  /api/finance/indirect-tax/accounts?entityId=...   → list accounts
 * POST /api/finance/indirect-tax/accounts                → register account
 *
 * PR5 — Entity-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { indirectTaxAccounts } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { CreateIndirectTaxAccountInput } from '@nzila/tax/types'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get('entityId')
  if (!entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }

  const access = await requireEntityAccess(entityId)
  if (!access.ok) return access.response

  const rows = await db
    .select()
    .from(indirectTaxAccounts)
    .where(eq(indirectTaxAccounts.entityId, entityId))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateIndirectTaxAccountInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await requireEntityAccess(parsed.data.entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  const [row] = await db
    .insert(indirectTaxAccounts)
    .values(parsed.data)
    .returning()

  await recordFinanceAuditEvent({
    entityId: parsed.data.entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_ACCOUNT_CREATE,
    targetType: 'indirect_tax_account',
    targetId: row.id,
    afterJson: {
      taxType: parsed.data.taxType,
      accountNumber: parsed.data.programAccountNumber,
    },
  })

  return NextResponse.json(row, { status: 201 })
}
