/**
 * Financial Email Notification Service
 * 
 * Handles all financial-related email notifications including:
 * - Payment confirmations
 * - Payment failures
 * - Invoice generation
 * - Receipt delivery
 * - Payment reminders
 */

import { Decimal } from 'decimal.js';
import { logger } from '@/lib/logger';
import { getResendClient, getFromEmail } from '@/lib/email-service';

export interface PaymentConfirmationEmail {
  to: string;
  memberName: string;
  transactionId: string;
  amount: Decimal;
  currency: string;
  paymentMethod: string;
  paymentDate: Date;
  receiptUrl?: string;
  invoiceNumber?: string;
}

export interface PaymentFailureEmail {
  to: string;
  memberName: string;
  amount: Decimal;
  currency: string;
  failureReason: string;
  failureDate: Date;
  retryUrl?: string;
  supportEmail: string;
}

export interface InvoiceEmail {
  to: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  amount: Decimal;
  currency: string;
  invoicePdfUrl: string;
  paymentUrl?: string;
}

export class FinancialEmailService {
  /**
   * Send payment confirmation email
   */
  static async sendPaymentConfirmation(params: PaymentConfirmationEmail): Promise<void> {
    try {
      const client = getResendClient();
      if (!client) { logger.warn('Resend not configured – payment confirmation email skipped'); return; }
      await client.emails.send({
        from: getFromEmail('Union Eyes'),
        to: params.to,
        subject: `Payment Confirmed - ${params.currency} ${params.amount.toFixed(2)}`,
        html: this.generatePaymentConfirmationHTML(params),
      });

      logger.info('Payment confirmation email sent', {
        to: params.to,
        transactionId: params.transactionId,
      });
    } catch (error) {
      logger.error('Failed to send payment confirmation email', { error });
      throw error;
    }
  }

  /**
   * Send payment failure notification
   */
  static async sendPaymentFailure(params: PaymentFailureEmail): Promise<void> {
    try {
      const client = getResendClient();
      if (!client) { logger.warn('Resend not configured – payment failure email skipped'); return; }
      await client.emails.send({
        from: getFromEmail('Union Eyes'),
        to: params.to,
        subject: `Payment Failed - Action Required`,
        html: this.generatePaymentFailureHTML(params),
      });

      logger.info('Payment failure email sent', { to: params.to });
    } catch (error) {
      logger.error('Failed to send payment failure email', { error });
      throw error;
    }
  }

  /**
   * Send invoice email
   */
  static async sendInvoice(params: InvoiceEmail): Promise<void> {
    try {
      const client = getResendClient();
      if (!client) { logger.warn('Resend not configured – invoice email skipped'); return; }
      await client.emails.send({
        from: getFromEmail('Union Eyes'),
        to: params.to,
        subject: `Invoice ${params.invoiceNumber} - Due ${params.dueDate.toLocaleDateString()}`,
        html: this.generateInvoiceHTML(params),
        attachments: params.invoicePdfUrl ? [{
          filename: `invoice-${params.invoiceNumber}.pdf`,
          path: params.invoicePdfUrl,
        }] : undefined,
      });

      logger.info('Invoice email sent', { to: params.to, invoiceNumber: params.invoiceNumber });
    } catch (error) {
      logger.error('Failed to send invoice email', { error });
      throw error;
    }
  }

  /**
   * Send receipt email
   */
  static async sendReceipt(params: {
    to: string;
    memberName: string;
    receiptNumber: string;
    amount: Decimal;
    currency: string;
    paymentDate: Date;
    receiptPdfUrl?: string;
  }): Promise<void> {
    try {
      const client = getResendClient();
      if (!client) { logger.warn('Resend not configured – receipt email skipped'); return; }
      await client.emails.send({
        from: getFromEmail('Union Eyes'),
        to: params.to,
        subject: `Receipt #${params.receiptNumber}`,
        html: `
          <h2>Payment Receipt</h2>
          <p>Dear ${params.memberName},</p>
          <p>Thank you for your payment. Here are your receipt details:</p>
          <table>
            <tr><td><strong>Receipt Number:</strong></td><td>${params.receiptNumber}</td></tr>
            <tr><td><strong>Amount:</strong></td><td>${params.currency} ${params.amount.toFixed(2)}</td></tr>
            <tr><td><strong>Date:</strong></td><td>${params.paymentDate.toLocaleDateString()}</td></tr>
          </table>
          <p>Keep this receipt for your records.</p>
        `,
        attachments: params.receiptPdfUrl ? [{
          filename: `receipt-${params.receiptNumber}.pdf`,
          path: params.receiptPdfUrl,
        }] : undefined,
      });
    } catch (error) {
      logger.error('Failed to send receipt email', { error });
      throw error;
    }
  }

  /**
   * Send payment reminder
   */
  static async sendPaymentReminder(params: {
    to: string;
    memberName: string;
    dueAmount: Decimal;
    currency: string;
    dueDate: Date;
    daysOverdue: number;
    paymentUrl: string;
  }): Promise<void> {
    try {
      const subject = params.daysOverdue > 0
        ? `Payment Overdue: ${params.daysOverdue} days - Action Required`
        : `Payment Reminder - Due in ${Math.abs(params.daysOverdue)} days`;

      const client = getResendClient();
      if (!client) { logger.warn('Resend not configured – payment reminder skipped'); return; }
      await client.emails.send({
        from: getFromEmail('Union Eyes'),
        to: params.to,
        subject,
        html: `
          <h2>Payment Reminder</h2>
          <p>Dear ${params.memberName},</p>
          <p>${params.daysOverdue > 0 
            ? `Your payment is <strong>overdue by ${params.daysOverdue} days</strong>.`
            : `This is a reminder that your payment is due in ${Math.abs(params.daysOverdue)} days.`
          }</p>
          <table>
            <tr><td><strong>Amount Due:</strong></td><td>${params.currency} ${params.dueAmount.toFixed(2)}</td></tr>
            <tr><td><strong>Due Date:</strong></td><td>${params.dueDate.toLocaleDateString()}</td></tr>
          </table>
          <p><a href="${params.paymentUrl}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 16px;">Pay Now</a></p>
          <p style="margin-top: 24px; color: #666; font-size: 14px;">If you have already made this payment, please disregard this message.</p>
        `,
      });
    } catch (error) {
      logger.error('Failed to send payment reminder email', { error });
      throw error;
    }
  }

  /**
   * Send AutoPay setup confirmation
   */
  static async sendAutopayConfirmation(params: {
    to: string;
    memberName: string;
    frequency: string;
    amount: Decimal;
    currency: string;
    nextChargeDate: Date;
  }): Promise<void> {
    try {
      const client = getResendClient();
      if (!client) { logger.warn('Resend not configured – autopay confirmation skipped'); return; }
      await client.emails.send({
        from: getFromEmail('Union Eyes'),
        to: params.to,
        subject: 'AutoPay Successfully Set Up',
        html: `
          <h2>AutoPay Confirmation</h2>
          <p>Dear ${params.memberName},</p>
          <p>Your automatic payment has been successfully set up.</p>
          <table>
            <tr><td><strong>Amount:</strong></td><td>${params.currency} ${params.amount.toFixed(2)}</td></tr>
            <tr><td><strong>Frequency:</strong></td><td>${params.frequency}</td></tr>
            <tr><td><strong>Next Payment:</strong></td><td>${params.nextChargeDate.toLocaleDateString()}</td></tr>
          </table>
          <p>You can manage your AutoPay settings at any time through your member portal.</p>
        `,
      });
    } catch (error) {
      logger.error('Failed to send autopay confirmation email', { error });
      throw error;
    }
  }

  /**
   * Send AutoPay failure notification (after multiple failures)
   */
  static async sendAutopayDisabled(params: {
    to: string;
    memberName: string;
    failureCount: number;
    lastFailureReason: string;
    updatePaymentUrl: string;
  }): Promise<void> {
    try {
      const client = getResendClient();
      if (!client) { logger.warn('Resend not configured – autopay disabled email skipped'); return; }
      await client.emails.send({
        from: getFromEmail('Union Eyes'),
        to: params.to,
        subject: 'AutoPay Disabled - Action Required',
        html: `
          <h2>AutoPay Disabled</h2>
          <p>Dear ${params.memberName},</p>
          <p><strong>Your AutoPay has been disabled</strong> after ${params.failureCount} failed payment attempts.</p>
          <p><strong>Last failure reason:</strong> ${params.lastFailureReason}</p>
          <p>To resume automatic payments, please update your payment method and re-enable AutoPay.</p>
          <p><a href="${params.updatePaymentUrl}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 16px;">Update Payment Method</a></p>
        `,
      });
    } catch (error) {
      logger.error('Failed to send autopay disabled email', { error });
      throw error;
    }
  }

  // ============================================================================
  // HTML TEMPLATES
  // ============================================================================

  private static generatePaymentConfirmationHTML(params: PaymentConfirmationEmail): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0070f3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .details-table td { padding: 12px; border-bottom: 1px solid #ddd; }
            .details-table td:first-child { font-weight: bold; width: 40%; }
            .amount { font-size: 24px; font-weight: bold; color: #0070f3; }
            .button { background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Payment Confirmed</h1>
            </div>
            <div class="content">
              <p>Dear ${params.memberName},</p>
              <p>Thank you! Your payment has been successfully processed.</p>
              
              <table class="details-table">
                <tr>
                  <td>Transaction ID:</td>
                  <td>${params.transactionId}</td>
                </tr>
                <tr>
                  <td>Amount Paid:</td>
                  <td class="amount">${params.currency} ${params.amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Payment Method:</td>
                  <td>${params.paymentMethod}</td>
                </tr>
                <tr>
                  <td>Payment Date:</td>
                  <td>${params.paymentDate.toLocaleDateString()} ${params.paymentDate.toLocaleTimeString()}</td>
                </tr>
                ${params.invoiceNumber ? `
                <tr>
                  <td>Invoice Number:</td>
                  <td>${params.invoiceNumber}</td>
                </tr>
                ` : ''}
              </table>

              ${params.receiptUrl ? `
                <a href="${params.receiptUrl}" class="button">Download Receipt</a>
              ` : ''}

              <p style="margin-top: 30px;">If you have any questions about this payment, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Union Eyes Financial System.</p>
              <p>© ${new Date().getFullYear()} Union Eyes. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private static generatePaymentFailureHTML(params: PaymentFailureEmail): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert { background: #fee; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
            .button { background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✗ Payment Failed</h1>
            </div>
            <div class="content">
              <p>Dear ${params.memberName},</p>
              <p>We were unable to process your payment of <strong>${params.currency} ${params.amount.toFixed(2)}</strong>.</p>
              
              <div class="alert">
                <strong>Reason:</strong> ${params.failureReason}
              </div>

              <p><strong>What to do next:</strong></p>
              <ul>
                <li>Verify your payment method has sufficient funds</li>
                <li>Check that your card details are up to date</li>
                <li>Contact your bank if the issue persists</li>
              </ul>

              ${params.retryUrl ? `
                <a href="${params.retryUrl}" class="button">Retry Payment</a>
              ` : ''}

              <p style="margin-top: 30px;">If you need assistance, please contact us at <a href="mailto:${params.supportEmail}">${params.supportEmail}</a>.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Union Eyes Financial System.</p>
              <p>© ${new Date().getFullYear()} Union Eyes. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private static generateInvoiceHTML(params: InvoiceEmail): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0070f3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice ${params.invoiceNumber}</h1>
            </div>
            <div class="content">
              <p>Dear ${params.customerName},</p>
              <p>Please find attached your invoice for ${params.currency} ${params.amount.toFixed(2)}.</p>
              
              <p><strong>Invoice Date:</strong> ${params.invoiceDate.toLocaleDateString()}</p>
              <p><strong>Due Date:</strong> ${params.dueDate.toLocaleDateString()}</p>
              <p><strong>Amount Due:</strong> ${params.currency} ${params.amount.toFixed(2)}</p>

              ${params.paymentUrl ? `
                <a href="${params.paymentUrl}" class="button">Pay Now</a>
              ` : ''}
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Union Eyes. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

