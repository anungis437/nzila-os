// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Tax Filings
 * GET  /api/finance/tax/filings?taxYearId=...   → list filings for a tax year
 * POST /api/finance/tax/filings                 → record a new filing
 *
 * PR5 — Governance enforcement:
 *  • Entity-scoped auth
 *  • Full enforceSoD with role awareness
 *  • Dividend governance link gate for T5/RL-3
 *  • Hash-chained audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { taxFilings, taxYears, financeGovernanceLinks } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { CreateTaxFilingInput } from '@nzila/tax/types'
import { enforceSoD, validateDividendGovernanceLink } from '@nzila/tax/validation'
import type { FinanceRole } from '@nzila/tax/types'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

export async function GET(req: NextRequest) {
  const taxYearId = req.nextUrl.searchParams.get('taxYearId')
  const entityId = req.nextUrl.searchParams.get('entityId')

  if (!taxYearId && !entityId) {
    return NextResponse.json({ error: 'taxYearId or entityId required' }, { status: 400 })
  }

  // For entity-scoped access, we need entityId. If only taxYearId, resolve entity.
  let resolvedEntityId = entityId
  if (!resolvedEntityId && taxYearId) {
    const [ty] = await platformDb.select().from(taxYears).where(eq(taxYears.id, taxYearId))
    resolvedEntityId = ty?.entityId ?? null
  }

  if (!resolvedEntityId) {
    return NextResponse.json({ error: 'Could not resolve entity' }, { status: 400 })
  }

  const access = await requireEntityAccess(resolvedEntityId)
  if (!access.ok) return access.response

  const filter = taxYearId
    ? eq(taxFilings.taxYearId, taxYearId)
    : eq(taxFilings.entityId, resolvedEntityId)

  const rows = await platformDb.select().from(taxFilings).where(filter)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateTaxFilingInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await requireEntityAccess(parsed.data.entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  // ── Segregation of duties: reviewer ≠ preparer ──
  if (parsed.data.reviewedBy) {
    const actorRole = (access.context.membership?.role ?? 'entity_viewer') as FinanceRole
    const sodCheck = enforceSoD(
      access.context.userId,
      actorRole,
      parsed.data.preparedBy,
    )
    if (!sodCheck.allowed) {
      return NextResponse.json(
        { error: sodCheck.reason },
        { status: 403 },
      )
    }

    // Also enforce basic preparer ≠ reviewer
    if (parsed.data.preparedBy === parsed.data.reviewedBy) {
      return NextResponse.json(
        { error: 'Segregation of duties: reviewer cannot be the same person as the preparer.' },
        { status: 403 },
      )
    }
  }

  // ── Dividend governance link gate for T5 / RL-3 ──
  if (parsed.data.filingType === 'T5' || parsed.data.filingType === 'RL-3') {
    const links = await platformDb
      .select()
      .from(financeGovernanceLinks)
      .where(eq(financeGovernanceLinks.entityId, parsed.data.entityId))

    const linkCheck = validateDividendGovernanceLink(
      parsed.data.filingType,
      links.map((l) => ({
        governanceType: l.governanceType,
        governanceId: l.governanceId,
      })),
    )

    if (!linkCheck.valid) {
      return NextResponse.json(
        { error: linkCheck.reason },
        { status: 422 },
      )
    }
  }

  const [row] = await platformDb.insert(taxFilings).values(parsed.data).returning()

  await recordFinanceAuditEvent({
    entityId: parsed.data.entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: FINANCE_AUDIT_ACTIONS.TAX_FILING_UPLOAD,
    targetType: 'tax_filing',
    targetId: row.id,
    afterJson: {
      filingType: parsed.data.filingType,
      taxYearId: parsed.data.taxYearId,
      preparedBy: parsed.data.preparedBy,
      reviewedBy: parsed.data.reviewedBy,
    },
  })

  return NextResponse.json(row, { status: 201 })
}
