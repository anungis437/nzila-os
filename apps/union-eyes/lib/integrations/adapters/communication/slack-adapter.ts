/**
 * Slack Integration Adapter
 * 
 * Orchestrates sync operations for Slack workspace data including
 * channels, messages, users, and files.
 */

import { BaseIntegration } from '../../base-integration';
import { SlackClient } from './slack-client';
import type {
  SyncOptions,
  SyncResult,
  HealthCheckResult,
  WebhookEvent,
} from '../../types';
import { db } from '@/db';
import { 
  externalCommunicationChannels,
  externalCommunicationMessages,
  externalCommunicationUsers,
  externalCommunicationFiles,
} from '@/db/schema/domains/data/communication';
import { IntegrationType, IntegrationProvider, ConnectionStatus } from '../../types';
import { eq, and } from 'drizzle-orm';

const PAGE_SIZE = 200; // Slack cursor pagination

export class SlackAdapter extends BaseIntegration {
  private client: SlackClient;
  private orgId: string;

  constructor(orgId: string, config: Record<string, unknown>) {
    super(IntegrationType.COMMUNICATION, IntegrationProvider.SLACK, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: true,
      supportsRealTime: true,
      supportedEntities: ['channels', 'messages', 'users', 'files'],
      requiresOAuth: true,
      rateLimitPerMinute: 50,
    });
    this.orgId = orgId;

    this.client = new SlackClient({
      botToken: config.botToken as string,
      apiUrl: config.apiUrl as string | undefined,
      workspaceId: config.workspaceId as string | undefined,
    });
  }

  async connect(): Promise<void> {
    const health = await this.client.healthCheck();
    if (health.status !== 'ok') {
      throw new Error(`Failed to connect to Slack: ${health.message}`);
    }
    this.connected = true;
    this.logOperation('connect', { message: 'Connected to Slack API' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logOperation('disconnect', { message: 'Slack integration disconnected' });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now();
      const health = await this.client.healthCheck();
      const latencyMs = Date.now() - startTime;
      return {
        healthy: health.status === 'ok',
        status: health.status === 'ok' ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR,
        latencyMs,
        lastCheckedAt: new Date(),
        lastError: health.status !== 'ok' ? health.message : undefined,
      };
    } catch (error) {
      return {
        healthy: false,
        status: ConnectionStatus.ERROR,
        lastCheckedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    return true; // Simplified for now
  }

  async processWebhook(event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { eventType: event.type, message: `Processing ${event.type}` });
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    await this.ensureConnected();

    const entities = options.entities || ['channels', 'messages', 'users', 'files'];
    const results: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      cursor: options.cursor,
    };

    try {
      for (const entity of entities) {
        switch (entity) {
          case 'channels':
            await this.syncChannels(options, results);
            break;
          case 'messages':
            await this.syncMessages(options, results);
            break;
          case 'users':
            await this.syncUsers(options, results);
            break;
          case 'files':
            await this.syncFiles(options, results);
            break;
          default:
            this.logOperation('sync', { message: `Unknown entity type: ${entity}` });
        }
      }

      this.logOperation('sync', {
        message: 'Slack sync completed',
        processed: results.recordsProcessed,
        created: results.recordsCreated,
        updated: results.recordsUpdated,
      });
    } catch (error) {
      results.success = false;
      results.metadata = { error: error instanceof Error ? error.message : String(error) };
      this.logError('sync', error as Error);
    }

    return results;
  }

  /**
   * Sync all channels
   */
  private async syncChannels(options: SyncOptions, results: SyncResult): Promise<void> {
    let cursor: string | undefined = options.cursor;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getChannels({
        cursor,
        limit: PAGE_SIZE,
        excludeArchived: false,
      });

      for (const channel of response.channels) {
        try {
          await db
            .insert(externalCommunicationChannels)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.SLACK,
              externalId: channel.id,
              channelName: channel.name,
              channelType: channel.is_private ? 'private' : 'public',
              isArchived: channel.is_archived,
              createdAt: new Date(channel.created * 1000),
              creatorId: channel.creator,
              memberCount: channel.num_members || 0,
              topic: channel.topic?.value,
              description: channel.purpose?.value,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalCommunicationChannels.orgId,
                externalCommunicationChannels.externalProvider,
                externalCommunicationChannels.externalId,
              ],
              set: {
                channelName: channel.name,
                isArchived: channel.is_archived,
                memberCount: channel.num_members || 0,
                topic: channel.topic?.value,
                description: channel.purpose?.value,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncChannel', error as Error, { message: `Failed to sync channel ${channel.id}` });
          results.recordsFailed++;
        }
      }

      hasMore = !!response.nextCursor;
      cursor = response.nextCursor;
    }
  }

  /**
   * Sync messages from all channels
   */
  private async syncMessages(options: SyncOptions, results: SyncResult): Promise<void> {
    // First get all channels
    const channels = await db
      .select()
      .from(externalCommunicationChannels)
      .where(
        and(
          eq(externalCommunicationChannels.orgId, this.orgId),
          eq(externalCommunicationChannels.externalProvider, IntegrationProvider.SLACK)
        )
      );

    // Calculate oldest timestamp for incremental sync
    const oldestTimestamp = options.cursor 
      ? options.cursor 
      : undefined;

    for (const channel of channels) {
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await this.client.getChannelMessages(channel.externalId, {
          cursor,
          limit: PAGE_SIZE,
          oldest: oldestTimestamp,
        });

        for (const message of response.messages) {
          try {
            await db
              .insert(externalCommunicationMessages)
              .values({
                orgId: this.orgId,
                externalProvider: IntegrationProvider.SLACK,
                externalId: message.client_msg_id || message.ts,
                channelId: channel.id,
                userId: message.user,
                messageText: message.text,
                messageType: message.type,
                timestamp: new Date(parseFloat(message.ts) * 1000),
                threadId: message.thread_ts,
                replyCount: message.reply_count || 0,
                reactionCount: message.reactions?.reduce((sum, r) => sum + r.count, 0) || 0,
                lastSyncedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [
                  externalCommunicationMessages.orgId,
                  externalCommunicationMessages.externalProvider,
                  externalCommunicationMessages.externalId,
                ],
                set: {
                  messageText: message.text,
                  replyCount: message.reply_count || 0,
                  reactionCount: message.reactions?.reduce((sum, r) => sum + r.count, 0) || 0,
                  lastSyncedAt: new Date(),
                },
              });

            results.recordsProcessed++;
          } catch (error) {
            this.logError('syncMessage', error as Error, { message: `Failed to sync message ${message.ts}` });
            results.recordsFailed++;
          }
        }

        hasMore = !!response.nextCursor;
        cursor = response.nextCursor;
      }
    }
  }

  /**
   * Sync all users
   */
  private async syncUsers(options: SyncOptions, results: SyncResult): Promise<void> {
    let cursor: string | undefined = options.cursor;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getUsers({
        cursor,
        limit: PAGE_SIZE,
      });

      for (const user of response.users) {
        try {
          await db
            .insert(externalCommunicationUsers)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.SLACK,
              externalId: user.id,
              username: user.name,
              displayName: user.profile?.display_name || user.real_name || user.name,
              email: user.profile?.email,
              firstName: user.profile?.first_name,
              lastName: user.profile?.last_name,
              title: user.profile?.title,
              avatarUrl: user.profile?.image_72,
              isBot: user.is_bot || false,
              isAdmin: user.is_admin || false,
              isDeleted: user.deleted || false,
              statusText: user.profile?.status_text,
              statusEmoji: user.profile?.status_emoji,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalCommunicationUsers.orgId,
                externalCommunicationUsers.externalProvider,
                externalCommunicationUsers.externalId,
              ],
              set: {
                displayName: user.profile?.display_name || user.real_name || user.name,
                email: user.profile?.email,
                title: user.profile?.title,
                isBot: user.is_bot || false,
                isAdmin: user.is_admin || false,
                isDeleted: user.deleted || false,
                statusText: user.profile?.status_text,
                statusEmoji: user.profile?.status_emoji,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncUser', error as Error, { message: `Failed to sync user ${user.id}` });
          results.recordsFailed++;
        }
      }

      hasMore = !!response.nextCursor;
      cursor = response.nextCursor;
    }
  }

  /**
   * Sync files shared in workspace
   */
  private async syncFiles(options: SyncOptions, results: SyncResult): Promise<void> {
    const tsFrom = options.cursor;

    const response = await this.client.getFiles({
      limit: PAGE_SIZE,
      tsFrom,
    });

    for (const file of response.files) {
      try {
        // Find channel DB ID if file is shared in a channel
        let channelDbId: string | null = null;
        if (file.channels && file.channels.length > 0) {
          const channel = await db
            .select()
            .from(externalCommunicationChannels)
            .where(
              and(
                eq(externalCommunicationChannels.orgId, this.orgId),
                eq(externalCommunicationChannels.externalProvider, IntegrationProvider.SLACK),
                eq(externalCommunicationChannels.externalId, file.channels[0])
              )
            )
            .limit(1);
          
          if (channel.length > 0) {
            channelDbId = channel[0].id;
          }
        }

        await db
          .insert(externalCommunicationFiles)
          .values({
            orgId: this.orgId,
            externalProvider: IntegrationProvider.SLACK,
            externalId: file.id,
            channelId: channelDbId,
            userId: file.user,
            fileName: file.name,
            fileType: file.filetype,
            mimeType: file.mimetype,
            fileSize: file.size,
            fileUrl: file.url_private,
            downloadUrl: file.url_private_download,
            createdAt: new Date(file.created * 1000),
            commentCount: file.comments_count || 0,
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              externalCommunicationFiles.orgId,
              externalCommunicationFiles.externalProvider,
              externalCommunicationFiles.externalId,
            ],
            set: {
              commentCount: file.comments_count || 0,
              lastSyncedAt: new Date(),
            },
          });

        results.recordsProcessed++;
      } catch (error) {
        this.logError('syncFile', error as Error, { message: `Failed to sync file ${file.id}` });
        results.recordsFailed++;
      }
    }
  }
}
