// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Year-End Pack
 *
 * GET  /api/finance/year-end-pack?entityId=&fiscalYear=  → completeness status
 * POST /api/finance/year-end-pack                        → build / refresh manifest
 *
 * PR5 — Entity-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import {
  taxYears,
  taxFilings,
  taxInstallments,
  taxNotices,
  taxProfiles,
  indirectTaxAccounts,
  indirectTaxPeriods,
  closePeriods,
  closeApprovals,
  financeGovernanceLinks,
} from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import {
  buildYearEndManifest,
  evaluatePackCompleteness,
  yearEndPackBasePath,
  type YearEndPackInput,
} from '@nzila/tax/evidence'
import { evaluateTaxYearCloseGate } from '@nzila/tax/validation'
import { buildTaxYearDeadlines, sortDeadlines } from '@nzila/tax/deadlines'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get('entityId')
  const fiscalYear = req.nextUrl.searchParams.get('fiscalYear')
  if (!entityId || !fiscalYear) {
    return NextResponse.json(
      { error: 'entityId and fiscalYear are required' },
      { status: 400 },
    )
  }

  const access = await requireEntityAccess(entityId)
  if (!access.ok) return access.response

  // Find the tax year
  const [taxYear] = await platformDb
    .select()
    .from(taxYears)
    .where(and(eq(taxYears.entityId, entityId), eq(taxYears.fiscalYearLabel, fiscalYear)))

  if (!taxYear) {
    return NextResponse.json(
      { error: `Tax year ${fiscalYear} not found for entity` },
      { status: 404 },
    )
  }

  // Fetch profile for province
  const [profile] = await platformDb
    .select()
    .from(taxProfiles)
    .where(eq(taxProfiles.entityId, entityId))

  const isQcEntity = profile?.provinceOfRegistration === 'QC'

  // Gather artifacts: filings, notices, installments, indirect tax, governance links
  const [filings, allNotices, installments, _indirectAccts, indirectPrds, links, periods, _approvals] =
    await Promise.all([
      platformDb.select().from(taxFilings).where(eq(taxFilings.taxYearId, taxYear.id)),
      platformDb.select().from(taxNotices).where(eq(taxNotices.taxYearId, taxYear.id)),
      platformDb.select().from(taxInstallments).where(eq(taxInstallments.taxYearId, taxYear.id)),
      platformDb.select().from(indirectTaxAccounts).where(eq(indirectTaxAccounts.entityId, entityId)),
      platformDb.select().from(indirectTaxPeriods).where(eq(indirectTaxPeriods.entityId, entityId)),
      platformDb.select().from(financeGovernanceLinks).where(eq(financeGovernanceLinks.entityId, entityId)),
      platformDb.select().from(closePeriods).where(eq(closePeriods.entityId, entityId)),
      platformDb.select().from(closeApprovals),
    ])

  // Close gate
  const closeGate = evaluateTaxYearCloseGate({
    filings,
    notices: allNotices,
    indirectPeriods: indirectPrds,
    province: profile?.provinceOfRegistration ?? 'ON',
  })

  // Build manifest input from DB data
  const findFiling = (type: string) =>
    filings.find((f) => f.filingType === type)?.documentId ?? undefined
  const findNotice = (authority: string, type: string) =>
    allNotices.find((n) => n.authority === authority && n.noticeType === type)?.documentId ??
    undefined

  // Governance links
  const fsApproval = links.find(
    (l) => l.governanceType === 'resolution' && l.linkDescription?.toLowerCase().includes('financial statement'),
  )
  const shareLedger = links.find(
    (l) => l.governanceType === 'governance_action' && l.linkDescription?.toLowerCase().includes('share ledger'),
  )
  const dividendLinks = links
    .filter(
      (l) => l.governanceType === 'resolution' && l.linkDescription?.toLowerCase().includes('dividend'),
    )
    .map((l) => l.governanceId)

  // GST/HST and QST annual summaries — check that ALL periods in FY range are filed
  const fyStart = new Date(taxYear.startDate)
  const fyEnd = new Date(taxYear.endDate)
  const gstHstPeriods = indirectPrds.filter(
    (p) =>
      (p.taxType === 'GST' || p.taxType === 'HST') &&
      new Date(p.startDate) >= fyStart &&
      new Date(p.endDate) <= fyEnd,
  )
  const qstPeriods = indirectPrds.filter(
    (p) =>
      p.taxType === 'QST' &&
      new Date(p.startDate) >= fyStart &&
      new Date(p.endDate) <= fyEnd,
  )
  const allGstHstFiled = gstHstPeriods.length > 0 && gstHstPeriods.every((p) => p.status === 'filed' || p.status === 'paid' || p.status === 'closed')
  const allQstFiled = qstPeriods.length > 0 && qstPeriods.every((p) => p.status === 'filed' || p.status === 'paid' || p.status === 'closed')

  const packInput: YearEndPackInput = {
    entityId,
    fiscalYear,
    financial: {
      // Financial artifacts come from QBO sync (documents) — reference by doc ID if available
      // For now, these will be populated when QBO integration stores the reports
      trialBalance: undefined,
      profitAndLoss: undefined,
      balanceSheet: undefined,
      glExport: undefined,
      cashFlow: undefined,
    },
    governance: {
      fsApprovalResolution: fsApproval?.governanceId,
      shareLedgerSnapshot: shareLedger?.governanceId,
      dividendResolutions: dividendLinks.length > 0 ? dividendLinks : undefined,
    },
    tax: {
      t2Filing: findFiling('T2'),
      co17Filing: findFiling('CO-17'),
      schedule50: findFiling('Schedule50'),
      installmentSummary:
        installments.length > 0
          ? `summary:${taxYear.id}:${installments.length}_installments`
          : undefined,
      noticeOfAssessment: findNotice('CRA', 'NOA'),
      gstHstAnnualSummary: allGstHstFiled ? `gst-hst:${gstHstPeriods.length}_periods` : undefined,
      qstAnnualSummary: allQstFiled ? `qst:${qstPeriods.length}_periods` : undefined,
    },
  }

  const manifest = buildYearEndManifest(packInput)
  const completeness = evaluatePackCompleteness(manifest, isQcEntity)
  const deadlines = sortDeadlines(buildTaxYearDeadlines(taxYear))
  const basePath = yearEndPackBasePath(entityId, fiscalYear)

  // Find fiscal year close period
  const yearClosePeriod = periods.find(
    (p) => p.periodType === 'year' && p.startDate === taxYear.startDate && p.endDate === taxYear.endDate,
  )

  return NextResponse.json({
    taxYear,
    profile: profile ?? null,
    manifest,
    completeness,
    closeGate,
    deadlines,
    basePath,
    yearClosePeriod: yearClosePeriod ?? null,
    artifacts: {
      filings: filings.length,
      notices: allNotices.length,
      installments: installments.length,
      indirectTaxPeriods: indirectPrds.length,
      governanceLinks: links.length,
    },
  })
}

export async function POST(req: NextRequest) {
  const YearEndPackPostSchema = z.object({
    entityId: z.string().min(1),
    fiscalYear: z.string().min(1),
  })
  const parsed = YearEndPackPostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'entityId and fiscalYear are required' },
      { status: 400 },
    )
  }
  const { entityId, fiscalYear } = parsed.data

  const access = await requireEntityAccess(entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  // Rebuild manifest via GET logic
  const url = new URL(req.url)
  url.searchParams.set('entityId', entityId)
  url.searchParams.set('fiscalYear', fiscalYear)

  const response = await GET(
    new NextRequest(url, { method: 'GET', headers: req.headers }),
  )

  // Record evidence-pack-generated audit event after successful build
  if (response.ok) {
    const data = await response.clone().json()
    await recordFinanceAuditEvent({
      entityId,
      actorClerkUserId: access.context.userId,
      actorRole: access.context.membership?.role ?? access.context.platformRole,
      action: FINANCE_AUDIT_ACTIONS.EVIDENCE_PACK_GENERATED,
      targetType: 'year_end_pack',
      targetId: `${entityId}:${fiscalYear}`,
      afterJson: {
        fiscalYear,
        completeness: data.completeness?.percentage,
        canClose: data.closeGate?.canClose,
        blockers: data.closeGate?.blockers?.length ?? 0,
      },
    })
  }

  return response
}
