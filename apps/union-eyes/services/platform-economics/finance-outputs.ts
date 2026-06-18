/**
 * Finance Outputs Service (Layer 5)
 * 
 * Generates reproducible, period-locked financial exports:
 * - Master invoices (PDF-ready data)
 * - Allocation statements
 * - Local chargeback reports
 * - Subsidy reports
 * - GL exports (CSV/JSON)
 * - Audit evidence packs
 * 
 * All outputs are traceable to ledger entries and tagged with a run hash.
 * 
 * @domain platform-economics
 * @layer 5 — Finance Outputs
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ExportMeta {
  exportId: string;
  exportType: ExportType;
  organizationId: string;
  periodId: string;
  generatedAt: string;
  dataHash: string;
  rowCount: number;
}

export type ExportType =
  | 'master_invoice'
  | 'allocation_statement'
  | 'chargeback_report'
  | 'subsidy_report'
  | 'gl_journal_csv'
  | 'gl_trial_balance'
  | 'evidence_pack';

export interface MasterInvoiceExport {
  meta: ExportMeta;
  invoice: {
    invoiceNumber: string;
    orgName: string;
    billingPeriod: string;
    issueDate: string;
    dueDate: string;
    lineItems: Array<{
      description: string;
      quantity: string;
      unitPrice: string;
      amount: string;
      costType: string;
    }>;
    subtotal: string;
    discount: string;
    subsidy: string;
    total: string;
    currency: 'CAD';
    paymentStatus: string;
    paidAmount: string;
    balanceDue: string;
  };
}

export interface AllocationStatementExport {
  meta: ExportMeta;
  allocationRunId: string;
  method: string;
  costPool: string;
  lines: Array<{
    localId: string;
    localName: string;
    basisValue: string;
    sharePercent: string;
    allocatedAmount: string;
  }>;
  total: string;
}

export interface ChargebackReportExport {
  meta: ExportMeta;
  localId: string;
  localName: string;
  chargebacks: Array<{
    chargebackId: string;
    periodLabel: string;
    grossAmount: string;
    subsidyApplied: string;
    netAmount: string;
    status: string;
  }>;
  totalGross: string;
  totalSubsidy: string;
  totalNet: string;
}

export interface GlJournalRow {
  date: string;
  accountNumber: string;
  accountName: string;
  description: string;
  debit: string;
  credit: string;
  costCenter: string;
  reference: string;
}

export interface GlJournalExport {
  meta: ExportMeta;
  rows: GlJournalRow[];
}

export interface EvidencePack {
  meta: ExportMeta;
  sections: {
    invoices: MasterInvoiceExport[];
    allocations: AllocationStatementExport[];
    chargebacks: ChargebackReportExport[];
    glJournal: GlJournalExport;
    ledgerSummary: {
      totalEntries: number;
      totalDebitsCad: string;
      totalCreditsCad: string;
      netBalanceCad: string;
    };
  };
}

// ============================================================================
// Helpers
// ============================================================================

function computeHash(data: any): string {
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

function makeMeta(
  exportType: ExportType,
  organizationId: string,
  periodId: string,
  rowCount: number,
  data: any,
): ExportMeta {
  return {
    exportId: crypto.randomUUID(),
    exportType,
    organizationId,
    periodId,
    generatedAt: new Date().toISOString(),
    dataHash: computeHash(data),
    rowCount,
  };
}

// ============================================================================
// Master Invoice Export
// ============================================================================

export async function exportMasterInvoice(
  organizationId: string,
  invoiceId: string,
): Promise<MasterInvoiceExport> {
  const [invoice] = await db.execute(sql`
    SELECT
      pi.id, pi.invoice_number, pi.billing_period_id,
      pi.issue_date, pi.due_date, pi.subtotal_cad, pi.discount_cad,
      pi.subsidy_cad, pi.total_cad, pi.status, pi.paid_amount_cad, pi.balance_due_cad,
      bp.label AS period_label,
      o.name AS org_name
    FROM platform_invoices pi
    JOIN billing_periods bp ON bp.id = pi.billing_period_id
    JOIN organizations o ON o.id = pi.organization_id
    WHERE pi.id = ${invoiceId}
      AND pi.organization_id = ${organizationId}
  `);

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found for org ${organizationId}`);
  }

  const lineItems = await db.execute(sql`
    SELECT description, quantity, unit_price_cad, amount_cad, cost_type
    FROM platform_invoice_line_items
    WHERE invoice_id = ${invoiceId}
    ORDER BY line_number
  `);

  const rows = lineItems as any as Array<Record<string, unknown>>;

  const result: MasterInvoiceExport['invoice'] = {
    invoiceNumber: String(invoice.invoice_number),
    orgName: String(invoice.org_name),
    billingPeriod: String(invoice.period_label),
    issueDate: String(invoice.issue_date),
    dueDate: String(invoice.due_date),
    lineItems: rows.map((r) => ({
      description: String(r.description),
      quantity: String(r.quantity),
      unitPrice: String(r.unit_price_cad),
      amount: String(r.amount_cad),
      costType: String(r.cost_type),
    })),
    subtotal: String(invoice.subtotal_cad),
    discount: String(invoice.discount_cad),
    subsidy: String(invoice.subsidy_cad),
    total: String(invoice.total_cad),
    currency: 'CAD',
    paymentStatus: String(invoice.status),
    paidAmount: String(invoice.paid_amount_cad),
    balanceDue: String(invoice.balance_due_cad),
  };

  const meta = makeMeta(
    'master_invoice',
    organizationId,
    String(invoice.billing_period_id),
    rows.length,
    result,
  );

  await auditLog({
    eventType: AuditEventType.DATA_EXPORT,
    severity: AuditSeverity.MEDIUM,
    organizationId,
    resource: 'master_invoice',
    resourceId: invoiceId,
    action: 'master_invoice_exported',
    metadata: { exportId: meta.exportId, dataHash: meta.dataHash },
  });

  return { meta, invoice: result };
}

// ============================================================================
// Allocation Statement Export
// ============================================================================

export async function exportAllocationStatement(
  organizationId: string,
  allocationRunId: string,
): Promise<AllocationStatementExport> {
  const [run] = await db.execute(sql`
    SELECT
      ar.id, ar.billing_period_id, ar.method, ar.total_cost_pool_cad,
      bp.label AS period_label
    FROM allocation_runs ar
    JOIN billing_periods bp ON bp.id = ar.billing_period_id
    WHERE ar.id = ${allocationRunId}
      AND ar.organization_id = ${organizationId}
  `);

  if (!run) {
    throw new Error(`Allocation run ${allocationRunId} not found`);
  }

  const lines = await db.execute(sql`
    SELECT
      arl.local_id,
      o.name AS local_name,
      arl.basis_value,
      arl.share_percent,
      arl.allocated_amount_cad
    FROM allocation_run_lines arl
    LEFT JOIN organizations o ON o.id = arl.local_id
    WHERE arl.allocation_run_id = ${allocationRunId}
    ORDER BY arl.allocated_amount_cad DESC
  `);

  const rows = lines as any as Array<Record<string, unknown>>;

  const meta = makeMeta(
    'allocation_statement',
    organizationId,
    String(run.billing_period_id),
    rows.length,
    rows,
  );

  await auditLog({
    eventType: AuditEventType.DATA_EXPORT,
    severity: AuditSeverity.MEDIUM,
    organizationId,
    resource: 'allocation_statement',
    resourceId: allocationRunId,
    action: 'allocation_statement_exported',
    metadata: { exportId: meta.exportId, dataHash: meta.dataHash },
  });

  return {
    meta,
    allocationRunId,
    method: String(run.method),
    costPool: String(run.total_cost_pool_cad),
    lines: rows.map((r) => ({
      localId: String(r.local_id),
      localName: String(r.local_name ?? ''),
      basisValue: String(r.basis_value),
      sharePercent: String(r.share_percent),
      allocatedAmount: String(r.allocated_amount_cad),
    })),
    total: String(run.total_cost_pool_cad),
  };
}

// ============================================================================
// Chargeback Report Export
// ============================================================================

export async function exportChargebackReport(
  organizationId: string,
  localId: string,
  periodId?: string,
): Promise<ChargebackReportExport> {
  const periodFilter = periodId
    ? sql`AND cs.billing_period_id = ${periodId}`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      cs.id AS chargeback_id,
      bp.label AS period_label,
      cs.gross_amount_cad,
      cs.subsidy_applied_cad,
      cs.net_amount_cad,
      cs.status,
      o.name AS local_name
    FROM chargeback_statements cs
    JOIN billing_periods bp ON bp.id = cs.billing_period_id
    JOIN organizations o ON o.id = cs.local_id
    WHERE cs.organization_id = ${organizationId}
      AND cs.local_id = ${localId}
      ${periodFilter}
    ORDER BY bp.start_date DESC
  `);

  const data = rows as any as Array<Record<string, unknown>>;
  const localName = data.length > 0 ? String(data[0].local_name) : localId;

  let totalGrossCents = 0;
  let totalSubsidyCents = 0;
  let totalNetCents = 0;
  for (const r of data) {
    totalGrossCents += Math.round(Number(String(r.gross_amount_cad ?? '0')) * 100);
    totalSubsidyCents += Math.round(Number(String(r.subsidy_applied_cad ?? '0')) * 100);
    totalNetCents += Math.round(Number(String(r.net_amount_cad ?? '0')) * 100);
  }
  const totalGross = totalGrossCents / 100;
  const totalSubsidy = totalSubsidyCents / 100;
  const totalNet = totalNetCents / 100;

  const meta = makeMeta(
    'chargeback_report',
    organizationId,
    periodId ?? 'all',
    data.length,
    data,
  );

  await auditLog({
    eventType: AuditEventType.DATA_EXPORT,
    severity: AuditSeverity.MEDIUM,
    organizationId,
    resource: 'chargeback_report',
    resourceId: localId,
    action: 'chargeback_report_exported',
    metadata: { exportId: meta.exportId, localId },
  });

  return {
    meta,
    localId,
    localName,
    chargebacks: data.map((r) => ({
      chargebackId: String(r.chargeback_id),
      periodLabel: String(r.period_label),
      grossAmount: String(r.gross_amount_cad),
      subsidyApplied: String(r.subsidy_applied_cad),
      netAmount: String(r.net_amount_cad),
      status: String(r.status),
    })),
    totalGross: totalGross.toFixed(2),
    totalSubsidy: totalSubsidy.toFixed(2),
    totalNet: totalNet.toFixed(2),
  };
}

// ============================================================================
// GL Journal Export (CSV-ready)
// ============================================================================

export async function exportGlJournal(
  organizationId: string,
  periodId: string,
): Promise<GlJournalExport> {
  const rows = await db.execute(sql`
    SELECT
      pl.created_at AS date,
      COALESCE(ga.gl_account_number, pl.cost_type::text) AS account_number,
      COALESCE(ca.account_name, pl.cost_type::text) AS account_name,
      pl.description,
      CASE WHEN pl.amount_cad::numeric >= 0 THEN pl.amount_cad ELSE '0.00' END AS debit,
      CASE WHEN pl.amount_cad::numeric < 0 THEN ABS(pl.amount_cad::numeric)::text ELSE '0.00' END AS credit,
      COALESCE(cc.code, '') AS cost_center,
      COALESCE(pl.source_id, pl.id::text) AS reference
    FROM platform_cost_ledger_entries pl
    LEFT JOIN cost_centers cc ON cc.id = pl.cost_center_id
    LEFT JOIN gl_account_mappings ga ON ga.organization_id = pl.organization_id
      AND ga.local_account_type = pl.cost_type::text
    LEFT JOIN chart_of_accounts ca ON ca.id = ga.chart_of_accounts_id
    WHERE pl.organization_id = ${organizationId}
      AND pl.billing_period_id = ${periodId}
    ORDER BY pl.created_at ASC
  `);

  const data = rows as any as Array<Record<string, unknown>>;

  const meta = makeMeta('gl_journal_csv', organizationId, periodId, data.length, data);

  await auditLog({
    eventType: AuditEventType.DATA_EXPORT,
    severity: AuditSeverity.HIGH,
    organizationId,
    resource: 'gl_journal',
    resourceId: periodId,
    action: 'gl_journal_exported',
    metadata: { exportId: meta.exportId, dataHash: meta.dataHash, rowCount: data.length },
  });

  return {
    meta,
    rows: data.map((r) => ({
      date: String(r.date),
      accountNumber: String(r.account_number),
      accountName: String(r.account_name),
      description: String(r.description ?? ''),
      debit: String(r.debit),
      credit: String(r.credit),
      costCenter: String(r.cost_center),
      reference: String(r.reference),
    })),
  };
}

/**
 * Convert GL journal data to CSV string
 */
export function glJournalToCsv(journal: GlJournalExport): string {
  const header = 'Date,Account Number,Account Name,Description,Debit (CAD),Credit (CAD),Cost Center,Reference';
  const lines = journal.rows.map((r) =>
    [
      r.date,
      r.accountNumber,
      `"${r.accountName.replace(/"/g, '""')}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.debit,
      r.credit,
      r.costCenter,
      r.reference,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

// ============================================================================
// Evidence Pack
// ============================================================================

export async function generateEvidencePack(
  organizationId: string,
  periodId: string,
): Promise<EvidencePack> {
  // Gather all invoices for the period
  const invoiceRows = await db.execute(sql`
    SELECT id FROM platform_invoices
    WHERE organization_id = ${organizationId}
      AND billing_period_id = ${periodId}
  `);
  const invoiceIds = (invoiceRows as any as Array<{ id: string }>).map((r) => r.id);

  const invoices: MasterInvoiceExport[] = [];
  for (const id of invoiceIds) {
    invoices.push(await exportMasterInvoice(organizationId, id));
  }

  // Allocation runs
  const allocationRows = await db.execute(sql`
    SELECT id FROM allocation_runs
    WHERE organization_id = ${organizationId}
      AND billing_period_id = ${periodId}
      AND is_simulation = false
  `);
  const allocationIds = (allocationRows as any as Array<{ id: string }>).map((r) => r.id);

  const allocations: AllocationStatementExport[] = [];
  for (const id of allocationIds) {
    allocations.push(await exportAllocationStatement(organizationId, id));
  }

  // Chargebacks (all locals)
  const localRows = await db.execute(sql`
    SELECT DISTINCT local_id FROM chargeback_statements
    WHERE organization_id = ${organizationId}
      AND billing_period_id = ${periodId}
  `);
  const localIds = (localRows as any as Array<{ local_id: string }>).map((r) => r.local_id);

  const chargebacks: ChargebackReportExport[] = [];
  for (const lid of localIds) {
    chargebacks.push(await exportChargebackReport(organizationId, lid, periodId));
  }

  // GL journal
  const glJournal = await exportGlJournal(organizationId, periodId);

  // Ledger summary
  const [summary] = await db.execute(sql`
    SELECT
      COUNT(*) AS total_entries,
      COALESCE(SUM(CASE WHEN amount_cad::numeric >= 0 THEN amount_cad::numeric ELSE 0 END), 0) AS total_debits,
      COALESCE(SUM(CASE WHEN amount_cad::numeric < 0 THEN ABS(amount_cad::numeric) ELSE 0 END), 0) AS total_credits,
      COALESCE(SUM(amount_cad::numeric), 0) AS net_balance
    FROM platform_cost_ledger_entries
    WHERE organization_id = ${organizationId}
      AND billing_period_id = ${periodId}
  `);

  const totalItems = invoices.length + allocations.length + chargebacks.length + glJournal.rows.length;

  const meta = makeMeta('evidence_pack', organizationId, periodId, totalItems, {
    invoiceCount: invoices.length,
    allocationCount: allocations.length,
    chargebackCount: chargebacks.length,
    glRowCount: glJournal.rows.length,
  });

  await auditLog({
    eventType: AuditEventType.DATA_EXPORT,
    severity: AuditSeverity.CRITICAL,
    organizationId,
    resource: 'evidence_pack',
    resourceId: periodId,
    action: 'evidence_pack_generated',
    metadata: {
      exportId: meta.exportId,
      dataHash: meta.dataHash,
      invoiceCount: invoices.length,
      allocationCount: allocations.length,
      chargebackCount: chargebacks.length,
    },
  });

  return {
    meta,
    sections: {
      invoices,
      allocations,
      chargebacks,
      glJournal,
      ledgerSummary: {
        totalEntries: Number(summary?.total_entries ?? 0),
        totalDebitsCad: String(summary?.total_debits ?? '0'),
        totalCreditsCad: String(summary?.total_credits ?? '0'),
        netBalanceCad: String(summary?.net_balance ?? '0'),
      },
    },
  };
}
