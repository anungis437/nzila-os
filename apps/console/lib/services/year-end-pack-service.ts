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
  financeGovernanceLinks,
} from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  buildYearEndManifest,
  evaluatePackCompleteness,
  yearEndPackBasePath,
  type YearEndPackInput,
} from '@nzila/tax/evidence'
import { evaluateTaxYearCloseGate } from '@nzila/tax/validation'
import { buildTaxYearDeadlines, sortDeadlines } from '@nzila/tax/deadlines'
import { calculateCorporateDeadlines } from '@nzila/tax/cra-deadlines'
import { recordFinanceAuditEvent, FINANCE_AUDIT_ACTIONS } from '@/lib/finance-audit'
import type { AuthContext } from '@/lib/api-guards'
export async function readYearEndPack(orgId: string, fiscalYear: string) {
  // Find the tax year
  const [taxYear] = await platformDb
    .select()
    .from(taxYears)
    .where(and(eq(taxYears.orgId, orgId), eq(taxYears.fiscalYearLabel, fiscalYear)))
  if (!taxYear) {
    return {
      status: 404 as const,
      body: { error: `Tax year ${fiscalYear} not found for entity` },
    }
  }
  // Fetch profile for province
  const [profile] = await platformDb.select().from(taxProfiles).where(eq(taxProfiles.orgId, orgId))
  const isQcEntity = profile?.provinceOfRegistration === 'QC'
  // Gather artifacts: filings, notices, installments, indirect tax, governance links
  const [filings, allNotices, installments, _indirectAccts, indirectPrds, links, periods] =
    await Promise.all([
      platformDb
        .select()
        .from(taxFilings)
        .where(and(eq(taxFilings.taxYearId, taxYear.id), eq(taxFilings.orgId, orgId))),
      platformDb
        .select()
        .from(taxNotices)
        .where(and(eq(taxNotices.taxYearId, taxYear.id), eq(taxNotices.orgId, orgId))),
      platformDb
        .select()
        .from(taxInstallments)
        .where(and(eq(taxInstallments.taxYearId, taxYear.id), eq(taxInstallments.orgId, orgId))),
      platformDb.select().from(indirectTaxAccounts).where(eq(indirectTaxAccounts.orgId, orgId)),
      platformDb.select().from(indirectTaxPeriods).where(eq(indirectTaxPeriods.orgId, orgId)),
      platformDb
        .select()
        .from(financeGovernanceLinks)
        .where(eq(financeGovernanceLinks.orgId, orgId)),
      platformDb.select().from(closePeriods).where(eq(closePeriods.orgId, orgId)),
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
    (l) =>
      l.governanceType === 'resolution' &&
      l.linkDescription?.toLowerCase().includes('financial statement'),
  )
  const shareLedger = links.find(
    (l) =>
      l.governanceType === 'governance_action' &&
      l.linkDescription?.toLowerCase().includes('share ledger'),
  )
  const dividendLinks = links
    .filter(
      (l) =>
        l.governanceType === 'resolution' && l.linkDescription?.toLowerCase().includes('dividend'),
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
    (p) => p.taxType === 'QST' && new Date(p.startDate) >= fyStart && new Date(p.endDate) <= fyEnd,
  )
  const allGstHstFiled =
    gstHstPeriods.length > 0 &&
    gstHstPeriods.every((p) => p.status === 'filed' || p.status === 'paid' || p.status === 'closed')
  const allQstFiled =
    qstPeriods.length > 0 &&
    qstPeriods.every((p) => p.status === 'filed' || p.status === 'paid' || p.status === 'closed')
  const packInput: YearEndPackInput = {
    orgId,
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
  const basePath = yearEndPackBasePath(orgId, fiscalYear)
  // Auto-calculated CRA statutory deadlines from the entity's FYE + province
  const fye = profile?.fiscalYearEnd ?? '12-31'
  const province = (profile?.provinceOfRegistration ?? 'ON') as import('@nzila/tax').Province
  const fyYear = parseInt(fiscalYear.replace(/\D/g, ''), 10) || new Date().getFullYear()
  const craDeadlines = calculateCorporateDeadlines(fye, fyYear, province, { isCcpc: true })
  // Find fiscal year close period
  const yearClosePeriod = periods.find(
    (p) =>
      p.periodType === 'year' && p.startDate === taxYear.startDate && p.endDate === taxYear.endDate,
  )
  return {
    status: 200 as const,
    body: {
      taxYear,
      profile: profile ?? null,
      manifest,
      completeness,
      closeGate,
      deadlines,
      craDeadlines,
      basePath,
      yearClosePeriod: yearClosePeriod ?? null,
      artifacts: {
        filings: filings.length,
        notices: allNotices.length,
        installments: installments.length,
        indirectTaxPeriods: indirectPrds.length,
        governanceLinks: links.length,
      },
    },
  }
}

export async function buildAndAuditYearEndPack(
  orgId: string,
  fiscalYear: string,
  actor: AuthContext,
) {
  const result = await readYearEndPack(orgId, fiscalYear)
  if (result.status === 200) {
    const data = result.body
    await recordFinanceAuditEvent({
      orgId,
      actorClerkUserId: actor.userId,
      actorRole: actor.membership?.role ?? actor.platformRole,
      action: FINANCE_AUDIT_ACTIONS.EVIDENCE_PACK_GENERATED,
      targetType: 'year_end_pack',
      targetId: orgId + ':' + fiscalYear,
      afterJson: {
        fiscalYear,
        completeness: data.completeness?.percentage,
        canClose: data.closeGate?.canClose,
        blockers: data.closeGate?.blockers?.length ?? 0,
      },
    })
  }
  return result
}
