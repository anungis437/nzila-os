/**
 * Integration Factory
 * Creates and manages integration adapter instances
 */

import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { integrationConfigs, integrationProviderEnum, integrationTypeEnum } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  IIntegration,
  IntegrationType,
  IntegrationProvider,
  IntegrationConfig,
  IntegrationCredentials,
  IntegrationError,
} from './types';
import { IntegrationRegistry } from './registry';
import { WorkdayAdapter } from './adapters/hris/workday-adapter';
import { BambooHRAdapter } from './adapters/hris/bamboohr-adapter';
import { ADPAdapter } from './adapters/hris/adp-adapter';
import { QuickBooksAdapter } from './adapters/accounting/quickbooks-adapter';
import { XeroAdapter } from './adapters/accounting/xero-adapter';
import { SageIntacctAdapter } from './adapters/accounting/sage-intacct-adapter';
import { FreshBooksAdapter } from './adapters/accounting/freshbooks-adapter';
import { WaveAdapter } from './adapters/accounting/wave-adapter';
import { SunLifeAdapter } from './adapters/insurance/sunlife-adapter';
import { ManulifeAdapter } from './adapters/insurance/manulife-adapter';
import { GreenShieldAdapter } from './adapters/insurance/greenshield-adapter';
import { CanadaLifeAdapter } from './adapters/insurance/canadalife-adapter';
import { IndustrialAllianceAdapter } from './adapters/insurance/ia-adapter';
import { SlackAdapter } from './adapters/communication/slack-adapter';
import { TeamsAdapter } from './adapters/communication/teams-adapter';
import { LinkedInLearningAdapter } from './adapters/lms/linkedin-learning-adapter';
import { SharePointAdapter } from './adapters/documents/sharepoint-adapter';

/**
 * Integration Factory
 * Singleton that creates and caches integration instances
 */
export class IntegrationFactory {
  private static instance: IntegrationFactory;
  private instances: Map<string, IIntegration> = new Map();
  private registry: IntegrationRegistry;

  private constructor() {
    this.registry = IntegrationRegistry.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): IntegrationFactory {
    if (!IntegrationFactory.instance) {
      IntegrationFactory.instance = new IntegrationFactory();
    }
    return IntegrationFactory.instance;
  }

  /**
   * Get or create an integration instance
   */
  async getIntegration(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<IIntegration> {
    const cacheKey = `${organizationId}:${provider}`;
    
    // Return cached instance if available
    let instance = this.instances.get(cacheKey);
    if (instance) {
      return instance;
    }

    // Check if provider is available
    if (!this.registry.isAvailable(provider)) {
      throw new IntegrationError(
        `Integration provider ${provider} is not available`,
        provider,
        'PROVIDER_UNAVAILABLE'
      );
    }

    // Check environment variables
    const envCheck = this.registry.checkEnvironmentVars(provider);
    if (!envCheck.available) {
      throw new IntegrationError(
        `Missing required environment variables: ${envCheck.missing.join(', ')}`,
        provider,
        'MISSING_ENV_VARS'
      );
    }

    // Load configuration from database
    const config = await this.loadConfig(organizationId, provider);
    if (!config) {
      throw new IntegrationError(
        `No configuration found for ${provider} in organization ${organizationId}`,
        provider,
        'CONFIG_NOT_FOUND'
      );
    }

    if (!config.enabled) {
      throw new IntegrationError(
        `Integration ${provider} is disabled`,
        provider,
        'INTEGRATION_DISABLED'
      );
    }

    // Create new instance
    instance = this.createInstance(provider, organizationId, config);
    await instance.initialize(config);

    // Cache instance
    this.instances.set(cacheKey, instance);

    logger.info('Integration instance created', {
      organizationId,
      provider,
    });

    return instance;
  }

  /**
   * Get all integrations for an organization
   */
  async getIntegrations(
    organizationId: string,
    type?: IntegrationType
  ): Promise<IIntegration[]> {
    const configs = await this.loadAllConfigs(organizationId, type);
    const instances: IIntegration[] = [];

    for (const config of configs) {
      if (!config.enabled) continue;

      try {
        const instance = await this.getIntegration(organizationId, config.provider);
        instances.push(instance);
      } catch (error) {
        logger.error('Failed to load integration', error instanceof Error ? error : new Error(String(error)), {
          organizationId,
          provider: config.provider,
        });
      }
    }

    return instances;
  }

  /**
   * Clear cached instance
   */
  clearCache(organizationId: string, provider: IntegrationProvider): void {
    const cacheKey = `${organizationId}:${provider}`;
    this.instances.delete(cacheKey);
  }

  /**
   * Clear all cached instances
   */
  clearAllCache(): void {
    this.instances.clear();
  }

  /**
   * Create integration instance based on provider
   */
  private createInstance(provider: IntegrationProvider, organizationId: string = '', config?: IntegrationConfig): IIntegration {
    // This will be implemented as we add each adapter
    // For now, throw an error indicating the adapter needs to be implemented
    
    switch (provider) {
      // HRIS
      case IntegrationProvider.WORKDAY:
        return new WorkdayAdapter();
      
      case IntegrationProvider.BAMBOOHR:
        return new BambooHRAdapter();
      
      case IntegrationProvider.ADP:
        return new ADPAdapter();

      // Accounting
      case IntegrationProvider.QUICKBOOKS:
        return new QuickBooksAdapter();
      
      case IntegrationProvider.XERO:
        return new XeroAdapter();
      
      case IntegrationProvider.SAGE_INTACCT:
        return new SageIntacctAdapter();
      
      case IntegrationProvider.FRESHBOOKS:
        return new FreshBooksAdapter();
      
      case IntegrationProvider.WAVE:
        return new WaveAdapter();

      // Insurance
      case IntegrationProvider.SUNLIFE:
        return new SunLifeAdapter();
      
      case IntegrationProvider.SUN_LIFE:
        return new SunLifeAdapter();
      
      case IntegrationProvider.MANULIFE:
        return new ManulifeAdapter();
      
      case IntegrationProvider.GREEN_SHIELD:
        return new GreenShieldAdapter();
      
      case IntegrationProvider.GREEN_SHIELD_CANADA:
        return new GreenShieldAdapter();
      
      case IntegrationProvider.CANADA_LIFE:
        return new CanadaLifeAdapter();
      
      case IntegrationProvider.INDUSTRIAL_ALLIANCE:
        return new IndustrialAllianceAdapter();

      // Pension
      case IntegrationProvider.OTPP:
        // return new OTPPAdapter();
        throw new IntegrationError(
          'OTPP adapter not yet implemented',
          provider,
          'NOT_IMPLEMENTED'
        );

      // LMS
      case IntegrationProvider.LINKEDIN_LEARNING:
        return new LinkedInLearningAdapter(organizationId, { ...config?.credentials, ...config?.settings } as Record<string, unknown>);

      // Communication
      case IntegrationProvider.SLACK:
        return new SlackAdapter(organizationId, { ...config?.credentials, ...config?.settings } as Record<string, unknown>);
      
      case IntegrationProvider.MICROSOFT_TEAMS:
        return new TeamsAdapter(organizationId, { ...config?.credentials, ...config?.settings } as Record<string, unknown>);

      // Document Management
      case IntegrationProvider.SHAREPOINT:
        return new SharePointAdapter(organizationId, { ...config?.credentials, ...config?.settings } as Record<string, unknown>);

      default:
        throw new IntegrationError(
          `Unknown provider: ${provider}`,
          provider,
          'UNKNOWN_PROVIDER'
        );
    }
  }

  /**
   * Load configuration from database
   */
  private async loadConfig(
    organizationId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationConfig | null> {
    const [config] = await db
      .select()
      .from(integrationConfigs)
      .where(
        and(
          eq(integrationConfigs.organizationId, organizationId),
          eq(integrationConfigs.provider, provider as (typeof integrationProviderEnum.enumValues)[number])
        )
      )
      .limit(1);

    if (!config) {
      return null;
    }

    const metadata = this.registry.getMetadata(provider);
    if (!metadata) {
      return null;
    }

    return {
      organizationId: config.organizationId,
      type: metadata.type,
      provider,
      credentials: config.credentials as IntegrationCredentials,
      settings: config.settings as Record<string, unknown> | undefined,
      webhookUrl: config.webhookUrl || undefined,
      enabled: config.enabled ?? false,
    };
  }

  /**
   * Load all configurations for an organization
   */
  private async loadAllConfigs(
    organizationId: string,
    type?: IntegrationType
  ): Promise<IntegrationConfig[]> {
    const conditions = [eq(integrationConfigs.organizationId, organizationId)];
    
    if (type) {
      conditions.push(eq(integrationConfigs.type, type as (typeof integrationTypeEnum.enumValues)[number]));
    }

    const configs = await db
      .select()
      .from(integrationConfigs)
      .where(and(...conditions));

    return configs.map(config => {
      const _metadata = this.registry.getMetadata(config.provider as IntegrationProvider);
      return {
        organizationId: config.organizationId,
        type: config.type as IntegrationType,
        provider: config.provider as IntegrationProvider,
        credentials: config.credentials as IntegrationCredentials,
        settings: config.settings as Record<string, unknown> | undefined,
        webhookUrl: config.webhookUrl || undefined,
        enabled: config.enabled ?? false,
      };
    });
  }
}

/**
 * Convenience function to get an integration
 */
export async function getIntegration(
  organizationId: string,
  provider: IntegrationProvider
): Promise<IIntegration> {
  const factory = IntegrationFactory.getInstance();
  return factory.getIntegration(organizationId, provider);
}

/**
 * Convenience function to get all integrations
 */
export async function getIntegrations(
  organizationId: string,
  type?: IntegrationType
): Promise<IIntegration[]> {
  const factory = IntegrationFactory.getInstance();
  return factory.getIntegrations(organizationId, type);
}
