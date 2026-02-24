/**
 * Excel Generator Utility
 * 
 * Generates Excel spreadsheets from structured data
 * Uses ExcelJS for workbook generation
 */

import ExcelJS from 'exceljs';

// ============================================================================
// TYPES
// ============================================================================

export interface ExcelOptions {
  title: string;
  data: unknown[] | Record<string, unknown>;
  columns: ExcelColumn[];
  sheetName?: string;
  includeHeader?: boolean;
  includeFilters?: boolean;
  freezeHeader?: boolean;
  autoWidth?: boolean;
  styles?: {
    headerFill?: string;
    headerFont?: Partial<ExcelJS.Font>;
    bodyFont?: Partial<ExcelJS.Font>;
    alternateRows?: boolean;
    alternateRowFill?: string;
  };
}

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  style?: Partial<ExcelJS.Style>;
  format?: string; // e.g., '0.00' for decimals, 'yyyy-mm-dd' for dates
}

export interface MultiSheetExcelOptions {
  filename: string;
  sheets: {
    name: string;
    data: unknown[];
    columns: ExcelColumn[];
  }[];
}

// ============================================================================
// EXCEL GENERATOR
// ============================================================================

/**
 * Generate an Excel workbook from structured data
 */
export async function generateExcel(options: ExcelOptions): Promise<Buffer> {
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  
  // Set workbook properties
  workbook.creator = 'Union Management System';
  workbook.lastModifiedBy = 'Union Management System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Add worksheet
  const worksheet = workbook.addWorksheet(options.sheetName || 'Sheet1', {
    properties: { tabColor: { argb: 'FF1F4788' } },
    views: [{ state: 'frozen', xSplit: 0, ySplit: options.freezeHeader !== false ? 1 : 0 }],
  });

  // Normalize data
  const data = Array.isArray(options.data) ? options.data : [options.data];

  // Add columns
  worksheet.columns = options.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
    style: col.style || {},
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = options.styles?.headerFont || {
    bold: true,
    size: 12,
    color: { argb: 'FFFFFFFF' },
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: options.styles?.headerFill || 'FF1F4788' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.forEach((row: any, index) => {
    const excelRow = worksheet.addRow(row);

    // Apply body font
    excelRow.font = options.styles?.bodyFont || { size: 10 };

    // Alternate row coloring
    if (options.styles?.alternateRows && index % 2 === 1) {
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: options.styles?.alternateRowFill || 'FFF5F5F5' },
      };
    }

    // Apply column-specific formatting
    options.columns.forEach((col, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      
      // Apply format if specified
      if (col.format) {
        cell.numFmt = col.format;
      }

      // Format dates
      const value = row[col.key];
      if (value instanceof Date) {
        cell.value = value;
        cell.numFmt = col.format || 'yyyy-mm-dd';
      }
    });
  });

  // Enable filters
  if (options.includeFilters !== false) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: options.columns.length },
    };
  }

  // Auto-fit column widths (if enabled)
  if (options.autoWidth !== false) {
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        maxLength = Math.max(maxLength, cellValue.length);
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// MULTI-SHEET EXCEL GENERATOR
// ============================================================================

/**
 * Generate multi-sheet Excel workbook
 */
export async function generateMultiSheetExcel(
  options: MultiSheetExcelOptions
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  workbook.creator = 'Union Management System';
  workbook.created = new Date();

  // Add each sheet
  for (const sheet of options.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Add columns
    worksheet.columns = sheet.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4788' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data
    sheet.data.forEach((row) => {
      worksheet.addRow(row);
    });

    // Enable filters
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// TEMPLATE GENERATORS
// ============================================================================

/**
 * Generate financial Excel report with multiple sheets
 */
export async function generateFinancialExcel(data: {
  summary: unknown;
  transactions: unknown[];
  categories: unknown[];
}): Promise<Buffer> {
  return await generateMultiSheetExcel({
    filename: 'financial-report',
    sheets: [
      {
        name: 'Summary',
        data: [data.summary],
        columns: [
          { header: 'Period', key: 'period', width: 20 },
          { header: 'Revenue', key: 'revenue', width: 15, format: '$#,##0.00' },
          { header: 'Expenses', key: 'expenses', width: 15, format: '$#,##0.00' },
          { header: 'Net', key: 'net', width: 15, format: '$#,##0.00' },
        ],
      },
      {
        name: 'Transactions',
        data: data.transactions,
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Description', key: 'description', width: 30 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Amount', key: 'amount', width: 15, format: '$#,##0.00' },
          { header: 'Type', key: 'type', width: 10 },
        ],
      },
      {
        name: 'Categories',
        data: data.categories,
        columns: [
          { header: 'Category', key: 'category', width: 20 },
          { header: 'Total', key: 'total', width: 15, format: '$#,##0.00' },
          { header: 'Count', key: 'count', width: 10 },
        ],
      },
    ],
  });
}

/**
 * Generate membership roster Excel
 */
export async function generateMembershipRoster(members: unknown[]): Promise<Buffer> {
  return await generateExcel({
    title: 'Membership Roster',
    data: members,
    columns: [
      { header: 'Member ID', key: 'memberId', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Join Date', key: 'joinDate', width: 12, format: 'yyyy-mm-dd' },
      { header: 'Local', key: 'local', width: 15 },
      { header: 'Position', key: 'position', width: 20 },
    ],
    sheetName: 'Members',
  });
}

/**
 * Generate claims/grievances Excel report
 */
export async function generateClaimsExcel(claims: unknown[]): Promise<Buffer> {
  return await generateExcel({
    title: 'Claims Report',
    data: claims,
    columns: [
      { header: 'Claim #', key: 'claimNumber', width: 12 },
      { header: 'Subject', key: 'subject', width: 35 },
      { header: 'Member', key: 'memberName', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Filed Date', key: 'createdAt', width: 12, format: 'yyyy-mm-dd' },
      { header: 'Resolved Date', key: 'resolvedAt', width: 12, format: 'yyyy-mm-dd' },
    ],
    sheetName: 'Claims',
  });
}

/**
 * Generate CLC remittance Excel
 */
export async function generateRemittanceExcel(data: {
  organizationInfo: unknown;
  remittances: unknown[];
  summary: unknown;
}): Promise<Buffer> {
  return await generateMultiSheetExcel({
    filename: 'clc-remittance',
    sheets: [
      {
        name: 'Remittances',
        data: data.remittances,
        columns: [
          { header: 'Member ID', key: 'memberId', width: 15 },
          { header: 'Name', key: 'memberName', width: 25 },
          { header: 'Dues Amount', key: 'duesAmount', width: 15, format: '$#,##0.00' },
          { header: 'Per Capita', key: 'perCapita', width: 15, format: '$#,##0.00' },
          { header: 'Period', key: 'period', width: 12 },
          { header: 'Status', key: 'status', width: 12 },
        ],
      },
      {
        name: 'Summary',
        data: [data.summary],
        columns: [
          { header: 'Total Members', key: 'totalMembers', width: 15 },
          { header: 'Total Dues', key: 'totalDues', width: 15, format: '$#,##0.00' },
          { header: 'Total Per Capita', key: 'totalPerCapita', width: 15, format: '$#,##0.00' },
          { header: 'Period', key: 'period', width: 12 },
        ],
      },
    ],
  });
}

/**
 * Generate training report Excel
 */
export async function generateTrainingReportExcel(data: {
  programs: unknown[];
  enrollments: unknown[];
  completions: unknown[];
}): Promise<Buffer> {
  return await generateMultiSheetExcel({
    filename: 'training-report',
    sheets: [
      {
        name: 'Programs',
        data: data.programs,
        columns: [
          { header: 'Program Name', key: 'name', width: 30 },
          { header: 'Type', key: 'type', width: 15 },
          { header: 'Duration (hrs)', key: 'duration', width: 12 },
          { header: 'Enrollments', key: 'enrollmentCount', width: 12 },
          { header: 'Completions', key: 'completionCount', width: 12 },
        ],
      },
      {
        name: 'Enrollments',
        data: data.enrollments,
        columns: [
          { header: 'Member', key: 'memberName', width: 25 },
          { header: 'Program', key: 'programName', width: 30 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Progress %', key: 'progress', width: 10, format: '0%' },
          { header: 'Enrolled Date', key: 'enrolledDate', width: 12, format: 'yyyy-mm-dd' },
        ],
      },
      {
        name: 'Completions',
        data: data.completions,
        columns: [
          { header: 'Member', key: 'memberName', width: 25 },
          { header: 'Program', key: 'programName', width: 30 },
          { header: 'Completed Date', key: 'completedDate', width: 12, format: 'yyyy-mm-dd' },
          { header: 'Score', key: 'score', width: 10, format: '0.0' },
          { header: 'Certificate #', key: 'certificateNumber', width: 15 },
        ],
      },
    ],
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Apply conditional formatting to a worksheet range
 */
export function applyConditionalFormatting(
  worksheet: ExcelJS.Worksheet,
  range: string,
  rules: ExcelJS.ConditionalFormattingRule[]
) {
  worksheet.addConditionalFormatting({
    ref: range,
    rules: rules,
  });
}

/**
 * Add chart to worksheet
 * 
 * Note: ExcelJS has limited native chart support. This function generates
 * chart data and provides instructions for chart creation via:
 * 1. Excel API (for Office Add-ins)
 * 2. Python openpyxl (for server-side generation)
 * 3. Chart.js + canvas export (for image-based charts)
 */
export async function addChart(
  worksheet: ExcelJS.Worksheet,
  chartOptions: {
    type: 'bar' | 'line' | 'pie' | 'scatter';
    title: string;
    dataRange: string;
    categories?: string;
    series?: Array<{
      name: string;
      values: string;
    }>;
    position?: { row: number; col: number };
  }
) {
  // Add chart data reference and metadata as a comment
  const chartCell = worksheet.getCell(chartOptions.position?.row || 1, chartOptions.position?.col || 1);
  
  const chartMetadata = {
    type: chartOptions.type,
    title: chartOptions.title,
    dataRange: chartOptions.dataRange,
    categories: chartOptions.categories,
    series: chartOptions.series,
    instructions: 'Chart data prepared. Use Excel to insert chart with this data range.',
  };
  
  chartCell.note = JSON.stringify(chartMetadata, null, 2);
  chartCell.value = `[Chart: ${chartOptions.title}]`;
  chartCell.font = { italic: true, color: { argb: 'FF0066CC' } };
  
  // For automated chart generation, use one of these approaches:
  // 1. Excel API: worksheet.addImage() with chart image from Chart.js
  // 2. External tool: Generate XLSX with Python openpyxl
  // 3. Office Scripts: Use Office.js API for chart insertion
// Return metadata for external processing
  return chartMetadata;
}

/**
 * Protect worksheet with password
 */
export function protectWorksheet(
  worksheet: ExcelJS.Worksheet,
  password?: string
) {
  worksheet.protect(password || '', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });
}

export default generateExcel;

