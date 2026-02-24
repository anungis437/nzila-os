/**
 * PDF Generator Utility
 * 
 * Generates PDF documents from structured data
 * Uses PDFKit for document generation
 */

import PDFDocument from 'pdfkit';

// ============================================================================
// TYPES
// ============================================================================

export interface PDFOptions {
  title: string;
  data: unknown[] | Record<string, unknown>;
  template?: string;
  orientation?: 'portrait' | 'landscape';
  size?: 'letter' | 'legal' | 'A4';
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  header?: {
    text?: string;
    height?: number;
    fontSize?: number;
  };
  footer?: {
    text?: string;
    height?: number;
    fontSize?: number;
    showPageNumbers?: boolean;
  };
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

// ============================================================================
// PDF GENERATOR
// ============================================================================

/**
 * Generate a PDF document from structured data
 */
export async function generatePDF(options: PDFOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: options.size || 'letter',
        layout: options.orientation || 'portrait',
        margins: {
          top: options.margins?.top || 50,
          bottom: options.margins?.bottom || 50,
          left: options.margins?.left || 50,
          right: options.margins?.right || 50,
        },
        info: {
          Title: options.title,
          Author: options.metadata?.author || 'Union Management System',
          Subject: options.metadata?.subject || options.title,
          Keywords: options.metadata?.keywords,
          CreationDate: new Date(),
          ModDate: new Date(),
        },
      });

      // Buffer to collect PDF data
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Render based on template
      switch (options.template) {
        case 'claims-report':
          renderClaimsReport(doc, options);
          break;
        case 'members-report':
          renderMembersReport(doc, options);
          break;
        case 'grievances-report':
          renderGrievancesReport(doc, options);
          break;
        case 'usage-report':
          renderUsageReport(doc, options);
          break;
        case 'financial-report':
          renderFinancialReport(doc, options);
          break;
        default:
          renderGenericReport(doc, options);
      }

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================================================
// TEMPLATE RENDERERS
// ============================================================================

/**
 * Render claims report
 */
function renderClaimsReport(doc: typeof PDFDocument, options: PDFOptions) {
  const data = Array.isArray(options.data) ? options.data : [options.data];

  // Title
  doc.fontSize(20).text(options.title, { align: 'center' });
  doc.moveDown();

  // Summary
  doc.fontSize(12).text(`Total Claims: ${data.length}`);
  doc.moveDown();

  // Table
  const columns: TableColumn[] = [
    { header: 'Claim #', key: 'claimNumber', width: 80 },
    { header: 'Subject', key: 'subject', width: 150 },
    { header: 'Status', key: 'status', width: 80 },
    { header: 'Priority', key: 'priority', width: 70 },
    { header: 'Created', key: 'createdAt', width: 100 },
  ];

  renderTable(doc, columns, data);
}

/**
 * Render members report
 */
function renderMembersReport(doc: typeof PDFDocument, options: PDFOptions) {
  const data = Array.isArray(options.data) ? options.data : [options.data];

  doc.fontSize(20).text(options.title, { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Total Members: ${data.length}`);
  doc.moveDown();

  const columns: TableColumn[] = [
    { header: 'Name', key: 'name', width: 150 },
    { header: 'Email', key: 'email', width: 150 },
    { header: 'Status', key: 'status', width: 80 },
    { header: 'Joined', key: 'createdAt', width: 100 },
  ];

  renderTable(doc, columns, data);
}

/**
 * Render grievances report
 */
function renderGrievancesReport(doc: typeof PDFDocument, options: PDFOptions) {
  const data = Array.isArray(options.data) ? options.data : [options.data];

  doc.fontSize(20).text(options.title, { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Total Grievances: ${data.length}`);
  doc.moveDown();

  const columns: TableColumn[] = [
    { header: 'Claim #', key: 'claimNumber', width: 80 },
    { header: 'Subject', key: 'subject', width: 150 },
    { header: 'Status', key: 'status', width: 80 },
    { header: 'Filed', key: 'createdAt', width: 100 },
    { header: 'Resolved', key: 'resolvedAt', width: 100 },
  ];

  renderTable(doc, columns, data);
}

/**
 * Render usage report
 */
function renderUsageReport(doc: typeof PDFDocument, options: PDFOptions) {
  const data = options.data as unknown;

  doc.fontSize(20).text(options.title, { align: 'center' });
  doc.moveDown();

  // Period info
  doc.fontSize(14).text(`Period: ${data.period?.start || 'N/A'} to ${data.period?.end || 'N/A'}`);
  doc.moveDown();

  // Claims section
  doc.fontSize(16).text('Claims', { underline: true });
  doc.fontSize(12);
  doc.text(`Total Claims: ${data.claims?.total || 0}`);
  doc.text(`By Status: ${JSON.stringify(data.claims?.byStatus || {})}`);
  doc.text(`By Priority: ${JSON.stringify(data.claims?.byPriority || {})}`);
  doc.moveDown();

  // Members section
  doc.fontSize(16).text('Members', { underline: true });
  doc.fontSize(12);
  doc.text(`Total Members: ${data.members?.total || 0}`);
  doc.text(`Active Members: ${data.members?.active || 0}`);
  doc.text(`New Members: ${data.members?.new || 0}`);
  doc.moveDown();

  // Grievances section
  if (data.grievances) {
    doc.fontSize(16).text('Grievances', { underline: true });
    doc.fontSize(12);
    doc.text(`Total Grievances: ${data.grievances.total || 0}`);
    doc.text(`Resolved: ${data.grievances.resolved || 0}`);
  }
}

/**
 * Render financial report
 */
function renderFinancialReport(doc: typeof PDFDocument, options: PDFOptions) {
  const data = options.data as unknown;

  doc.fontSize(20).text(options.title, { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).text(`Period: ${data.period?.start || 'N/A'} to ${data.period?.end || 'N/A'}`);
  doc.moveDown();

  // Financial summary
  doc.fontSize(16).text('Financial Summary', { underline: true });
  doc.fontSize(12);
  doc.text(`Total Revenue: $${(data.revenue || 0).toLocaleString()}`);
  doc.text(`Total Expenses: $${(data.expenses || 0).toLocaleString()}`);
  doc.text(`Net: $${((data.revenue || 0) - (data.expenses || 0)).toLocaleString()}`);
}

/**
 * Render generic report
 */
function renderGenericReport(doc: typeof PDFDocument, options: PDFOptions) {
  doc.fontSize(20).text(options.title, { align: 'center' });
  doc.moveDown();

  const data = Array.isArray(options.data) ? options.data : [options.data];
  doc.fontSize(12).text(JSON.stringify(data, null, 2));
}

// ============================================================================
// TABLE RENDERING
// ============================================================================

/**
 * Render a data table
 */
function renderTable(
  doc: typeof PDFDocument,
  columns: TableColumn[],
  data: unknown[]
) {
  const startY = doc.y;
  const rowHeight = 20;
  const headerHeight = 25;

  // Calculate total width
  const _totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);

  // Draw header
  let x = doc.page.margins.left;
  doc.fontSize(10).fillColor('black');

  columns.forEach((col) => {
    doc
      .rect(x, startY, col.width || 100, headerHeight)
      .fillAndStroke('#f0f0f0', '#000000');
    
    doc
      .fillColor('black')
      .text(col.header, x + 5, startY + 7, {
        width: (col.width || 100) - 10,
        align: col.align || 'left',
      });

    x += col.width || 100;
  });

  // Draw rows
  let y = startY + headerHeight;
  data.forEach((row, _index) => {
    // Check if we need a new page
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    x = doc.page.margins.left;
    doc.fontSize(9);

    columns.forEach((col) => {
      let value = row[col.key];
      
      // Format dates
      if (value instanceof Date) {
        value = value.toLocaleDateString();
      } else if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value);
      } else if (value === null || value === undefined) {
        value = '';
      } else {
        value = String(value);
      }

      // Draw cell border
      doc
        .rect(x, y, col.width || 100, rowHeight)
        .stroke('#cccccc');

      // Draw cell text
      doc.text(value, x + 5, y + 5, {
        width: (col.width || 100) - 10,
        align: col.align || 'left',
        ellipsis: true,
      });

      x += col.width || 100;
    });

    y += rowHeight;
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add header to PDF
 */
export function addHeader(
  doc: typeof PDFDocument,
  text: string,
  options?: { fontSize?: number; align?: unknown }
) {
  doc
    .fontSize(options?.fontSize || 12)
    .text(text, {
      align: options?.align || 'center',
    });
  doc.moveDown();
}

/**
 * Add footer to PDF
 */
export function addFooter(
  doc: typeof PDFDocument,
  text: string,
  showPageNumbers: boolean = true
) {
  const bottomMargin = doc.page.margins.bottom;
  const footerY = doc.page.height - bottomMargin + 10;

  doc.fontSize(9).text(text, doc.page.margins.left, footerY, {
    align: 'center',
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
  });

  if (showPageNumbers) {
    const pageNumber = (doc as unknown).bufferedPageRange().start + 1;
    doc.text(`Page ${pageNumber}`, doc.page.margins.left, footerY + 15, {
      align: 'center',
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
  }
}

export default generatePDF;

