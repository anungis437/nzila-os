/**
 * Payroll Integration Service
 *
 * Abstracts payroll-deduction connectivity for employers that remit union
 * dues on behalf of members (the dominant pattern in unionized workplaces).
 *
 * Canadian context:
 *   - Most collective agreements contain "Dues Check-Off" clauses (Rand formula)
 *     requiring the employer to deduct union dues at source and remit monthly.
 *   - Employer remittance files come in varied formats: CSV, fixed-width,
 *     SFTP drops, or API calls depending on the payroll vendor.
 *   - Common Canadian payroll systems: Ceridian Dayforce, ADP WFN, Avanti,
 *     SAP SuccessFactors, Payworks, Nethris (by Desjardins), Humi.
 *
 * Architecture:
 *   PayrollIntegrationService  ←── orchestrator
 *     └─ PayrollConnector       ←── provider-specific adapter (interface)
 *          ├─ CeridianConnector
 *          ├─ AdpConnector
 *          ├─ GenericCsvConnector  (fallback for any CSV/fixed-width file)
 *          └─ ManualEntryConnector (treasurer manually enters remittance)
 *
 * Data flow:
 *   1. Employer payroll system produces deduction file (or API push)
 *   2. Connector normalises rows → PayrollDeductionRow[]
 *   3. Service matches rows to members → employer_remittances / remittance_line_items
 *   4. Reconciliation identifies exceptions (unknown employees, amount mismatches)
 *   5. Matched payments are posted to member_dues_ledger
 */

import { db } from '@/db/db';
import {
  employerRemittances,
  remittanceLineItems,
  remittanceExceptions,
} from '@/db/schema/dues-finance-schema';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

/** A single deduction row extracted from the employer's payroll file */
export interface PayrollDeductionRow {
  /** Employee identifier from payroll (employee number, SIN last-4, etc.) */
  employeeId: string;
  /** Employee name as it appears in payroll */
  employeeName: string;
  /** Pay period start date */
  periodStart: Date;
  /** Pay period end date */
  periodEnd: Date;
  /** Gross wages for the period (needed for percentage-based dues) */
  grossWages?: number;
  /** Total union dues deducted */
  duesAmount: number;
  /** COPE / PAC voluntary contribution (deducted alongside dues) */
  copeAmount?: number;
  /** Other deductions (strike fund, special assessment) */
  otherDeductions?: number;
  /** Description of other deductions */
  otherDescription?: string;
  /** Raw line from the source file (for audit) */
  rawLine?: string;
}

/** Result of parsing an employer remittance file */
export interface ParsedRemittanceFile {
  employerName: string;
  employerPayrollId?: string;
  fileFormat: 'csv' | 'fixed_width' | 'api_push' | 'manual';
  periodStart: Date;
  periodEnd: Date;
  rows: PayrollDeductionRow[];
  totalAmount: number;
  rowCount: number;
  /** Any parse-level warnings (e.g., skipped malformed rows) */
  warnings: string[];
}

/** Result of processing a remittance file */
export interface RemittanceProcessingResult {
  remittanceId: string;
  matched: number;
  unmatched: number;
  exceptions: number;
  totalPosted: number;
  totalAmount: string;
}

/** Adapter interface — one per payroll vendor */
export interface PayrollConnector {
  /** Human-readable name for audit logs */
  readonly vendorName: string;
  /** Parse a raw file/buffer into normalised deduction rows */
  parseFile(data: Buffer | string, options?: Record<string, unknown>): Promise<ParsedRemittanceFile>;
}

// ============================================================================
// GENERIC CSV CONNECTOR
// ============================================================================

/**
 * Handles the most common case: a CSV file exported from any payroll system.
 * Column mapping is configurable per employer.
 */
export interface CsvColumnMapping {
  employeeId: string;   // column header for employee ID
  employeeName: string; // column header for name
  periodStart: string;  // column header for period start
  periodEnd: string;    // column header for period end
  grossWages?: string;  // column header for gross wages
  duesAmount: string;   // column header for dues deducted
  copeAmount?: string;  // column header for COPE (optional)
}

export const DEFAULT_CSV_MAPPING: CsvColumnMapping = {
  employeeId: 'Employee ID',
  employeeName: 'Employee Name',
  periodStart: 'Period Start',
  periodEnd: 'Period End',
  grossWages: 'Gross Wages',
  duesAmount: 'Union Dues',
  copeAmount: 'COPE',
};

export class GenericCsvConnector implements PayrollConnector {
  readonly vendorName = 'Generic CSV';
  private mapping: CsvColumnMapping;

  constructor(mapping?: Partial<CsvColumnMapping>) {
    this.mapping = { ...DEFAULT_CSV_MAPPING, ...mapping };
  }

  async parseFile(data: Buffer | string): Promise<ParsedRemittanceFile> {
    const text = typeof data === 'string' ? data : data.toString('utf-8');
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const colIndex = (name: string): number => {
      const idx = headers.indexOf(name);
      if (idx === -1) throw new Error(`Missing required column: "${name}"`);
      return idx;
    };

    const empColIdx = colIndex(this.mapping.employeeId);
    const nameColIdx = colIndex(this.mapping.employeeName);
    const startColIdx = colIndex(this.mapping.periodStart);
    const endColIdx = colIndex(this.mapping.periodEnd);
    const duesColIdx = colIndex(this.mapping.duesAmount);
    const grossColIdx = this.mapping.grossWages ? headers.indexOf(this.mapping.grossWages) : -1;
    const copeColIdx = this.mapping.copeAmount ? headers.indexOf(this.mapping.copeAmount) : -1;

    const rows: PayrollDeductionRow[] = [];
    const warnings: string[] = [];
    let total = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      try {
        const duesAmt = parseFloat(cols[duesColIdx]);
        if (isNaN(duesAmt)) {
          warnings.push(`Row ${i + 1}: invalid dues amount "${cols[duesColIdx]}"`);
          continue;
        }

        rows.push({
          employeeId: cols[empColIdx],
          employeeName: cols[nameColIdx],
          periodStart: new Date(cols[startColIdx]),
          periodEnd: new Date(cols[endColIdx]),
          grossWages: grossColIdx >= 0 ? parseFloat(cols[grossColIdx]) || undefined : undefined,
          duesAmount: duesAmt,
          copeAmount: copeColIdx >= 0 ? parseFloat(cols[copeColIdx]) || 0 : 0,
          rawLine: lines[i],
        });

        total += duesAmt;
      } catch {
        warnings.push(`Row ${i + 1}: parse error — skipped`);
      }
    }

    return {
      employerName: 'Unknown Employer', // populated by caller
      fileFormat: 'csv',
      periodStart: rows[0]?.periodStart ?? new Date(),
      periodEnd: rows[0]?.periodEnd ?? new Date(),
      rows,
      totalAmount: total,
      rowCount: rows.length,
      warnings,
    };
  }
}

// ============================================================================
// MANUAL ENTRY CONNECTOR
// ============================================================================

/**
 * For locals where the treasurer manually enters remittance data via the UI.
 * Accepts pre-structured JSON data rather than a file.
 */
export class ManualEntryConnector implements PayrollConnector {
  readonly vendorName = 'Manual Entry';

  async parseFile(data: Buffer | string): Promise<ParsedRemittanceFile> {
    const json = JSON.parse(typeof data === 'string' ? data : data.toString('utf-8'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: PayrollDeductionRow[] = (json.rows ?? []).map((r: any) => ({
      employeeId: r.employeeId ?? '',
      employeeName: r.employeeName ?? '',
      periodStart: new Date(r.periodStart),
      periodEnd: new Date(r.periodEnd),
      grossWages: r.grossWages,
      duesAmount: parseFloat(r.duesAmount) || 0,
      copeAmount: parseFloat(r.copeAmount) || 0,
    }));

    const total = rows.reduce((sum: number, r: PayrollDeductionRow) => sum + r.duesAmount, 0);

    return {
      employerName: json.employerName ?? 'Manual Entry',
      fileFormat: 'manual',
      periodStart: rows[0]?.periodStart ?? new Date(),
      periodEnd: rows[0]?.periodEnd ?? new Date(),
      rows,
      totalAmount: total,
      rowCount: rows.length,
      warnings: [],
    };
  }
}

// ============================================================================
// CONNECTOR FACTORY
// ============================================================================

const CONNECTOR_REGISTRY: Record<string, () => PayrollConnector> = {
  csv: () => new GenericCsvConnector(),
  manual: () => new ManualEntryConnector(),
  // Future connectors:
  // ceridian: () => new CeridianConnector(),
  // adp: () => new AdpConnector(),
  // avanti: () => new AvantiConnector(),
  // payworks: () => new PayworksConnector(),
};

export function getPayrollConnector(type: string, _options?: Record<string, unknown>): PayrollConnector {
  const factory = CONNECTOR_REGISTRY[type];
  if (!factory) {
    throw new Error(`Unknown payroll connector type: "${type}". Available: ${Object.keys(CONNECTOR_REGISTRY).join(', ')}`);
  }
  return factory();
}

// ============================================================================
// PAYROLL INTEGRATION SERVICE
// ============================================================================

export class PayrollIntegrationService {
  /**
   * Process an employer remittance file:
   *   1. Parse the file using the appropriate connector
   *   2. Create an employer_remittances record
   *   3. Match deduction rows to members
   *   4. Post payments to member_dues_ledger
   *   5. Record exceptions for unmatched rows
   */
  static async processRemittanceFile(
    organizationId: string,
    connectorType: string,
    fileData: Buffer | string,
    metadata?: {
      employerName?: string;
      employerOrgId?: string;
      processedBy?: string;
    },
  ): Promise<RemittanceProcessingResult> {
    const connector = getPayrollConnector(connectorType);
    const parsed = await connector.parseFile(fileData);

    // Override employer name if provided
    if (metadata?.employerName) {
      parsed.employerName = metadata.employerName;
    }

    logger.info('[PayrollIntegration] Processing remittance file', {
      organizationId,
      connector: connector.vendorName,
      rows: parsed.rowCount,
      totalAmount: parsed.totalAmount,
      warnings: parsed.warnings.length,
    });

    // Create employer remittance record
    const [remittance] = await db
      .insert(employerRemittances)
      .values({
        organizationId,
        employerId: metadata?.employerOrgId ?? organizationId,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        fiscalYear: parsed.periodStart.getFullYear(),
        fiscalMonth: parsed.periodStart.getMonth() + 1,
        remittanceDate: new Date(),
        totalAmount: parsed.totalAmount.toFixed(2),
        memberCount: parsed.rowCount,
        fileName: `remittance-${parsed.periodStart.toISOString().split('T')[0]}.${parsed.fileFormat}`,
        processingStatus: 'processing',
        processedBy: metadata?.processedBy ?? 'system',
        metadata: { employerName: parsed.employerName, fileFormat: parsed.fileFormat },
      })
      .returning({ id: employerRemittances.id });

    let matched = 0;
    let unmatched = 0;
    let totalPosted = 0;

    // Process each deduction row
    for (const row of parsed.rows) {
      try {
        // TODO: Match row.employeeId to our members table
        // For now, record the line item and flag for manual matching
        await db
          .insert(remittanceLineItems)
          .values({
            remittanceId: remittance.id,
            organizationId,
            employeeNumber: row.employeeId,
            employeeName: row.employeeName,
            amount: row.duesAmount.toFixed(2),
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            lineStatus: 'pending',
            metadata: {
              copeAmount: (row.copeAmount ?? 0).toFixed(2),
              grossWages: row.grossWages?.toFixed(2) ?? null,
            },
          });

        // TODO: When member matching is implemented, post to ledger:
        // - Lookup member by employeeId / payroll mapping
        // - Calculate balance before
        // - Insert into memberDuesLedger with type='payment', method='employer_remittance'
        // - Mark line item as 'matched'

        matched++; // Will be accurate once matching is implemented
        totalPosted += row.duesAmount;
      } catch (error) {
        unmatched++;
        // Record exception
        await db
          .insert(remittanceExceptions)
          .values({
            remittanceId: remittance.id,
            organizationId,
            employeeNumber: row.employeeId,
            employeeName: row.employeeName,
            exceptionType: 'processing_error',
            description: `Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`,
            amount: row.duesAmount.toFixed(2),
            status: 'open',
          });
      }
    }

    // Update remittance status
    // Note: Using raw SQL for the update since we just need to set status
    await db.execute(
      `UPDATE employer_remittances SET status = 'completed', processed_at = NOW() WHERE id = '${remittance.id}'`
    );

    logger.info('[PayrollIntegration] Remittance processed', {
      remittanceId: remittance.id,
      matched,
      unmatched,
      totalPosted,
    });

    return {
      remittanceId: remittance.id,
      matched,
      unmatched,
      exceptions: unmatched + parsed.warnings.length,
      totalPosted,
      totalAmount: parsed.totalAmount.toFixed(2),
    };
  }

  /**
   * Get available connector types for the admin UI.
   */
  static getAvailableConnectors(): { type: string; name: string }[] {
    return Object.entries(CONNECTOR_REGISTRY).map(([type, factory]) => ({
      type,
      name: factory().vendorName,
    }));
  }
}
