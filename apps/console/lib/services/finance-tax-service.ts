import { platformDb } from '@nzila/db/platform'
import {
  taxProfiles,
  taxYears,
  taxFilings,
  taxNotices,
  taxInstallments,
  indirectTaxAccounts,
  indirectTaxPeriods,
  indirectTaxSummary,
  financeGovernanceLinks,
} from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import type { AuthContext } from '@/lib/api-guards'
import type {
  CreateTaxProfileInput,
  CreateTaxYearInput,
  CreateTaxFilingInput,
  CreateTaxInstallmentInput,
  CreateTaxNoticeInput,
  CreateIndirectTaxAccountInput,
  CreateIndirectTaxPeriodInput,
  UpdateIndirectTaxSummaryInput,
  FinanceRole,
} from '@nzila/tax/types'
import {
  enforceSoD,
  validateDividendGovernanceLink,
  evaluateTaxYearCloseGate,
} from '@nzila/tax/validation'
import { evaluateFinanceGovernanceRequirements } from '@nzila/tax/governance'
import { buildTaxYearDeadlines, buildIndirectTaxDeadlines } from '@nzila/tax/deadlines'
import { recordFinanceAuditEvent, FINANCE_AUDIT_ACTIONS } from '@/lib/finance-audit'
import type {
  TaxInstallmentPatch,
  IndirectTaxPeriodPatch,
} from '@/lib/validation/finance-patch-schemas'

export async function loadTaxYear(id: string) {
  return (await platformDb.select().from(taxYears).where(eq(taxYears.id, id)).limit(1))[0]
}
export async function loadTaxInstallment(id: string) {
  return (
    await platformDb.select().from(taxInstallments).where(eq(taxInstallments.id, id)).limit(1)
  )[0]
}
export async function loadIndirectTaxPeriod(id: string) {
  return (
    await platformDb.select().from(indirectTaxPeriods).where(eq(indirectTaxPeriods.id, id)).limit(1)
  )[0]
}
export async function resolveTaxYearOrganization(
  taxYearId: string | null,
  requestedOrgId: string | null,
) {
  if (!taxYearId) return { orgId: requestedOrgId, mismatch: false }
  const year = await loadTaxYear(taxYearId)
  return {
    orgId: year?.orgId ?? null,
    mismatch: Boolean(year && requestedOrgId && requestedOrgId !== year.orgId),
  }
}

export async function listTaxProfiles(orgId: string) {
  const rows = await platformDb.select().from(taxProfiles).where(eq(taxProfiles.orgId, orgId))
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createTaxProfile(input: CreateTaxProfileInput, actor: AuthContext) {
  const [row] = await platformDb.insert(taxProfiles).values(input).returning()
  await recordFinanceAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.TAX_PROFILE_CREATE,
    targetType: 'tax_profile',
    targetId: row.id,
    afterJson: input as unknown as Record<string, unknown>,
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function listTaxYears(orgId: string) {
  const rows = await platformDb.select().from(taxYears).where(eq(taxYears.orgId, orgId))
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createTaxYear(input: CreateTaxYearInput, actor: AuthContext) {
  const [row] = await platformDb.insert(taxYears).values(input).returning()
  await recordFinanceAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.TAX_YEAR_CREATE,
    targetType: 'tax_year',
    targetId: row.id,
    afterJson: {
      fiscalYearLabel: input.fiscalYearLabel,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function listIndirectTaxAccounts(orgId: string) {
  const rows = await platformDb
    .select()
    .from(indirectTaxAccounts)
    .where(eq(indirectTaxAccounts.orgId, orgId))
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createIndirectTaxAccount(
  input: CreateIndirectTaxAccountInput,
  actor: AuthContext,
) {
  const [row] = await platformDb.insert(indirectTaxAccounts).values(input).returning()
  await recordFinanceAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_ACCOUNT_CREATE,
    targetType: 'indirect_tax_account',
    targetId: row.id,
    afterJson: {
      taxType: input.taxType,
      accountNumber: input.programAccountNumber,
    },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function listTaxFilings(taxYearId: string | null, resolvedEntityId: string) {
  const filter = taxYearId
    ? and(eq(taxFilings.taxYearId, taxYearId), eq(taxFilings.orgId, resolvedEntityId))
    : eq(taxFilings.orgId, resolvedEntityId)
  const rows = await platformDb.select().from(taxFilings).where(filter)
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createTaxFiling(input: CreateTaxFilingInput, actor: AuthContext) {
  const year = await loadTaxYear(input.taxYearId)
  if (!year || year.orgId !== input.orgId)
    return {
      status: 403 as const,
      body: { error: 'Tax year does not belong to organization' },
    }
  // ── Segregation of duties: reviewer ≠ preparer ──
  if (input.reviewedBy) {
    const actorRole = (actor.membership?.role ?? 'org_viewer') as FinanceRole
    const sodCheck = enforceSoD(actor.userId, actorRole, input.preparedBy)
    if (!sodCheck.allowed) {
      return {
        status: 403 as const,
        body: { error: sodCheck.reason },
      }
    }
    // Also enforce basic preparer ≠ reviewer
    if (input.preparedBy === input.reviewedBy) {
      return {
        status: 403 as const,
        body: {
          error: 'Segregation of duties: reviewer cannot be the same person as the preparer.',
        },
      }
    }
  }
  // ── Dividend governance link gate for T5 / RL-3 ──
  if (input.filingType === 'T5' || input.filingType === 'RL-3') {
    const links = await platformDb
      .select()
      .from(financeGovernanceLinks)
      .where(eq(financeGovernanceLinks.orgId, input.orgId))
    const linkCheck = validateDividendGovernanceLink(
      input.filingType,
      links.map((l) => ({
        governanceType: l.governanceType,
        governanceId: l.governanceId,
      })),
    )
    if (!linkCheck.valid) {
      return {
        status: 422 as const,
        body: { error: linkCheck.reason },
      }
    }
  }
  const [row] = await platformDb.insert(taxFilings).values(input).returning()
  await recordFinanceAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.TAX_FILING_UPLOAD,
    targetType: 'tax_filing',
    targetId: row.id,
    afterJson: {
      filingType: input.filingType,
      taxYearId: input.taxYearId,
      preparedBy: input.preparedBy,
      reviewedBy: input.reviewedBy,
    },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function listTaxNotices(taxYearId: string | null, resolvedEntityId: string) {
  const filter = taxYearId
    ? and(eq(taxNotices.taxYearId, taxYearId), eq(taxNotices.orgId, resolvedEntityId))
    : eq(taxNotices.orgId, resolvedEntityId)
  const rows = await platformDb.select().from(taxNotices).where(filter)
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createTaxNotice(input: CreateTaxNoticeInput, actor: AuthContext) {
  const year = await loadTaxYear(input.taxYearId)
  if (!year || year.orgId !== input.orgId)
    return {
      status: 403 as const,
      body: { error: 'Tax year does not belong to organization' },
    }
  const [row] = await platformDb.insert(taxNotices).values(input).returning()
  await recordFinanceAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.TAX_NOTICE_UPLOAD,
    targetType: 'tax_notice',
    targetId: row.id,
    afterJson: {
      noticeType: input.noticeType,
      authority: input.authority,
      taxYearId: input.taxYearId,
    },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function listTaxInstallments(taxYearId: string | null, resolvedEntityId: string) {
  const filter = taxYearId
    ? and(eq(taxInstallments.taxYearId, taxYearId), eq(taxInstallments.orgId, resolvedEntityId))
    : eq(taxInstallments.orgId, resolvedEntityId)
  const rows = await platformDb.select().from(taxInstallments).where(filter)
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createTaxInstallment(input: CreateTaxInstallmentInput, actor: AuthContext) {
  const year = await loadTaxYear(input.taxYearId)
  if (!year || year.orgId !== input.orgId)
    return {
      status: 403 as const,
      body: { error: 'Tax year does not belong to organization' },
    }
  const [row] = await platformDb.insert(taxInstallments).values(input).returning()
  await recordFinanceAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.TAX_INSTALLMENT_RECORD,
    targetType: 'tax_installment',
    targetId: row.id,
    afterJson: {
      taxYearId: input.taxYearId,
      amount: input.requiredAmount,
    },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function updateTaxInstallment(
  id: string,
  updates: Omit<TaxInstallmentPatch, 'id'>,
  existing: typeof taxInstallments.$inferSelect,
  actor: AuthContext,
) {
  const [row] = await platformDb
    .update(taxInstallments)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(
        eq(taxInstallments.id, id),
        eq(taxInstallments.orgId, existing.orgId),
        eq(taxInstallments.taxYearId, existing.taxYearId),
      ),
    )
    .returning()
  if (!row)
    return {
      status: 409 as const,
      body: { error: 'Installment no longer matches organization' },
    }
  await recordFinanceAuditEvent({
    orgId: existing.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.TAX_INSTALLMENT_RECORD,
    targetType: 'tax_installment',
    targetId: id,
    beforeJson: { status: existing.status },
    afterJson: updates as Record<string, unknown>,
  })
  return {
    status: 200 as const,
    body: row,
  }
}

export async function listFinanceGovernanceLinks(orgId: string, sourceId: string | null) {
  const conditions = sourceId
    ? and(eq(financeGovernanceLinks.orgId, orgId), eq(financeGovernanceLinks.sourceId, sourceId))
    : eq(financeGovernanceLinks.orgId, orgId)
  const rows = await platformDb.select().from(financeGovernanceLinks).where(conditions)
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createFinanceGovernanceLink(
  input: {
    orgId: string
    sourceType: string
    sourceId: string
    governanceType: string
    governanceId: string
    linkDescription?: string
  },
  actor: AuthContext,
) {
  const { orgId, sourceType, sourceId, governanceType, governanceId, linkDescription } = input
  const [row] = await platformDb
    .insert(financeGovernanceLinks)
    .values({
      orgId,
      sourceType,
      sourceId,
      governanceType,
      governanceId,
      linkDescription,
      createdBy: actor.userId,
    })
    .returning()
  await recordFinanceAuditEvent({
    orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.GOVERNANCE_LINK_CREATE,
    targetType: 'finance_governance_link',
    targetId: row.id,
    afterJson: { sourceType, sourceId, governanceType, governanceId, linkDescription },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function listIndirectTaxPeriods(orgId: string, accountId: string | null) {
  const conditions = accountId
    ? and(eq(indirectTaxPeriods.orgId, orgId), eq(indirectTaxPeriods.accountId, accountId))
    : eq(indirectTaxPeriods.orgId, orgId)
  const rows = await platformDb.select().from(indirectTaxPeriods).where(conditions)
  return {
    status: 200 as const,
    body: rows,
  }
}

export async function createIndirectTaxPeriod(
  input: CreateIndirectTaxPeriodInput,
  actor: AuthContext,
) {
  const account = (
    await platformDb
      .select()
      .from(indirectTaxAccounts)
      .where(eq(indirectTaxAccounts.id, input.accountId))
      .limit(1)
  )[0]
  if (!account || account.orgId !== input.orgId || account.taxType !== input.taxType)
    return {
      status: 403 as const,
      body: { error: 'Account does not match organization and tax type' },
    }
  const [row] = await platformDb.insert(indirectTaxPeriods).values(input).returning()
  await recordFinanceAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_CREATE,
    targetType: 'indirect_tax_period',
    targetId: row.id,
    afterJson: {
      taxType: input.taxType,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function updateIndirectTaxPeriod(
  id: string,
  updates: Omit<IndirectTaxPeriodPatch, 'id'>,
  existing: typeof indirectTaxPeriods.$inferSelect,
  actor: AuthContext,
) {
  const [row] = await platformDb
    .update(indirectTaxPeriods)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(
        eq(indirectTaxPeriods.id, id),
        eq(indirectTaxPeriods.orgId, existing.orgId),
        eq(indirectTaxPeriods.accountId, existing.accountId),
      ),
    )
    .returning()
  if (!row)
    return {
      status: 409 as const,
      body: { error: 'Period no longer matches organization' },
    }
  // Pick audit action based on status transition
  const auditAction =
    updates.status === 'filed'
      ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_FILE
      : updates.status === 'paid'
        ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_PAY
        : FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_CREATE
  await recordFinanceAuditEvent({
    orgId: existing.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: auditAction,
    targetType: 'indirect_tax_period',
    targetId: id,
    beforeJson: { status: existing.status },
    afterJson: updates as Record<string, unknown>,
  })
  return {
    status: 200 as const,
    body: row,
  }
}

export async function readIndirectTaxPeriodDetail(period: typeof indirectTaxPeriods.$inferSelect) {
  const { id: periodId } = period
  const summaryRows = await platformDb
    .select()
    .from(indirectTaxSummary)
    .where(eq(indirectTaxSummary.periodId, periodId))
  // Get account info
  const [account] = await platformDb
    .select()
    .from(indirectTaxAccounts)
    .where(
      and(
        eq(indirectTaxAccounts.id, period.accountId),
        eq(indirectTaxAccounts.orgId, period.orgId),
        eq(indirectTaxAccounts.taxType, period.taxType),
      ),
    )
  const deadlines = buildIndirectTaxDeadlines({
    orgId: period.orgId,
    taxType: period.taxType,
    filingDue: period.filingDue,
    paymentDue: period.paymentDue,
    status: period.status,
  })
  return {
    status: 200 as const,
    body: {
      period,
      summary: summaryRows[0] ?? null,
      account: account ?? null,
      deadlines,
    },
  }
}

export async function changeIndirectTaxPeriodStatus(
  periodId: string,
  body: { status?: 'open' | 'filed' | 'paid' | 'closed' },
  existing: typeof indirectTaxPeriods.$inferSelect,
  actor: AuthContext,
) {
  const [updated] = await platformDb
    .update(indirectTaxPeriods)
    .set({ ...(body.status !== undefined ? { status: body.status } : {}), updatedAt: new Date() })
    .where(
      and(
        eq(indirectTaxPeriods.id, periodId),
        eq(indirectTaxPeriods.orgId, existing.orgId),
        eq(indirectTaxPeriods.accountId, existing.accountId),
      ),
    )
    .returning()
  if (!updated)
    return {
      status: 409 as const,
      body: { error: 'Period no longer matches organization' },
    }
  const auditAction =
    body.status === 'filed'
      ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_FILE
      : body.status === 'paid'
        ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_PAY
        : FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_CREATE
  await recordFinanceAuditEvent({
    orgId: existing.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: auditAction,
    targetType: 'indirect_tax_period',
    targetId: periodId,
    beforeJson: { status: existing.status },
    afterJson: body as Record<string, unknown>,
  })
  return {
    status: 200 as const,
    body: updated,
  }
}

export async function readIndirectTaxSummary(periodId: string) {
  const rows = await platformDb
    .select()
    .from(indirectTaxSummary)
    .where(eq(indirectTaxSummary.periodId, periodId))
  return {
    status: 200 as const,
    body: rows[0] ?? null,
  }
}

export async function upsertIndirectTaxSummary(
  input: UpdateIndirectTaxSummaryInput,
  period: typeof indirectTaxPeriods.$inferSelect,
  actor: AuthContext,
) {
  // Upsert: check if summary already exists for this period
  const existing = await platformDb
    .select()
    .from(indirectTaxSummary)
    .where(eq(indirectTaxSummary.periodId, input.periodId))
  let row
  if (existing.length > 0) {
    const { periodId, ...updates } = input
    ;[row] = await platformDb
      .update(indirectTaxSummary)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(indirectTaxSummary.periodId, periodId))
      .returning()
  } else {
    ;[row] = await platformDb.insert(indirectTaxSummary).values(input).returning()
  }
  await recordFinanceAuditEvent({
    orgId: period.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_SUMMARY_UPDATE,
    targetType: 'indirect_tax_summary',
    targetId: row.id,
    beforeJson: existing[0] ? (existing[0] as unknown as Record<string, unknown>) : undefined,
    afterJson: input as unknown as Record<string, unknown>,
  })
  return {
    status: existing.length > 0 ? 200 : 201,
    body: row,
  }
}

export async function readTaxYearDetail(taxYear: typeof taxYears.$inferSelect) {
  const taxYearId = taxYear.id
  // Fetch related data for close gate evaluation
  const [filings, notices, installments, indirectPrds, profiles] = await Promise.all([
    platformDb
      .select()
      .from(taxFilings)
      .where(and(eq(taxFilings.taxYearId, taxYearId), eq(taxFilings.orgId, taxYear.orgId))),
    platformDb
      .select()
      .from(taxNotices)
      .where(and(eq(taxNotices.taxYearId, taxYearId), eq(taxNotices.orgId, taxYear.orgId))),
    platformDb
      .select()
      .from(taxInstallments)
      .where(
        and(eq(taxInstallments.taxYearId, taxYearId), eq(taxInstallments.orgId, taxYear.orgId)),
      ),
    platformDb.select().from(indirectTaxPeriods).where(eq(indirectTaxPeriods.orgId, taxYear.orgId)),
    platformDb.select().from(taxProfiles).where(eq(taxProfiles.orgId, taxYear.orgId)),
  ])
  const profile = profiles[0]
  const province = profile?.provinceOfRegistration ?? null
  const closeGate = evaluateTaxYearCloseGate({
    province,
    filings: filings.map((f) => ({
      filingType: f.filingType,
      documentId: f.documentId,
      sha256: f.sha256,
    })),
    indirectPeriods: indirectPrds.map((p) => ({
      status: p.status,
      taxType: p.taxType,
    })),
    notices: notices.map((n) => ({
      noticeType: n.noticeType,
      documentId: n.documentId,
    })),
  })
  const deadlines = buildTaxYearDeadlines({
    id: taxYear.id,
    orgId: taxYear.orgId,
    fiscalYearLabel: taxYear.fiscalYearLabel,
    federalFilingDeadline: taxYear.federalFilingDeadline,
    federalPaymentDeadline: taxYear.federalPaymentDeadline,
    provincialFilingDeadline: taxYear.provincialFilingDeadline,
    provincialPaymentDeadline: taxYear.provincialPaymentDeadline,
  })
  return {
    status: 200 as const,
    body: {
      taxYear,
      filings,
      notices,
      installments,
      closeGate,
      deadlines,
      profile,
    },
  }
}

export async function changeTaxYearStatus(
  taxYearId: string,
  newStatus: 'open' | 'filed' | 'assessed' | 'closed',
  existing: typeof taxYears.$inferSelect,
  actor: AuthContext,
) {
  // ── Governance gate: enforce close requirements ──────────────────────────
  if (newStatus === 'closed') {
    // 1. Tax year close gate (T2, CO-17, indirect filed, etc.)
    const [filings, notices, indirectPrds, profiles, links] = await Promise.all([
      platformDb
        .select()
        .from(taxFilings)
        .where(and(eq(taxFilings.taxYearId, taxYearId), eq(taxFilings.orgId, existing.orgId))),
      platformDb
        .select()
        .from(taxNotices)
        .where(and(eq(taxNotices.taxYearId, taxYearId), eq(taxNotices.orgId, existing.orgId))),
      platformDb
        .select()
        .from(indirectTaxPeriods)
        .where(eq(indirectTaxPeriods.orgId, existing.orgId)),
      platformDb.select().from(taxProfiles).where(eq(taxProfiles.orgId, existing.orgId)),
      platformDb
        .select()
        .from(financeGovernanceLinks)
        .where(eq(financeGovernanceLinks.orgId, existing.orgId)),
    ])
    const profile = profiles[0]
    const province = profile?.provinceOfRegistration ?? null
    const closeGate = evaluateTaxYearCloseGate({
      province,
      filings: filings.map((f) => ({
        filingType: f.filingType,
        documentId: f.documentId,
        sha256: f.sha256,
      })),
      indirectPeriods: indirectPrds.map((p) => ({
        status: p.status,
        taxType: p.taxType,
      })),
      notices: notices.map((n) => ({
        noticeType: n.noticeType,
        documentId: n.documentId,
      })),
    })
    if (!closeGate.canClose) {
      return {
        status: 422 as const,
        body: {
          error: 'Tax year close gate not satisfied.',
          blockers: closeGate.blockers,
          warnings: closeGate.warnings,
        },
      }
    }
    // 2. Finance governance requirements (FS approval resolution, etc.)
    const hasFsApproval = links.some(
      (l) =>
        l.governanceType === 'resolution' &&
        l.linkDescription?.toLowerCase().includes('financial statement'),
    )
    const hasDividendResolution = links.some(
      (l) =>
        l.governanceType === 'resolution' && l.linkDescription?.toLowerCase().includes('dividend'),
    )
    const dividendFilings = filings.filter((f) => f.filingType === 'T5' || f.filingType === 'RL-3')
    const govReqs = evaluateFinanceGovernanceRequirements({
      province,
      hasFsApprovalResolution: hasFsApproval,
      hasDividendResolution,
      dividendsDeclared: dividendFilings.length > 0,
      borrowingAmount: 0, // Borrowing check deferred to explicit flow
      borrowingThreshold: Infinity,
      hasBorrowingGovernanceLink: true,
    })
    if (govReqs.blockers.length > 0) {
      return {
        status: 422 as const,
        body: {
          error: 'Finance governance requirements not met.',
          blockers: govReqs.blockers,
          warnings: govReqs.warnings,
        },
      }
    }
  }
  const previousStatus = existing.status
  const [updated] = await platformDb
    .update(taxYears)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(taxYears.id, taxYearId), eq(taxYears.orgId, existing.orgId)))
    .returning()
  if (!updated)
    return {
      status: 409 as const,
      body: { error: 'Tax year no longer matches organization' },
    }
  // Audit event
  const auditAction =
    newStatus === 'closed'
      ? FINANCE_AUDIT_ACTIONS.TAX_YEAR_CLOSE
      : FINANCE_AUDIT_ACTIONS.TAX_YEAR_CREATE // 'open' transition

  await recordFinanceAuditEvent({
    orgId: existing.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: auditAction,
    targetType: 'tax_year',
    targetId: taxYearId,
    beforeJson: { status: previousStatus },
    afterJson: { status: newStatus },
  })
  return {
    status: 200 as const,
    body: updated,
  }
}
