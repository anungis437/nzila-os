/**
 * Scheduled Report Executor
 * 
 * Core engine for executing scheduled reports:
 * - Fetches report data
 * - Generates exports (PDF, Excel, CSV, JSON)
 * - Handles delivery (email, storage, webhook)
 * - Tracks execution status
 * - Implements retry logic
 * 
 * Part of: Phase 2.4 - Scheduled Reports System
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import type { ScheduledReport } from '@/db/queries/scheduled-reports-queries';
import { updateScheduleAfterRun } from '@/db/queries/scheduled-reports-queries';
import DocumentStorageService from '@/lib/services/document-storage-service';

// ============================================================================
// Types
// ============================================================================

interface ExecutionResult {
  success: boolean;
  scheduleId: string;
  exportJobId?: string;
  error?: string;
  rowCount?: number;
  fileUrl?: string;
  fileSizeBytes?: number;
  processingDurationMs?: number;
}

interface ReportData {
  columns: string[];
  rows: unknown[];
  totalCount: number;
}

const storageService = new DocumentStorageService();

// ============================================================================
// Main Execution Function
// ============================================================================

/**
 * Execute a scheduled report
 */
export async function executeScheduledReport(
  schedule: ScheduledReport
): Promise<ExecutionResult> {
  const startTime = Date.now();
  
  try {
// 1. Create export job record
    const exportJob = await createExportJob(schedule);
    
    // 2. Fetch report data
const reportData = await fetchReportData(schedule);
    
    if (!reportData || reportData.rows.length === 0) {
      throw new Error('No data available for report');
    }

    // 3. Generate export file
const fileBuffer = await generateExportFile(
      reportData,
      schedule.exportFormat
    );

    // 4. Upload file to storage
const fileUrl = await uploadFile(
      fileBuffer,
      schedule.id,
      schedule.exportFormat,
      schedule.organizationId
    );

    const processingDurationMs = Date.now() - startTime;

    // 5. Update export job with success
    await updateExportJob(exportJob.id, {
      status: 'completed',
      fileUrl,
      fileSizeBytes: fileBuffer.length,
      rowCount: reportData.rows.length,
      processingDurationMs,
    });

    // 6. Deliver the report
await deliverReport(schedule, fileUrl, fileBuffer);

    // 7. Update schedule
    await updateScheduleAfterRun(schedule.id, true);
return {
      success: true,
      scheduleId: schedule.id,
      exportJobId: exportJob.id,
      rowCount: reportData.rows.length,
      fileUrl,
      fileSizeBytes: fileBuffer.length,
      processingDurationMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
// Update schedule with failure
    await updateScheduleAfterRun(schedule.id, false, errorMessage);

    return {
      success: false,
      scheduleId: schedule.id,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Database Functions
// ============================================================================

/**
 * Create an export job record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createExportJob(schedule: ScheduledReport): Promise<any> {
  const result = await db.execute(sql`
    INSERT INTO export_jobs (
      report_id,
      tenant_id,
      schedule_id,
      export_format,
      status,
      created_by
    ) VALUES (
      ${schedule.reportId},
      ${schedule.organizationId},
      ${schedule.id},
      ${schedule.exportFormat},
      'processing',
      'system'
    )
    RETURNING *
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result as any[];
  return rows[0];
}

/**
 * Update export job with results
 */
async function updateExportJob(
  jobId: string,
  data: {
    status: string;
    fileUrl?: string;
    fileSizeBytes?: number;
    rowCount?: number;
    processingDurationMs?: number;
    errorMessage?: string;
  }
): Promise<void> {
  await db.execute(sql`
    UPDATE export_jobs
    SET 
      status = ${data.status},
      completed_at = NOW(),
      file_url = ${data.fileUrl ?? null},
      file_size_bytes = ${data.fileSizeBytes ?? null},
      row_count = ${data.rowCount ?? null},
      processing_duration_ms = ${data.processingDurationMs ?? null},
      error_message = ${data.errorMessage ?? null}
    WHERE id = ${jobId}
  `);
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch report data based on report configuration
 */
async function fetchReportData(schedule: ScheduledReport): Promise<ReportData> {
  // Get the report configuration
  const reportResult = await db.execute(sql`
    SELECT config FROM reports WHERE id = ${schedule.reportId}
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportRows = reportResult as any[];
  if (reportRows.length === 0) {
    throw new Error('Report not found');
  }

  const reportConfig = reportRows[0];
  const config = reportConfig.config;

  // Execute the report query based on its type
  let result: unknown[];

  switch (config.reportType || config.type) {
    case 'claims':
      result = await executeClaimsQuery(schedule.organizationId, config);
      break;
    case 'analytics':
      result = await executeAnalyticsQuery(schedule.organizationId, config);
      break;
    case 'custom':
      result = await executeCustomQuery(schedule.organizationId, config);
      break;
    default:
      result = await executeDefaultQuery(schedule.organizationId, config);
  }

  return {
    columns: Object.keys(result[0] || {}),
    rows: result,
    totalCount: result.length,
  };
}

/**
 * Execute claims report query
 */
async function executeClaimsQuery(organizationId: string, _config: unknown): Promise<unknown[]> {
  const result = await db.execute(sql`
    SELECT 
      c.claim_number,
      c.status,
      c.priority,
      c.claim_type,
      c.claim_amount,
      c.date_filed,
      c.resolution_date,
      u.full_name as claimant_name,
      u.member_id
    FROM claims c
    LEFT JOIN user_profiles u ON c.user_id = u.user_id
    WHERE c.tenant_id = ${organizationId}
      AND c.created_at >= NOW() - INTERVAL '90 days'
    ORDER BY c.created_at DESC
    LIMIT 1000
  `);
  
  return result as unknown[];
}

/**
 * Execute analytics report query
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAnalyticsQuery(organizationId: string, config: any): Promise<unknown[]> {
  const groupBy = config.groupBy || 'status';

  // SECURITY FIX: Whitelist validation to prevent SQL injection via GROUP BY column
  const ALLOWED_COLUMNS = ['status', 'priority', 'claim_type', 'created_at', 'updated_at', 'member_id'];
  if (!ALLOWED_COLUMNS.includes(groupBy)) {
    throw new Error(`Invalid groupBy column: ${groupBy}. Allowed columns: ${ALLOWED_COLUMNS.join(', ')}`);
  }

  // Safe to use sql.raw now that column is validated against whitelist
  const result = await db.execute(sql`
    SELECT 
      ${sql.raw(groupBy)} as category,
      COUNT(*) as count,
      AVG(claim_amount) as avg_amount,
      SUM(claim_amount) as total_amount
    FROM claims
    WHERE tenant_id = ${organizationId}
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY ${sql.raw(groupBy)}
    ORDER BY count DESC
    LIMIT 100
  `);
  
  return result as unknown[];
}

/**
 * Execute default query
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeDefaultQuery(organizationId: string, _config: any): Promise<unknown[]> {
  const result = await db.execute(sql`
    SELECT 
      id,
      claim_number,
      status,
      priority,
      claim_amount,
      created_at
    FROM claims
    WHERE tenant_id = ${organizationId}
    ORDER BY created_at DESC
    LIMIT 500
  `);
  
  return result as unknown[];
}

/**
 * Execute custom query (unsafe - admin only)
 * 
 * SECURITY WARNING: This function allows arbitrary SQL execution and is a critical
 * security risk. It should ONLY be used with pre-approved, validated SQL queries.
 * Implementation includes strict allowlist validation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeCustomQuery(organizationId: string, config: any): Promise<unknown[]> {
  const customQuery = config.query || '';
  if (!customQuery) {
    return executeDefaultQuery(organizationId, config);
  }
  
  // SECURITY FIX: Implement strict SQL allowlist validation
  // Only allow pre-approved queries to prevent SQL injection
  const APPROVED_QUERIES: Record<string, { query: string; name: string }> = {
    'claims_summary': { 
      query: 'claims_summary',
      name: 'Claims Summary'
    },
    'member_stats': { 
      query: 'member_stats',
      name: 'Member Statistics'
    },
    'recent_claims': { 
      query: 'recent_claims',
      name: 'Recent Claims'
    }
  };
  
  const queryKey = config.queryKey;
  if (!queryKey || !APPROVED_QUERIES[queryKey]) {
    throw new Error(
      `Invalid or unapproved custom query. Must use queryKey with one of: ${Object.keys(APPROVED_QUERIES).join(', ')}`
    );
  }
  
  // SECURITY FIX: Use proper parameterization instead of string replacement
  let result: unknown[];
  switch (queryKey) {
    case 'claims_summary':
      result = await db.execute(sql`
        SELECT COUNT(*) as total, SUM(claim_amount) as total_amount 
        FROM claims 
        WHERE tenant_id = ${organizationId}
      `);
      break;
    case 'member_stats':
      result = await db.execute(sql`
        SELECT COUNT(*) as total, COUNT(DISTINCT union_id) as unique_unions 
        FROM members 
        WHERE tenant_id = ${organizationId}
      `);
      break;
    case 'recent_claims':
      result = await db.execute(sql`
        SELECT id, claim_number, status, claim_amount, created_at 
        FROM claims 
        WHERE tenant_id = ${organizationId}
        ORDER BY created_at DESC 
        LIMIT 100
      `);
      break;
    default:
      throw new Error(`Query not implemented: ${queryKey}`);
  }
  
  return result as unknown[];
}

// ============================================================================
// Export Generation
// ============================================================================

/**
 * Generate export file in the specified format
 */
async function generateExportFile(
  data: ReportData,
  format: string
): Promise<Buffer> {
  switch (format) {
    case 'csv':
      return generateCSV(data);
    case 'json':
      return generateJSON(data);
    case 'excel':
    case 'xlsx':
      return await generateExcel(data);
    case 'pdf':
      return await generatePDF(data);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Generate CSV file
 */
function generateCSV(data: ReportData): Buffer {
  const lines: string[] = [];
  
  // Header row
  lines.push(data.columns.join(','));
  
  // Data rows
  for (const row of data.rows) {
    const values = data.columns.map(col => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (row as any)[col];
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Escape quotes and wrap in quotes if contains comma
      return str.includes(',') || str.includes('"') 
        ? `"${str.replace(/"/g, '""')}"` 
        : str;
    });
    lines.push(values.join(','));
  }

  return Buffer.from(lines.join('\n'), 'utf-8');
}

/**
 * Generate JSON file
 */
function generateJSON(data: ReportData): Buffer {
  const output = {
    columns: data.columns,
    data: data.rows,
    totalCount: data.totalCount,
    generatedAt: new Date().toISOString(),
  };

  return Buffer.from(JSON.stringify(output, null, 2), 'utf-8');
}

/**
 * Generate Excel file (XLSX) using exceljs
 */
async function generateExcel(data: ReportData): Promise<Buffer> {
  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'UnionEyes Report System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Report', {
      headerFooter: {
        firstHeader: 'UnionEyes Report',
        firstFooter: `Generated: ${new Date().toLocaleDateString()}`,
      },
    });

    // Add header row with styling
    worksheet.columns = data.columns.map(col => ({
      header: formatColumnHeader(col),
      key: col,
      width: Math.max(15, col.length + 5),
    }));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Blue header
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Add data rows
    data.rows.forEach((row, index) => {
      const dataRow = worksheet.addRow(row);
      
      // Alternate row colors
      if (index % 2 === 1) {
        dataRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }, // Light gray
        };
      }
    });

    // Add borders to all cells
    worksheet.eachRow((row, _rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    // Auto-fit columns based on content
    worksheet.columns.forEach(column => {
      if (column.values) {
        let maxLength = 10;
        column.values.forEach(value => {
          if (value) {
            const len = String(value).length;
            if (len > maxLength) maxLength = Math.min(len, 50);
          }
        });
        column.width = maxLength + 2;
      }
    });

    // Add summary row
    const _summaryRow = worksheet.addRow([]);
    const totalRow = worksheet.addRow([`Total Records: ${data.totalCount}`, '', '', `Generated: ${new Date().toISOString()}`]);
    totalRow.font = { italic: true, color: { argb: 'FF6B7280' } };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (_error) {
// Fallback to CSV if Excel generation fails
    return generateCSV(data);
  }
}

/**
 * Format column header for display
 */
function formatColumnHeader(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generate PDF file using jspdf
 */
async function generatePDF(data: ReportData): Promise<Buffer> {
  try {
    const { jsPDF } = await import('jspdf');
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: data.columns.length > 6 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const usableWidth = pageWidth - (2 * margin);
    let currentY = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // Blue
    doc.text('UnionEyes Report', margin, currentY);
    currentY += 10;

    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // Gray
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, currentY);
    currentY += 5;
    doc.text(`Total Records: ${data.totalCount}`, margin, currentY);
    currentY += 10;

    // Divider line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    // Calculate column widths
    const colCount = Math.min(data.columns.length, 8); // Limit columns for readability
    const displayColumns = data.columns.slice(0, colCount);
    const colWidth = usableWidth / colCount;

    // Table header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, currentY - 4, usableWidth, 8, 'F');
    
    displayColumns.forEach((col, index) => {
      const headerText = formatColumnHeader(col);
      const truncatedHeader = headerText.length > 12 ? headerText.substring(0, 12) + '...' : headerText;
      doc.text(truncatedHeader, margin + (index * colWidth) + 2, currentY);
    });
    currentY += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    
    const maxRows = Math.min(data.rows.length, 50); // Limit rows per page
    
    for (let i = 0; i < maxRows; i++) {
      // Check if we need a new page
      if (currentY > pageHeight - 25) {
        doc.addPage();
        currentY = margin;
        
        // Repeat header on new page
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(37, 99, 235);
        doc.rect(margin, currentY - 4, usableWidth, 8, 'F');
        
        displayColumns.forEach((col, index) => {
          const headerText = formatColumnHeader(col);
          const truncatedHeader = headerText.length > 12 ? headerText.substring(0, 12) + '...' : headerText;
          doc.text(truncatedHeader, margin + (index * colWidth) + 2, currentY);
        });
        currentY += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(31, 41, 55);
      }

      // Alternate row background
      if (i % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, currentY - 4, usableWidth, 6, 'F');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data.rows[i] as any;
      doc.setFontSize(8);
      
      displayColumns.forEach((col, colIndex) => {
        let value = row[col];
        if (value === null || value === undefined) value = '-';
        value = String(value);
        
        // Truncate long values
        const maxLen = Math.floor(colWidth / 2);
        if (value.length > maxLen) {
          value = value.substring(0, maxLen - 3) + '...';
        }
        
        doc.text(value, margin + (colIndex * colWidth) + 2, currentY);
      });
      
      currentY += 6;
    }

    // Footer
    currentY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth / 2, currentY, { align: 'center' });
    doc.text('UnionEyes - Union Management Platform', margin, currentY);

    // Return as buffer
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  } catch (_error) {
// Fallback to text representation
    const lines = [
      '='.repeat(80),
      'UnionEyes Report',
      '='.repeat(80),
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total Records: ${data.totalCount}`,
      '',
      '-'.repeat(80),
      data.columns.map(c => formatColumnHeader(c)).join(' | '),
      '-'.repeat(80),
    ];

    data.rows.slice(0, 100).forEach(row => {
      const values = data.columns.map(col => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = (row as any)[col];
        return val === null || val === undefined ? '-' : String(val).substring(0, 20);
      });
      lines.push(values.join(' | '));
    });

    lines.push('-'.repeat(80));
    lines.push(`Showing ${Math.min(data.rows.length, 100)} of ${data.totalCount} records`);

    return Buffer.from(lines.join('\n'), 'utf-8');
  }
}

// ============================================================================
// File Storage
// ============================================================================

/**
 * Upload file to storage via DocumentStorageService
 */
async function uploadFile(
  buffer: Buffer,
  scheduleId: string,
  format: string,
  organizationId: string
): Promise<string> {
  const timestamp = Date.now();
  const filename = `scheduled-report-${scheduleId}-${timestamp}.${format}`;
  const contentType = format === 'excel'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : format === 'pdf'
      ? 'application/pdf'
      : format === 'csv'
        ? 'text/csv'
        : 'application/json';

  const uploadResult = await storageService.uploadDocument({
    organizationId,
    documentName: filename,
    documentBuffer: buffer,
    documentType: 'scheduled_report',
    contentType,
    metadata: {
      scheduleId,
      format,
    },
  });

  return uploadResult.url;
}

// ============================================================================
// Delivery
// ============================================================================

/**
 * Deliver report via the configured method
 */
async function deliverReport(
  schedule: ScheduledReport,
  fileUrl: string,
  fileBuffer: Buffer
): Promise<void> {
  switch (schedule.deliveryMethod) {
    case 'email':
      await deliverViaEmail(schedule, fileUrl, fileBuffer);
      break;
    case 'dashboard':
      // No action needed - file is already accessible via fileUrl
break;
    case 'storage':
      // Already uploaded in previous step
break;
    case 'webhook':
      await deliverViaWebhook(schedule, fileUrl);
      break;
    default:
}
}

/**
 * Deliver report via email
 */
async function deliverViaEmail(
  schedule: ScheduledReport,
  fileUrl: string,
  fileBuffer: Buffer
): Promise<void> {
  // Import email function (will create in next file)
  const { sendScheduledReportEmail } = await import('@/lib/email/report-email-templates');
  
  await sendScheduledReportEmail({
    schedule,
    fileUrl,
    fileBuffer,
  });
}

/**
 * Deliver report via webhook
 */
async function deliverViaWebhook(
  schedule: ScheduledReport,
  fileUrl: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webhookUrl = (schedule.scheduleConfig as any).webhookUrl;
  
  if (!webhookUrl) {
    throw new Error('Webhook URL not configured');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scheduleId: schedule.id,
      reportId: schedule.reportId,
      fileUrl,
      generatedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.statusText}`);
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Retry failed executions
 */
export async function retryFailedExecution(
  scheduleId: string,
  maxRetries = 3
): Promise<ExecutionResult> {
  // Get the schedule
  const result = await db.execute(sql`
    SELECT * FROM report_schedules WHERE id = ${scheduleId}
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result as any[];
  if (rows.length === 0) {
    throw new Error('Schedule not found');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schedule = rows[0] as any;

  if (schedule.failure_count >= maxRetries) {
return {
      success: false,
      scheduleId,
      error: 'Max retries exceeded',
    };
  }
return await executeScheduledReport(schedule as ScheduledReport);
}

