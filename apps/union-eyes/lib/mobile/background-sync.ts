/**
 * Background Sync Library
 * 
 * Provides background synchronization capabilities for offline-first mobile functionality
 * Uses the Background Sync API when available, with fallback to periodic sync
 */

import { logger } from '@/lib/logger';
import { syncQueue } from './offline-storage';

// Sync configuration
export interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  syncInterval: number;
}

const DEFAULT_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelay: 5000,
  batchSize: 10,
  syncInterval: 5 * 60 * 1000, // 5 minutes
};

/**
 * Background Sync Manager
 */
export class BackgroundSyncManager {
  private config: SyncConfig;
  private isProcessing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize background sync
   */
  async init(): Promise<void> {
    if (!this.isSupported()) {
      logger.warn('Background sync not supported, using fallback');
      this.startPeriodicSync();
      return;
    }

    // Register for background sync
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (registration as any).sync.register('sync-all');
        logger.info('Background sync registered');
      }
    } catch (error) {
      logger.error('Failed to register background sync', { error });
      this.startPeriodicSync();
    }
  }

  /**
   * Check if Background Sync API is supported
   */
  isSupported(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return 'serviceWorker' in navigator && 'sync' in ((navigator.serviceWorker as any)?.registration || {});
  }

  /**
   * Queue an item for background sync
   */
  async queueForSync(operation: SyncOperation): Promise<void> {
    await syncQueue.add(operation);
    
    // Try to trigger immediate sync if supported
    if (this.isSupported()) {
      try {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (registration as any).sync.register(`sync-${operation.entity}`);
        }
      } catch (error) {
        logger.warn('Failed to trigger background sync', { error });
      }
    }
  }

  /**
   * Process all pending sync operations
   */
  async processPendingSync(): Promise<SyncResult> {
    if (this.isProcessing) {
      return { success: false, processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    const result: SyncResult = { success: true, processed: 0, failed: 0 };

    try {
      const pending = await syncQueue.getPending();
      logger.info('Processing pending sync operations', { count: pending.length });

      for (const operation of pending) {
        try {
          await this.processOperation(operation);
          await syncQueue.complete(operation.id!);
          result.processed++;
        } catch (error) {
          logger.error('Sync operation failed', { operation, error });
          
          if (operation.retryCount >= this.config.maxRetries) {
            // Move to failed queue after max retries
            await syncQueue.fail(operation.id!, (error as Error).message);
          } else {
            await syncQueue.fail(operation.id!, (error as Error).message);
          }
          result.failed++;
        }
      }
    } catch (error) {
      logger.error('Background sync failed', { error });
      result.success = false;
    } finally {
      this.isProcessing = false;
    }

    return result;
  }

  /**
   * Process a single sync operation
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    const endpoint = this.getEndpoint(operation.entity);
    
    const options: RequestInit = {
      method: this.getMethod(operation.type),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (operation.type !== 'delete') {
      options.body = JSON.stringify(operation.data);
    }

    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }

  /**
   * Get API endpoint for entity
   */
  private getEndpoint(entity: string): string {
    const endpoints: Record<string, string> = {
      claim: '/api/claims',
      member: '/api/members',
      message: '/api/messages',
      document: '/api/documents',
    };
    return endpoints[entity] || `/api/${entity}`;
  }

  /**
   * Get HTTP method for operation type
   */
  private getMethod(type: string): string {
    const methods: Record<string, string> = {
      create: 'POST',
      update: 'PATCH',
      delete: 'DELETE',
    };
    return methods[type] || 'POST';
  }

  /**
   * Start periodic sync as fallback
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      logger.info('Running periodic sync');
      await this.processPendingSync();
    }, this.config.syncInterval);

    // Run initial sync
    this.processPendingSync();
  }

  /**
   * Stop periodic sync
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const pending = await syncQueue.getPending();
    
    return {
      isSupported: this.isSupported(),
      isProcessing: this.isProcessing,
      pendingCount: pending.length,
      lastSync: await this.getLastSyncTime(),
    };
  }

  /**
   * Get last sync time from localStorage
   */
  private async getLastSyncTime(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('lastSyncTime');
  }
}

/**
 * Sync operation interface
 */
interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  entity: 'claim' | 'member' | 'message' | 'document';
  data: Record<string, unknown>;
  entityId: string;
}

interface QueuedOperation extends SyncOperation {
  id?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  createdAt: string;
  lastAttemptAt: string | null;
  error?: string;
}

/**
 * Sync result interface
 */
export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
}

/**
 * Sync status interface
 */
export interface SyncStatus {
  isSupported: boolean;
  isProcessing: boolean;
  pendingCount: number;
  lastSync: string | null;
}

/**
 * Factory function to create background sync manager
 */
export function createBackgroundSyncManager(config?: Partial<SyncConfig>): BackgroundSyncManager {
  return new BackgroundSyncManager(config);
}

// Export singleton instance
export const backgroundSync = new BackgroundSyncManager();
