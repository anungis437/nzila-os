/**
 * Microsoft Teams Integration Adapter
 * 
 * Orchestrates sync operations for Microsoft Teams data including
 * teams, channels, messages, members, and files.
 */

import { BaseIntegration } from '../../base-integration';
import { TeamsClient } from './teams-client';
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

const PAGE_SIZE = 50; // Microsoft Graph API default

export class TeamsAdapter extends BaseIntegration {
  private client: TeamsClient;
  private orgId: string;

  constructor(orgId: string, config: Record<string, unknown>) {
    super(IntegrationType.COMMUNICATION, IntegrationProvider.MICROSOFT_TEAMS, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: true,
      supportsRealTime: false,
      supportedEntities: ['teams', 'channels', 'messages', 'members', 'files'],
      requiresOAuth: true,
      rateLimitPerMinute: 2000,
    });
    this.orgId = orgId;

    this.client = new TeamsClient({
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      tenantId: config.organizationId as string,
      apiUrl: config.apiUrl as string | undefined,
    });
  }

  async connect(): Promise<void> {
    const health = await this.client.healthCheck();
    if (health.status !== 'ok') {
      throw new Error(`Failed to connect to Microsoft Teams: ${health.message}`);
    }
    this.connected = true;
    this.logOperation('connect', { message: 'Connected to Microsoft Teams API' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logOperation('disconnect', { message: 'Microsoft Teams integration disconnected' });
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

    const entities = options.entities || ['teams', 'channels', 'messages', 'members', 'files'];
    const results: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      cursor: options.cursor,
    };

    try {
      // Teams are required for other entities
      if (entities.includes('teams') || entities.includes('channels') || 
          entities.includes('messages') || entities.includes('members') || 
          entities.includes('files')) {
        await this.syncTeamsAndChannels(options, results);
      }

      if (entities.includes('messages')) {
        await this.syncMessages(options, results);
      }

      if (entities.includes('members')) {
        await this.syncMembers(options, results);
      }

      if (entities.includes('files')) {
        await this.syncFiles(options, results);
      }

      this.logOperation('sync', {
        message: 'Microsoft Teams sync completed',
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
   * Sync teams and their channels
   */
  private async syncTeamsAndChannels(options: SyncOptions, results: SyncResult): Promise<void> {
    let nextLink: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getTeams({
        skipToken: nextLink,
        top: PAGE_SIZE,
      });

      for (const team of response.teams) {
        try {
          // Sync the team as a "team" type channel
          const _teamChannel = await db
            .insert(externalCommunicationChannels)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.MICROSOFT_TEAMS,
              externalId: team.id,
              channelName: team.displayName,
              channelType: 'team', // Special type for Teams
              isArchived: team.isArchived,
              createdAt: new Date(team.createdDateTime),
              description: team.description,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalCommunicationChannels.orgId,
                externalCommunicationChannels.externalProvider,
                externalCommunicationChannels.externalId,
              ],
              set: {
                channelName: team.displayName,
                isArchived: team.isArchived,
                description: team.description,
                lastSyncedAt: new Date(),
              },
            })
            .returning();

          results.recordsProcessed++;

          // Now sync channels within this team
          await this.syncTeamChannels(team.id, results);
        } catch (error) {
          this.logError('syncTeam', error as Error, { message: `Failed to sync team ${team.id}` });
          results.recordsFailed++;
        }
      }

      hasMore = !!response.nextLink;
      nextLink = response.nextLink;
    }
  }

  /**
   * Sync channels for a specific team
   */
  private async syncTeamChannels(teamId: string, results: SyncResult): Promise<void> {
    let nextLink: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getChannels(teamId, {
        skipToken: nextLink,
        top: PAGE_SIZE,
      });

      for (const channel of response.channels) {
        try {
          await db
            .insert(externalCommunicationChannels)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.MICROSOFT_TEAMS,
              externalId: channel.id,
              channelName: channel.displayName,
              channelType: channel.membershipType || 'standard',
              isArchived: false,
              createdAt: new Date(channel.createdDateTime),
              description: channel.description,
              parentChannelId: teamId, // Link to parent team
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalCommunicationChannels.orgId,
                externalCommunicationChannels.externalProvider,
                externalCommunicationChannels.externalId,
              ],
              set: {
                channelName: channel.displayName,
                description: channel.description,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncChannel', error as Error, { message: `Failed to sync channel ${channel.id}` });
          results.recordsFailed++;
        }
      }

      hasMore = !!response.nextLink;
      nextLink = response.nextLink;
    }
  }

  /**
   * Sync messages from all channels
   */
  private async syncMessages(options: SyncOptions, results: SyncResult): Promise<void> {
    // Get all channels (excluding teams)
    const channels = await db
      .select()
      .from(externalCommunicationChannels)
      .where(
        and(
          eq(externalCommunicationChannels.orgId, this.orgId),
          eq(externalCommunicationChannels.externalProvider, IntegrationProvider.MICROSOFT_TEAMS)
        )
      );

    // Build filter for incremental sync
    const filter = options.cursor
      ? `lastModifiedDateTime gt ${new Date(options.cursor).toISOString()}`
      : undefined;

    for (const channel of channels) {
      // Skip team-level entries, only process channels
      if (channel.channelType === 'team') continue;
      
      if (!channel.parentChannelId) continue; // Need team ID

      let nextLink: string | undefined;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.client.getChannelMessages(
            channel.parentChannelId,
            channel.externalId,
            {
              skipToken: nextLink,
              top: PAGE_SIZE,
              filter,
            }
          );

          for (const message of response.messages) {
            try {
              await db
                .insert(externalCommunicationMessages)
                .values({
                  orgId: this.orgId,
                  externalProvider: IntegrationProvider.MICROSOFT_TEAMS,
                  externalId: message.id,
                  channelId: channel.id,
                  userId: message.from?.user?.id,
                  messageText: message.body.content,
                  messageType: message.messageType,
                  timestamp: new Date(message.createdDateTime),
                  threadId: message.replyToId,
                  replyCount: 0, // Teams doesn&apos;t provide this directly
                  reactionCount: message.reactions?.length || 0,
                  lastSyncedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [
                    externalCommunicationMessages.orgId,
                    externalCommunicationMessages.externalProvider,
                    externalCommunicationMessages.externalId,
                  ],
                  set: {
                    messageText: message.body.content,
                    reactionCount: message.reactions?.length || 0,
                    lastSyncedAt: new Date(),
                  },
                });

              results.recordsProcessed++;
            } catch (error) {
              this.logError('syncMessage', error as Error, { message: `Failed to sync message ${message.id}` });
              results.recordsFailed++;
            }
          }

          hasMore = !!response.nextLink;
          nextLink = response.nextLink;
        } catch (error) {
          this.logError('syncMessages', error as Error, { message: `Failed to fetch messages for channel ${channel.externalId}` });
          break;
        }
      }
    }
  }

  /**
   * Sync members from all teams
   */
  private async syncMembers(options: SyncOptions, results: SyncResult): Promise<void> {
    // Get all teams (channelType = 'team')
    const teams = await db
      .select()
      .from(externalCommunicationChannels)
      .where(
        and(
          eq(externalCommunicationChannels.orgId, this.orgId),
          eq(externalCommunicationChannels.externalProvider, IntegrationProvider.MICROSOFT_TEAMS),
          eq(externalCommunicationChannels.channelType, 'team')
        )
      );

    for (const team of teams) {
      let nextLink: string | undefined;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.client.getTeamMembers(team.externalId, {
            skipToken: nextLink,
            top: PAGE_SIZE,
          });

          for (const member of response.members) {
            try {
              const isAdmin = member.roles?.includes('owner') || false;

              await db
                .insert(externalCommunicationUsers)
                .values({
                  orgId: this.orgId,
                  externalProvider: IntegrationProvider.MICROSOFT_TEAMS,
                  externalId: member.userId,
                  username: member.email?.split('@')[0] || member.displayName,
                  displayName: member.displayName,
                  email: member.email,
                  isBot: false,
                  isAdmin,
                  isDeleted: false,
                  lastSyncedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [
                    externalCommunicationUsers.orgId,
                    externalCommunicationUsers.externalProvider,
                    externalCommunicationUsers.externalId,
                  ],
                  set: {
                    displayName: member.displayName,
                    email: member.email,
                    isAdmin,
                    lastSyncedAt: new Date(),
                  },
                });

              results.recordsProcessed++;
            } catch (error) {
              this.logError('syncMember', error as Error, { message: `Failed to sync member ${member.userId}` });
              results.recordsFailed++;
            }
          }

          hasMore = !!response.nextLink;
          nextLink = response.nextLink;
        } catch (error) {
          this.logError('syncMembers', error as Error, { message: `Failed to fetch members for team ${team.externalId}` });
          break;
        }
      }
    }
  }

  /**
   * Sync files from all channels
   */
  private async syncFiles(options: SyncOptions, results: SyncResult): Promise<void> {
    // Get all channels (excluding teams)
    const channels = await db
      .select()
      .from(externalCommunicationChannels)
      .where(
        and(
          eq(externalCommunicationChannels.orgId, this.orgId),
          eq(externalCommunicationChannels.externalProvider, IntegrationProvider.MICROSOFT_TEAMS)
        )
      );

    for (const channel of channels) {
      // Skip team-level entries
      if (channel.channelType === 'team') continue;
      if (!channel.parentChannelId) continue;

      let nextLink: string | undefined;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.client.getChannelFiles(
            channel.parentChannelId,
            channel.externalId,
            {
              skipToken: nextLink,
              top: PAGE_SIZE,
            }
          );

          for (const file of response.files) {
            try {
              await db
                .insert(externalCommunicationFiles)
                .values({
                  orgId: this.orgId,
                  externalProvider: IntegrationProvider.MICROSOFT_TEAMS,
                  externalId: file.id,
                  channelId: channel.id,
                  userId: file.createdBy?.user?.id,
                  fileName: file.name,
                  fileType: file.name.split('.').pop() || 'unknown',
                  mimeType: file.file?.mimeType,
                  fileSize: file.size,
                  fileUrl: file.webUrl,
                  createdAt: new Date(file.createdDateTime),
                  commentCount: 0,
                  lastSyncedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [
                    externalCommunicationFiles.orgId,
                    externalCommunicationFiles.externalProvider,
                    externalCommunicationFiles.externalId,
                  ],
                  set: {
                    fileSize: file.size,
                    lastSyncedAt: new Date(),
                  },
                });

              results.recordsProcessed++;
            } catch (error) {
              this.logError('syncFile', error as Error, { message: `Failed to sync file ${file.id}` });
              results.recordsFailed++;
            }
          }

          hasMore = !!response.nextLink;
          nextLink = response.nextLink;
        } catch (error) {
          this.logError('syncFiles', error as Error, { message: `Failed to fetch files for channel ${channel.externalId}` });
          break;
        }
      }
    }
  }
}
