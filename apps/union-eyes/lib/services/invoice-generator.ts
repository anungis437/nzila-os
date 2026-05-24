/**
 * Invoice PDF Generation Service
 * 
 * Generates professional PDF invoices for dues, fees, and other charges.
 */

import { Decimal } from 'decimal.js';
import PDFDocument from 'pdfkit';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  
  // Customer info
  customerName: string;
  customerEmail: string;
  customerAddress?: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  
  // Union info
  unionName: string;
  unionAddress: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  unionPhone?: string;
  unionEmail?: string;
  unionWebsite?: string;
  
  // Line items
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: Decimal;
    amount: Decimal;
    taxable?: boolean;
  }>;
  
  // Totals
  subtotal: Decimal;
  taxRate?: number;
  taxAmount?: Decimal;
  totalAmount: Decimal;
  amountPaid?: Decimal;
  amountDue?: Decimal;
  
  // Additional info
  terms?: string;
  notes?: string;
  paymentInstructions?: string;
}

export class InvoiceGenerator {
  /**
   * Generate invoice HTML
   */
  static generateHTML(data: InvoiceData): string {
    const amountDue = data.amountDue || data.totalAmount.minus(data.amountPaid || 0);
    const isPaid = amountDue.isZero();
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Invoice ${data.invoiceNumber}</title>
          <style>
            @page { size: letter; margin: 1in; }
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              font-size: 10pt;
              line-height: 1.5;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .invoice-container {
              max-width: 8.5in;
              margin: 0 auto;
            }
            .header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #0070f3;
            }
            .header-left {
              flex: 1;
            }
            .header-right {
              text-align: right;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #0070f3;
              margin-bottom: 5px;
            }
            .invoice-title {
              font-size: 32px;
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
            }
            .invoice-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
            .invoice-info, .customer-info {
              padding: 15px;
              background: #f9f9f9;
              border-radius: 5px;
            }
            .info-label {
              font-weight: bold;
              color: #666;
              font-size: 9pt;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .info-value {
              margin-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 30px 0;
            }
            thead {
              background: #0070f3;
              color: white;
            }
            th {
              padding: 12px;
              text-align: left;
              font-weight: bold;
            }
            th.right {
              text-align: right;
            }
            tbody tr {
              border-bottom: 1px solid #ddd;
            }
            tbody tr:last-child {
              border-bottom: 2px solid #333;
            }
            td {
              padding: 10px 12px;
            }
            td.right {
              text-align: right;
            }
            .totals {
              margin-top: 20px;
              margin-left: auto;
              width: 300px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
            }
            .totals-row.subtotal {
              border-top: 1px solid #ddd;
            }
            .totals-row.total {
              border-top: 2px solid #333;
              margin-top: 5px;
              padding-top: 10px;
              font-size: 14pt;
              font-weight: bold;
            }
            .totals-row.amount-due {
              background: #fffbeb;
              padding: 12px;
              margin-top: 10px;
              border: 2px solid #f59e0b;
              border-radius: 5px;
              font-size: 14pt;
              font-weight: bold;
              color: #f59e0b;
            }
            .totals-row.paid-stamp {
              background: #d1fae5;
              padding: 12px;
              margin-top: 10px;
              border: 2px solid #10b981;
              border-radius: 5px;
              font-size: 14pt;
              font-weight: bold;
              color: #10b981;
              text-align: center;
            }
            .notes {
              margin-top: 40px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 5px;
            }
            .notes-title {
              font-weight: bold;
              margin-bottom: 10px;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              font-size: 9pt;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .invoice-container { max-width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <!-- Header -->
            <div class="header">
              <div class="header-left">
                <div class="company-name">${data.unionName}</div>
                <div>${data.unionAddress.line1}</div>
                ${data.unionAddress.line2 ? `<div>${data.unionAddress.line2}</div>` : ''}
                <div>${data.unionAddress.city}, ${data.unionAddress.province} ${data.unionAddress.postalCode}</div>
                ${data.unionPhone ? `<div>Phone: ${data.unionPhone}</div>` : ''}
                ${data.unionEmail ? `<div>Email: ${data.unionEmail}</div>` : ''}
              </div>
              <div class="header-right">
                <div class="invoice-title">INVOICE</div>
                <div><strong>Invoice #:</strong> ${data.invoiceNumber}</div>
                <div><strong>Date:</strong> ${data.invoiceDate.toLocaleDateString()}</div>
                <div><strong>Due Date:</strong> ${data.dueDate.toLocaleDateString()}</div>
              </div>
            </div>

            <!-- Invoice and Customer Details -->
            <div class="invoice-details">
              <div class="customer-info">
                <div class="info-label">Bill To:</div>
                <div class="info-value">
                  <strong>${data.customerName}</strong><br>
                  ${data.customerEmail}<br>
                  ${data.customerAddress ? `
                    ${data.customerAddress.line1}<br>
                    ${data.customerAddress.line2 ? `${data.customerAddress.line2}<br>` : ''}
                    ${data.customerAddress.city}, ${data.customerAddress.province} ${data.customerAddress.postalCode}
                  ` : ''}
                </div>
              </div>
              
              <div class="invoice-info">
                <div class="info-label">Payment Terms:</div>
                <div class="info-value">${data.terms || 'Due upon receipt'}</div>
                ${data.amountPaid && data.amountPaid.greaterThan(0) ? `
                  <div class="info-label">Amount Paid:</div>
                  <div class="info-value">$${data.amountPaid.toFixed(2)} CAD</div>
                ` : ''}
              </div>
            </div>

            <!-- Line Items Table -->
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="right">Quantity</th>
                  <th class="right">Unit Price</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.lineItems.map(item => `
                  <tr>
                    <td>${item.description}</td>
                    <td class="right">${item.quantity}</td>
                    <td class="right">$${item.unitPrice.toFixed(2)}</td>
                    <td class="right">$${item.amount.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Totals -->
            <div class="totals">
              <div class="totals-row subtotal">
                <span>Subtotal:</span>
                <span>$${data.subtotal.toFixed(2)} CAD</span>
              </div>
              ${data.taxAmount && data.taxAmount.greaterThan(0) ? `
                <div class="totals-row">
                  <span>Tax (${((data.taxRate || 0) * 100).toFixed(2)}%):</span>
                  <span>$${data.taxAmount.toFixed(2)} CAD</span>
                </div>
              ` : ''}
              <div class="totals-row total">
                <span>Total:</span>
                <span>$${data.totalAmount.toFixed(2)} CAD</span>
              </div>
              ${data.amountPaid && data.amountPaid.greaterThan(0) ? `
                <div class="totals-row">
                  <span>Amount Paid:</span>
                  <span>-$${data.amountPaid.toFixed(2)} CAD</span>
                </div>
              ` : ''}
              ${isPaid ? `
                <div class="totals-row paid-stamp">
                  ✓ PAID IN FULL
                </div>
              ` : `
                <div class="totals-row amount-due">
                  <span>Amount Due:</span>
                  <span>$${amountDue.toFixed(2)} CAD</span>
                </div>
              `}
            </div>

            <!-- Notes and Payment Instructions -->
            ${data.notes || data.paymentInstructions ? `
              <div class="notes">
                ${data.notes ? `
                  <div class="notes-title">Notes:</div>
                  <div>${data.notes}</div>
                ` : ''}
                ${data.paymentInstructions ? `
                  <div class="notes-title" style="margin-top: 15px;">Payment Instructions:</div>
                  <div>${data.paymentInstructions}</div>
                ` : ''}
              </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
              <p>Thank you for your payment!</p>
              <p>Questions? Contact us at ${data.unionEmail || 'info@union.com'}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate invoice for dues payment
   */
  static generateDuesInvoice(params: {
    memberName: string;
    memberEmail: string;
    memberAddress?: InvoiceData['customerAddress'];
    invoiceNumber: string;
    duesAmount: Decimal;
    period: string;
    dueDate: Date;
    unionInfo: {
      name: string;
      address: InvoiceData['unionAddress'];
      phone?: string;
      email?: string;
    };
  }): string {
    const data: InvoiceData = {
      invoiceNumber: params.invoiceNumber,
      invoiceDate: new Date(),
      dueDate: params.dueDate,
      customerName: params.memberName,
      customerEmail: params.memberEmail,
      customerAddress: params.memberAddress,
      unionName: params.unionInfo.name,
      unionAddress: params.unionInfo.address,
      unionPhone: params.unionInfo.phone,
      unionEmail: params.unionInfo.email,
      lineItems: [{
        description: `Union Dues - ${params.period}`,
        quantity: 1,
        unitPrice: params.duesAmount,
        amount: params.duesAmount,
        taxable: false,
      }],
      subtotal: params.duesAmount,
      totalAmount: params.duesAmount,
      amountDue: params.duesAmount,
      terms: 'Due upon receipt',
      paymentInstructions: 'Payment can be made via credit card through the member portal, bank transfer, or payroll deduction.',
    };

    return this.generateHTML(data);
  }

  /**
   * Generate a real PDF invoice.
   *
   * When passed InvoiceData, render the structured invoice layout directly.
   * When passed HTML, render a plain-text archival PDF as a compatibility
   * fallback for the legacy API shape.
   */
  static async generatePDF(source: InvoiceData | string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'letter',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: typeof source === 'string' ? 'Invoice' : `Invoice ${source.invoiceNumber}`,
            Author: typeof source === 'string' ? 'UnionEyes' : source.unionName,
            Subject: 'Invoice',
            CreationDate: new Date(),
            ModDate: new Date(),
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        if (typeof source === 'string') {
          this.renderHtmlFallback(doc, source);
        } else {
          this.renderStructuredInvoice(doc, source);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private static renderStructuredInvoice(doc: InstanceType<typeof PDFDocument>, data: InvoiceData): void {
    const amountDue = data.amountDue || data.totalAmount.minus(data.amountPaid || 0);
    const isPaid = amountDue.isZero();
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableRight = doc.page.width - doc.page.margins.right;
    const quantityX = doc.page.margins.left + pageWidth * 0.58;
    const unitX = doc.page.margins.left + pageWidth * 0.72;
    const amountX = doc.page.margins.left + pageWidth * 0.86;

    doc.fillColor('#0f172a').fontSize(24).text(data.unionName, { continued: false });
    doc.fontSize(11).fillColor('#334155');
    this.writeAddress(doc, data.unionAddress);
    if (data.unionPhone) doc.text(`Phone: ${data.unionPhone}`);
    if (data.unionEmail) doc.text(`Email: ${data.unionEmail}`);
    if (data.unionWebsite) doc.text(`Web: ${data.unionWebsite}`);

    const topY = doc.page.margins.top;
    doc.fillColor('#0f172a').fontSize(28).text('INVOICE', 0, topY, { align: 'right' });
    doc.fontSize(11).fillColor('#334155');
    doc.text(`Invoice #: ${data.invoiceNumber}`, { align: 'right' });
    doc.text(`Invoice Date: ${data.invoiceDate.toLocaleDateString()}`, { align: 'right' });
    doc.text(`Due Date: ${data.dueDate.toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(2);

    const infoTop = doc.y;
    const boxWidth = (pageWidth - 20) / 2;
    this.drawInfoBox(doc, {
      x: doc.page.margins.left,
      y: infoTop,
      width: boxWidth,
      title: 'Bill To',
      lines: [
        data.customerName,
        data.customerEmail,
        ...this.addressLines(data.customerAddress),
      ],
    });
    this.drawInfoBox(doc, {
      x: doc.page.margins.left + boxWidth + 20,
      y: infoTop,
      width: boxWidth,
      title: 'Payment Terms',
      lines: [
        data.terms || 'Due upon receipt',
        data.amountPaid && data.amountPaid.greaterThan(0)
          ? `Amount paid: ${this.formatMoney(data.amountPaid)}`
          : 'Amount paid: $0.00 CAD',
      ],
    });
    doc.y = infoTop + 92;
    doc.moveDown(1.2);

    doc.fontSize(11).fillColor('#ffffff');
    doc.rect(doc.page.margins.left, doc.y, pageWidth, 24).fill('#2563eb');
    doc.text('Description', doc.page.margins.left + 8, doc.y + 7);
    doc.text('Qty', quantityX, doc.y + 7, { width: 40, align: 'right' });
    doc.text('Unit Price', unitX, doc.y + 7, { width: 64, align: 'right' });
    doc.text('Amount', amountX, doc.y + 7, { width: tableRight - amountX - 8, align: 'right' });
    doc.y += 24;

    doc.fontSize(10).fillColor('#1f2937');
    for (const item of data.lineItems) {
      this.ensureSpace(doc, 24);
      doc.rect(doc.page.margins.left, doc.y, pageWidth, 24).strokeColor('#cbd5e1').stroke();
      doc.text(item.description, doc.page.margins.left + 8, doc.y + 7, {
        width: quantityX - doc.page.margins.left - 16,
      });
      doc.text(String(item.quantity), quantityX, doc.y + 7, { width: 40, align: 'right' });
      doc.text(this.formatMoney(item.unitPrice), unitX, doc.y + 7, { width: 64, align: 'right' });
      doc.text(this.formatMoney(item.amount), amountX, doc.y + 7, {
        width: tableRight - amountX - 8,
        align: 'right',
      });
      doc.y += 24;
    }

    doc.moveDown(1.5);
    const totalsX = doc.page.margins.left + pageWidth * 0.58;
    const totalsWidth = tableRight - totalsX;
    this.writeTotalRow(doc, totalsX, totalsWidth, 'Subtotal', this.formatMoney(data.subtotal));
    if (data.taxAmount && data.taxAmount.greaterThan(0)) {
      this.writeTotalRow(
        doc,
        totalsX,
        totalsWidth,
        `Tax (${((data.taxRate || 0) * 100).toFixed(2)}%)`,
        this.formatMoney(data.taxAmount),
      );
    }
    this.writeTotalRow(doc, totalsX, totalsWidth, 'Total', this.formatMoney(data.totalAmount), true);
    if (data.amountPaid && data.amountPaid.greaterThan(0)) {
      this.writeTotalRow(doc, totalsX, totalsWidth, 'Amount Paid', `-${this.formatMoney(data.amountPaid)}`);
    }

    this.ensureSpace(doc, 56);
    doc.moveDown(0.4);
    const dueBoxY = doc.y;
    doc.roundedRect(totalsX, dueBoxY, totalsWidth, 36, 6)
      .fill(isPaid ? '#dcfce7' : '#fef3c7');
    doc.fillColor(isPaid ? '#047857' : '#b45309').fontSize(14).font('Helvetica-Bold');
    doc.text(isPaid ? 'PAID IN FULL' : 'Amount Due', totalsX + 10, dueBoxY + 10);
    doc.text(
      isPaid ? this.formatMoney(new Decimal(0)) : this.formatMoney(amountDue),
      totalsX + 10,
      dueBoxY + 10,
      { width: totalsWidth - 20, align: 'right' },
    );
    doc.font('Helvetica').fillColor('#1f2937');
    doc.y = dueBoxY + 44;

    if (data.notes || data.paymentInstructions) {
      this.ensureSpace(doc, 120);
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').text('Additional Information');
      doc.font('Helvetica').fontSize(10).fillColor('#334155');
      if (data.notes) {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text('Notes');
        doc.font('Helvetica').text(data.notes);
      }
      if (data.paymentInstructions) {
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').text('Payment Instructions');
        doc.font('Helvetica').text(data.paymentInstructions);
      }
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#64748b').text(
      `Questions? Contact ${data.unionEmail || 'your union office'} for invoice support.`,
      { align: 'center' },
    );
  }

  private static renderHtmlFallback(doc: InstanceType<typeof PDFDocument>, html: string): void {
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    doc.fontSize(20).fillColor('#0f172a').text('Invoice Archive Copy', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#334155').text(
      'This PDF was generated from the legacy HTML invoice path. Structured invoice rendering is used when InvoiceData is supplied directly.',
    );
    doc.moveDown();
    doc.fontSize(10).fillColor('#1f2937').text(text);
  }

  private static ensureSpace(doc: InstanceType<typeof PDFDocument>, height: number): void {
    if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
    doc.addPage();
  }

  private static writeAddress(
    doc: InstanceType<typeof PDFDocument>,
    address: InvoiceData['unionAddress'],
  ): void {
    for (const line of this.addressLines(address)) {
      doc.text(line);
    }
  }

  private static addressLines(address?: InvoiceData['customerAddress'] | InvoiceData['unionAddress']): string[] {
    if (!address) return [];
    return [
      address.line1,
      ...(address.line2 ? [address.line2] : []),
      `${address.city}, ${address.province} ${address.postalCode}`,
      address.country,
    ];
  }

  private static drawInfoBox(
    doc: InstanceType<typeof PDFDocument>,
    box: { x: number; y: number; width: number; title: string; lines: string[] },
  ): void {
    doc.roundedRect(box.x, box.y, box.width, 80, 6).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(box.title, box.x + 10, box.y + 10);
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    let lineY = box.y + 28;
    for (const line of box.lines.filter(Boolean)) {
      doc.text(line, box.x + 10, lineY, { width: box.width - 20 });
      lineY += 12;
    }
  }

  private static writeTotalRow(
    doc: InstanceType<typeof PDFDocument>,
    x: number,
    width: number,
    label: string,
    value: string,
    emphasize = false,
  ): void {
    doc.font(emphasize ? 'Helvetica-Bold' : 'Helvetica').fontSize(emphasize ? 12 : 10);
    doc.fillColor('#1f2937').text(label, x, doc.y, { width: width / 2 });
    doc.text(value, x + width / 2, doc.y, { width: width / 2, align: 'right' });
    doc.moveDown(0.5);
  }

  private static formatMoney(value: Decimal): string {
    return `$${value.toFixed(2)} CAD`;
  }
}

