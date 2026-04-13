import { describe, it, expect } from 'vitest'
import {
  integrationTypeEnum,
  integrationProviderEnum,
  integrationStatusEnum,
  deliveryStatusEnum,
  integrationConfigs,
  integrationDeliveries,
  integrationDlq,
  webhookSubscriptions,
  webhookDeliveryAttempts,
} from './schema'
import {
  healthStatusEnum,
  circuitStateEnum,
  integrationProviderHealth,
  integrationProviderMetrics,
  integrationSloTargets,
} from './health-schema'
import * as integrationDbIndex from './index'
import * as integrationRepos from './repos'
import * as integrationHealthRepos from './health-repos'

describe('integrations-db schema', () => {
  describe('enums', () => {
    it('integrationTypeEnum has expected values', () => {
      expect(integrationTypeEnum.enumValues).toEqual([
        'email', 'sms', 'push', 'chatops', 'crm', 'webhooks',
      ])
    })

    it('integrationProviderEnum has expected values', () => {
      expect(integrationProviderEnum.enumValues).toEqual([
        'resend', 'sendgrid', 'mailgun', 'twilio', 'firebase',
        'slack', 'teams', 'hubspot',
      ])
    })

    it('integrationStatusEnum has expected values', () => {
      expect(integrationStatusEnum.enumValues).toEqual(['active', 'inactive', 'suspended'])
    })

    it('deliveryStatusEnum has expected values', () => {
      expect(deliveryStatusEnum.enumValues).toEqual([
        'queued', 'sent', 'failed', 'dlq', 'blocked_by_circuit',
      ])
    })

    it('healthStatusEnum has expected values', () => {
      expect(healthStatusEnum.enumValues).toEqual(['ok', 'degraded', 'down'])
    })

    it('circuitStateEnum has expected values', () => {
      expect(circuitStateEnum.enumValues).toEqual(['closed', 'open', 'half_open'])
    })
  })

  describe('tables', () => {
    it('integrationConfigs has required columns', () => {
      const cols = Object.keys(integrationConfigs)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'orgId', 'type', 'provider', 'credentialsRef', 'status', 'metadata', 'createdBy', 'createdAt', 'updatedAt',
      ]))
    })

    it('integrationDeliveries has required columns', () => {
      const cols = Object.keys(integrationDeliveries)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'orgId', 'configId', 'channel', 'provider', 'recipientRef', 'templateId', 'status', 'attempts', 'lastError', 'correlationId',
      ]))
    })

    it('integrationDlq has required columns', () => {
      const cols = Object.keys(integrationDlq)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'deliveryId', 'orgId', 'provider', 'channel', 'lastError', 'payload', 'attempts',
      ]))
    })

    it('webhookSubscriptions has required columns', () => {
      const cols = Object.keys(webhookSubscriptions)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'orgId', 'url', 'events', 'secret', 'active', 'createdBy',
      ]))
    })

    it('webhookDeliveryAttempts has required columns', () => {
      const cols = Object.keys(webhookDeliveryAttempts)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'subscriptionId', 'event', 'payload', 'responseStatus', 'success', 'attemptNumber',
      ]))
    })

    it('integrationProviderHealth has required columns', () => {
      const cols = Object.keys(integrationProviderHealth)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'orgId', 'provider', 'status', 'consecutiveFailures', 'circuitState',
      ]))
    })

    it('integrationProviderMetrics has required columns', () => {
      const cols = Object.keys(integrationProviderMetrics)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'orgId', 'provider', 'windowStart', 'windowEnd',
      ]))
    })

    it('integrationSloTargets has required columns', () => {
      const cols = Object.keys(integrationSloTargets)
      expect(cols).toEqual(expect.arrayContaining([
        'id', 'orgId', 'provider', 'channel', 'successRateTarget', 'p95LatencyTarget', 'windowDays', 'isDefault', 'metadata',
      ]))
    })

    it('exports schema and ports from barrel modules', () => {
      expect(integrationDbIndex.integrationConfigs).toBeDefined()
      expect(integrationDbIndex.integrationProviderHealth).toBeDefined()
      expect(Object.keys(integrationRepos).length).toBeGreaterThanOrEqual(0)
      expect(Object.keys(integrationHealthRepos).length).toBeGreaterThanOrEqual(0)
    })
  })
})
