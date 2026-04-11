/**
 * Dues Notification Templates
 * Templates for all dues-related notifications
 * 
 * Templates:
 * - dues_deduction_summary - Periodic deduction summary for members
 * - dues_reminder_7days - 7 days before due date (edge-case: non-payroll members)
 * - dues_reminder_1day - 1 day before due date (edge-case: non-payroll members)
 * - dues_overdue - Deduction missing or payment overdue
 * - dues_payment_confirmation - Payment/deduction confirmed
 * - dues_payment_failed - Payment failed (edge-case: manual payments)
 * - dues_payment_retry_scheduled - Retry scheduled after failure
 * - dues_admin_intervention - Requires admin assistance
 * 
 * @module lib/notification-templates/dues-notifications
 */

export interface DuesNotificationData {
  memberName: string;
  memberEmail: string;
  organizationName: string;
  amount: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  transactionId: string;
  breakdown?: {
    dues: string;
    cope: string;
    pac: string;
    strikeFund: string;
  };
  paymentUrl?: string;
  receiptUrl?: string;
  failureReason?: string;
  retryDate?: string;
  attemptNumber?: number;
}

/**
 * Dues notification templates
 */
export const DuesNotificationTemplates = {
  /**
   * 7-day reminder: Deduction expected in 7 days (for non-payroll members or manual-pay scenarios)
   */
  DUES_REMINDER_7_DAYS: {
    id: 'dues_reminder_7days',
    subject: (data: DuesNotificationData) => 
      `Reminder: Union Dues Due ${data.dueDate}`,
    
    title: (_data: DuesNotificationData) => 
      `Dues Due Soon`,
    
    body: (data: DuesNotificationData) => 
      `Hi ${data.memberName},\n\nThis is a reminder that your union dues of $${data.amount} are due on ${data.dueDate}.\n\nPayment Period: ${data.periodStart} to ${data.periodEnd}\n\nIf your dues are deducted from payroll, no action is needed — your employer will remit them automatically. Otherwise, please arrange payment by the due date.\n\nThank you for your continued membership!\n\n${data.organizationName}`,
    
    htmlBody: (data: DuesNotificationData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Dues Reminder</h2>
        <p>Hi ${data.memberName},</p>
        <p>This is a reminder that your union dues are <strong>due on ${data.dueDate}</strong>.</p>
        
        <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #0c5460;"><strong>If your dues are deducted from payroll, no action is needed.</strong> Your employer will remit them automatically.</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2c3e50;">Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Amount Due:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">$${data.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Due Date:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${data.dueDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Period:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${data.periodStart} - ${data.periodEnd}</td>
            </tr>
          </table>
          ${data.breakdown ? `
            <h4 style="margin: 15px 0 10px; color: #2c3e50;">Breakdown</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 4px 0;">Regular Dues:</td>
                <td style="text-align: right;">$${data.breakdown.dues}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">COPE:</td>
                <td style="text-align: right;">$${data.breakdown.cope}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">PAC:</td>
                <td style="text-align: right;">$${data.breakdown.pac}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">Strike Fund:</td>
                <td style="text-align: right;">$${data.breakdown.strikeFund}</td>
              </tr>
            </table>
          ` : ''}
        </div>
        
        ${data.paymentUrl ? `
          <p style="color: #6c757d; font-size: 14px;">If you need to make a manual payment:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.paymentUrl}" style="background: #6c757d; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">Make Manual Payment</a>
          </div>
        ` : ''}
        
        <p>Thank you for your continued membership!</p>
        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          ${data.organizationName}<br>
          <em>This is an automated reminder. Please do not reply to this email.</em>
        </p>
      </div>
    `,
  },

  /**
   * 1-day reminder: Deduction expected tomorrow (for non-payroll members)
   */
  DUES_REMINDER_1_DAY: {
    id: 'dues_reminder_1day',
    subject: (_data: DuesNotificationData) => 
      `⚠️ Reminder: Union Dues Due Tomorrow`,
    
    title: (_data: DuesNotificationData) => 
      `Dues Due Tomorrow`,
    
    body: (data: DuesNotificationData) => 
      `Hi ${data.memberName},\n\n⚠️ REMINDER: Your union dues of $${data.amount} are due TOMORROW (${data.dueDate}).\n\nIf your dues are deducted from payroll, no action is needed. Otherwise, please arrange payment today.\n\n${data.organizationName}`,
    
    htmlBody: (data: DuesNotificationData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
          <strong style="color: #856404;">⚠️ REMINDER</strong>
        </div>
        
        <h2 style="color: #2c3e50;">Dues Due Tomorrow</h2>
        <p>Hi ${data.memberName},</p>
        <p>Your union dues of <strong>$${data.amount}</strong> are due <strong>tomorrow (${data.dueDate})</strong>.</p>
        
        <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #0c5460;"><strong>If your dues are deducted from payroll, no action is needed.</strong></p>
        </div>
        
        ${data.paymentUrl ? `
          <p style="color: #6c757d; font-size: 14px;">For non-payroll members who need to make a manual payment:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.paymentUrl}" style="background: #6c757d; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">Make Manual Payment</a>
          </div>
        ` : ''}
        
        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          ${data.organizationName}
        </p>
      </div>
    `,
  },

  /**
   * Overdue notice: Deduction missing or dues overdue
   */
  DUES_OVERDUE: {
    id: 'dues_overdue',
    subject: (_data: DuesNotificationData) => 
      `🔴 Action Needed: Union Dues Overdue`,
    
    title: (_data: DuesNotificationData) => 
      `Dues Overdue`,
    
    body: (data: DuesNotificationData) => 
      `Hi ${data.memberName},\n\nYour union dues of $${data.amount} were due on ${data.dueDate} and are now overdue.\n\nThis may indicate a missed payroll deduction. Please check your recent pay stubs and contact your union if you believe the deduction was missed by your employer.\n\nIf you need to make a manual payment, please visit your account dashboard.\n\n${data.organizationName}`,
    
    htmlBody: (data: DuesNotificationData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 20px;">
          <strong style="color: #721c24;">🔴 DUES OVERDUE</strong>
        </div>
        
        <h2 style="color: #dc3545;">Overdue Dues Notice</h2>
        <p>Hi ${data.memberName},</p>
        <p>Your union dues of <strong>$${data.amount}</strong> were due on <strong>${data.dueDate}</strong> and are now <strong style="color: #dc3545;">overdue</strong>.</p>
        
        <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #0c5460;"><strong>This may indicate a missed payroll deduction.</strong> Please check your recent pay stubs. If you believe the deduction was missed by your employer, report it through your UnionEyes dashboard.</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Amount Overdue:</strong> $${data.amount}</p>
          <p style="margin: 0;"><strong>Original Due Date:</strong> ${data.dueDate}</p>
        </div>
        
        ${data.paymentUrl ? `
          <p style="color: #6c757d; font-size: 14px;">If you need to make a manual payment:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.paymentUrl}" style="background: #6c757d; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">Make Manual Payment</a>
          </div>
        ` : ''}
        
        <p><strong>Please review your deduction status to maintain your membership in good standing.</strong></p>
        <p style="color: #6c757d;">If you&apos;re experiencing financial hardship, please contact us to discuss options.</p>
        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          ${data.organizationName}
        </p>
      </div>
    `,
  },

  /**
   * Payment confirmation: Payment received
   */
  DUES_PAYMENT_CONFIRMATION: {
    id: 'dues_payment_confirmation',
    subject: (_data: DuesNotificationData) => 
      `✅ Payment Received - Thank You!`,
    
    title: (_data: DuesNotificationData) => 
      `Payment Confirmed`,
    
    body: (data: DuesNotificationData) => 
      `Hi ${data.memberName},\n\nThank you! We've received your dues payment of $${data.amount}.\n\nPayment Period: ${data.periodStart} to ${data.periodEnd}\n\nYour receipt is available at: ${data.receiptUrl || 'Your account dashboard'}\n\nThank you for your continued membership!\n\n${data.organizationName}`,
    
    htmlBody: (data: DuesNotificationData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin-bottom: 20px;">
          <strong style="color: #155724;">✅ PAYMENT RECEIVED</strong>
        </div>
        
        <h2 style="color: #28a745;">Payment Confirmed</h2>
        <p>Hi ${data.memberName},</p>
        <p>Thank you! We've successfully received your dues payment.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Amount Paid:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">$${data.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Period:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${data.periodStart} - ${data.periodEnd}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Transaction ID:</strong></td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${data.transactionId}</td>
            </tr>
          </table>
        </div>
        
        ${data.receiptUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.receiptUrl}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Receipt</a>
          </div>
        ` : ''}
        
        <p>Thank you for your continued membership!</p>
        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          ${data.organizationName}
        </p>
      </div>
    `,
  },

  /**
   * Payment failed: Payment processing failed
   */
  DUES_PAYMENT_FAILED: {
    id: 'dues_payment_failed',
    subject: (_data: DuesNotificationData) => 
      `⚠️ Payment Failed - Action Required`,
    
    title: (_data: DuesNotificationData) => 
      `Payment Failed`,
    
    body: (data: DuesNotificationData) => 
      `Hi ${data.memberName},\n\nYour dues payment of $${data.amount} could not be processed.\n\nReason: ${data.failureReason || 'Payment declined'}\n\nPlease update your payment method and try again.\n\n${data.organizationName}`,
    
    htmlBody: (data: DuesNotificationData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
          <strong style="color: #856404;">⚠️ PAYMENT FAILED</strong>
        </div>
        
        <h2 style="color: #856404;">Payment Could Not Be Processed</h2>
        <p>Hi ${data.memberName},</p>
        <p>We were unable to process your dues payment of <strong>$${data.amount}</strong>.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${data.failureReason || 'Payment declined by your bank or card issuer'}</p>
          ${data.retryDate ? `<p style="margin: 10px 0 0 0;"><strong>Next Retry:</strong> ${data.retryDate}</p>` : ''}
        </div>
        
        ${data.paymentUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.paymentUrl}" style="background: #ffc107; color: #212529; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Update Payment Method</a>
          </div>
        ` : ''}
        
        <p><strong>Please update your payment method and try again.</strong></p>
        <p style="color: #6c757d; font-size: 14px;">Common reasons for payment failures:</p>
        <ul style="color: #6c757d; font-size: 14px;">
          <li>Insufficient funds</li>
          <li>Expired card</li>
          <li>Incorrect card details</li>
          <li>Card declined by issuer</li>
        </ul>
        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          ${data.organizationName}
        </p>
      </div>
    `,
  },

  /**
   * Payment retry scheduled: Automatic retry scheduled
   */
  DUES_PAYMENT_RETRY_SCHEDULED: {
    id: 'dues_payment_retry_scheduled',
    subject: (_data: DuesNotificationData) => 
      `Payment Retry Scheduled`,
    
    title: (_data: DuesNotificationData) => 
      `Payment Retry Scheduled`,
    
    body: (data: DuesNotificationData) => 
      `Hi ${data.memberName},\n\nYour previous payment attempt of $${data.amount} failed. We&apos;ll automatically retry your payment on ${data.retryDate}.\n\nIf you&apos;d like to update your payment method before the retry, please visit your account dashboard.\n\n${data.organizationName}`,
    
    htmlBody: (data: DuesNotificationData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Payment Retry Scheduled</h2>
        <p>Hi ${data.memberName},</p>
        <p>Your previous payment attempt of <strong>$${data.amount}</strong> failed (Attempt ${data.attemptNumber || 1}).</p>
        
        <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>We&apos;ll automatically retry your payment on ${data.retryDate}.</strong></p>
        </div>
        
        ${data.paymentUrl ? `
          <p>If you&apos;d like to update your payment method before the retry:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.paymentUrl}" style="background: #17a2b8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Update Payment Method</a>
          </div>
        ` : ''}
        
        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          ${data.organizationName}
        </p>
      </div>
    `,
  },

  /**
   * Admin intervention needed: Max retry attempts reached
   */
  DUES_ADMIN_INTERVENTION: {
    id: 'dues_admin_intervention',
    subject: (data: DuesNotificationData) => 
      `🔴 Member Requires Assistance - ${data.memberName}`,
    
    title: (_data: DuesNotificationData) => 
      `Payment Assistance Required`,
    
    body: (data: DuesNotificationData) => 
      `Admin Alert:\n\nMember ${data.memberName} (${data.memberEmail}) has reached maximum payment retry attempts for dues payment of $${data.amount}.\n\nTransaction ID: ${data.transactionId}\nAttempts: ${data.attemptNumber || 4}\n\nPlease contact the member to resolve payment issues.\n\n${data.organizationName}`,
    
    htmlBody: (data: DuesNotificationData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 20px;">
          <strong style="color: #721c24;">🔴 ADMIN INTERVENTION REQUIRED</strong>
        </div>
        
        <h2 style="color: #dc3545;">Member Requires Payment Assistance</h2>
        <p>The following member has reached maximum payment retry attempts:</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Member:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${data.memberName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Email:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${data.memberEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Amount:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">$${data.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Failed Attempts:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${data.attemptNumber || 4}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Transaction ID:</strong></td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${data.transactionId}</td>
            </tr>
          </table>
        </div>
        
        <p><strong>Action Required:</strong> Please contact the member to resolve payment issues.</p>
        <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
          ${data.organizationName}<br>
          <em>This is an automated admin alert.</em>
        </p>
      </div>
    `,
  },
};
