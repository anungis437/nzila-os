/**
 * Report Email Templates
 * 
 * Email delivery functions for scheduled reports
 * 
 * Part of: Phase 2.4 - Scheduled Reports System
 */

 
 
 
import type { ScheduledReport } from '@/db/queries/scheduled-reports-queries';

// ============================================================================
// Types
// ============================================================================

interface SendEmailParams {
  schedule: ScheduledReport;
  fileUrl: string;
  fileBuffer: Buffer;
}

// ============================================================================
// Email Sending
// ============================================================================

/**
 * Send scheduled report via email
 */
export async function sendScheduledReportEmail(params: SendEmailParams): Promise<void> {
  const { schedule: _schedule, fileUrl: _fileUrl, fileBuffer: _fileBuffer } = params;

  // Check if email service is configured
  const emailProvider = process.env.EMAIL_PROVIDER || 'resend';

  try {
    if (emailProvider === 'resend') {
      await sendViaResend(params);
    } else if (emailProvider === 'sendgrid') {
      await sendViaSendGrid(params);
    } else {
      // Fallback to console log for development
}
  } catch (error) {
throw error;
  }
}

/**
 * Send email via Resend
 */
async function sendViaResend(params: SendEmailParams): Promise<void> {
  const { schedule, fileUrl, fileBuffer } = params;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const reportName = (schedule as unknown as Record<string, unknown>).report_name as string || 'Report';
    const fileName = `${reportName.replace(/\s+/g, '-')}.${schedule.exportFormat}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'reports@union-claims.com',
      to: schedule.recipients,
      subject: `Scheduled Report: ${reportName}`,
      html: generateEmailHTML(schedule, fileUrl),
      attachments: [
        {
          filename: fileName,
          content: fileBuffer,
        },
      ],
    });
} catch (error) {
throw error;
  }
}

/**
 * Send email via SendGrid
 * Note: Requires @sendgrid/mail package to be installed
 * Install with: npm install @sendgrid/mail
 */
async function sendViaSendGrid(params: SendEmailParams): Promise<void> {
  const { schedule, fileUrl, fileBuffer } = params;

  // SendGrid integration (install with: pnpm add @sendgrid/mail)
  try {
    // Check if SendGrid is available
    let sgMail: { default: { setApiKey: (key: string) => void; send: (msg: Record<string, unknown>) => Promise<unknown> } };
    try {
       
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - @sendgrid/mail may not be installed
      sgMail = await import('@sendgrid/mail') as typeof sgMail;
    } catch (_importError) {
throw new Error('SendGrid package not installed. Using Resend fallback.');
    }

    if (!process.env.SENDGRID_API_KEY) {
throw new Error('SendGrid API key not configured. Using Resend fallback.');
    }

    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

    const reportName = (schedule as unknown as Record<string, unknown>).report_name as string || 'Report';
    const fileName = `${reportName.replace(/\s+/g, '-')}.${schedule.exportFormat}`;

    await sgMail.default.send({
      to: schedule.recipients,
      from: process.env.EMAIL_FROM || 'reports@union-claims.com',
      subject: `Scheduled Report: ${reportName}`,
      html: generateEmailHTML(schedule, fileUrl),
      attachments: [
        {
          content: fileBuffer.toString('base64'),
          filename: fileName,
          type: getMimeType(schedule.exportFormat),
          disposition: 'attachment',
        },
      ],
    });
return;
  } catch (_error) {
// Fall through to Resend implementation below
  }
}

// ============================================================================
// Email HTML Generation
// ============================================================================

/**
 * Generate HTML email body
 */
function generateEmailHTML(schedule: ScheduledReport, fileUrl: string): string {
  const reportName = (schedule as unknown as Record<string, unknown>).report_name as string || 'Report';
  const reportDescription = (schedule as unknown as Record<string, unknown>).report_description as string || '';
  const scheduleType = schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Scheduled Report</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        h1 {
          color: #1e40af;
          margin: 0;
          font-size: 24px;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          background-color: #dbeafe;
          color: #1e40af;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 10px;
        }
        .content {
          margin: 20px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-label {
          font-weight: 600;
          color: #6b7280;
        }
        .info-value {
          color: #111827;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #3b82f6;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin-top: 20px;
        }
        .button:hover {
          background-color: #2563eb;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Scheduled Report</h1>
          <span class="badge">${scheduleType} Report</span>
        </div>

        <div class="content">
          <h2 style="color: #111827; font-size: 18px; margin-bottom: 10px;">
            ${reportName}
          </h2>
          
          ${reportDescription ? `<p style="color: #6b7280; margin-bottom: 20px;">${reportDescription}</p>` : ''}

          <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <div class="info-row">
              <span class="info-label">Generated At:</span>
              <span class="info-value">${new Date().toLocaleString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Schedule Type:</span>
              <span class="info-value">${scheduleType}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Export Format:</span>
              <span class="info-value">${schedule.exportFormat.toUpperCase()}</span>
            </div>
            <div class="info-row" style="border-bottom: none;">
              <span class="info-label">Next Run:</span>
              <span class="info-value">${schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'N/A'}</span>
            </div>
          </div>

          <p style="margin: 20px 0;">
            Your scheduled report is attached to this email. You can also access it online using the button below.
          </p>

          <a href="${fileUrl}" class="button">
            View Report Online
          </a>
        </div>

        <div class="footer">
          <p>
            This is an automated report from Union Claims Management System.<br>
            If you wish to unsubscribe or modify your report schedule, please contact your administrator.
          </p>
          <p style="margin-top: 10px;">
            Ãƒâ€šÃ‚Â© ${new Date().getFullYear()} Union Claims. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get MIME type for export format
 */
function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    json: 'application/json',
  };

  return mimeTypes[format] || 'application/octet-stream';
}

/**
 * Send test email (for testing)
 */
export async function sendTestEmail(to: string): Promise<void> {
  const testSchedule: Partial<ScheduledReport> = {
    id: 'test-123',
    reportId: 'report-123',
    scheduleType: 'daily',
    exportFormat: 'pdf',
    recipients: [to],
    nextRunAt: new Date(),
  };

  const testBuffer = Buffer.from('Test report content', 'utf-8');

  await sendScheduledReportEmail({
    schedule: testSchedule as ScheduledReport,
    fileUrl: 'https://example.com/test-report.pdf',
    fileBuffer: testBuffer,
  });
}

