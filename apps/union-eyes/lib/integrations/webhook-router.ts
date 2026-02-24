/**
 * Webhook Router
 * Central webhook verification, routing, and processing
 */

import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { webhookEvents } from '@/db/schema';
import crypto from 'crypto';
import {
  IntegrationProvider,
  WebhookEvent,
  WebhookStatus,
  WebhookError,
} from './types';
import { IntegrationFactory } from './factory';

/**
 * Webhook router configuration
 */
export interface WebhookRouterConfig {
  maxRetries: number;
  retryDelayMs: number;
  idempotencyWindow: number; // milliseconds
}

const DEFAULT_CONFIG: WebhookRouterConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  idempotencyWindow: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Webhook Router
 * Handles webhook verification, routing, and processing
 */
export class WebhookRouter {
  private static instance: WebhookRouter;
  private config: WebhookRouterConfig;
  private factory: IntegrationFactory;
  private processedEvents: Set<string> = new Set();

  private constructor(config: WebhookRouterConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.factory = IntegrationFactory.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WebhookRouter {
    if (!WebhookRouter.instance) {
      WebhookRouter.instance = new WebhookRouter();
    }
    return WebhookRouter.instance;
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(
    organizationId: string,
    provider: IntegrationProvider,
    payload: string,
    signature: string,
    _headers: Record<string, string>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const eventId = this.generateEventId(provider, payload);

    try {
      // Check if already processed (idempotency)
      if (await this.isProcessed(eventId)) {
        logger.info('Webhook already processed (idempotent)', {
          eventId,
          provider,
          organizationId,
        });
        return { success: true, eventId };
      }

      // Get integration instance
      const integration = await this.factory.getIntegration(organizationId, provider);

      // Verify webhook signature
      const verified = await integration.verifyWebhook(payload, signature);
      if (!verified) {
        throw new WebhookError('Invalid webhook signature', provider);
      }

      // Parse payload
      const data = JSON.parse(payload);

      // Create webhook event
      const event: WebhookEvent = {
        id: eventId,
        provider,
        type: this.extractEventType(data, provider),
        timestamp: new Date(),
        data,
        signature,
        verified: true,
      };

      // Store webhook event
      await this.storeEvent(organizationId, event, WebhookStatus.RECEIVED);

      // Process webhook
      await this.processEvent(organizationId, integration, event);

      // Mark as processed
      this.markProcessed(eventId);

      logger.info('Webhook processed successfully', {
        eventId,
        provider,
        organizationId,
        eventType: event.type,
      });

      return { success: true, eventId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Webhook processing failed', error instanceof Error ? error : new Error(errorMessage), {
        eventId,
        provider,
        organizationId,
      });

      // Store failed event
      await this.storeEvent(
        organizationId,
        {
          id: eventId,
          provider,
          type: 'unknown',
          timestamp: new Date(),
          data: payload,
          signature,
          verified: false,
        },
        WebhookStatus.FAILED,
        errorMessage
      );

      return { success: false, eventId, error: errorMessage };
    }
  }

  /**
   * Process webhook event with retries
   */
  private async processEvent(
    organizationId: string,
    integration: unknown,
    event: WebhookEvent,
    attempt: number = 1
  ): Promise<void> {
    try {
      await this.updateEventStatus(event.id, WebhookStatus.PROCESSING);
      await integration.processWebhook(event);
      await this.updateEventStatus(event.id, WebhookStatus.PROCESSED);
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        logger.warn('Webhook processing failed, retrying', {
          eventId: event.id,
          attempt,
          maxRetries: this.config.maxRetries,
        });

        await this.delay(this.config.retryDelayMs * attempt);
        await this.processEvent(organizationId, integration, event, attempt + 1);
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate event ID
   */
  private generateEventId(provider: IntegrationProvider, payload: string): string {
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return `${provider}_${hash.substring(0, 16)}`;
  }

  /**
   * Extract event type from payload
   */
  private extractEventType(data: unknown, provider: IntegrationProvider): string {
    // Provider-specific event type extraction
    switch (provider) {
      case IntegrationProvider.WORKDAY:
        return data.eventType || 'unknown';
      case IntegrationProvider.QUICKBOOKS:
        return data.eventNotifications?.[0]?.name || 'unknown';
      case IntegrationProvider.SLACK:
        return data.type || 'unknown';
      default:
        return data.type || data.event || data.eventType || 'unknown';
    }
  }

  /**
   * Check if event already processed
   */
  private async isProcessed(eventId: string): Promise<boolean> {
    // Check in-memory cache first
    if (this.processedEvents.has(eventId)) {
      return true;
    }

    // Check database
    const [event] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, eventId))
      .limit(1);

    if (event && event.status === WebhookStatus.PROCESSED) {
      this.processedEvents.add(eventId);
      return true;
    }

    return false;
  }

  /**
   * Mark event as processed
   */
  private markProcessed(eventId: string): void {
    this.processedEvents.add(eventId);

    // Clean up old entries periodically
    if (this.processedEvents.size > 10000) {
      this.processedEvents.clear();
    }
  }

  /**
   * Store webhook event
   */
  private async storeEvent(
    organizationId: string,
    event: WebhookEvent,
    status: WebhookStatus,
    error?: string
  ): Promise<void> {
    await db.insert(webhookEvents).values({
      id: event.id,
      organizationId,
      provider: event.provider,
      eventType: event.type,
      payload: event.data,
      signature: event.signature,
      verified: event.verified,
      status,
      error,
      receivedAt: event.timestamp,
      processedAt: status === WebhookStatus.PROCESSED ? new Date() : null,
    });
  }

  /**
   * Update event status
   */
  private async updateEventStatus(eventId: string, status: WebhookStatus): Promise<void> {
    await db
      .update(webhookEvents)
      .set({
        status,
        processedAt: status === WebhookStatus.PROCESSED ? new Date() : undefined,
      })
      .where(eq(webhookEvents.id, eventId));
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up old processed events
   */
  async cleanupOldEvents(daysOld: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await db
      .delete(webhookEvents)
      .where(
        and(
          eq(webhookEvents.status, WebhookStatus.PROCESSED),
          sql`${webhookEvents.receivedAt} < ${cutoff}`
        )
      );

    logger.info('Cleaned up old webhook events', {
      deletedCount: result.rowCount,
      cutoffDate: cutoff,
    });

    return result.rowCount || 0;
  }
}

/**
 * Convenience function to process webhook
 */
export async function processWebhook(
  organizationId: string,
  provider: IntegrationProvider,
  payload: string,
  signature: string,
  headers: Record<string, string> = {}
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const router = WebhookRouter.getInstance();
  return router.processWebhook(organizationId, provider, payload, signature, headers);
}

// Import symbols needed for the code above
import { eq, and, sql } from 'drizzle-orm';
