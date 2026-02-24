/**
 * Event Bus System
 * 
 * Provides in-memory event-driven architecture for loose coupling between components.
 * Can be upgraded to AWS EventBridge or Kafka for distributed systems.
 * 
 * Usage:
 * ```typescript
 * // Subscribe to events
 * eventBus.on('claim.created', async (event) => {
 *   await sendNotification(event.data);
 * });
 * 
 * // Emit events
 * eventBus.emit('claim.created', {
 *   claimId: '123',
 *   organizationId: 'org1',
 *   userId: 'user1',
 * });
 * 
 * // Wait for all handlers
 * await eventBus.emitAndWait('user.registered', { userId: '123' });
 * ```
 */

import { logger } from '@/lib/logger';
import type { OrganizationId } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventHandler<T = any> = (event: Event<T>) => void | Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncEventHandler<T = any> = (event: Event<T>) => Promise<void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Event<T = any> {
  type: string;
  data: T;
  metadata: EventMetadata;
}

export interface EventMetadata {
  eventId: string;
  timestamp: Date;
  organizationId?: OrganizationId;
  userId?: string;
  source?: string;
  correlationId?: string;
}

export interface EventSubscription {
  handler: EventHandler;
  once: boolean;
}

/**
 * In-Memory Event Bus
 * 
 * Thread-safe event emitter with support for async handlers,
 * error handling, and event history.
 */
export class EventBus {
  private subscribers = new Map<string, Set<EventSubscription>>();
  private eventHistory: Event[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * Subscribe to an event type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on<T = any>(
    eventType: string,
    handler: EventHandler<T>
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const subscription: EventSubscription = {
      handler: handler as EventHandler,
      once: false,
    };

    this.subscribers.get(eventType)!.add(subscription);

    logger.debug('Event subscriber registered', { eventType });

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(subscription);
    };
  }

  /**
   * Subscribe to an event type (fires once then unsubscribes)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once<T = any>(
    eventType: string,
    handler: EventHandler<T>
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const subscription: EventSubscription = {
      handler: handler as EventHandler,
      once: true,
    };

    this.subscribers.get(eventType)!.add(subscription);

    logger.debug('One-time event subscriber registered', { eventType });

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(subscription);
    };
  }

  /**
   * Emit an event (fire-and-forget)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit<T = any>(
    eventType: string,
    data: T,
    metadata?: Partial<EventMetadata>
  ): void {
    const event: Event<T> = {
      type: eventType,
      data,
      metadata: {
        eventId: this.generateEventId(),
        timestamp: new Date(),
        ...metadata,
      },
    };

    // Store in history
    this.addToHistory(event);

    // Get subscribers
    const subscribers = this.subscribers.get(eventType);
    if (!subscribers || subscribers.size === 0) {
      logger.debug('No subscribers for event', { eventType });
      return;
    }

    logger.debug('Emitting event', {
      eventType,
      subscriberCount: subscribers.size,
      eventId: event.metadata.eventId,
    });

    // Execute handlers asynchronously
    const subscriptionsToRemove: EventSubscription[] = [];

    for (const subscription of subscribers) {
      // Execute in background
      this.executeHandler(subscription.handler, event).catch((error) => {
        logger.error('Event handler failed', {
          eventType,
          eventId: event.metadata.eventId,
          error: error.message,
        });
      });

      // Mark for removal if once
      if (subscription.once) {
        subscriptionsToRemove.push(subscription);
      }
    }

    // Remove one-time subscriptions
    for (const subscription of subscriptionsToRemove) {
      subscribers.delete(subscription);
    }
  }

  /**
   * Emit an event and wait for all handlers to complete
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async emitAndWait<T = any>(
    eventType: string,
    data: T,
    metadata?: Partial<EventMetadata>
  ): Promise<void> {
    const event: Event<T> = {
      type: eventType,
      data,
      metadata: {
        eventId: this.generateEventId(),
        timestamp: new Date(),
        ...metadata,
      },
    };

    // Store in history
    this.addToHistory(event);

    // Get subscribers
    const subscribers = this.subscribers.get(eventType);
    if (!subscribers || subscribers.size === 0) {
      logger.debug('No subscribers for event', { eventType });
      return;
    }

    logger.debug('Emitting event (waiting)', {
      eventType,
      subscriberCount: subscribers.size,
      eventId: event.metadata.eventId,
    });

    // Execute all handlers
    const promises: Promise<void>[] = [];
    const subscriptionsToRemove: EventSubscription[] = [];

    for (const subscription of subscribers) {
      promises.push(
        this.executeHandler(subscription.handler, event).catch((error) => {
          logger.error('Event handler failed', {
            eventType,
            eventId: event.metadata.eventId,
            error: error.message,
          });
          throw error; // Re-throw to fail Promise.allSettled
        })
      );

      if (subscription.once) {
        subscriptionsToRemove.push(subscription);
      }
    }

    // Wait for all handlers
    const results = await Promise.allSettled(promises);

    // Remove one-time subscriptions
    for (const subscription of subscriptionsToRemove) {
      subscribers.delete(subscription);
    }

    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('Some event handlers failed', {
        eventType,
        failureCount: failures.length,
        totalCount: results.length,
      });
    }
  }

  /**
   * Remove all subscribers for an event type
   */
  off(eventType: string): void {
    this.subscribers.delete(eventType);
    logger.debug('Event subscribers removed', { eventType });
  }

  /**
   * Remove all subscribers
   */
  clear(): void {
    this.subscribers.clear();
    logger.info('All event subscribers cleared');
  }

  /**
   * Get subscriber count for an event type
   */
  getSubscriberCount(eventType: string): number {
    return this.subscribers.get(eventType)?.size ?? 0;
  }

  /**
   * Get all event types with subscribers
   */
  getEventTypes(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Get event history
   */
  getHistory(limit = 100): Event[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Execute event handler safely
   */
  private async executeHandler(
    handler: EventHandler,
    event: Event
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      logger.error('Event handler threw error', {
        eventType: event.type,
        eventId: event.metadata.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Add event to history
   */
  private addToHistory(event: Event): void {
    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global event bus instance
 */
export const eventBus = new EventBus();

/**
 * Common application events
 */
export const AppEvents = {
  // Claims
  CLAIM_CREATED: 'claim.created',
  CLAIM_UPDATED: 'claim.updated',
  CLAIM_RESOLVED: 'claim.resolved',
  CLAIM_ESCALATED: 'claim.escalated',
  
  // Users
  USER_REGISTERED: 'user.registered',
  USER_LOGGED_IN: 'user.logged_in',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  
  // Members
  MEMBER_JOINED: 'member.joined',
  MEMBER_LEFT: 'member.left',
  MEMBER_DUES_PAID: 'member.dues_paid',
  
  // Voting
  VOTE_CREATED: 'vote.created',
  VOTE_CAST: 'vote.cast',
  VOTE_ENDED: 'vote.ended',
  
  // Documents
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_SHARED: 'document.shared',
  
  // Notifications
  NOTIFICATION_SENT: 'notification.sent',
  EMAIL_SENT: 'email.sent',
  SMS_SENT: 'sms.sent',
  
  // System
  SYSTEM_ERROR: 'system.error',
  SYSTEM_WARNING: 'system.warning',
  TASK_COMPLETED: 'task.completed',
  AUDIT_LOG: 'system.audit_log',
  
  // Organization
  ORG_CREATED: 'org.created',
  ORG_SETTINGS_CHANGED: 'org.settings_changed',
} as const;

/**
 * Typed event data interfaces
 */
export interface ClaimCreatedEvent {
  claimId: string;
  organizationId: OrganizationId;
  createdBy: string;
  type: string;
}

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  organizationId: OrganizationId;
}

export interface VoteCastEvent {
  voteId: string;
  voterId: string;
  organizationId: OrganizationId;
  ballotId: string;
}

