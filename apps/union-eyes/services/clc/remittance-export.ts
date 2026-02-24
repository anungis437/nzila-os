/**
 * CLC Remittance File Export System
 * 
 * Generates per-capita remittance files in multiple formats:
 * - CSV: For manual upload to CLC finance portal
 * - XML/EDI: For automated API integration
 * - StatCan LAB-05302: For Statistics Canada labour reporting
 * 
 * Formats comply with:
 * - CLC Financial Reporting Standards
 * - StatCan Labour Organization Survey (LOS) requirements
 * - EDI X12 810 Invoice standard (where applicable)
 * 
 * @module services/clc/remittance-export
 */

import { db } from '@/db/db';
import { organizations, perCapitaRemittances } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { generateRemittanceExcel } from '@/lib/utils/excel-generator';

/**
 * Export format options
 */
export type RemittanceExportFormat = 'csv' | 'xml' | 'edi' | 'statcan' | 'excel';

/**
 * Export file metadata
 */
export interface ExportFile {
  filename: string;
  format: RemittanceExportFormat;
  content: string | Buffer;
  mimeType: string;
  size: number;
  checksum: string;
  generatedAt: Date;
  recordCount: number;
  totalAmount: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  format: RemittanceExportFormat;
  remittanceIds?: string[];
  parentOrgId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  includeHeaders?: boolean;
  encoding?: string;
  delimiter?: string;
  statcanProgram?: 'LOS' | 'LAB-05302';
}

/**
 * Remittance record for export
 */
interface RemittanceExportRecord {
  id: string;
  fromOrgId: string;
  fromOrgName: string;
  fromOrgCode: string;
  toOrgId: string;
  toOrgName: string;
  toOrgCode: string;
  periodStart: Date;
  periodEnd: Date;
  remittableMembers: number;
  perCapitaRate: string;
  totalAmount: string;
  status: string;
  dueDate: Date;
  paidDate?: Date;
  clcAccountCode?: string;
  glAccount?: string;
  notes?: string;
}

/**
 * Remittance File Export Service
 */
export class RemittanceExportService {
  
  /**
   * Export remittances to specified format
   * 
   * @param options - Export configuration
   * @returns ExportFile with content and metadata
   * 
   * @example
   * ```typescript
   * const exporter = new RemittanceExportService();
   * const file = await exporter.exportRemittances({
   *   format: 'csv',
   *   parentOrgId: 'clc-root-id',
   *   periodStart: new Date('2025-12-01'),
   *   periodEnd: new Date('2025-12-31'),
   * });
   * ```
   */
  async exportRemittances(options: ExportOptions): Promise<ExportFile> {
    logger.info('Starting remittance export', {
      format: options.format,
      parentOrgId: options.parentOrgId,
      remittanceCount: options.remittanceIds?.length,
    });

    // Fetch remittance data
    const records = await this.fetchRemittanceData(options);

    if (records.length === 0) {
      throw new Error('No remittances found for export');
    }

    // Generate file content based on format
    let content: string | Buffer;
    let mimeType: string;
    let extension: string;

    switch (options.format) {
      case 'csv':
        content = this.generateCSV(records, options);
        mimeType = 'text/csv';
        extension = 'csv';
        break;

      case 'xml':
        content = this.generateXML(records, options);
        mimeType = 'application/xml';
        extension = 'xml';
        break;

      case 'edi':
        content = this.generateEDI(records, options);
        mimeType = 'application/edi-x12';
        extension = 'edi';
        break;

      case 'statcan':
        content = this.generateStatCan(records, options);
        mimeType = 'text/csv';
        extension = 'csv';
        break;

      case 'excel':
        content = await this.generateExcel(records, options);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Calculate metadata
    const totalAmount = records.reduce(
      (sum, r) => sum + parseFloat(r.totalAmount),
      0
    ).toFixed(2);

    const checksum = this.calculateChecksum(content);
    const generatedAt = new Date();
    const filename = this.generateFilename(options, extension, generatedAt);

    const exportFile: ExportFile = {
      filename,
      format: options.format,
      content,
      mimeType,
      size: Buffer.byteLength(content),
      checksum,
      generatedAt,
      recordCount: records.length,
      totalAmount,
    };

    logger.info('Remittance export completed', {
      filename,
      format: options.format,
      recordCount: records.length,
      totalAmount,
      size: exportFile.size,
    });

    return exportFile;
  }

  /**
   * Fetch remittance data from database
   */
  private async fetchRemittanceData(
    options: ExportOptions
  ): Promise<RemittanceExportRecord[]> {
    
    // Build query conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];

    if (options.remittanceIds && options.remittanceIds.length > 0) {
      conditions.push(inArray(perCapitaRemittances.id, options.remittanceIds));
    }

    if (options.parentOrgId) {
      conditions.push(eq(perCapitaRemittances.toOrganizationId, options.parentOrgId));
    }

    if (options.periodStart) {
      conditions.push(sql`${perCapitaRemittances.dueDate} >= ${options.periodStart.toISOString().split('T')[0]}`);
    }

    if (options.periodEnd) {
      conditions.push(sql`${perCapitaRemittances.dueDate} <= ${options.periodEnd.toISOString().split('T')[0]}`);
    }

    // Fetch with organization details
    const results = await db
      .select({
        remittance: perCapitaRemittances,
        fromOrg: {
          id: organizations.id,
          name: organizations.name,
          code: organizations.charterNumber,
        },
      })
      .from(perCapitaRemittances)
      .innerJoin(
        organizations,
        eq(perCapitaRemittances.fromOrganizationId, organizations.id)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(organizations.name, perCapitaRemittances.remittanceYear, perCapitaRemittances.remittanceMonth);

    // Fetch parent org details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentOrgs = new Map<string, any>();
    for (const result of results) {
      const parentId = result.remittance.toOrganizationId;
      if (parentId && !parentOrgs.has(parentId)) {
        const [parent] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, parentId))
          .limit(1);
        if (parent) {
          parentOrgs.set(parentId, parent);
        }
      }
    }

    // Map to export records
    return results.map(result => {
      const parent = parentOrgs.get(result.remittance.toOrganizationId);
      
      // Calculate period from remittanceYear and remittanceMonth
      const periodStart = new Date(result.remittance.remittanceYear, result.remittance.remittanceMonth - 1, 1);
      const periodEnd = new Date(result.remittance.remittanceYear, result.remittance.remittanceMonth, 0);
      
      return {
        id: result.remittance.id,
        fromOrgId: result.fromOrg.id,
        fromOrgName: result.fromOrg.name || 'Unknown',
        fromOrgCode: result.fromOrg.code || '',
        toOrgId: result.remittance.toOrganizationId,
        toOrgName: parent?.name || 'Unknown',
        toOrgCode: parent?.charterNumber || '',
        periodStart,
        periodEnd,
        remittableMembers: result.remittance.remittableMembers || 0,
        perCapitaRate: result.remittance.perCapitaRate || '0.00',
        totalAmount: result.remittance.totalAmount || '0.00',
        status: result.remittance.status || 'pending',
        dueDate: new Date(result.remittance.dueDate),
        paidDate: result.remittance.paidDate ? new Date(result.remittance.paidDate) : undefined,
        clcAccountCode: result.remittance.clcAccountCode || undefined,
        glAccount: result.remittance.glAccount || undefined,
        notes: result.remittance.notes || undefined,
      };
    });
  }

  /**
   * Generate CSV format
   * 
   * Standard CSV format for CLC finance portal upload
   */
  private generateCSV(
    records: RemittanceExportRecord[],
    options: ExportOptions
  ): string {
    const delimiter = options.delimiter || ',';
    const includeHeaders = options.includeHeaders !== false;

    const lines: string[] = [];

    // CSV Headers
    if (includeHeaders) {
      lines.push([
        'Remittance ID',
        'From Organization Code',
        'From Organization Name',
        'To Organization Code',
        'To Organization Name',
        'Period Start',
        'Period End',
        'Remittable Members',
        'Per-Capita Rate',
        'Total Amount',
        'Status',
        'Due Date',
        'Paid Date',
        'CLC Account Code',
        'GL Account',
        'Notes',
      ].join(delimiter));
    }

    // CSV Rows
    for (const record of records) {
      lines.push([
        this.csvEscape(record.id),
        this.csvEscape(record.fromOrgCode),
        this.csvEscape(record.fromOrgName),
        this.csvEscape(record.toOrgCode),
        this.csvEscape(record.toOrgName),
        this.formatDate(record.periodStart),
        this.formatDate(record.periodEnd),
        record.remittableMembers.toString(),
        record.perCapitaRate,
        record.totalAmount,
        this.csvEscape(record.status),
        this.formatDate(record.dueDate),
        record.paidDate ? this.formatDate(record.paidDate) : '',
        this.csvEscape(record.clcAccountCode || ''),
        this.csvEscape(record.glAccount || ''),
        this.csvEscape(record.notes || ''),
      ].join(delimiter));
    }

    return lines.join('\n');
  }

  /**
   * Generate XML format
   * 
   * XML format for automated API integration
   */
  private generateXML(
    records: RemittanceExportRecord[],
    _options: ExportOptions
  ): string {
    const xml: string[] = [];

    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push('<PerCapitaRemittances>');
    xml.push(`  <GeneratedAt>${new Date().toISOString()}</GeneratedAt>`);
    xml.push(`  <RecordCount>${records.length}</RecordCount>`);
    xml.push(`  <TotalAmount>${this.calculateTotal(records)}</TotalAmount>`);
    xml.push('  <Remittances>');

    for (const record of records) {
      xml.push('    <Remittance>');
      xml.push(`      <ID>${this.xmlEscape(record.id)}</ID>`);
      xml.push('      <FromOrganization>');
      xml.push(`        <Code>${this.xmlEscape(record.fromOrgCode)}</Code>`);
      xml.push(`        <Name>${this.xmlEscape(record.fromOrgName)}</Name>`);
      xml.push('      </FromOrganization>');
      xml.push('      <ToOrganization>');
      xml.push(`        <Code>${this.xmlEscape(record.toOrgCode)}</Code>`);
      xml.push(`        <Name>${this.xmlEscape(record.toOrgName)}</Name>`);
      xml.push('      </ToOrganization>');
      xml.push('      <Period>');
      xml.push(`        <Start>${this.formatDate(record.periodStart)}</Start>`);
      xml.push(`        <End>${this.formatDate(record.periodEnd)}</End>`);
      xml.push('      </Period>');
      xml.push(`      <RemittableMembers>${record.remittableMembers}</RemittableMembers>`);
      xml.push(`      <PerCapitaRate>${record.perCapitaRate}</PerCapitaRate>`);
      xml.push(`      <TotalAmount>${record.totalAmount}</TotalAmount>`);
      xml.push(`      <Status>${this.xmlEscape(record.status)}</Status>`);
      xml.push(`      <DueDate>${this.formatDate(record.dueDate)}</DueDate>`);
      if (record.paidDate) {
        xml.push(`      <PaidDate>${this.formatDate(record.paidDate)}</PaidDate>`);
      }
      if (record.clcAccountCode) {
        xml.push(`      <CLCAccountCode>${this.xmlEscape(record.clcAccountCode)}</CLCAccountCode>`);
      }
      if (record.glAccount) {
        xml.push(`      <GLAccount>${this.xmlEscape(record.glAccount)}</GLAccount>`);
      }
      if (record.notes) {
        xml.push(`      <Notes>${this.xmlEscape(record.notes)}</Notes>`);
      }
      xml.push('    </Remittance>');
    }

    xml.push('  </Remittances>');
    xml.push('</PerCapitaRemittances>');

    return xml.join('\n');
  }

  /**
   * Generate EDI X12 810 Invoice format
   * 
   * EDI standard for electronic invoicing (simplified version)
   */
  private generateEDI(
    records: RemittanceExportRecord[],
    _options: ExportOptions
  ): string {
    const edi: string[] = [];
    const timestamp = this.formatTimestampEDI(new Date());
    const controlNumber = this.generateControlNumber();

    // ISA - Interchange Control Header
    edi.push(`ISA*00*          *00*          *ZZ*CLC_SENDER     *ZZ*CLC_RECEIVER   *${timestamp}*^*00501*${controlNumber}*0*P*:~`);

    // GS - Functional Group Header
    edi.push(`GS*IN*CLC_SENDER*CLC_RECEIVER*${timestamp.substring(0, 8)}*${timestamp.substring(8)}*${controlNumber}*X*005010~`);

    let transactionSetCount = 0;

    for (const record of records) {
      transactionSetCount++;

      // ST - Transaction Set Header
      edi.push(`ST*810*${transactionSetCount.toString().padStart(4, '0')}~`);

      // BIG - Beginning Segment for Invoice
      edi.push(`BIG*${this.formatDate(record.dueDate, 'YYYYMMDD')}*${record.id}*${this.formatDate(record.periodStart, 'YYYYMMDD')}*${record.id}~`);

      // N1 - Name (From Organization)
      edi.push(`N1*BT*${record.fromOrgName}*91*${record.fromOrgCode}~`);

      // N1 - Name (To Organization)
      edi.push(`N1*ST*${record.toOrgName}*91*${record.toOrgCode}~`);

      // IT1 - Baseline Item Data
      edi.push(`IT1*1*${record.remittableMembers}*EA*${record.totalAmount}**BP*PER_CAPITA~`);

      // TDS - Total Monetary Value Summary
      edi.push(`TDS*${this.formatAmountEDI(record.totalAmount)}~`);

      // SE - Transaction Set Trailer
      edi.push(`SE*7*${transactionSetCount.toString().padStart(4, '0')}~`);
    }

    // GE - Functional Group Trailer
    edi.push(`GE*${transactionSetCount}*${controlNumber}~`);

    // IEA - Interchange Control Trailer
    edi.push(`IEA*1*${controlNumber}~`);

    return edi.join('\n');
  }

  /**
   * Generate StatCan LAB-05302 format
   * 
   * Statistics Canada Labour Organization Survey format
   */
  private generateStatCan(
    records: RemittanceExportRecord[],
    options: ExportOptions
  ): string {
    const program = options.statcanProgram || 'LAB-05302';
    const lines: string[] = [];

    // StatCan Header
    lines.push([
      'SURVEY_CODE',
      'REFERENCE_PERIOD',
      'ORG_CODE',
      'ORG_NAME',
      'ORG_TYPE',
      'PARENT_ORG_CODE',
      'PARENT_ORG_NAME',
      'MEMBER_COUNT',
      'PER_CAPITA_AMOUNT',
      'TOTAL_AMOUNT',
      'FISCAL_YEAR',
      'QUARTER',
    ].join('|'));

    // StatCan Rows
    for (const record of records) {
      const fiscalYear = record.periodStart.getFullYear();
      const quarter = Math.ceil((record.periodStart.getMonth() + 1) / 3);

      lines.push([
        program,
        this.formatDate(record.periodStart, 'YYYYMM'),
        record.fromOrgCode,
        this.statcanEscape(record.fromOrgName),
        'LOCAL_UNION',
        record.toOrgCode,
        this.statcanEscape(record.toOrgName),
        record.remittableMembers.toString(),
        record.perCapitaRate,
        record.totalAmount,
        fiscalYear.toString(),
        `Q${quarter}`,
      ].join('|'));
    }

    return lines.join('\n');
  }

  /**
   * Generate Excel format
   */
  private async generateExcel(
    records: RemittanceExportRecord[],
    _options: ExportOptions
  ): Promise<Buffer> {
    // Calculate summary
    const summary = {
      totalMembers: records.reduce((sum, r) => sum + r.remittableMembers, 0),
      totalDues: records.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0).toFixed(2),
      totalPerCapita: records.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0).toFixed(2),
      period: `${records[0]?.periodStart.toLocaleDateString() || 'N/A'} - ${records[0]?.periodEnd.toLocaleDateString() || 'N/A'}`,
    };

    // Prepare remittance data
    const remittances = records.map((r) => ({
      memberId: r.fromOrgCode,
      memberName: r.fromOrgName,
      duesAmount: r.totalAmount,
      perCapita: r.totalAmount,
      period: `${r.periodStart.toLocaleDateString()} - ${r.periodEnd.toLocaleDateString()}`,
      status: r.status,
    }));

    // Get organization info from first record
    const organizationInfo = {
      name: records[0]?.toOrgName || 'CLC',
      code: records[0]?.toOrgCode || 'CLC',
    };

    return await generateRemittanceExcel({
      organizationInfo,
      remittances,
      summary,
    });
  }

  /**
   * Helper: CSV escape
   */
  private csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Helper: XML escape
   */
  private xmlEscape(value: string): string {
    if (!value) return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Helper: StatCan escape (pipe-delimited)
   */
  private statcanEscape(value: string): string {
    if (!value) return '';
    return value.replace(/\|/g, '').replace(/\n/g, ' ');
  }

  /**
   * Helper: Format date
   */
  private formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    switch (format) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'YYYYMMDD':
        return `${year}${month}${day}`;
      case 'YYYYMM':
        return `${year}${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Helper: Format timestamp for EDI
   */
  private formatTimestampEDI(date: Date): string {
    const year = date.getFullYear().toString().substring(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}`;
  }

  /**
   * Helper: Format amount for EDI
   */
  private formatAmountEDI(amount: string): string {
    return parseFloat(amount).toFixed(2).replace('.', '');
  }

  /**
   * Helper: Generate EDI control number
   */
  private generateControlNumber(): string {
    return Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  }

  /**
   * Helper: Calculate total amount
   */
  private calculateTotal(records: RemittanceExportRecord[]): string {
    return records.reduce(
      (sum, r) => sum + parseFloat(r.totalAmount),
      0
    ).toFixed(2);
  }

  /**
   * Helper: Calculate checksum (SHA-256)
   */
  private calculateChecksum(content: string | Buffer): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Helper: Generate filename
   */
  private generateFilename(
    options: ExportOptions,
    extension: string,
    date: Date
  ): string {
    const timestamp = date.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const prefix = options.format === 'statcan' ? 'statcan_lab05302' : 'clc_remittance';
    return `${prefix}_${timestamp}.${extension}`;
  }
}

/**
 * Create singleton instance
 */
export const remittanceExporter = new RemittanceExportService();
