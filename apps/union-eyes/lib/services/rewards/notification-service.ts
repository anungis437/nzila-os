/**
 * Notification Triggers for Rewards System
 * Handles automatic email notifications for various reward events
 * Includes batch processing for credit expiration warnings
 */

import { db } from '@/db';
import { 
  rewardWalletLedger, 
  recognitionAwards, 
  rewardRedemptions,
  organizations,
  users,
  organizationMembers 
} from '@/db/schema';
import { 
  sendAwardReceivedEmail, 
  sendApprovalRequestEmail, 
  sendCreditExpirationEmail, 
  sendRedemptionConfirmationEmail 
} from './email-service';
import { eq, and, lte, gte, desc, sql, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

// Batch configuration
const BATCH_SIZE = 100;
const EMAIL_RATE_LIMIT_MS = 100; // Rate limit for sending emails

interface ExpiringCreditsNotification {
  userId: string;
  userEmail: string;
  userName: string;
  organizationName: string;
  expiringAmount: number;
  expirationDate: Date;
  daysRemaining: number;
}

interface NotificationResult {
  success: boolean;
  userId: string;
  emailSent: boolean;
  error?: string;
}

/**
 * Trigger notification when an award is issued
 */
export async function notifyAwardIssued(awardId: string) {
  try {
    // Fetch award details with relationships
    const award = await db.query.recognitionAwards.findFirst({
      where: (awards, { eq }) => eq(awards.id, awardId),
      with: {
        awardType: true,
        organization: true,
      },
    });

    if (!award || award.status !== 'issued') {
      return { success: false, error: 'Award not found or not issued' };
    }

    // Fetch recipient user details
    const recipient = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.userId, award.recipientUserId),
    });

    // Fetch issuer user details (issuerUserId can be null for system awards)
    const issuerUserId = award.issuerUserId;
    const issuer = issuerUserId
      ? await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.userId, issuerUserId),
        })
      : null;

    if (!recipient?.email) {
      return { success: false, error: 'Recipient email not found' };
    }

    // Send notification email
    await sendAwardReceivedEmail({
      recipientName: recipient.email.split('@')[0] || 'Member',
      recipientEmail: recipient.email,
      issuerName: issuer?.email.split('@')[0] || 'A colleague',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      awardTypeName: (award.awardType as any)?.name || 'Award',
      awardTypeIcon: undefined,
      message: award.reason || 'Great work!',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      creditsAwarded: (award.awardType as any)?.defaultCreditAmount || 0,
      awardId: award.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orgName: (award.organization as any)?.name || 'Organization',
    });

    return { success: true };
  } catch (error) {
    logger.error('[Notifications] Error sending award issued notification', { error, awardId });
    return { success: false, error };
  }
}

/**
 * Trigger notification when an award requires approval
 */
export async function notifyAwardPendingApproval(awardId: string) {
  try {
    // Fetch award details
    const award = await db.query.recognitionAwards.findFirst({
      where: (awards, { eq }) => eq(awards.id, awardId),
      with: {
        awardType: true,
        organization: true,
      },
    });

    if (!award || award.status !== 'pending') {
      return { success: false, error: 'Award not found or not pending' };
    }

    // Fetch recipient and issuer details
    const recipient = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.userId, award.recipientUserId),
    });
    const issuerUserId = award.issuerUserId;
    const issuer = issuerUserId
      ? await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.userId, issuerUserId),
        })
      : null;

    // Fetch organization admins
    const admins = await db.query.organizationMembers.findMany({
      where: (members, { eq, and, inArray }) =>
        and(
          eq(members.organizationId, award.orgId),
          inArray(members.role, ['admin', 'owner'])
        ),
    });

    // Send notification to all admins
    const results = await Promise.allSettled(
      admins.map(async (admin) => {
        if (!admin.email) return Promise.resolve();
        
        // Fetch admin user details
        const adminUser = await db.query.users.findFirst({
          where: eq(users.userId, admin.userId),
        });

        if (!adminUser) return Promise.resolve();
        
        return sendApprovalRequestEmail({
          adminName: adminUser.displayName || adminUser.email.split('@')[0] || 'Admin',
          adminEmail: adminUser.email,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          awardTypeName: (award.awardType as any)?.name || 'Award',
          recipientName: recipient?.email.split('@')[0] || 'Unknown',
          issuerName: issuer?.email.split('@')[0] || 'Unknown',
          message: award.reason || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          creditsToAward: (award.awardType as any)?.defaultCreditAmount || 0,
          awardId: award.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orgName: (award.organization as any)?.name || 'Organization',
        });
      })
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;

    return { success: true, notifiedAdmins: successCount };
  } catch (error) {
    logger.error('[Notifications] Error sending approval notifications', { error, awardId });
    return { success: false, error };
  }
}

/**
 * Get users with expiring credits within the specified timeframe
 * Uses batched queries for performance
 * 
 * NOTE: Credit expiration is not currently implemented in the schema.
 * This function returns an empty array until expiration tracking is added.
 */
export async function getExpiringCreditsUsers(daysBeforeExpiration: number, batchSize = BATCH_SIZE) {
  const now = new Date();
  const expiresBefore = new Date();
  expiresBefore.setDate(expiresBefore.getDate() + daysBeforeExpiration);

  const rows = await db
    .select({
      userId: rewardWalletLedger.userId,
      userEmail: users.email,
      userName: organizationMembers.name,
      organizationId: organizationMembers.organizationId,
      organizationName: organizations.name,
      expiringAmount: sql<number>`sum(${rewardWalletLedger.pointsChange})`,
      expirationDate: rewardWalletLedger.expiresAt,
    })
    .from(rewardWalletLedger)
    .leftJoin(users, eq(users.userId, rewardWalletLedger.userId))
    .leftJoin(organizationMembers, eq(organizationMembers.userId, rewardWalletLedger.userId))
    .leftJoin(organizations, eq(sql`${organizations.id}::text`, organizationMembers.organizationId))
    .where(
      and(
        gte(rewardWalletLedger.expiresAt, now),
        lte(rewardWalletLedger.expiresAt, expiresBefore),
        gt(rewardWalletLedger.pointsChange, 0)
      )
    )
    .groupBy(
      rewardWalletLedger.userId,
      rewardWalletLedger.expiresAt,
      users.email,
      organizationMembers.name,
      organizationMembers.organizationId,
      organizations.name
    )
    .limit(batchSize);

  return rows
    .filter((row) => row.userEmail && row.expirationDate)
    .map((row) => ({
      userId: row.userId,
      userEmail: row.userEmail as string,
      userName: row.userName || (row.userEmail as string).split('@')[0],
      organizationName: row.organizationName || 'UnionEyes',
      expiringAmount: row.expiringAmount || 0,
      expirationDate: row.expirationDate as Date,
      daysRemaining: Math.ceil(
        ((row.expirationDate as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    } as ExpiringCreditsNotification));
}

/**
 * Send credit expiration notification to a single user
 * 
 * NOTE: Credit expiration is not currently implemented.
 * This function logs a warning and returns success without sending emails.
 */
async function sendExpirationNotificationToUser(
  entry: ExpiringCreditsNotification
): Promise<NotificationResult> {
  try {
    await sendCreditExpirationEmail({
      recipientName: entry.userName,
      recipientEmail: entry.userEmail,
      orgName: entry.organizationName,
      expiringAmount: entry.expiringAmount,
      expirationDate: entry.expirationDate,
    });

    return { success: true, userId: entry.userId, emailSent: true };
  } catch (error) {
    logger.error('[Notifications] Error sending expiration notification', { error, userId: entry.userId });
    return { 
      success: false, 
      userId: entry.userId, 
      emailSent: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Trigger notification for expiring credits
 * Processes in batches with rate limiting
 */
export async function notifyExpiringCredits(daysBeforeExpiration = 7) {
  try {
    const now = Date.now();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysBeforeExpiration);

    logger.info('[Notifications] Checking for credits expiring', {
      daysBeforeExpiration,
      expiresBefore: expirationDate.toISOString(),
    });

    // Get all users with expiring credits (paginated)
    const usersWithExpiringCredits = await getExpiringCreditsUsers(daysBeforeExpiration, 10000);
    
    logger.info('[Notifications] Found users with expiring credits', {
      count: usersWithExpiringCredits.length,
    });

    const results: NotificationResult[] = [];
    
    // Process in batches with rate limiting
    for (let i = 0; i < usersWithExpiringCredits.length; i += BATCH_SIZE) {
      const batch = usersWithExpiringCredits.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (userEntry) => {
          // Rate limit between emails
          await new Promise((resolve) => setTimeout(resolve, EMAIL_RATE_LIMIT_MS));
          
          return sendExpirationNotificationToUser(userEntry);
        })
      );
      
      results.push(...batchResults);

      // Log progress
      const progress = Math.min(i + BATCH_SIZE, usersWithExpiringCredits.length);
      logger.info('[Notifications] Processed expiring credit batch', {
        processed: progress,
        total: usersWithExpiringCredits.length,
      });
    }

    const successCount = results.filter((r) => r.emailSent).length;
    const failedCount = results.filter((r) => !r.emailSent).length;
    const duration = Date.now() - now;

    logger.info('[Notifications] Completed expiration notifications', {
      sent: successCount,
      failed: failedCount,
      durationMs: duration,
    });

    return {
      success: true,
      totalUsers: usersWithExpiringCredits.length,
      sent: successCount,
      failed: failedCount,
      duration: `${duration}ms`,
    };
  } catch (error) {
    logger.error('[Notifications] Error sending expiration notifications', { error });
    return { success: false, error };
  }
}

/**
 * Trigger notification when redemption is confirmed
 */
export async function notifyRedemptionConfirmed(redemptionId: string) {
  try {
    // Fetch redemption details
    const redemption = await db.query.rewardRedemptions.findFirst({
      where: (redemptions, { eq }) => eq(redemptions.id, redemptionId),
      with: {
        organization: true,
      },
    });

    if (!redemption) {
      return { success: false, error: 'Redemption not found' };
    }

    // Fetch user details
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.userId, redemption.userId),
    });

    if (!user?.email) {
      return { success: false, error: 'User email not found' };
    }

    // Send notification email
    await sendRedemptionConfirmationEmail({
      recipientName: user.email.split('@')[0] || 'Member',
      recipientEmail: user.email,
      creditsRedeemed: redemption.creditsSpent || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      checkoutUrl: redemption.providerCheckoutId || (redemption.providerPayloadJson as any)?.checkout_url,
      redemptionId: redemption.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orgName: (redemption.organization as any)?.name || 'Organization',
    });

    return { success: true };
  } catch (error) {
    logger.error('[Notifications] Error sending redemption confirmation', {
      error,
      redemptionId,
    });
    return { success: false, error };
  }
}

/**
 * Batch notification for credit expiration warnings
 * Should be run as a scheduled job (daily)
 */
export async function sendBatchExpirationWarnings() {
  try {
    const now = Date.now();
    const results = {
      usersNotified7Days: 0,
      usersNotified14Days: 0,
      usersNotified30Days: 0,
      errors: [] as string[],
    };

    // Send notifications at multiple intervals
    const intervals = [
      { days: 7, counter: 'usersNotified7Days' },
      { days: 14, counter: 'usersNotified14Days' },
      { days: 30, counter: 'usersNotified30Days' },
    ];

    for (const interval of intervals) {
      const result = await notifyExpiringCredits(interval.days);
      
      if (result.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (results as any)[interval.counter] = result.sent;
      } else {
        results.errors.push(`Failed for ${interval.days} days: ${result.error}`);
      }
    }

    const duration = Date.now() - now;

    logger.info('[Notifications] Batch expiration warnings completed', {
      durationMs: duration,
      results,
    });

    return {
      success: true,
      ...results,
      duration: `${duration}ms`,
    };
  } catch (error) {
    logger.error('[Notifications] Error in batch expiration warnings', { error });
    return { success: false, error };
  }
}

/**
 * Get notification statistics for monitoring
 */
export async function getNotificationStats(organizationId?: string) {
  try {
    // Get recent notification counts (simplified - would need notification log table)
    const stats = {
      totalExpiringNotifications7Days: 0,
      totalExpiringNotifications14Days: 0,
      totalExpiringNotifications30Days: 0,
      pendingAwards: 0,
      recentRedemptions: 0,
    };

    // Credit expiration not yet implemented
    stats.totalExpiringNotifications7Days = 0;

    // Count pending awards
    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recognitionAwards)
      .where(eq(recognitionAwards.status, 'pending'));
    
    stats.pendingAwards = pendingResult?.count || 0;

    // Count recent redemptions
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const [redemptionResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rewardRedemptions)
      .where(gte(rewardRedemptions.createdAt, oneDayAgo));
    
    stats.recentRedemptions = redemptionResult?.count || 0;

    return { success: true, data: stats };
  } catch (error) {
    logger.error('[Notifications] Error getting stats', { error, organizationId });
    return { success: false, error };
  }
}

/**
 * Schedule future expiration notifications
 * This would be called after credits are earned
 * 
 * NOTE: Credit expiration is not currently implemented.
 * This function is a placeholder for future functionality.
 */
export async function scheduleExpirationNotifications(
  userId: string,
  creditsEarned: number,
  expiresAt: Date
) {
  try {
    const [latest] = await db
      .select({ balanceAfter: rewardWalletLedger.balanceAfter })
      .from(rewardWalletLedger)
      .where(eq(rewardWalletLedger.userId, userId))
      .orderBy(desc(rewardWalletLedger.createdAt))
      .limit(1);

    await db.insert(rewardWalletLedger).values({
      id: uuidv4(),
      userId,
      transactionType: 'expiration_scheduled',
      pointsChange: 0,
      balanceAfter: latest?.balanceAfter ?? 0,
      expiresAt,
      description: 'Credit expiration scheduled',
      createdAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return {
      success: true,
      scheduled: 1,
      message: 'Credit expiration scheduled',
    };
  } catch (error) {
    logger.error('[Notifications] Error in expiration scheduling placeholder', { error, userId });
    return { success: false, error };
  }
}

