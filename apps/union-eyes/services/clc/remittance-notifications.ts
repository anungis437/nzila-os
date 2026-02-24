/**
 * CLC Remittance Notification Service
 * 
 * Comprehensive notification system for per-capita remittance alerts, reminders,
 * and escalation workflows. Supports email and SMS channels with customizable
 * templates and organization contact preferences.
 * 
 * Features:
 * - Overdue remittance alerts (7, 14, 30 days)
 * - Payment confirmation notifications
 * - Monthly reminders (7 days before due date)
 * - Executive escalation workflows
 * - Multi-channel delivery (email + SMS)
 * - Template customization
 * - Organization contact preferences
 * - Notification history tracking
 * 
 * Usage:
 * ```typescript
 * import { sendOverdueAlert, sendPaymentConfirmation, sendMonthlyReminder } from '@/services/clc/remittance-notifications';
 * 
 * // Send overdue alert
 * await sendOverdueAlert(remittanceId, 14); // 14 days overdue
 * 
 * // Send payment confirmation
 * await sendPaymentConfirmation(remittanceId);
 * 
 * // Send monthly reminder
 * await sendMonthlyReminder(organizationId, new Date(2025, 0, 1)); // Jan 2025
 * ```
 */

import { db } from '@/db';
import { 
  perCapitaRemittances, 
  organizations, 
  notificationLog,
  organizationContacts 
} from '@/db/schema';
import { eq, and, lte, isNull } from 'drizzle-orm';
import { Resend } from 'resend';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface NotificationConfig {
  channel: 'email' | 'sms' | 'both';
  priority: 'low' | 'medium' | 'high' | 'critical';
  sendToExecutive?: boolean;
}

interface NotificationTemplate {
  subject: string;
  emailBody: string;
  smsBody?: string;
}

interface NotificationRecipient {
  name: string;
  email?: string;
  phone?: string;
  role: 'primary' | 'secondary' | 'executive';
}

interface RemittanceNotificationData {
  remittanceId: string;
  organizationId: string;
  organizationName: string;
  charterNumber: string;
  remittanceMonth: Date;
  dueDate: Date;
  amount: number;
  memberCount: number;
  status: string;
  daysOverdue?: number;
}

interface NotificationResult {
  success: boolean;
  channel: 'email' | 'sms';
  recipientEmail?: string;
  recipientPhone?: string;
  messageId?: string;
  error?: string;
}

type NotificationType = 
  | 'overdue_alert' 
  | 'payment_confirmation' 
  | 'monthly_reminder' 
  | 'escalation' 
  | 'submission_received'
  | 'calculation_completed';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Lazy initialize Resend client
let resend: Resend | null = null;
function getResendClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const NOTIFICATION_CONFIG = {
  overdue: {
    day7: { channel: 'email' as const, priority: 'medium' as const },
    day14: { channel: 'both' as const, priority: 'high' as const },
    day30: { channel: 'both' as const, priority: 'critical' as const, sendToExecutive: true }
  },
  reminder: {
    day7Before: { channel: 'email' as const, priority: 'low' as const }
  },
  payment: {
    confirmation: { channel: 'email' as const, priority: 'low' as const }
  }
};

const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || 'notifications@clc.ca';
const _FROM_SMS = process.env.NOTIFICATION_FROM_PHONE || '+15551234567';
const EXECUTIVE_EMAIL = process.env.EXECUTIVE_EMAIL || 'executive@clc.ca';

// ============================================================================
// MAIN NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Send overdue remittance alert
 * Escalates based on days overdue (7, 14, 30+)
 */
export async function sendOverdueAlert(
  remittanceId: string,
  daysOverdue: number
): Promise<NotificationResult[]> {
  // Fetch remittance details
  const remittance = await fetchRemittanceData(remittanceId);
  if (!remittance) {
    throw new Error(`Remittance ${remittanceId} not found`);
  }

  // Determine escalation level
  const config = getOverdueConfig(daysOverdue);
  
  // Get recipients
  const recipients = await getNotificationRecipients(
    remittance.organizationId,
    config.sendToExecutive
  );

  // Generate notification content
  const template = generateOverdueTemplate(remittance, daysOverdue);

  // Send notifications
  const results = await sendNotifications(
    recipients,
    template,
    config,
    'overdue_alert',
    remittance
  );

  // Log notifications
  await logNotifications(
    remittanceId,
    remittance.organizationId,
    'overdue_alert',
    config.priority,
    results
  );

  return results;
}

/**
 * Send payment confirmation
 */
export async function sendPaymentConfirmation(
  remittanceId: string
): Promise<NotificationResult[]> {
  const remittance = await fetchRemittanceData(remittanceId);
  if (!remittance) {
    throw new Error(`Remittance ${remittanceId} not found`);
  }

  const config = NOTIFICATION_CONFIG.payment.confirmation;
  const recipients = await getNotificationRecipients(remittance.organizationId, false);
  const template = generatePaymentConfirmationTemplate(remittance);

  const results = await sendNotifications(
    recipients,
    template,
    config,
    'payment_confirmation',
    remittance
  );

  await logNotifications(
    remittanceId,
    remittance.organizationId,
    'payment_confirmation',
    config.priority,
    results
  );

  return results;
}

/**
 * Send monthly reminder (7 days before due date)
 */
export async function sendMonthlyReminder(
  organizationId: string,
  remittanceMonth: Date
): Promise<NotificationResult[]> {
  // Check if remittance already exists
  const month = remittanceMonth.getMonth() + 1; // Convert 0-11 to 1-12
  const year = remittanceMonth.getFullYear();
  
  const existingRemittance = await db
    .select()
    .from(perCapitaRemittances)
    .where(
      and(
        eq(perCapitaRemittances.organizationId, organizationId),
        eq(perCapitaRemittances.remittanceMonth, month),
        eq(perCapitaRemittances.remittanceYear, year)
      )
    )
    .limit(1);

  if (existingRemittance.length > 0) {
    // Remittance already submitted, no reminder needed
    return [];
  }

  // Get organization details
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (org.length === 0) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  const config = NOTIFICATION_CONFIG.reminder.day7Before;
  const recipients = await getNotificationRecipients(organizationId, false);
  
  const reminderData: RemittanceNotificationData = {
    remittanceId: '', // Not yet created
    organizationId,
    organizationName: org[0].name,
    charterNumber: org[0].charterNumber || '',
    remittanceMonth,
    dueDate: calculateDueDate(remittanceMonth),
    amount: 0, // Not yet calculated
    memberCount: 0,
    status: 'pending'
  };

  const template = generateMonthlyReminderTemplate(reminderData);

  const results = await sendNotifications(
    recipients,
    template,
    config,
    'monthly_reminder',
    reminderData
  );

  await logNotifications(
    null, // No remittance ID yet
    organizationId,
    'monthly_reminder',
    config.priority,
    results
  );

  return results;
}

/**
 * Send executive escalation for critical non-compliance
 */
export async function sendExecutiveEscalation(
  remittanceIds: string[]
): Promise<NotificationResult[]> {
  const remittances = await Promise.all(
    remittanceIds.map(id => fetchRemittanceData(id))
  );

  const validRemittances = remittances.filter(r => r !== null) as RemittanceNotificationData[];

  if (validRemittances.length === 0) {
    return [];
  }

  const template = generateExecutiveEscalationTemplate(validRemittances);

  const results: NotificationResult[] = [];

  // Send to executive
  const emailResult = await sendEmail(
    EXECUTIVE_EMAIL,
    template.subject,
    template.emailBody
  );

  results.push({
    success: emailResult.success,
    channel: 'email',
    recipientEmail: EXECUTIVE_EMAIL,
    messageId: emailResult.messageId,
    error: emailResult.error
  });

  // Log escalation
  for (const remittance of validRemittances) {
    await logNotifications(
      remittance.remittanceId,
      remittance.organizationId,
      'escalation',
      'critical',
      results
    );
  }

  return results;
}

/**
 * Send bulk monthly reminders to all organizations
 * Called by cron job 7 days before month start
 */
export async function sendBulkMonthlyReminders(
  remittanceMonth: Date
): Promise<{ sent: number; failed: number; skipped: number }> {
  const allOrgs = await db.select().from(organizations);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const org of allOrgs) {
    try {
      const results = await sendMonthlyReminder(org.id, remittanceMonth);
      if (results.length === 0) {
        skipped++;
      } else if (results.some(r => r.success)) {
        sent++;
      } else {
        failed++;
      }
    } catch (_error) {
failed++;
    }
  }

  return { sent, failed, skipped };
}

/**
 * Process overdue remittances and send escalating alerts
 * Called by daily cron job
 */
export async function processOverdueRemittances(): Promise<{
  day7: number;
  day14: number;
  day30: number;
  failed: number;
}> {
  const today = new Date();
  const day7Ago = new Date(today);
  day7Ago.setDate(today.getDate() - 7);
  const day14Ago = new Date(today);
  day14Ago.setDate(today.getDate() - 14);
  const day30Ago = new Date(today);
  day30Ago.setDate(today.getDate() - 30);

  // Convert dates to YYYY-MM-DD format for comparison
  const todayStr = today.toISOString().split('T')[0];

  // Find overdue remittances
  const overdueRemittances = await db
    .select()
    .from(perCapitaRemittances)
    .where(
      and(
        lte(perCapitaRemittances.dueDate, todayStr),
        isNull(perCapitaRemittances.paidDate)
      )
    );

  let day7Count = 0;
  let day14Count = 0;
  let day30Count = 0;
  let failedCount = 0;

  const criticalRemittances: string[] = [];

  for (const remittance of overdueRemittances) {
    const dueDate = new Date(remittance.dueDate);
    const daysOverdue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    try {
      // Send alert at specific intervals
      if (daysOverdue === 7) {
        await sendOverdueAlert(remittance.id, daysOverdue);
        day7Count++;
      } else if (daysOverdue === 14) {
        await sendOverdueAlert(remittance.id, daysOverdue);
        day14Count++;
      } else if (daysOverdue === 30) {
        await sendOverdueAlert(remittance.id, daysOverdue);
        day30Count++;
        criticalRemittances.push(remittance.id);
      }
    } catch (_error) {
failedCount++;
    }
  }

  // Send executive escalation for critical cases (30+ days)
  if (criticalRemittances.length > 0) {
    await sendExecutiveEscalation(criticalRemittances);
  }

  return { day7: day7Count, day14: day14Count, day30: day30Count, failed: failedCount };
}

// ============================================================================
// HELPER FUNCTIONS - DATA FETCHING
// ============================================================================

async function fetchRemittanceData(remittanceId: string): Promise<RemittanceNotificationData | null> {
  const result = await db
    .select({
      remittance: perCapitaRemittances,
      organization: organizations
    })
    .from(perCapitaRemittances)
    .innerJoin(organizations, eq(perCapitaRemittances.organizationId, organizations.id))
    .where(eq(perCapitaRemittances.id, remittanceId))
    .limit(1);

  if (result.length === 0) return null;

  const { remittance, organization } = result[0];
  const today = new Date();
  const dueDate = new Date(remittance.dueDate);
  const daysOverdue = dueDate < today && !remittance.paidDate
    ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : undefined;

  return {
    remittanceId: remittance.id,
    organizationId: organization.id,
    organizationName: organization.name,
    charterNumber: organization.charterNumber || '',
    remittanceMonth: new Date(remittance.remittanceYear, remittance.remittanceMonth - 1, 1),
    dueDate: new Date(remittance.dueDate),
    amount: Number(remittance.totalAmount),
    memberCount: remittance.remittableMembers,
    status: remittance.status || 'pending',
    daysOverdue
  };
}

async function getNotificationRecipients(
  organizationId: string,
  includeExecutive: boolean = false
): Promise<NotificationRecipient[]> {
  const contacts = await db
    .select()
    .from(organizationContacts)
    .where(eq(organizationContacts.organizationId, organizationId));

  const recipients: NotificationRecipient[] = contacts.map(contact => ({
    name: contact.name,
    email: contact.email,
    phone: contact.phone || undefined,
    role: contact.isPrimary ? 'primary' : 'secondary'
  }));

  if (includeExecutive) {
    recipients.push({
      name: 'CLC Executive',
      email: EXECUTIVE_EMAIL,
      role: 'executive'
    });
  }

  return recipients;
}

// ============================================================================
// HELPER FUNCTIONS - CONFIGURATION
// ============================================================================

function getOverdueConfig(daysOverdue: number): NotificationConfig {
  if (daysOverdue >= 30) {
    return NOTIFICATION_CONFIG.overdue.day30;
  } else if (daysOverdue >= 14) {
    return NOTIFICATION_CONFIG.overdue.day14;
  } else {
    return NOTIFICATION_CONFIG.overdue.day7;
  }
}

function calculateDueDate(remittanceMonth: Date): Date {
  const year = remittanceMonth.getFullYear();
  const month = remittanceMonth.getMonth();
  
  // Due date is 15th of the following month
  const dueDate = new Date(year, month + 1, 15);
  return dueDate;
}

// ============================================================================
// HELPER FUNCTIONS - TEMPLATES
// ============================================================================

function generateOverdueTemplate(
  data: RemittanceNotificationData,
  daysOverdue: number
): NotificationTemplate {
  const severityText = daysOverdue >= 30 ? 'CRITICAL' : daysOverdue >= 14 ? 'URGENT' : 'IMPORTANT';
  
  return {
    subject: `${severityText}: CLC Per-Capita Remittance Overdue - ${data.organizationName}`,
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${daysOverdue >= 30 ? '#dc2626' : daysOverdue >= 14 ? '#ea580c' : '#f59e0b'}; color: white; padding: 20px; text-align: center;">
            <h1>${severityText} - Remittance Overdue</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9fafb;">
            <p>Dear ${data.organizationName},</p>
            
            <p>This is ${daysOverdue >= 30 ? 'a critical' : daysOverdue >= 14 ? 'an urgent' : 'an important'} reminder that your CLC per-capita remittance is <strong>${daysOverdue} days overdue</strong>.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Remittance Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>CLC Affiliate Code:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.charterNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Period:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.remittanceMonth.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Due Date:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.dueDate.toLocaleDateString('en-CA')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Amount:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${data.amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Members:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.memberCount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px;"><strong>Days Overdue:</strong></td>
                  <td style="padding: 8px; color: #dc2626; font-weight: bold;">${daysOverdue} days</td>
                </tr>
              </table>
            </div>
            
            ${daysOverdue >= 30 ? `
              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b;"><strong>CRITICAL:</strong> This remittance is significantly overdue. Non-compliance may result in penalties and escalation to CLC national office.</p>
              </div>
            ` : ''}
            
            <p><strong>Required Action:</strong> Please submit payment immediately to avoid further penalties.</p>
            
            <p>If you have questions or need assistance, please contact the CLC national office.</p>
            
            <p style="margin-top: 30px;">
              Sincerely,<br>
              Canadian Labour Congress<br>
              Per-Capita Remittance Department
            </p>
          </div>
        </body>
      </html>
    `,
    smsBody: daysOverdue >= 14 ? `${severityText}: CLC per-capita remittance for ${data.organizationName} is ${daysOverdue} days overdue. Amount: $${data.amount.toFixed(2)}. Please submit payment immediately.` : undefined
  };
}

function generatePaymentConfirmationTemplate(
  data: RemittanceNotificationData
): NotificationTemplate {
  return {
    subject: `Payment Confirmed - CLC Per-Capita Remittance for ${data.remittanceMonth.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })}`,
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #16a34a; color: white; padding: 20px; text-align: center;">
            <h1>âœ“ Payment Confirmed</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9fafb;">
            <p>Dear ${data.organizationName},</p>
            
            <p>Thank you! We have received and confirmed your CLC per-capita remittance payment.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Payment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>CLC Affiliate Code:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.charterNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Period:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.remittanceMonth.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Amount Paid:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${data.amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Members:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.memberCount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px;"><strong>Status:</strong></td>
                  <td style="padding: 8px; color: #16a34a; font-weight: bold;">PAID</td>
                </tr>
              </table>
            </div>
            
            <p>Your organization is now in good standing for this period. A receipt will be issued shortly.</p>
            
            <p>Thank you for your continued support of the Canadian Labour Congress.</p>
            
            <p style="margin-top: 30px;">
              Sincerely,<br>
              Canadian Labour Congress<br>
              Per-Capita Remittance Department
            </p>
          </div>
        </body>
      </html>
    `
  };
}

function generateMonthlyReminderTemplate(
  data: RemittanceNotificationData
): NotificationTemplate {
  return {
    subject: `Reminder: CLC Per-Capita Remittance Due Soon - ${data.remittanceMonth.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })}`,
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
            <h1>ðŸ“… Monthly Remittance Reminder</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9fafb;">
            <p>Dear ${data.organizationName},</p>
            
            <p>This is a friendly reminder that your CLC per-capita remittance for <strong>${data.remittanceMonth.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })}</strong> is due on <strong>${data.dueDate.toLocaleDateString('en-CA')}</strong>.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Remittance Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>CLC Affiliate Code:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.charterNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Period:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.remittanceMonth.toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px;"><strong>Due Date:</strong></td>
                  <td style="padding: 8px; font-weight: bold;">${data.dueDate.toLocaleDateString('en-CA')}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Next Steps:</strong></p>
              <ol style="margin: 10px 0;">
                <li>Review your membership data</li>
                <li>Calculate your per-capita amount</li>
                <li>Submit payment by ${data.dueDate.toLocaleDateString('en-CA')}</li>
              </ol>
            </div>
            
            <p>Please ensure timely submission to maintain good standing with CLC.</p>
            
            <p>If you have questions, please contact the CLC national office.</p>
            
            <p style="margin-top: 30px;">
              Sincerely,<br>
              Canadian Labour Congress<br>
              Per-Capita Remittance Department
            </p>
          </div>
        </body>
      </html>
    `
  };
}

function generateExecutiveEscalationTemplate(
  remittances: RemittanceNotificationData[]
): NotificationTemplate {
  const totalOverdue = remittances.reduce((sum, r) => sum + r.amount, 0);
  
  return {
    subject: `EXECUTIVE ALERT: ${remittances.length} Critical Per-Capita Remittances (30+ Days Overdue)`,
    emailBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background-color: #991b1b; color: white; padding: 20px; text-align: center;">
            <h1>ðŸš¨ EXECUTIVE ESCALATION</h1>
            <p style="font-size: 18px; margin: 10px 0;">Critical Non-Compliance Alert</p>
          </div>
          
          <div style="padding: 20px; background-color: #f9fafb;">
            <p><strong>Attention CLC Executive,</strong></p>
            
            <p>The following organizations have critically overdue per-capita remittances (30+ days past due date):</p>
            
            <div style="background-color: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #991b1b;">Summary</h3>
              <p><strong>Total Critical Cases:</strong> ${remittances.length}</p>
              <p><strong>Total Amount Overdue:</strong> $${totalOverdue.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
            </div>
            
            <h3>Affected Organizations:</h3>
            <table style="width: 100%; border-collapse: collapse; background-color: white;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Organization</th>
                  <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Code</th>
                  <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">Period</th>
                  <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">Amount</th>
                  <th style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                ${remittances.map(r => `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${r.organizationName}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${r.charterNumber}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">${r.remittanceMonth.toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb;">$${r.amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${r.daysOverdue}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Recommended Actions:</strong></p>
              <ul style="margin: 10px 0;">
                <li>Direct contact with organization leadership</li>
                <li>Review of payment arrangements</li>
                <li>Assessment of compliance penalties</li>
                <li>Consideration of membership status</li>
              </ul>
            </div>
            
            <p>This automated alert was generated by the CLC Per-Capita Remittance System.</p>
            
            <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
              Generated: ${new Date().toLocaleString('en-CA')}<br>
              System: CLC Per-Capita Remittance Management
            </p>
          </div>
        </body>
      </html>
    `
  };
}

// ============================================================================
// HELPER FUNCTIONS - DELIVERY
// ============================================================================

async function sendNotifications(
  recipients: NotificationRecipient[],
  template: NotificationTemplate,
  config: NotificationConfig,
  _type: NotificationType,
  _data: RemittanceNotificationData
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  for (const recipient of recipients) {
    // Send email
    if ((config.channel === 'email' || config.channel === 'both') && recipient.email) {
      const emailResult = await sendEmail(
        recipient.email,
        template.subject,
        template.emailBody
      );
      results.push({
        success: emailResult.success,
        channel: 'email',
        recipientEmail: recipient.email,
        messageId: emailResult.messageId,
        error: emailResult.error
      });
    }

    // Send SMS
    if ((config.channel === 'sms' || config.channel === 'both') && recipient.phone && template.smsBody) {
      const smsResult = await sendSMS(recipient.phone, template.smsBody);
      results.push({
        success: smsResult.success,
        channel: 'sms',
        recipientPhone: recipient.phone,
        messageId: smsResult.messageId,
        error: smsResult.error
      });
    }
  }

  return results;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const result = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message
      };
    }

    return {
      success: true,
      messageId: result.data?.id
    };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Import and use the Twilio SMS service
    const { sendSms } = await import('@/services/twilio-sms-service');
    
    const result = await sendSms({
      phoneNumber: to,
      message,
      organizationId: process.env.DEFAULT_ORGANIZATION_ID,
    });

    if (result.success) {
return {
        success: true,
        messageId: result.twilioSid ?? result.messageId
      };
    } else {
return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS - LOGGING
// ============================================================================

async function logNotifications(
  remittanceId: string | null,
  organizationId: string,
  type: NotificationType,
  priority: string,
  results: NotificationResult[]
): Promise<void> {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  try {
    await db.insert(notificationLog).values({
      remittanceId,
      organizationId,
      type,
      priority,
      channel: results.map(r => r.channel).join(','),
      recipients: results.map(r => r.recipientEmail || r.recipientPhone).filter(Boolean).join(','),
      successCount,
      failureCount,
      messageIds: results.map(r => r.messageId).filter(Boolean).join(','),
      errors: results.map(r => r.error).filter(Boolean).join('; '),
      sentAt: new Date().toISOString()
    });
  } catch (_error) {
}
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  NotificationConfig,
  NotificationTemplate,
  NotificationRecipient,
  RemittanceNotificationData,
  NotificationResult,
  NotificationType
};
