/**
 * Email Notification Service for Rewards System
 * Sends email notifications for award events, redemptions, and more
 */

import { Resend } from 'resend';
import { logger } from '@/lib/logger';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

interface _EmailRecipient {
  email: string;
  name: string;
}

interface AwardNotificationData {
  recipientName: string;
  recipientEmail: string;
  issuerName: string;
  awardTypeName: string;
  awardTypeIcon?: string;
  message: string;
  creditsAwarded: number;
  awardId: string;
  orgName: string;
}

interface ApprovalNotificationData {
  adminName: string;
  adminEmail: string;
  awardTypeName: string;
  recipientName: string;
  issuerName: string;
  message: string;
  creditsToAward: number;
  awardId: string;
  orgName: string;
}

interface ExpirationNotificationData {
  recipientName: string;
  recipientEmail: string;
  expiringAmount: number;
  expirationDate: Date;
  orgName: string;
}

interface RedemptionNotificationData {
  recipientName: string;
  recipientEmail: string;
  creditsRedeemed: number;
  checkoutUrl?: string;
  redemptionId: string;
  orgName: string;
}

/**
 * Send award received notification
 */
export async function sendAwardReceivedEmail(data: AwardNotificationData) {
  try {
    const { error } = await getResend().emails.send({
      from: `${data.orgName} Rewards <rewards@${process.env.EMAIL_DOMAIN || 'example.com'}>`,
      to: data.recipientEmail,
      subject: `🎉 You've been recognized by ${data.issuerName}!`,
      html: generateAwardReceivedHTML(data),
    });

    if (error) {
      logger.error('[Email] Failed to send award notification', {
        error,
        recipientEmail: data.recipientEmail,
        awardId: data.awardId,
      });
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    logger.error('[Email] Error sending award notification', {
      error,
      recipientEmail: data.recipientEmail,
      awardId: data.awardId,
    });
    return { success: false, error };
  }
}

/**
 * Send approval request notification to admins
 */
export async function sendApprovalRequestEmail(data: ApprovalNotificationData) {
  try {
    const { error } = await getResend().emails.send({
      from: `${data.orgName} Rewards <rewards@${process.env.EMAIL_DOMAIN || 'example.com'}>`,
      to: data.adminEmail,
      subject: `⚡ Award Pending Approval: ${data.awardTypeName}`,
      html: generateApprovalRequestHTML(data),
    });

    if (error) {
      logger.error('[Email] Failed to send approval request', {
        error,
        adminEmail: data.adminEmail,
        awardId: data.awardId,
      });
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    logger.error('[Email] Error sending approval request', {
      error,
      adminEmail: data.adminEmail,
      awardId: data.awardId,
    });
    return { success: false, error };
  }
}

/**
 * Send credit expiration warning
 */
export async function sendCreditExpirationEmail(data: ExpirationNotificationData) {
  try {
    const { error } = await getResend().emails.send({
      from: `${data.orgName} Rewards <rewards@${process.env.EMAIL_DOMAIN || 'example.com'}>`,
      to: data.recipientEmail,
      subject: `⚠️ Your credits are expiring soon!`,
      html: generateExpirationWarningHTML(data),
    });

    if (error) {
      logger.error('[Email] Failed to send expiration warning', {
        error,
        recipientEmail: data.recipientEmail,
      });
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    logger.error('[Email] Error sending expiration warning', {
      error,
      recipientEmail: data.recipientEmail,
    });
    return { success: false, error };
  }
}

/**
 * Send redemption confirmation
 */
export async function sendRedemptionConfirmationEmail(data: RedemptionNotificationData) {
  try {
    const { error } = await getResend().emails.send({
      from: `${data.orgName} Rewards <rewards@${process.env.EMAIL_DOMAIN || 'example.com'}>`,
      to: data.recipientEmail,
      subject: `✅ Redemption Confirmed: ${data.creditsRedeemed} credits`,
      html: generateRedemptionConfirmationHTML(data),
    });

    if (error) {
      logger.error('[Email] Failed to send redemption confirmation', {
        error,
        recipientEmail: data.recipientEmail,
        redemptionId: data.redemptionId,
      });
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    logger.error('[Email] Error sending redemption confirmation', {
      error,
      recipientEmail: data.recipientEmail,
      redemptionId: data.redemptionId,
    });
    return { success: false, error };
  }
}

// ============================================
// HTML Email Templates
// ============================================

function generateAwardReceivedHTML(data: AwardNotificationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Been Recognized!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 You've Been Recognized!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.recipientName},</p>
    
    <p style="font-size: 16px;">Great news! <strong>${data.issuerName}</strong> has recognized you with a <strong>${data.awardTypeName}</strong> award!</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      ${data.awardTypeIcon ? `<div style="font-size: 36px; margin-bottom: 10px;">${data.awardTypeIcon}</div>` : ''}
      <p style="font-style: italic; color: #555; margin: 0;">"${data.message}"</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;">
      <p style="color: white; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Credits Awarded</p>
      <p style="color: white; margin: 10px 0 0 0; font-size: 36px; font-weight: bold;">${data.creditsAwarded}</p>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/rewards" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Wallet</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
      Keep up the great work! 🚀
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
    <p>${data.orgName} • Recognition & Rewards System</p>
  </div>
</body>
</html>
  `;
}

function generateApprovalRequestHTML(data: ApprovalNotificationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Award Pending Approval</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f59e0b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">⚡ Award Pending Approval</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.adminName},</p>
    
    <p style="font-size: 16px;">A new award requires your approval:</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Award Type:</td>
          <td style="padding: 8px 0; font-weight: bold;">${data.awardTypeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Recipient:</td>
          <td style="padding: 8px 0; font-weight: bold;">${data.recipientName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Nominated by:</td>
          <td style="padding: 8px 0; font-weight: bold;">${data.issuerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Credits:</td>
          <td style="padding: 8px 0; font-weight: bold;">${data.creditsToAward}</td>
        </tr>
      </table>
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-style: italic; color: #555;">"${data.message}"</p>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/rewards/awards" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Award</a>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
    <p>${data.orgName} • Recognition & Rewards System</p>
  </div>
</body>
</html>
  `;
}

function generateExpirationWarningHTML(data: ExpirationNotificationData): string {
  const daysUntilExpiration = Math.ceil(
    (data.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credits Expiring Soon</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #ef4444; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Credits Expiring Soon!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.recipientName},</p>
    
    <p style="font-size: 16px;">This is a friendly reminder that some of your credits are about to expire:</p>
    
    <div style="text-align: center; margin: 30px 0; padding: 20px; background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px;">
      <p style="color: #991b1b; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Expiring Credits</p>
      <p style="color: #991b1b; margin: 10px 0 0 0; font-size: 48px; font-weight: bold;">${data.expiringAmount}</p>
      <p style="color: #991b1b; margin: 10px 0 0 0; font-size: 16px; font-weight: bold;">in ${daysUntilExpiration} ${daysUntilExpiration === 1 ? 'day' : 'days'}</p>
    </div>
    
    <p style="font-size: 16px;">Don&apos;t let your hard-earned credits go to waste! Redeem them now for exclusive rewards.</p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/rewards/redeem" style="display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Redeem Now</a>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
    <p>${data.orgName} • Recognition & Rewards System</p>
  </div>
</body>
</html>
  `;
}

function generateRedemptionConfirmationHTML(data: RedemptionNotificationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redemption Confirmed</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #10b981; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Redemption Confirmed!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.recipientName},</p>
    
    <p style="font-size: 16px;">Your redemption has been successfully processed!</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Credits Redeemed:</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.creditsRedeemed}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Redemption ID:</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.redemptionId.slice(0, 8)}...</td>
        </tr>
      </table>
    </div>
    
    ${data.checkoutUrl ? `
    <div style="text-align: center; margin: 30px 0;">
      <p style="font-size: 16px; margin-bottom: 15px;">Complete your order on Shopify:</p>
      <a href="${data.checkoutUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Complete Checkout</a>
    </div>
    ` : ''}
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Thank you for being part of our recognition program! 🎉
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
    <p>${data.orgName} • Recognition & Rewards System</p>
  </div>
</body>
</html>
  `;
}

