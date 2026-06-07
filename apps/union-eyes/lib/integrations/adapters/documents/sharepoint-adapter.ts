/**
 * SharePoint Integration Adapter
 * 
 * Orchestrates sync operations for SharePoint document data including
 * sites, document libraries, files, and permissions.
 */

import { BaseIntegration } from '../../base-integration';
import { SharePointClient } from './sharepoint-client';
import type {
  IIntegration,
  SyncOptions,
  SyncResult,
  HealthCheckResult,
  WebhookEvent,
} from '../../types';
import { db } from '@/db';
import {
  externalDocumentSites,
  externalDocumentLibraries,
  externalDocumentFiles,
  externalDocumentPermissions,
} from '@/db/schema/domains/data/documents';
import { IntegrationType, IntegrationProvider, ConnectionStatus } from '../../types';
import { eq, and } from 'drizzle-orm';

const PAGE_SIZE = 50; // Microsoft Graph API default

export class SharePointAdapter extends BaseIntegration implements IIntegration {
  private client: SharePointClient;
  private readonly orgId: string;

  constructor(orgId: string, config: Record<string, unknown>) {
    super(IntegrationType.DOCUMENT_MANAGEMENT, IntegrationProvider.SHAREPOINT, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: true,
      supportsRealTime: false,
      supportedEntities: ['sites', 'libraries', 'files', 'permissions'],
      requiresOAuth: false,
      rateLimitPerMinute: 2000,
    });
    this.orgId = orgId;

    this.client = new SharePointClient({
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      tenantId: config.organizationId as string,
      siteUrl: config.siteUrl as string | undefined,
      apiUrl: config.apiUrl as string | undefined,
    });
  }

  async connect(): Promise<void> {
    const health = await this.client.healthCheck();
    if (health.status !== 'ok') {
      throw new Error(`Failed to connect to SharePoint: ${health.message}`);
    }
    this.logOperation('connect', { message: 'Successfully connected to SharePoint API' });
  }

  async disconnect(): Promise<void> {
    this.logOperation('disconnect', { message: 'SharePoint integration disconnected' });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result = await this.client.healthCheck();
    return {
      healthy: result.status === 'ok',
      status: result.status === 'ok' ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR,
      latencyMs: Date.now() - startTime,
      lastError: result.status !== 'ok' ? result.message : undefined,
      lastCheckedAt: new Date(),
    };
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    await this.ensureConnected();

    const orgs = options.orgs || ['sites', 'libraries', 'files', 'permissions'];
    const results: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      cursor: options.cursor,
    };

    try {
      // Sites and libraries are required for files
      if (orgs.includes('sites') || orgs.includes('libraries') || orgs.includes('files')) {
        await this.syncSitesAndLibraries(options, results);
      }

      if (orgs.includes('files')) {
        await this.syncFiles(options, results);
      }

      if (orgs.includes('permissions')) {
        await this.syncPermissions(options, results);
      }

      this.logOperation('sync', {
        message: 'SharePoint sync completed',
        processed: results.recordsProcessed,
        created: results.recordsCreated,
        updated: results.recordsUpdated,
      });
    } catch (error) {
      results.success = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results.errors = [{ entity: 'sync', error: error instanceof Error ? error.message : String(error) }] as any;
      this.logError('sync', error instanceof Error ? error : new Error(String(error)));
    }

    return results;
  }

  /**
   * Sync sites and their libraries
   */
  private async syncSitesAndLibraries(options: SyncOptions, results: SyncResult): Promise<void> {
    let nextLink: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getSites({
        skipToken: nextLink,
        top: PAGE_SIZE,
      });

      for (const site of response.sites) {
        try {
          // Sync the site
          await db
            .insert(externalDocumentSites)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.SHAREPOINT,
              externalId: site.id,
              siteName: site.displayName,
              siteUrl: site.webUrl,
              description: site.description,
              createdAt: new Date(site.createdDateTime),
              lastModifiedAt: new Date(site.lastModifiedDateTime),
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalDocumentSites.orgId,
                externalDocumentSites.externalProvider,
                externalDocumentSites.externalId,
              ],
              set: {
                siteName: site.displayName,
                description: site.description,
                lastModifiedAt: new Date(site.lastModifiedDateTime),
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;

          // Now sync libraries for this site
          await this.syncSiteLibraries(site.id, results);
        } catch (error) {
          this.logError('syncSites', error instanceof Error ? error : new Error(String(error)), { siteId: site.id });
          results.recordsFailed++;
        }
      }

      hasMore = !!response.nextLink;
      nextLink = response.nextLink;
    }
  }

  /**
   * Sync libraries for a specific site
   */
  private async syncSiteLibraries(siteId: string, results: SyncResult): Promise<void> {
    let nextLink: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.getLibraries(siteId, {
        skipToken: nextLink,
        top: PAGE_SIZE,
      });

      for (const library of response.libraries) {
        try {
          await db
            .insert(externalDocumentLibraries)
            .values({
              orgId: this.orgId,
              externalProvider: IntegrationProvider.SHAREPOINT,
              externalId: library.id,
              siteId,
              libraryName: library.name,
              libraryUrl: library.webUrl,
              description: library.description,
              driveType: library.driveType,
              createdAt: new Date(library.createdDateTime),
              createdBy: library.createdBy?.user?.displayName,
              lastSyncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                externalDocumentLibraries.orgId,
                externalDocumentLibraries.externalProvider,
                externalDocumentLibraries.externalId,
              ],
              set: {
                libraryName: library.name,
                description: library.description,
                lastSyncedAt: new Date(),
              },
            });

          results.recordsProcessed++;
        } catch (error) {
          this.logError('syncLibraries', error instanceof Error ? error : new Error(String(error)), { libraryId: library.id });
          results.recordsFailed++;
        }
      }

      hasMore = !!response.nextLink;
      nextLink = response.nextLink;
    }
  }

  /**
   * Sync files from all libraries
   */
  private async syncFiles(options: SyncOptions, results: SyncResult): Promise<void> {
    // Get all libraries
    const libraries = await db
      .select()
      .from(externalDocumentLibraries)
      .where(
        and(
          eq(externalDocumentLibraries.orgId, this.orgId),
          eq(externalDocumentLibraries.externalProvider, IntegrationProvider.SHAREPOINT)
        )
      );

    // Build filter for incremental sync
    const filter = options.cursor
      ? `lastModifiedDateTime gt ${new Date(options.cursor).toISOString()}`
      : undefined;

    for (const library of libraries) {
      let nextLink: string | undefined;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.client.getFiles(library.externalId, {
            skipToken: nextLink,
            top: PAGE_SIZE,
            filter,
          });

          for (const file of response.files) {
            try {
              const isFolder = !!file.folder;

              await db
                .insert(externalDocumentFiles)
                .values({
                  orgId: this.orgId,
                  externalProvider: IntegrationProvider.SHAREPOINT,
                  externalId: file.id,
                  libraryId: library.id,
                  fileName: file.name,
                  fileUrl: file.webUrl,
                  fileSize: file.size,
                  mimeType: file.file?.mimeType,
                  isFolder,
                  folderChildCount: file.folder?.childCount,
                  createdAt: new Date(file.createdDateTime),
                  createdBy: file.createdBy?.user?.displayName,
                  createdByEmail: file.createdBy?.user?.email,
                  lastModifiedAt: new Date(file.lastModifiedDateTime),
                  lastModifiedBy: file.lastModifiedBy?.user?.displayName,
                  parentPath: file.parentReference?.path,
                  lastSyncedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [
                    externalDocumentFiles.orgId,
                    externalDocumentFiles.externalProvider,
                    externalDocumentFiles.externalId,
                  ],
                  set: {
                    fileName: file.name,
                    fileSize: file.size,
                    folderChildCount: file.folder?.childCount,
                    lastModifiedAt: new Date(file.lastModifiedDateTime),
                    lastModifiedBy: file.lastModifiedBy?.user?.displayName,
                    lastSyncedAt: new Date(),
                  },
                });

              results.recordsProcessed++;
            } catch (error) {
              this.logError('syncFiles', error instanceof Error ? error : new Error(String(error)), { fileId: file.id });
              results.recordsFailed++;
            }
          }

          hasMore = !!response.nextLink;
          nextLink = response.nextLink;
        } catch (error) {
          this.logError('syncFiles', error instanceof Error ? error : new Error(String(error)), { libraryId: library.externalId });
          break;
        }
      }
    }
  }

  /**
   * Sync permissions for files
   */
  private async syncPermissions(options: SyncOptions, results: SyncResult): Promise<void> {
    // Get all files
    const files = await db
      .select()
      .from(externalDocumentFiles)
      .where(
        and(
          eq(externalDocumentFiles.orgId, this.orgId),
          eq(externalDocumentFiles.externalProvider, IntegrationProvider.SHAREPOINT)
        )
      );

    for (const file of files) {
      // Get library to find driveId
      const library = await db
        .select()
        .from(externalDocumentLibraries)
        .where(eq(externalDocumentLibraries.id, file.libraryId!))
        .limit(1);

      if (library.length === 0) continue;

      let nextLink: string | undefined;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.client.getFilePermissions(
            library[0].externalId,
            file.externalId,
            {
              skipToken: nextLink,
              top: PAGE_SIZE,
            }
          );

          for (const permission of response.permissions) {
            try {
              const grantedTo = permission.grantedToIdentitiesV2?.[0];
              const userId = grantedTo?.user?.id;
              const groupId = grantedTo?.group?.id;
              const displayName = grantedTo?.user?.displayName || grantedTo?.group?.displayName;

              await db
                .insert(externalDocumentPermissions)
                .values({
                  orgId: this.orgId,
                  externalProvider: IntegrationProvider.SHAREPOINT,
                  externalId: permission.id,
                  fileId: file.id,
                  userId,
                  groupId,
                  roles: permission.roles.join(','),
                  permissionType: permission.link?.type || 'direct',
                  scope: permission.link?.scope,
                  grantedTo: displayName,
                  lastSyncedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [
                    externalDocumentPermissions.orgId,
                    externalDocumentPermissions.externalProvider,
                    externalDocumentPermissions.externalId,
                  ],
                  set: {
                    roles: permission.roles.join(','),
                    lastSyncedAt: new Date(),
                  },
                });

              results.recordsProcessed++;
            } catch (error) {
              this.logError('syncPermissions', error instanceof Error ? error : new Error(String(error)), { permissionId: permission.id });
              results.recordsFailed++;
            }
          }

          hasMore = !!response.nextLink;
          nextLink = response.nextLink;
        } catch (error) {
          this.logError('syncPermissions', error instanceof Error ? error : new Error(String(error)), { fileId: file.externalId });
          break;
        }
      }
    }
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<boolean> {
    return false;
  }

  async processWebhook(_event: WebhookEvent): Promise<void> {
    this.logOperation('webhook', { message: 'SharePoint webhooks not implemented' });
  }
}
