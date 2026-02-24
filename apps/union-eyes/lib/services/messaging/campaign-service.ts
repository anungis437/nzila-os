/**
 * Campaign Service
 * 
 * Phase 4: Communications & Organizing
 * Orchestrates campaign creation, scheduling, and sending
 * 
 * Features:
 * - Campaign lifecycle management (draft → scheduled → sending → sent)
 * - Audience resolution (segment queries)
 * - Consent validation
 * - Message queue management
 * - Delivery tracking
 * - Campaign analytics
 * 
 * Version: 1.0.0
 * Created: February 13, 2026
 */

import { db } from '@/db';
import { sql, eq, and, desc, inArray, like, or } from 'drizzle-orm';
import { campaigns, messageLog } from '@/db/schema';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { users } from '@/db/schema/user-management-schema';
import { communicationPreferences } from '@/db/schema/communication-analytics-schema';
import { memberSegments, type MemberSegmentFilters } from '@/db/schema/domains/member/member-segments';
import type {
  Campaign,
  InsertCampaign,
  MessageLog,
  InsertMessageLog,
  CommunicationPreferences,
} from '@/db/schema';
import type { EmailService } from './email-service';
import type { SMSService } from './sms-service';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CampaignSendOptions {
  campaignId: string;
  userId: string;
  dryRun?: boolean; // Preview mode: don&apos;t actually send, just calculate
}

export interface CampaignSendResult {
  campaignId: string;
  success: boolean;
  totalAudience: number;
  queued: number;
  skipped: number;
  errors: string[];
  estimatedCompletionMinutes?: number;
}

export interface AudienceResolutionResult {
  recipients: Array<{
    userId: string;
    email?: string;
    phone?: string;
    name?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
  }>;
  totalCount: number;
  eligibleCount: number; // After consent filtering
  skippedCount: number;
  skippedReasons: Record<string, number>;
}

// ============================================================================
// CAMPAIGN SERVICE
// ============================================================================

export class CampaignService {
  constructor(
    private emailService: EmailService,
    private smsService: SMSService,
  ) {}

  /**
   * Create a new campaign
   */
  async createCampaign(
    data: InsertCampaign,
    organizationId: string,
  ): Promise<Campaign> {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        ...data,
        organizationId,
        status: 'draft',
      })
      .returning();

    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string, organizationId: string): Promise<Campaign | null> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, organizationId),
        ),
      )
      .limit(1);

    return campaign || null;
  }

  /**
   * List campaigns with pagination
   */
  async listCampaigns(
    organizationId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: string;
      channel?: string;
    } = {},
  ): Promise<{ campaigns: Campaign[]; total: number }> {
    const { page = 1, pageSize = 20, status, channel } = options;
    const offset = (page - 1) * pageSize;

    let query = db
      .select()
      .from(campaigns)
      .where(eq(campaigns.organizationId, organizationId))
      .$dynamic();

    if (status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.where(eq(campaigns.status, status as any));
    }

    if (channel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.where(eq(campaigns.channel, channel as any));
    }

    const campaignsList = await query
      .orderBy(desc(campaigns.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaigns)
      .where(eq(campaigns.organizationId, organizationId));

    return {
      campaigns: campaignsList,
      total: count,
    };
  }

  /**
   * Resolve campaign audience
   * Applies segment query and filters by consent
   */
  async resolveAudience(
    campaignId: string,
    organizationId: string,
  ): Promise<AudienceResolutionResult> {
    const campaign = await this.getCampaign(campaignId, organizationId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const segmentFilters: MemberSegmentFilters | undefined = campaign.segmentId
      ? (await db
          .select({ filters: memberSegments.filters })
          .from(memberSegments)
          .where(
            and(
              eq(memberSegments.id, campaign.segmentId),
              eq(memberSegments.organizationId, organizationId)
            )
          )
          .limit(1)
        )[0]?.filters
      : (campaign.segmentQuery as MemberSegmentFilters | undefined);

    let baseQuery = db
      .select({
        userId: organizationMembers.userId,
        email: users.email,
        phone: users.phone,
        name: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(organizationMembers.userId, users.userId))
      .where(eq(organizationMembers.organizationId, organizationId))
      .$dynamic();

    if (segmentFilters?.status?.length) {
      baseQuery = baseQuery.where(inArray(organizationMembers.status, segmentFilters.status));
    }

    if (segmentFilters?.role?.length) {
      baseQuery = baseQuery.where(inArray(organizationMembers.role, segmentFilters.role));
    }

    if (segmentFilters?.searchQuery) {
      const q = `%${segmentFilters.searchQuery}%`;
      baseQuery = baseQuery.where(
        or(
          like(users.email, q),
          like(users.firstName, q),
          like(users.lastName, q),
          like(users.displayName, q),
          like(organizationMembers.membershipNumber, q)
        )
      );
    }

    const rawAudience = await baseQuery;
    const uniqueAudience = new Map<string, typeof rawAudience[0]>();
    rawAudience.forEach((item) => {
      if (item.userId) {
        uniqueAudience.set(item.userId, item);
      }
    });

    const audience = Array.from(uniqueAudience.values());

    const preferences = await db
      .select()
      .from(communicationPreferences)
      .where(
        and(
          eq(communicationPreferences.organizationId, organizationId),
          inArray(communicationPreferences.userId, audience.map((a) => a.userId))
        )
      );

    const recipients: AudienceResolutionResult['recipients'] = [];
    const skippedReasons: Record<string, number> = {
      no_consent: 0,
      unsubscribed: 0,
      bounced_previously: 0,
      invalid_contact_info: 0,
    };

    for (const recipient of audience) {
      const pref = preferences.find((p) => p.userId === recipient.userId);
      const channel = campaign.channel;

      const emailOk = !!recipient.email && (pref?.emailEnabled ?? true);
      const smsOk = !!recipient.phone && (pref?.smsEnabled ?? true);
      const pushOk = (pref?.pushEnabled ?? true);

      const hasConsent = channel === 'email'
        ? emailOk
        : channel === 'sms'
        ? smsOk
        : channel === 'push'
        ? pushOk
        : (emailOk || smsOk || pushOk);

      if (!hasConsent) {
        skippedReasons.no_consent++;
        continue;
      }

      const contactValid = channel === 'email'
        ? !!recipient.email
        : channel === 'sms'
        ? !!recipient.phone
        : true;

      if (!contactValid) {
        skippedReasons.invalid_contact_info++;
        continue;
      }

      recipients.push({
        userId: recipient.userId,
        email: recipient.email || undefined,
        phone: recipient.phone || undefined,
        name: recipient.name || [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || undefined,
      });
    }

    const totalCount = recipients.length + Object.values(skippedReasons).reduce((a, b) => a + b, 0);

    return {
      recipients,
      totalCount,
      eligibleCount: recipients.length,
      skippedCount: totalCount - recipients.length,
      skippedReasons,
    };
  }

  /**
   * Send campaign
   * Main orchestration method
   */
  async sendCampaign(options: CampaignSendOptions): Promise<CampaignSendResult> {
    const { campaignId, userId, dryRun = false } = options;

    // Get campaign
    const campaign = await this.getCampaign(campaignId, options.userId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Validate campaign status
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error(`Campaign cannot be sent. Current status: ${campaign.status}`);
    }

    // Resolve audience
    const audience = await this.resolveAudience(campaignId, campaign.organizationId);

    if (dryRun) {
      // Preview mode: return stats without sending
      return {
        campaignId,
        success: true,
        totalAudience: audience.totalCount,
        queued: audience.eligibleCount,
        skipped: audience.skippedCount,
        errors: [],
        estimatedCompletionMinutes: this.estimateCampaignDuration(
          audience.eligibleCount,
          campaign.channel,
        ),
      };
    }

    // Update campaign status to 'sending'
    await db
      .update(campaigns)
      .set({
        status: 'sending',
        sentAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    // Queue messages
    let queued = 0;
    const errors: string[] = [];

    try {
      for (const recipient of audience.recipients) {
        try {
          await this.queueMessage(campaign, recipient);
          queued++;
        } catch (error) {
          errors.push(`Failed to queue for ${recipient.userId}: ${error}`);
        }
      }

      // Update campaign status to 'sent'
      await db
        .update(campaigns)
        .set({
          status: 'sent',
          completedAt: new Date(),
          stats: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(campaign.stats as any),
            queued,
          },
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));

      return {
        campaignId,
        success: true,
        totalAudience: audience.totalCount,
        queued,
        skipped: audience.skippedCount,
        errors,
      };
    } catch (error) {
      // Update campaign status to 'failed'
      await db
        .update(campaigns)
        .set({
          status: 'failed',
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));

      throw error;
    }
  }

  /**
   * Queue a message for sending
   * Creates message_log entry with 'queued' status
   */
  private async queueMessage(
    campaign: Campaign,
    recipient: {
      userId: string;
      email?: string;
      phone?: string;
      name?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata?: Record<string, any>;
    },
  ): Promise<MessageLog> {
    const messageData: InsertMessageLog = {
      organizationId: campaign.organizationId,
      campaignId: campaign.id,
      recipientId: recipient.userId,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
      recipientName: recipient.name,
      channelType: campaign.channel,
      subject: campaign.subject || undefined,
      bodySnippet: campaign.body?.substring(0, 500),
      status: 'queued',
      metadata: recipient.metadata || {},
    };

    const [message] = await db
      .insert(messageLog)
      .values(messageData)
      .returning();

    return message;
  }

  /**
   * Process message queue
   * Background worker: dequeue and send messages
   */
  async processMessageQueue(batchSize: number = 100): Promise<void> {
    // Get queued messages
    const queuedMessages = await db
      .select()
      .from(messageLog)
      .where(eq(messageLog.status, 'queued'))
      .orderBy(messageLog.createdAt)
      .limit(batchSize);

    for (const message of queuedMessages) {
      try {
        await this.sendMessage(message);
      } catch (error) {
        logger.error(`Failed to send message ${message.id}:`, error);
        
        // Update message log with error
        await db
          .update(messageLog)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            retryCount: (message.retryCount || 0) + 1,
          })
          .where(eq(messageLog.id, message.id));
      }
    }
  }

  /**
   * Send a single message
   */
  private async sendMessage(message: MessageLog): Promise<void> {
    const _startTime = Date.now();

    try {
      let providerMessageId: string | undefined;

      switch (message.channelType) {
        case 'email':
          if (!message.recipientEmail) {
            throw new Error('No email address for recipient');
          }
          providerMessageId = await this.emailService.send({
            to: message.recipientEmail,
            subject: message.subject || 'Message from Union',
            body: message.bodySnippet || '',
            metadata: {
              messageLogId: message.id,
              campaignId: message.campaignId,
            },
          });
          break;

        case 'sms':
          if (!message.recipientPhone) {
            throw new Error('No phone number for recipient');
          }
          providerMessageId = await this.smsService.send({
            to: message.recipientPhone,
            body: message.bodySnippet || '',
            metadata: {
              messageLogId: message.id,
              campaignId: message.campaignId,
            },
          });
          break;

        default:
          throw new Error(`Unsupported channel type: ${message.channelType}`);
      }

      // Update message log
      await db
        .update(messageLog)
        .set({
          status: 'sent',
          providerMessageId,
          sentAt: new Date(),
        })
        .where(eq(messageLog.id, message.id));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Estimate campaign completion time
   */
  private estimateCampaignDuration(recipientCount: number, channel: string): number {
    // Rough estimates:
    // - Email: 100/minute
    // - SMS: 50/minute
    const messagesPerMinute = channel === 'email' ? 100 : 50;
    return Math.ceil(recipientCount / messagesPerMinute);
  }

  /**
   * Check if user has consent for channel
   */
  private hasConsent(
    preferences: CommunicationPreferences | undefined,
    channel: string,
  ): boolean {
    if (!preferences) {
      return false;
    }

    if (preferences.globallyUnsubscribed) {
      return false;
    }

    switch (channel) {
      case 'email':
        return preferences.emailEnabled ?? false;
      case 'sms':
        return preferences.smsEnabled ?? false;
      case 'push':
        return preferences.pushEnabled ?? false;
      default:
        return false;
    }
  }

  /**
   * Cancel campaign
   */
  async cancelCampaign(campaignId: string, userId: string): Promise<Campaign> {
    const [campaign] = await db
      .update(campaigns)
      .set({
        status: 'cancelled',
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId))
      .returning();

    return campaign;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string, organizationId: string): Promise<{
    stats: Campaign['stats'];
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    unsubscribeRate: number;
  }> {
    const campaign = await this.getCampaign(campaignId, organizationId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = campaign.stats as any;
    const total = stats.sent || 0;

    return {
      stats,
      deliveryRate: total > 0 ? ((stats.delivered || 0) / total) * 100 : 0,
      openRate: total > 0 ? ((stats.opened || 0) / total) * 100 : 0,
      clickRate: total > 0 ? ((stats.clicked || 0) / total) * 100 : 0,
      unsubscribeRate: total > 0 ? ((stats.unsubscribed || 0) / total) * 100 : 0,
    };
  }
}

/**
 * Singleton instance
 */
let campaignServiceInstance: CampaignService;

export function getCampaignService(
  emailService: EmailService,
  smsService: SMSService,
): CampaignService {
  if (!campaignServiceInstance) {
    campaignServiceInstance = new CampaignService(emailService, smsService);
  }
  return campaignServiceInstance;
}
