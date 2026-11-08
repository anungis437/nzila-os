/**
 * Base Integration Abstract Class
 * Provides common functionality for all integration adapters
 */

import { logger } from '@/lib/logger';
import {
  IIntegration,
  IntegrationType,
  IntegrationProvider,
  IntegrationConfig,
  IntegrationCapabilities,
  SyncOptions,
  SyncResult,
  SyncError,
  HealthCheckResult,
  WebhookEvent,
  ConnectionStatus,
  IntegrationError,
} from './types';

/**
 * Abstract base class that all integrations extend
 */
export abstract class BaseIntegration implements IIntegration {
  protected config?: IntegrationConfig;
  protected initialized = false;
  protected connected = false;

  constructor(
    public readonly type: IntegrationType,
    public readonly provider: IntegrationProvider,
    public readonly capabilities: IntegrationCapabilities
  ) {}

  /**
   * Initialize the integration with configuration
   */
  async initialize(config: IntegrationConfig): Promise<void> {
    this.validateConfig(config);
    this.config = config;
    this.initialized = true;
    
    this.logOperation('initialize', {
      organizationId: config.organizationId,
      enabled: config.enabled,
    });
  }

  /**
   * Ensure integration is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new IntegrationError(
        `Integration ${this.provider} not initialized`,
        this.provider,
        'NOT_INITIALIZED'
      );
    }
  }

  /**
   * Ensure integration is connected
   */
  protected ensureConnected(): void {
    this.ensureInitialized();
    if (!this.connected) {
      throw new IntegrationError(
        `Integration ${this.provider} not connected`,
        this.provider,
        'NOT_CONNECTED'
      );
    }
  }

  /**
   * Cooperative cancellation check for a long-running sync(). Call this between external calls - batches, pages,
   * or entity types - in a sync() implementation. Throws once SyncEngine has signalled that it can no longer
   * confirm exclusive ownership of this job's distributed lock (a lease-renewal failure), so the sync stops making
   * further external calls instead of continuing unsupervised. A sync() that never calls this is unaffected - the
   * signal is opt-in per adapter, not a change to any adapter that does not check it.
   */
  protected throwIfAborted(options: SyncOptions): void {
    if (options.abortSignal?.aborted) {
      throw new IntegrationError(
        'Sync aborted: lease on the distributed job lock was lost or could not be renewed',
        this.provider,
        'SYNC_LEASE_LOST'
      );
    }
  }

  /**
   * Validate configuration
   */
  protected validateConfig(config: IntegrationConfig): void {
    if (!config.organizationId) {
      throw new IntegrationError(
        'Organization ID is required',
        this.provider,
        'INVALID_CONFIG'
      );
    }

    if (this.capabilities.requiresOAuth) {
      if (!config.credentials.clientId || !config.credentials.clientSecret) {
        throw new IntegrationError(
          'OAuth credentials required',
          this.provider,
          'INVALID_CONFIG'
        );
      }
    } else if (!config.credentials.apiKey) {
      throw new IntegrationError(
        'API key required',
        this.provider,
        'INVALID_CONFIG'
      );
    }
  }

  /**
   * Log operation
   */
  protected logOperation(operation: string, details?: Record<string, unknown>): void {
    logger.info(`Integration operation: ${operation}`, {
      type: this.type,
      provider: this.provider,
      ...details,
    });
  }

  /**
   * Log error
   */
  protected logError(operation: string, error: Error, details?: Record<string, unknown>): void {
    logger.error(`Integration error: ${operation}`, error, {
      type: this.type,
      provider: this.provider,
      ...details,
    });
  }

  /**
   * Abstract methods that must be implemented by each integration
   */
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract healthCheck(): Promise<HealthCheckResult>;
  abstract sync(options: SyncOptions): Promise<SyncResult>;
  abstract verifyWebhook(payload: string, signature: string): Promise<boolean>;
  abstract processWebhook(event: WebhookEvent): Promise<void>;

  /**
   * Optional refresh authentication
   */
  async refreshAuth?(): Promise<void>;
}

/**
 * Helper to check if credentials need refresh
 */
export function needsTokenRefresh(config: IntegrationConfig): boolean {
  if (!config.credentials.expiresAt) {
    return false;
  }
  
  // Refresh if expires within 5 minutes
  const bufferMs = 5 * 60 * 1000;
  return new Date(config.credentials.expiresAt).getTime() - Date.now() < bufferMs;
}

/**
 * Helper to create standard health check result
 */
export function createHealthCheckResult(
  healthy: boolean,
  status: ConnectionStatus,
  options?: {
    latencyMs?: number;
    rateLimitRemaining?: number;
    lastError?: string;
  }
): HealthCheckResult {
  return {
    healthy,
    status,
    latencyMs: options?.latencyMs,
    rateLimitRemaining: options?.rateLimitRemaining,
    lastError: options?.lastError,
    lastCheckedAt: new Date(),
  };
}

/**
 * Helper to create standard sync result
 */
export function createSyncResult(
  success: boolean,
  recordsProcessed: number,
  options?: {
    recordsCreated?: number;
    recordsUpdated?: number;
    recordsFailed?: number;
    errors?: SyncError[];
    cursor?: string;
    nextSyncAt?: Date;
  }
): SyncResult {
  return {
    success,
    recordsProcessed,
    recordsCreated: options?.recordsCreated || 0,
    recordsUpdated: options?.recordsUpdated || 0,
    recordsFailed: options?.recordsFailed || 0,
    errors: options?.errors,
    cursor: options?.cursor,
    nextSyncAt: options?.nextSyncAt,
  };
}
