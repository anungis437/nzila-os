/**
 * Integration Framework - Main Export
 * 
 * Central export for all integration framework components
 * 
 * Usage Example:
 * ```typescript
 * import { 
 *   IntegrationFactory, 
 *   IntegrationProvider, 
 *   IntegrationType,
 *   executeFullSync,
 *   processWebhook 
 * } from '@/lib/integrations';
 * 
 * // Get an integration
 * const integration = await IntegrationFactory.getInstance()
 *   .getIntegration(orgId, IntegrationProvider.WORKDAY);
 * 
 * // Execute sync
 * const result = await executeFullSync(
 *   orgId, 
 *   IntegrationProvider.WORKDAY, 
 *   ['employees', 'departments']
 * );
 * 
 * // Process webhook
 * await processWebhook(orgId, provider, payload, signature);
 * ```
 */

// Types and interfaces
export * from './types';

// Base integration
export { BaseIntegration, needsTokenRefresh, createHealthCheckResult, createSyncResult } from './base-integration';

// Registry
export { IntegrationRegistry } from './registry';
export type { IntegrationMetadata, IntegrationHealth } from './registry';

// Factory
export { IntegrationFactory, getIntegration, getIntegrations } from './factory';

// Webhook Router
export { WebhookRouter, processWebhook } from './webhook-router';
export type { WebhookRouterConfig } from './webhook-router';

// Sync Engine
export { 
  SyncEngine, 
  executeFullSync, 
  executeIncrementalSync, 
  getSyncHistory 
} from './sync-engine';
export type { SyncJobConfig } from './sync-engine';

/**
 * Initialize the integration framework
 * Call this once at application startup
 */
export async function initializeIntegrationFramework(): Promise<void> {
  // Initialize registry
  const _registry = IntegrationRegistry.getInstance();
  
  // Initialize factory
  const _factory = IntegrationFactory.getInstance();
  
  // Initialize webhook router
  const _webhookRouter = WebhookRouter.getInstance();
  
  // Initialize sync engine
  const _syncEngine = SyncEngine.getInstance();
  
  logger.info('Integration framework initialized');
}
