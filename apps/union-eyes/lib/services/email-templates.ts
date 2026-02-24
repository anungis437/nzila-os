/**
 * Email Template Service
 * 
 * Renders HTML email templates for all notification types
 * Supports variable substitution, branding, and responsive design
 */

import { logger } from "@/lib/logger";

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

interface TemplateContext {
  recipientName?: string;
  organizationName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface RenderedTemplate {
  subject: string;
  plainText: string;
  html: string;
}

// ============================================================================
// EMAIL TEMPLATE REGISTRY
// ============================================================================

const emailTemplates = {
  // ============================================================================
  // PAYMENT TEMPLATES
  // ============================================================================

  PAYMENT_RECEIVED: {
    subject: "Payment Received - ${organizationName}",
    plainText: `Dear ${"{recipientName}"},

We have successfully received your payment of $${"{amount}"}.

Payment Details:
- Amount: $${"{amount}"}
- Payment Method: ${"{paymentMethod}"}
- Transaction ID: ${"{transactionId}"}
- Date: ${"{date}"}

Thank you for your timely payment!

Best regards,
${"{organizationName}"}`,

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
      .content { background-color: #f9f9f9; padding: 20px; }
      .amount { font-size: 32px; font-weight: bold; color: #27ae60; }
      .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #27ae60; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
      .button { background-color: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Payment Received</h1>
      </div>
      <div class="content">
        <p>Dear ${"{recipientName}"},</p>
        <p>We have successfully received your payment.</p>
        <div class="amount">$${"{amount}"}</div>
        <div class="details">
          <p><strong>Payment Details:</strong></p>
          <p>Amount: $${"{amount}"}<br>
          Payment Method: ${"{paymentMethod}"}<br>
          Transaction ID: ${"{transactionId}"}<br>
          Date: ${"{date}"}</p>
        </div>
        <p>Thank you for your timely payment!</p>
        <p>Best regards,<br><strong>${"{organizationName}"}</strong></p>
      </div>
      <div class="footer">
        <p>© ${"{year}"} ${"{organizationName}"}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`,
  },

  PAYMENT_FAILED: {
    subject: "Payment Failed - Action Required",
    plainText: `Dear ${"{recipientName}"},

Your payment attempt has failed.

Payment Details:
- Amount: $${"{amount}"}
- Failure Reason: ${"{failureReason}"}
- Failure Date: ${"{date}"}

Please retry your payment using the link below:
${"{retryUrl}"}

If you continue to experience issues, please contact us for assistance.

Best regards,
${"{organizationName}"}`,

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #c0392b; color: white; padding: 20px; text-align: center; }
      .content { background-color: #f9f9f9; padding: 20px; }
      .alert { background-color: #fadbd8; border-left: 4px solid #c0392b; padding: 15px; margin: 15px 0; }
      .button { background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Payment Failed</h1>
      </div>
      <div class="content">
        <p>Dear ${"{recipientName}"},</p>
        <p>Your payment attempt has failed.</p>
        <div class="alert">
          <p><strong>Amount:</strong> $${"{amount}"}</p>
          <p><strong>Reason:</strong> ${"{failureReason}"}</p>
          <p><strong>Date:</strong> ${"{date}"}</p>
        </div>
        <p>Please retry your payment using the button below:</p>
        <a href="${"{retryUrl}"}" class="button">Retry Payment</a>
        <p>If you continue to experience issues, please contact us for assistance.</p>
        <p>Best regards,<br><strong>${"{organizationName}"}</strong></p>
      </div>
      <div class="footer">
        <p>© ${"{year}"} ${"{organizationName}"}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`,
  },

  // ============================================================================
  // DUES TEMPLATES
  // ============================================================================

  DUES_REMINDER: {
    subject: "Upcoming Dues Payment Reminder",
    plainText: `Dear ${"{recipientName}"},

Your union dues are coming due soon.

Dues Details:
- Amount Due: $${"{amount}"}
- Due Date: ${"{dueDate}"}
- Days Until Due: ${"{daysUntilDue}"}

Please pay your dues by visiting:
${"{paymentUrl}"}

Thank you,
${"{organizationName}"}`,

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #3498db; color: white; padding: 20px; text-align: center; }
      .content { background-color: #f9f9f9; padding: 20px; }
      .amount { font-size: 28px; font-weight: bold; color: #3498db; }
      .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }
      .button { background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Dues Payment Reminder</h1>
      </div>
      <div class="content">
        <p>Dear ${"{recipientName}"},</p>
        <p>Your union dues are coming due soon.</p>
        <div class="amount">$${"{amount}"}</div>
        <div class="details">
          <p><strong>Due Date:</strong> ${"{dueDate}"}<br>
          <strong>Days Until Due:</strong> ${"{daysUntilDue}"}</p>
        </div>
        <p>Please pay your dues by clicking the button below:</p>
        <a href="${"{paymentUrl}"}" class="button">Pay Dues Now</a>
        <p>Thank you,<br><strong>${"{organizationName}"}</strong></p>
      </div>
      <div class="footer">
        <p>© ${"{year}"} ${"{organizationName}"}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`,
  },

  DUES_OVERDUE: {
    subject: "URGENT: Dues Payment Overdue",
    plainText: `Dear ${"{recipientName}"},

URGENT: Your union dues payment is now overdue.

Dues Details:
- Original Amount: $${"{amount}"}
- Late Fee: $${"{lateFee}"}
- Total Due: $${"{totalDue}"}
- Due Date: ${"{dueDate}"}

Please pay immediately:
${"{paymentUrl}"}

Best regards,
${"{organizationName}"}`,

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #c0392b; color: white; padding: 20px; text-align: center; }
      .content { background-color: #f9f9f9; padding: 20px; }
      .amount { font-size: 32px; font-weight: bold; color: #c0392b; }
      .alert { background-color: #fadbd8; border-left: 4px solid #c0392b; padding: 15px; margin: 15px 0; }
      .button { background-color: #c0392b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>URGENT: Dues Payment Overdue</h1>
      </div>
      <div class="content">
        <p>Dear ${"{recipientName}"},</p>
        <p><strong>Your union dues payment is now overdue.</strong></p>
        <div class="amount">$${"{totalDue}"}</div>
        <div class="alert">
          <p><strong>Original Amount:</strong> $${"{amount}"}<br>
          <strong>Late Fee:</strong> $${"{lateFee}"}<br>
          <strong>Total Due:</strong> $${"{totalDue}"}<br>
          <strong>Due Date:</strong> ${"{dueDate}"}</p>
        </div>
        <p>Please pay immediately by clicking the button below:</p>
        <a href="${"{paymentUrl}"}" class="button">Pay Now</a>
        <p>Best regards,<br><strong>${"{organizationName}"}</strong></p>
      </div>
      <div class="footer">
        <p>© ${"{year}"} ${"{organizationName}"}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`,
  },

  // ============================================================================
  // VOTING TEMPLATES
  // ============================================================================

  VOTING_OPEN: {
    subject: "Voting is Now Open - ${electionName}",
    plainText: `Dear ${"{recipientName}"},

Voting is now open for ${"{electionName}"}!

Voting Details:
- Election: ${"{electionName}"}
- Voting Period: ${"{votingStart}"} to ${"{votingEnd}"}
- Time Remaining: ${"{timeRemaining}"}

Cast your vote:
${"{votingUrl}"}

Best regards,
${"{organizationName}"}`,

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
      .content { background-color: #f9f9f9; padding: 20px; }
      .button { background-color: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Voting is Open!</h1>
      </div>
      <div class="content">
        <p>Dear ${"{recipientName}"},</p>
        <p>Voting is now open for <strong>${"{electionName}"}</strong>!</p>
        <p><strong>Voting Period:</strong> ${"{votingStart}"} to ${"{votingEnd}"}<br>
        <strong>Time Remaining:</strong> ${"{timeRemaining}"}</p>
        <p>Cast your vote now:</p>
        <a href="${"{votingUrl}"}" class="button">Vote Now</a>
        <p>Best regards,<br><strong>${"{organizationName}"}</strong></p>
      </div>
      <div class="footer">
        <p>© ${"{year}"} ${"{organizationName}"}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`,
  },

  VOTING_REMINDER: {
    subject: "Reminder: Voting Closes Soon - ${electionName}",
    plainText: `Dear ${"{recipientName}"},

Don&apos;t forget! Voting for ${"{electionName}"} closes soon.

Voting Details:
- Election: ${"{electionName}"}
- Closes: ${"{votingEnd}"}
- Time Remaining: ${"{timeRemaining}"}

Cast your vote now:
${"{votingUrl}"}

Best regards,
${"{organizationName}"}`,

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f39c12; color: white; padding: 20px; text-align: center; }
      .content { background-color: #f9f9f9; padding: 20px; }
      .alert { background-color: #fdeaa8; border-left: 4px solid #f39c12; padding: 15px; margin: 15px 0; }
      .button { background-color: #f39c12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Voting Closes Soon!</h1>
      </div>
      <div class="content">
        <p>Dear ${"{recipientName}"},</p>
        <p>Don&apos;t forget! Voting for <strong>${"{electionName}"}</strong> closes soon.</p>
        <div class="alert">
          <p><strong>Closes:</strong> ${"{votingEnd}"}<br>
          <strong>Time Remaining:</strong> ${"{timeRemaining}"}</p>
        </div>
        <p>Cast your vote now:</p>
        <a href="${"{votingUrl}"}" class="button">Vote Now</a>
        <p>Best regards,<br><strong>${"{organizationName}"}</strong></p>
      </div>
      <div class="footer">
        <p>© ${"{year}"} ${"{organizationName}"}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`,
  },

  // ============================================================================
  // STRIKE TEMPLATES
  // ============================================================================

  STRIKE_BENEFITS: {
    subject: "Strike Benefits Available",
    plainText: `Dear ${"{recipientName}"},

You are now eligible to receive strike benefits!

Strike Details:
- Available Amount: $${"{amount}"}
- Strike Period: ${"{strikeStartDate}"} to ${"{strikeEndDate}"}

Claim your benefits:
${"{claimUrl}"}

Best regards,
${"{organizationName}"}`,

    html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #8e44ad; color: white; padding: 20px; text-align: center; }
      .content { background-color: #f9f9f9; padding: 20px; }
      .amount { font-size: 32px; font-weight: bold; color: #8e44ad; }
      .button { background-color: #8e44ad; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Strike Benefits Available</h1>
      </div>
      <div class="content">
        <p>Dear ${"{recipientName}"},</p>
        <p>You are now eligible to receive strike benefits!</p>
        <div class="amount">$${"{amount}"}</div>
        <p><strong>Strike Period:</strong> ${"{strikeStartDate}"} to ${"{strikeEndDate}"}</p>
        <p>Claim your benefits now:</p>
        <a href="${"{claimUrl}"}" class="button">Claim Benefits</a>
        <p>Best regards,<br><strong>${"{organizationName}"}</strong></p>
      </div>
      <div class="footer">
        <p>© ${"{year}"} ${"{organizationName}"}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`,
  },
};

// ============================================================================
// TEMPLATE SERVICE
// ============================================================================

/**
 * Render email template with variable substitution
 */
export function renderEmailTemplate(
  templateKey: string,
  context: TemplateContext
): RenderedTemplate {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = (emailTemplates as any)[templateKey];

    if (!template) {
      throw new Error(`Email template not found: ${templateKey}`);
    }

    // Add default context
    const fullContext = {
      year: new Date().getFullYear(),
      organizationName: process.env.ORGANIZATION_NAME || "Union Eyes",
      ...context,
    };

    // Render variables
    const subject = renderVariables(template.subject, fullContext);
    const plainText = renderVariables(template.plainText, fullContext);
    const html = renderVariables(template.html, fullContext);

    return {
      subject,
      plainText,
      html,
    };
  } catch (error) {
    logger.error("Failed to render email template", { error, templateKey });
    throw error;
  }
}

/**
 * Replace variables in template with values from context
 * Variables are in ${"{variableName}"} format
 */
function renderVariables(
  template: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, any>
): string {
  let result = template;

  // Replace all ${"{variable}"} patterns
  result = result.replace(/\$\{"{([^}"]+)"}\}/g, (match, variableName) => {
    const value = context[variableName];
    if (value === undefined || value === null) {
      logger.warn("Template variable not found in context", {
        variable: variableName,
      });
      return match; // Return original if not found
    }
    return String(value);
  });

  return result;
}

/**
 * Get all available template keys
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(emailTemplates);
}

/**
 * Validate template context has all required variables
 */
export function validateTemplateContext(
  templateKey: string,
  context: TemplateContext
): { valid: boolean; missingVariables: string[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template = (emailTemplates as any)[templateKey];

  if (!template) {
    return { valid: false, missingVariables: [`Template not found: ${templateKey}`] };
  }

  const allText = template.subject + template.plainText + template.html;
  const variableMatches = allText.match(/\$\{"{([^}"]+)"}\}/g) || [];
  const missingVariables = variableMatches.filter((match) => {
    const varName = match.replace(/\$\{"{([^}"]+)"}\}/g, "$1");
    return !context[varName];
  });

  return {
    valid: missingVariables.length === 0,
    missingVariables,
  };
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  renderEmailTemplate,
  getAvailableTemplates,
  validateTemplateContext,
};

